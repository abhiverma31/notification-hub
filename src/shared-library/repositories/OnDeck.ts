import { OnDeckNotification, OnDeckNotificationModel } from '../models/OnDeck';
import { UserId } from '../models/User';

export class OnDeckRepository {
  static readonly SCHEMA_VERSION = 1;

  async create(notification: OnDeckNotification) {
    return OnDeckNotificationModel.create(this.upgrade(notification));
  }

  async get(
    organisationId: string,
    offset: number,
    limit: number,
    email: string,
    includeRead: boolean,
  ): Promise<OnDeckNotification[]> {
    return OnDeckNotificationModel.find(
      includeRead
        ? { recipient_id: UserId.build(organisationId, email), archived_at: undefined }
        : { recipient_id: UserId.build(organisationId, email), archived_at: undefined, read_at: undefined },
    )
      .sort({ source_creation_timestamp: 'desc' })
      .skip(offset)
      .limit(limit);
  }

  async updateReadStatus(organisationId: string, id: string, markRead: boolean) {
    return this.upgradeAndSave(
      await OnDeckNotificationModel.findByIdAndUpdate(id, { read_at: markRead ? Date.now() : null }),
    );
  }

  async readAllUnread(organisationId: string, email: string) {
    await OnDeckNotificationModel.updateMany(
      { recipient_id: UserId.build(organisationId, email), archived_at: undefined, read_at: undefined },
      { read_at: Date.now() },
    );
  }

  async viewAllNotifications(organisationId: string, email: string) {
    await OnDeckNotificationModel.updateMany(
      { recipient_id: UserId.build(organisationId, email), archived_at: undefined, viewed_at: undefined },
      { viewed_at: Date.now() },
    );
  }

  async archive(organisationId: string, id: string) {
    return this.upgradeAndSave(
      await OnDeckNotificationModel.updateOne({ _id: id, archived_at: undefined }, { archived_at: Date.now() }),
    );
  }

  private setLatestSchemaVersion(onDeckNotification: OnDeckNotification): OnDeckNotification {
    onDeckNotification.schema_version = OnDeckRepository.SCHEMA_VERSION;

    return onDeckNotification;
  }

  private upgrade(onDeckNotification: OnDeckNotification): OnDeckNotification {
    // add upgrade logic

    return this.setLatestSchemaVersion(onDeckNotification);
  }

  private async upgradeAndSave(dbObject: any): Promise<OnDeckNotification | null> {
    if (!dbObject) return dbObject;

    const isOlderSchema =
      dbObject.schema_version === undefined ||
      dbObject.schema_version === null ||
      dbObject.schema_version !== OnDeckRepository.SCHEMA_VERSION;

    if (isOlderSchema) {
      dbObject = this.upgrade(dbObject);

      return OnDeckNotificationModel.findOneAndUpdate({ _id: dbObject._id }, dbObject, {
        upsert: true,
        new: true,
      });
    }

    return dbObject;
  }

  async findForArchival(cutoffDate: Date, lastId: string | null, limit: number, lastCreatedAt?: Date): Promise<OnDeckNotification[]> {
    const filter: Record<string, unknown> = { source_creation_timestamp: { $lt: cutoffDate } };
    
    // Compound cursor pagination: handle both source_creation_timestamp and _id for correct ordering
    if (lastId && lastCreatedAt) {
      filter.$or = [
        { source_creation_timestamp: { $gt: lastCreatedAt, $lt: cutoffDate } },
        { source_creation_timestamp: lastCreatedAt, _id: { $gt: lastId } }
      ];
      delete filter.source_creation_timestamp;
    }
    
    // Sort by timestamp first to ensure we process dates in order, then by _id for cursor stability
    return OnDeckNotificationModel.find(filter).sort({ source_creation_timestamp: 1, _id: 1 }).limit(limit).lean();
  }

  async deleteByIds(ids: string[]): Promise<void> {
    await OnDeckNotificationModel.deleteMany({ _id: { $in: ids } });
  }

  public async migrate() {
    const filter = {
      $or: [{ schema_version: { $exists: false } }, { schema_version: { $ne: OnDeckRepository.SCHEMA_VERSION } }],
    };
    const limit = 100;
    let modifiedCount = 0;
    let onDeckNotificationsToUpgrade;

    do {
      onDeckNotificationsToUpgrade = await OnDeckNotificationModel.find(filter).limit(limit);

      const upgradedOnDeckNotifications: OnDeckNotification[] = [];

      for (const onDeckNotificationToUpgrade of onDeckNotificationsToUpgrade) {
        upgradedOnDeckNotifications.push(this.upgrade(onDeckNotificationToUpgrade)!);
        modifiedCount++;
      }

      const bulkOperations = upgradedOnDeckNotifications.map((onDeckNotification) => ({
        updateOne: {
          filter: { _id: onDeckNotification._id },
          update: onDeckNotification,
          upsert: true,
        },
      }));
      await OnDeckNotificationModel.bulkWrite(bulkOperations);
    } while (onDeckNotificationsToUpgrade.length !== 0);

    return modifiedCount;
  }
}
