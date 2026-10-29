import { DeleteResult } from 'mongoose';
import { OnDeckConnection, OnDeckConnectionModel } from '../models/OnDeckConnection';
import { UserId } from '../models/User';

export class OnDeckConnectionRepository {
  static readonly SCHEMA_VERSION = 1;

  async create(connection: OnDeckConnection) {
    return OnDeckConnectionModel.create(this.upgrade(connection));
  }

  async getRecipientConnections(recipientEmail: string, organisationId: string): Promise<OnDeckConnection[]> {
    return await OnDeckConnectionModel.find({ recipient_id: UserId.build(organisationId, recipientEmail) });
  }

  async closeConnection(connectionId: string): Promise<DeleteResult> {
    return await OnDeckConnectionModel.deleteOne({ connection_id: connectionId });
  }

  private setLatestSchemaVersion(onDeckConnection: OnDeckConnection): OnDeckConnection {
    onDeckConnection.schema_version = OnDeckConnectionRepository.SCHEMA_VERSION;

    return onDeckConnection;
  }

  private upgrade(onDeckConnection: OnDeckConnection): OnDeckConnection {
    // add upgrade logic
    return this.setLatestSchemaVersion(onDeckConnection);
  }

  private async upgradeAndSave(dbObject: any): Promise<OnDeckConnection | null> {
    if (!dbObject) return dbObject;

    const isOlderSchema =
      dbObject.schema_version === undefined ||
      dbObject.schema_version === null ||
      dbObject.schema_version !== OnDeckConnectionRepository.SCHEMA_VERSION;

    if (isOlderSchema) {
      dbObject = this.upgrade(dbObject);

      return OnDeckConnectionModel.findOneAndUpdate({ _id: dbObject._id }, dbObject, {
        upsert: true,
        new: true,
      });
    }

    return dbObject;
  }

  public async migrate() {
    // This will create the collection if it doesn't exist
    await OnDeckConnectionModel.createCollection();

    const filter = {
      $or: [
        { schema_version: { $exists: false } },
        { schema_version: { $ne: OnDeckConnectionRepository.SCHEMA_VERSION } },
      ],
    };
    const limit = 100;
    let modifiedCount = 0;
    let onDeckConnectionsToUpgrade;

    do {
      onDeckConnectionsToUpgrade = await OnDeckConnectionModel.find(filter).limit(limit);

      const upgradedOnDeckConnections: OnDeckConnection[] = [];

      for (const onDeckConnectionToUpgrade of onDeckConnectionsToUpgrade) {
        upgradedOnDeckConnections.push(this.upgrade(onDeckConnectionToUpgrade)!);
        modifiedCount++;
      }

      const bulkOperations = upgradedOnDeckConnections.map((onDeckConnection) => ({
        updateOne: {
          filter: { _id: onDeckConnection._id },
          update: onDeckConnection,
          upsert: true,
        },
      }));
      await OnDeckConnectionModel.bulkWrite(bulkOperations);
    } while (onDeckConnectionsToUpgrade.length !== 0);

    return modifiedCount;
  }
}
