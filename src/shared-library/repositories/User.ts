import { FcmDeviceToken, UserId, UserInterface, UserModel } from '../models/User';
import { logger } from '../utils/CommonLogger';

export default class UserRepository {
  static readonly SCHEMA_VERSION = 4;

  async findByOrgIdEmailId(organisationId: string, emailId: string): Promise<UserInterface | null> {
    return await this.upgradeAndSave(await UserModel.findById(UserId.build(organisationId, emailId)));
  }

  async findUser(user: UserInterface): Promise<UserInterface | null> {
    return await this.upgradeAndSave(await UserModel.findById(user._id));
  }

  public async countUsersByOrgId(organisationId: string): Promise<number> {
    return UserModel.countDocuments({
      _id: { $regex: `^${organisationId}::` },
    });
  }

  private static userLocks: { [key: string]: boolean } = {};
  public async upsert(user: UserInterface): Promise<UserInterface | null> {
    if (!UserRepository.userLocks[user._id]) {
      UserRepository.userLocks[user._id] = true;

      try {
        const userFromDb = await this.findUser(user);

        logger.info('user from db', userFromDb);

        if (!userFromDb) {
          logger.info('User not found in db');

          return await UserModel.create(this.upgrade(user));
        }

        if (
          JSON.stringify(userFromDb.name) !== JSON.stringify(user.name) ||
          userFromDb.last_notified_at !== user.last_notified_at ||
          userFromDb.phone_number !== user.phone_number ||
          JSON.stringify(userFromDb.exclude_channels) !== JSON.stringify(user.exclude_channels) ||
          userFromDb.external_user_id !== user.external_user_id ||
          userFromDb.telegram_chat_id !== user.telegram_chat_id
        ) {
          await UserModel.updateOne(
            { _id: userFromDb._id },
            {
              $set: {
                'name.first': user.name?.first,
                'name.last': user.name?.last,
                last_notified_at: user.last_notified_at,
                phone_number: user.phone_number,
                exclude_channels: user.exclude_channels,
                updated_at: new Date(),
                external_user_id: user.external_user_id,
                last_updated_by: 'notification-engine',
                ...(user.telegram_chat_id !== undefined && { telegram_chat_id: user.telegram_chat_id }),
              },
            },
          );

          logger.info('User updated');
        } else {
          logger.info('User need not to be updated');
        }

        logger.info('Final user being returned', userFromDb);

        return userFromDb;
      } finally {
        UserRepository.userLocks[user._id] = false;
      }
    } else {
      logger.info('Another upsert operation is already in progress for this user');
      const existingUser = await this.findUser(user);
      if (existingUser) {
        return existingUser;
      }

      return null;
    }
  }

  public async retryFetchingUserId(user: UserInterface, retries = 5): Promise<UserInterface | null> {
    for (let retryAttempt = 0; retryAttempt < retries; retryAttempt++) {
      logger.info(`Retrying fetching user_id (${retryAttempt + 1}/${retries}) time(s)`);
      const userFound = await this.findUser(user);
      if (userFound) return userFound;
      await new Promise((resolve) => setTimeout(resolve, 50 * Math.pow(2, retryAttempt)));
    }

    return null;
  }

  private setLatestSchemaVersion(user: UserInterface): UserInterface {
    user.schema_version = UserRepository.SCHEMA_VERSION;

    return user;
  }

  private upgrade(user: UserInterface): UserInterface {
    // add upgrade logic

    return this.setLatestSchemaVersion(user);
  }

  private async upgradeAndSave(dbObject: any): Promise<UserInterface | null> {
    if (!dbObject) return dbObject;

    const isOlderSchema =
      dbObject.schema_version === undefined ||
      dbObject.schema_version === null ||
      dbObject.schema_version !== UserRepository.SCHEMA_VERSION;

    if (isOlderSchema) {
      dbObject = this.upgrade(dbObject);

      return UserModel.findOneAndUpdate({ _id: dbObject._id }, dbObject, { upsert: true, new: true });
    }

    return dbObject;
  }

  public async migrate() {
    const filter = {
      $or: [{ schema_version: { $exists: false } }, { schema_version: { $ne: UserRepository.SCHEMA_VERSION } }],
    };
    const limit = 25;
    let modifiedCount = 0;
    let usersToUpgrade;

    do {
      usersToUpgrade = await UserModel.find(filter).limit(limit);

      const upgradedUsers: UserInterface[] = [];

      for (const userToUpgrade of usersToUpgrade) {
        upgradedUsers.push(this.upgrade(userToUpgrade)!);
        modifiedCount++;
      }

      const bulkOperations = upgradedUsers.map((user) => ({
        updateOne: {
          filter: { _id: user._id },
          update: user,
          upsert: true,
        },
      }));
      await UserModel.bulkWrite(bulkOperations);
    } while (usersToUpgrade.length !== 0);

    return modifiedCount;
  }

  async updateFcmToken(
    organisationId: string,
    emailId: string,
    fcmToken: FcmDeviceToken,
  ): Promise<UserInterface | null> {
    const userId = UserId.build(organisationId, emailId);
    const result = await UserModel.findOneAndUpdate(
      { _id: userId },
      { $push: { fcm_device_tokens: fcmToken } },
      { new: true },
    );
    logger.info('Device Registered Successfully');

    return result;
  }

  async updateTelegramChatId(organisationId: string, phoneNumber: string, chatId: string): Promise<void> {
    const userId = UserId.build(organisationId, `${phoneNumber}@telegram`);
    await UserModel.updateOne(
      { _id: userId, phone_number: phoneNumber },
      { $set: { telegram_chat_id: chatId, updated_at: new Date() } },
    );
  }

  async getUserList(
    query: string,
    offset: number,
    limit: number,
    sortBy: string = 'updated_at',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<UserInterface[]> {
    const searchId = query;
    // Build sort object dynamically
    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const allFilteredUsers = await UserModel.find({
      _id: { $regex: `^${searchId}` },
    })
      .skip(offset!)
      .limit(limit!)
      .sort(sortObj);

    return allFilteredUsers;
  }
}
