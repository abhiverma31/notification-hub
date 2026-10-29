import { injectable } from 'tsyringe';
import { Types } from 'mongoose';
import { EventInterface, EventModel, EventQuery } from '../models/Event';

@injectable()
export class EventRepository {
  static readonly SCHEMA_VERSION = 1;

  public async insertEvent(event: EventInterface): Promise<EventInterface> {
    return await EventModel.create(this.upgrade(event));
  }

  public async findEventById(eventId: string, organisationId: string): Promise<EventInterface | null> {
    return await this.upgradeAndSave(
      await EventModel.findOne({ _id: new Types.ObjectId(eventId), organisationId: organisationId }),
    );
  }

  public async getEvents(
    query: EventQuery,
    offset?: number,
    limit?: number,
    sortBy: string = 'updated_at',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<EventInterface[]> {
    // Build sort object dynamically
    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    return await EventModel.find(query).skip(offset!).limit(limit!).sort(sortObj);
  }

  public async getEventsCount(query: EventQuery): Promise<number> {
    return await EventModel.countDocuments(query);
  }

  public async findEventByName(name: string, organisationId: string): Promise<EventInterface | null> {
    return await this.upgradeAndSave(await EventModel.findOne({ name, organisationId }));
  }

  public async updateEvent(
    eventId: string,
    updateEvent: Partial<EventInterface>,
    organisationId: string,
  ): Promise<EventInterface | null> {
    const now = new Date();
    const filter = { _id: eventId, organisationId: organisationId };
    const update = { $set: { ...updateEvent, updated_at: now } };
    const updatedEvent = await EventModel.findOneAndUpdate(filter, update, { new: true });

    if (updatedEvent) {
      const result = await this.upgradeAndSave(updatedEvent);

      return result;
    } else {
      return null;
    }
  }

  public async deleteEventById(eventId: string, organisationId: string): Promise<boolean> {
    const result = await EventModel.deleteOne({ _id: new Types.ObjectId(eventId), organisationId });

    return result.deletedCount === 1;
  }

  public async updateLastUsedAt(eventId: string, organisationId: string): Promise<void> {
    await EventModel.findOneAndUpdate(
      { _id: new Types.ObjectId(eventId), organisationId },
      { $set: { lastUsedAt: new Date() } },
      { new: true },
    );
  }

  private setLatestSchemaVersion(event: EventInterface): EventInterface {
    event.schema_version = EventRepository.SCHEMA_VERSION;

    return event;
  }

  private upgrade(event: EventInterface): EventInterface {
    // add upgrade logic
    return this.setLatestSchemaVersion(event);
  }

  private async upgradeAndSave(dbObject: any): Promise<EventInterface | null> {
    if (!dbObject) return dbObject;

    const isOlderSchema =
      dbObject.schema_version === undefined ||
      dbObject.schema_version === null ||
      dbObject.schema_version !== EventRepository.SCHEMA_VERSION;

    if (isOlderSchema) {
      dbObject = this.upgrade(dbObject);

      return EventModel.findOneAndUpdate({ _id: dbObject._id }, dbObject, { upsert: true, new: true });
    }

    return dbObject;
  }

  public async migrate() {
    const filter = {
      $or: [{ schema_version: { $exists: false } }, { schema_version: { $ne: EventRepository.SCHEMA_VERSION } }],
    };
    const limit = 100;
    let modifiedCount = 0;
    let eventsToUpgrade;

    do {
      eventsToUpgrade = await EventModel.find(filter).limit(limit);
      const upgradedEvents: EventInterface[] = [];
      for (const eventToUpgrade of eventsToUpgrade) {
        upgradedEvents.push(this.upgrade(eventToUpgrade)!);
        modifiedCount++;
      }
      const bulkOperations = upgradedEvents.map((event) => ({
        updateOne: {
          filter: { _id: event._id },
          update: event,
          upsert: true,
        },
      }));
      await EventModel.bulkWrite(bulkOperations);
    } while (eventsToUpgrade.length !== 0);

    return modifiedCount;
  }
}
