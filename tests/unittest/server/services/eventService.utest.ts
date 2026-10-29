import 'reflect-metadata';
import { EventService } from '../../../../src/server/services/Event';
import { EventInterface } from '../../../../src/shared-library/models/Event';
import { EventRepository } from '../../../../src/shared-library/repositories/Event';
import { BadRequest, Conflict } from '../../../../src/server/utils/errors/BadRequest';

jest.mock('../../../../src/shared-library/repositories/Event');

describe('EventService', () => {
  let eventService: EventService;
  let eventRepositoryMock: jest.Mocked<EventRepository>;
  const organisationId = 'org123';

  beforeEach(() => {
    eventRepositoryMock = new EventRepository() as jest.Mocked<EventRepository>;
    eventService = new EventService(eventRepositoryMock);
  });

  describe('createEvent', () => {
    it('should create event when name is unique', async () => {
      const eventReq = { name: 'TestEvent', channelType: 'EMAIL' } as any;
      eventRepositoryMock.findEventByName.mockResolvedValueOnce(null);
      eventRepositoryMock.insertEvent.mockResolvedValueOnce({ _id: 'eventId', ...eventReq, organisationId });
      const result = await eventService.createEvent(eventReq, organisationId);
      expect(result).toEqual({ id: 'eventId' });
      expect(eventRepositoryMock.insertEvent).toHaveBeenCalledWith({ ...eventReq, organisationId });
    });
    it('should throw Conflict if event name exists', async () => {
      eventRepositoryMock.findEventByName.mockResolvedValueOnce({ _id: 'existingId', name: 'TestEvent' } as any);
      await expect(eventService.createEvent({ name: 'TestEvent' } as any, organisationId)).rejects.toThrow(Conflict);
    });
  });

  describe('getEvent', () => {
    it('should return event if found', async () => {
      eventRepositoryMock.findEventById.mockResolvedValueOnce({ _id: 'eventId', name: 'TestEvent' } as any);
      const result = await eventService.getEvent('eventId', organisationId);
      expect(result).toEqual({ _id: 'eventId', name: 'TestEvent' });
      expect(eventRepositoryMock.findEventById).toHaveBeenCalledWith('eventId', organisationId);
    });
    it('should throw BadRequest if not found', async () => {
      eventRepositoryMock.findEventById.mockResolvedValueOnce(null);
      await expect(eventService.getEvent('eventId', organisationId)).rejects.toThrow(BadRequest);
    });
  });

  describe('getEventByName', () => {
    it('should return event if found', async () => {
      eventRepositoryMock.findEventByName.mockResolvedValueOnce({ _id: 'eventId', name: 'TestEvent' } as any);
      const result = await eventService.getEventByName('TestEvent', organisationId);
      expect(result).toEqual({ _id: 'eventId', name: 'TestEvent' });
      expect(eventRepositoryMock.findEventByName).toHaveBeenCalledWith('TestEvent', organisationId);
    });
    it('should throw BadRequest if not found', async () => {
      eventRepositoryMock.findEventByName.mockResolvedValueOnce(null);
      await expect(eventService.getEventByName('TestEvent', organisationId)).rejects.toThrow(BadRequest);
    });
  });

  describe('getEvents', () => {
    it('should return paginated events', async () => {
      eventRepositoryMock.getEvents.mockResolvedValueOnce([{ _id: 'eventId', name: 'TestEvent' } as any]);
      eventRepositoryMock.getEventsCount.mockResolvedValueOnce(1);
      const result = await eventService.getEvents(organisationId, 0, 1, 'TestEvent');
      expect(result?.events).toEqual([{ _id: 'eventId', name: 'TestEvent' }]);
      expect(result?.pagination.totalItems).toBe(1);
      expect(eventRepositoryMock.getEvents).toHaveBeenCalled();
      expect(eventRepositoryMock.getEventsCount).toHaveBeenCalled();
    });
    it('should handle error and return undefined', async () => {
      eventRepositoryMock.getEvents.mockRejectedValueOnce(new Error('DB error'));
      const result = await eventService.getEvents(organisationId, 0, 1);
      expect(result).toBeUndefined();
    });
  });

  describe('updateEvent', () => {
    it('should update event if found', async () => {
      eventRepositoryMock.findEventById.mockResolvedValueOnce({ _id: 'eventId', name: 'TestEvent' } as any);
      eventRepositoryMock.updateEvent.mockResolvedValueOnce({ _id: 'eventId', name: 'TestEventUpdated' } as any);
      await eventService.updateEvent('eventId', { name: 'TestEventUpdated' }, organisationId);
      expect(eventRepositoryMock.updateEvent).toHaveBeenCalledWith('eventId', { name: 'TestEventUpdated' }, organisationId);
    });
    it('should throw BadRequest if event not found', async () => {
      eventRepositoryMock.findEventById.mockResolvedValueOnce(null);
      await expect(eventService.updateEvent('eventId', { name: 'TestEventUpdated' }, organisationId)).rejects.toThrow(BadRequest);
    });
  });

  describe('isUniqueEventName', () => {
    it('should return true if event name is unique', async () => {
      eventRepositoryMock.findEventByName.mockResolvedValueOnce(null);
      const result = await eventService['isUniqueEventName']('UniqueEvent', organisationId);
      expect(result).toBe(true);
    });
    it('should return false if event name exists', async () => {
      eventRepositoryMock.findEventByName.mockResolvedValueOnce({ _id: 'eventId', name: 'UniqueEvent' } as any);
      const result = await eventService['isUniqueEventName']('UniqueEvent', organisationId);
      expect(result).toBe(false);
    });
  });

  describe('deleteEvent', () => {
    it('should delete event if found', async () => {
      eventRepositoryMock.deleteEventById.mockResolvedValueOnce(true);
      await eventService.deleteEvent('eventId', organisationId);
      expect(eventRepositoryMock.deleteEventById).toHaveBeenCalledWith('eventId', organisationId);
    });
    it('should throw BadRequest if event not found', async () => {
      eventRepositoryMock.deleteEventById.mockResolvedValueOnce(false);
      await expect(eventService.deleteEvent('eventId', organisationId)).rejects.toThrow(BadRequest);
    });
  });
});
