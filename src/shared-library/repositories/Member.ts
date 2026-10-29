import { injectable } from 'tsyringe';
import { AddMemberInterface, MemberInterface, MemberModel } from '../models/Member';

@injectable()
export class MemberRepository {
  static readonly SCHEMA_VERSION = 1;

  async findMemberByEmailId(emailId: string): Promise<MemberInterface | null> {
    return await this.upgradeAndSave(await MemberModel.findOne({ email: emailId }));
  }

  public async addMember(member: AddMemberInterface): Promise<MemberInterface | null> {
    return await MemberModel.create(this.upgrade(member));
  }

  public async updateOrganisationIdByEmail(organisationId: string, email: string) {
    return await MemberModel.updateOne({ email }, { $addToSet: { organisation_id: organisationId } }).exec();
  }

  private setLatestSchemaVersion(user: MemberInterface): MemberInterface {
    user.schema_version = MemberRepository.SCHEMA_VERSION;

    return user;
  }

  private upgrade(user: MemberInterface): MemberInterface {
    // add upgrade logic

    return this.setLatestSchemaVersion(user);
  }

  private async upgradeAndSave(dbObject: any): Promise<MemberInterface | null> {
    if (!dbObject) return dbObject;

    const isOlderSchema =
      dbObject.schema_version === undefined ||
      dbObject.schema_version === null ||
      dbObject.schema_version !== MemberRepository.SCHEMA_VERSION;

    if (isOlderSchema) {
      dbObject = this.upgrade(dbObject);

      return MemberModel.findOneAndUpdate({ _id: dbObject._id }, dbObject, { upsert: true, new: true });
    }

    return dbObject;
  }

  public async migrate() {
    const filter = {
      $or: [{ schema_version: { $exists: false } }, { schema_version: { $ne: MemberRepository.SCHEMA_VERSION } }],
    };
    const limit = 25;
    let modifiedCount = 0;
    let usersToUpgrade;

    do {
      usersToUpgrade = await MemberModel.find(filter).limit(limit);

      const upgradedUsers: MemberInterface[] = [];

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
      await MemberModel.bulkWrite(bulkOperations);
    } while (usersToUpgrade.length !== 0);

    return modifiedCount;
  }
}
