import UserRepository from '../../shared-library/repositories/User';
import { inject, injectable } from 'tsyringe';
import { UserId, UserInterface } from '../../shared-library/models/User';
import { ServerLogger, logger } from '../utils/ServerLogger';
import { CreateDeviceTokenRequest } from '../types/request/CreateDeviceToken';
import { BadRequest } from '../utils/errors/BadRequest';
import { CreateUser } from '../types/request/CreateUser';
import { UserListViewModel } from '../types/response/UserListResponse';
import { randomUUID } from 'crypto';
import { parseCsvFile } from '../utils/csvParser';

@injectable()
export class UserService {
  private readonly logger = new ServerLogger();
  constructor(@inject(UserRepository) private userRepository: UserRepository) {}

  getUserByEmail(organisationId: string, emailId: string): Promise<UserInterface | null> {
    return this.userRepository.findByOrgIdEmailId(organisationId, emailId);
  }

  async registerDevice(organisationId: string, emailId: string, fcmTokenJson: CreateDeviceTokenRequest) {
    logger.traceStart({ organisationId, emailId, fcmTokenJson }, 'Registering device');
    const fcmObject = {
      token: fcmTokenJson.fcmToken,
    };
    const user = await this.userRepository.findByOrgIdEmailId(organisationId, emailId);
    if (!user) {
      const newUser = {
        _id: UserId.build(organisationId, emailId),
        user_id: randomUUID(),
        email: emailId,
        fcm_device_tokens: [fcmObject],
      };
      logger.trace({ organisationId, emailId, fcmTokenJson }, 'new user created along with fcm token');

      return await this.userRepository.upsert(newUser);
    }

    const existingToken = user?.fcm_device_tokens?.find((token) => token.token === fcmTokenJson.fcmToken);
    if (existingToken) {
      logger.info('Requested FCM token already exists for the user');

      return user;
    }
    const result = await this.userRepository.updateFcmToken(organisationId, emailId, fcmObject);
    logger.traceEnd({ organisationId, emailId, fcmTokenJson }, 'device regsistered successfully');

    return result;
  }

  public async createUser(organisationId: string, user: CreateUser) {
    if (!user.email) {
      throw new BadRequest('Email is required for creating a new user');
    }

    const dbUser: UserInterface = {
      ...user,
      _id: UserId.build(organisationId, user.email),
      user_id: randomUUID(),
      email: user.email,
      external_user_id: user.external_user_id,
    };

    try {
      return await this.userRepository.upsert(dbUser);
    } catch (error) {
      logger.error('Error while creating user', error);
      throw new BadRequest('Error while creating user');
    }
  }

  public async updateUser(organisationId: string, emailId: string, user: CreateUser) {
    if (!emailId) {
      throw new BadRequest('Email is required for updating user');
    }
    const dbUser: UserInterface = {
      ...user,
      _id: UserId.build(organisationId, emailId),
      user_id: randomUUID(),
      email: emailId,
      external_user_id: user.external_user_id,
    };
    try {
      return await this.userRepository.upsert(dbUser);
    } catch (error) {
      logger.error('Error while upserting user', error);
      throw new BadRequest('Error while upserting user');
    }
  }

  public async getUserList(
    organisationId: string,
    page: number,
    itemsPerPage: number,
    sortBy: string = 'updated_at',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<UserListViewModel | undefined> {
    this.logger.traceStart(
      {
        organisationId,
        page,
        itemsPerPage,
        sortBy,
        sortOrder,
      },
      'server > getUserList getting users',
    );

    const query = organisationId.toString();

    try {
      const totalUsers = await this.userRepository.countUsersByOrgId(organisationId);
      const userList = await this.userRepository.getUserList(
        query,
        page! * itemsPerPage!,
        itemsPerPage,
        sortBy,
        sortOrder,
      );

      const totalPages = Math.ceil(totalUsers / itemsPerPage);
      this.logger.trace('fetched user list: ', userList);

      return {
        userList,
        pagination: {
          currentPage: page!,
          itemsPerPage: itemsPerPage!,
          totalUsers: totalUsers,
          totalPages: totalPages,
        },
      };
    } catch {
      this.logger.traceEnd(
        {
          organisationId,
          page,
          itemsPerPage,
          sortBy,
          sortOrder,
        },
        'server > getUserList getting users',
      );
    }
  }

  public async createUsersFromCsv(filePath: string, organisationId: string): Promise<{ successCount: number }> {
    try {
      const users = await parseCsvFile(filePath);
      this.logger.info(`Parsed ${users.length} users from CSV file`);

      let successCount = 0;

      for (const user of users) {
        const createUser: CreateUser = {
          email: user.email,
          name: {
            first: user.firstName,
            last: user.lastName,
          },
          phone_number: user.phoneNumber,
          external_user_id: user.externalUserId,
          telegram_chat_id: user.telegramChatId,
        };

        try {
          await this.createUser(organisationId, createUser);
          this.logger.info(`User created: ${user.email}`);
          successCount++;
        } catch (error) {
          this.logger.error(`Failed to create user: ${user.email}`, error);
        }
      }

      return { successCount };
    } catch (error) {
      this.logger.error('Failed to process CSV file', error);
      throw new BadRequest('Error processing CSV file');
    }
  }
}
