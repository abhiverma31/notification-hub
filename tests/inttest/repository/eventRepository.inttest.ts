import 'reflect-metadata';
import { container } from 'tsyringe';
import { EventRepository } from '../../../src/shared-library/repositories/Event';
import { EventInterface } from '../../../src/shared-library/models/Event';
import { DatabaseConnector } from '../../../src/shared-library/connectors/DatabaseConnector';

describe('EventRepository Integration', () => {
  let db: DatabaseConnector;
  let eventRepository: EventRepository;
  let organisationId: string;
  let eventId: string;

  beforeAll(async () => {
    db = container.resolve(DatabaseConnector);
    await db.connect('EventRepository IntTest:BeforeAll');
    eventRepository = new EventRepository();
    organisationId = '507f1f77bcf86cd799439011'; // Example orgId
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('EventRepository IntTest:AfterAll');
  });

  it('should insert a new event', async () => {
    const event: EventInterface = {
      name: 'Integration Test Event',
      organisationId,
      templateIds: ['template1', 'template2'],
    };
    const inserted = await eventRepository.insertEvent(event);
    expect(inserted._id).toBeDefined();
    expect(inserted.name).toBe(event.name);
    eventId = inserted._id!;
  });

  it('should find event by id', async () => {
    const found = await eventRepository.findEventById(eventId, organisationId);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Integration Test Event');
  });

  it('should find event by name', async () => {
    const found = await eventRepository.findEventByName('Integration Test Event', organisationId);
    expect(found).not.toBeNull();
    expect(found!.organisationId).toBe(organisationId);
  });

  it('should update an event', async () => {
    const update = { name: 'Updated Integration Event' };
    const updated = await eventRepository.updateEvent(eventId, update, organisationId);
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe(update.name);
  });

  it('should get events with pagination', async () => {
    const events = await eventRepository.getEvents({ organisationId }, 0, 10);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it('should get events count', async () => {
    const count = await eventRepository.getEventsCount({ organisationId });
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThan(0);
  });

  it('should delete event by id', async () => {
    const event: EventInterface = {
      name: 'Delete Test Event',
      organisationId,
      templateIds: ['template1'],
    };
    const inserted = await eventRepository.insertEvent(event);
    const deleted = await eventRepository.deleteEventById(inserted._id!, organisationId);
    expect(deleted).toBe(true);
    const found = await eventRepository.findEventById(inserted._id!, organisationId);
    expect(found).toBeNull();
  });
});
