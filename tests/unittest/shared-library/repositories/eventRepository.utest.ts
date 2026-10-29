import 'reflect-metadata';
import { Types } from 'mongoose';
import { EventRepository } from '../../../../src/shared-library/repositories/Event';
import { EventInterface, EventModel, EventQuery } from '../../../../src/shared-library/models/Event';

jest.mock('../../../../src/shared-library/models/Event');

describe('EventRepository', () => {
  let eventRepository: EventRepository;

  beforeEach(() => {
    eventRepository = new EventRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should insert an event', async () => {
    const mockEvent: EventInterface = { name: 'Test Event', organisationId: 'org1' } as any;
    (EventModel.create as jest.Mock).mockResolvedValueOnce(mockEvent);
    const result = await eventRepository.insertEvent(mockEvent);
    expect(EventModel.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Event', organisationId: 'org1', schema_version: 1 }));
    expect(result).toEqual(mockEvent);
  });

  it('should find event by ID', async () => {
    const mockEventId = '65816f6d40cb6e53c6656fa0';
    const mockOrganisationId = 'org1';
    const mockEvent = { _id: mockEventId, organisationId: mockOrganisationId, schema_version: 1 } as any;
    (EventModel.findOne as jest.Mock).mockResolvedValueOnce(mockEvent);
    jest.spyOn(eventRepository as any, 'upgradeAndSave').mockResolvedValueOnce(mockEvent);
    const result = await eventRepository.findEventById(mockEventId, mockOrganisationId);
    expect(EventModel.findOne).toHaveBeenCalledWith({ _id: new Types.ObjectId(mockEventId), organisationId: mockOrganisationId });
    expect(result).toEqual(mockEvent);
  });

  it('should get events with query, offset, and limit', async () => {
    const mockQuery: EventQuery = { organisationId: 'org1' };
    const mockEvents = [{ name: 'Event1' }, { name: 'Event2' }];
    (EventModel.find as jest.Mock).mockReturnValue({ skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), sort: jest.fn().mockResolvedValueOnce(mockEvents) });
    const result = await eventRepository.getEvents(mockQuery, 0, 2);
    expect(EventModel.find).toHaveBeenCalledWith(mockQuery);
    expect(result).toEqual(mockEvents);
  });

  it('should get events count', async () => {
    const mockQuery: EventQuery = { organisationId: 'org1' };
    (EventModel.countDocuments as jest.Mock).mockResolvedValueOnce(5);
    const result = await eventRepository.getEventsCount(mockQuery);
    expect(EventModel.countDocuments).toHaveBeenCalledWith(mockQuery);
    expect(result).toBe(5);
  });

  it('should find event by name', async () => {
    const mockName = 'EventName';
    const mockOrganisationId = 'org1';
    const mockEvent = { name: mockName, organisationId: mockOrganisationId, schema_version: 1 } as any;
    (EventModel.findOne as jest.Mock).mockResolvedValueOnce(mockEvent);
    jest.spyOn(eventRepository as any, 'upgradeAndSave').mockResolvedValueOnce(mockEvent);
    const result = await eventRepository.findEventByName(mockName, mockOrganisationId);
    expect(EventModel.findOne).toHaveBeenCalledWith({ name: mockName, organisationId: mockOrganisationId });
    expect(result).toEqual(mockEvent);
  });

  it('should update event and return updated event', async () => {
    const mockEventId = '65816f6d40cb6e53c6656fa0';
    const mockOrganisationId = 'org1';
    const mockDate = new Date('2024-07-15T10:08:02.011Z');
    const updateEvent = { name: 'Updated Event' };
    const mockEvent = { _id: mockEventId, organisationId: mockOrganisationId, name: 'Updated Event', updated_at: mockDate, schema_version: 1 } as any;
    (EventModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(mockEvent);
    jest.spyOn(eventRepository as any, 'upgradeAndSave').mockResolvedValueOnce(mockEvent);
    const result = await eventRepository.updateEvent(mockEventId, updateEvent, mockOrganisationId);
    expect(EventModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockEventId, organisationId: mockOrganisationId },
      { $set: { ...updateEvent, updated_at: expect.any(Date) } },
      { new: true }
    );
    expect(result).toEqual(mockEvent);
  });

  it('should return null if event to update does not exist', async () => {
    const mockEventId = '65816f6d40cb6e53c6656fa0';
    const mockOrganisationId = 'org1';
    const updateEvent = { name: 'Updated Event' };
    (EventModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(null);
    const result = await eventRepository.updateEvent(mockEventId, updateEvent, mockOrganisationId);
    expect(EventModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockEventId, organisationId: mockOrganisationId },
      { $set: { ...updateEvent, updated_at: expect.any(Date) } },
      { new: true }
    );
    expect(result).toBeNull();
  });

  it('should upgrade and save event if schema is outdated', async () => {
    const mockEvent = { _id: 'id1', schema_version: 0 } as Record<string, any>;
    const upgradedEvent = { _id: 'id1', schema_version: 1 } as Record<string, any>;
    // Patch upgrade method using Object.defineProperty to avoid TypeScript private error
    Object.defineProperty(eventRepository, 'upgrade', { value: jest.fn().mockReturnValue(upgradedEvent) });
    (EventModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(upgradedEvent);
    const result = await (eventRepository as any).upgradeAndSave(mockEvent);
    expect((eventRepository as any).upgrade).toHaveBeenCalledWith(mockEvent);
    expect(EventModel.findOneAndUpdate).toHaveBeenCalledWith({ _id: upgradedEvent._id }, upgradedEvent, { upsert: true, new: true });
    expect(result).toEqual(upgradedEvent);
  });

  it('should not upgrade and save event if schema is current', async () => {
    const mockEvent = { _id: 'id1', schema_version: 1 } as any;
    const result = await (eventRepository as any).upgradeAndSave(mockEvent);
    expect(result).toEqual(mockEvent);
  });

  it('should update lastUsedAt when updateLastUsedAt is called', async () => {
    const mockEventId = '65816f6d40cb6e53c6656fa0';
    const mockOrganisationId = 'org1';
    (EventModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({ _id: mockEventId, organisationId: mockOrganisationId, lastUsedAt: new Date() });
    await eventRepository.updateLastUsedAt(mockEventId, mockOrganisationId);
    expect(EventModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(mockEventId), organisationId: mockOrganisationId },
      { $set: { lastUsedAt: expect.any(Date) } },
      { new: true }
    );
  });
});
