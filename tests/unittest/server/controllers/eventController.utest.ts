import { EventController } from '../../../../src/server/controllers/Event';
import { EventService } from '../../../../src/server/services/Event';
import { NHRequest } from '../../../../src/server/types/internal/NHRequest';
import { EventInterface } from '../../../../src/shared-library/models/Event';
import Error from '../../../../src/server/middlewares/ErrorHandler';
import { BadRequest } from '../../../../src/server/utils/errors/BadRequest';

jest.mock('../../../../src/server/services/Event');

const validEventId = { id: '1234567890abcdef' };
const validOrganisationId = 'org123';

const validEvent: EventInterface = {
  _id: 'event1',
  name: 'Test Event',
  organisationId: validOrganisationId,
  templateIds: [],
};

describe('EventController', () => {
  let eventServiceMock: jest.Mocked<EventService>;
  let eventController: EventController;

  beforeEach(() => {
    eventServiceMock = new (EventService as jest.Mock)();
    eventController = new EventController(eventServiceMock);
    jest.clearAllMocks();
    eventController.setStatus = jest.fn();
  });

  describe('createEvent', () => {
    it('should create an event and respond with status 201', async () => {
      eventServiceMock.createEvent.mockResolvedValue(validEventId);
      const request = { user: { organisation: { _id: validOrganisationId } } } as NHRequest;
      const body = { name: 'Test Event', templateIds: [] };
      const result = await eventController.createEvent(request, body);
      expect(eventServiceMock.createEvent).toHaveBeenCalledWith(body, validOrganisationId);
      expect(eventController.setStatus).toHaveBeenCalledWith(201);
      expect(result).toEqual(validEventId);
    });

    it('should respond with status 409 if event already exists', async () => {
      eventServiceMock.createEvent.mockResolvedValue(undefined);
      const request = { user: { organisation: { _id: validOrganisationId } } } as NHRequest;
      const body = { name: 'Test Event', templateIds: [] };
      const result = await eventController.createEvent(request, body);
      expect(eventServiceMock.createEvent).toHaveBeenCalledWith(body, validOrganisationId);
      expect(eventController.setStatus).toHaveBeenCalledWith(409);
      expect(result).toBeUndefined();
    });
  });

  describe('updateEvent', () => {
    it('should update an event and respond with status 200', async () => {
      eventServiceMock.updateEvent.mockResolvedValueOnce();
      const request = { user: { organisation: { _id: validOrganisationId } } } as NHRequest;
      const eventId = 'event1';
      const updateBody = { name: 'Updated Event' };
      await eventController.updateEvent(request, eventId, updateBody);
      expect(eventServiceMock.updateEvent).toHaveBeenCalledWith(eventId, updateBody, validOrganisationId);
    });

    it('should throw Error if update fails', async () => {
      eventServiceMock.updateEvent.mockImplementation(() => {
        throw new BadRequest('Event does not exist');
      });
      const request = { user: { organisation: { _id: validOrganisationId } } } as NHRequest;
      const eventId = 'event1';
      const updateBody = { name: 'Updated Event' };
      await expect(eventController.updateEvent(request, eventId, updateBody)).rejects.toThrow(BadRequest);
      expect(eventServiceMock.updateEvent).toHaveBeenCalledWith(eventId, updateBody, validOrganisationId);
    });
  });

  describe('getEvent', () => {
    it('should return an event by id', async () => {
      eventServiceMock.getEvent.mockResolvedValue(validEvent);
      const request = { user: { organisation: { _id: validOrganisationId } } } as NHRequest;
      const eventId = 'event1';
      const result = await eventController.getEvent(request, eventId);
      expect(eventServiceMock.getEvent).toHaveBeenCalledWith(eventId, validOrganisationId);
      expect(result).toEqual(validEvent);
    });

    it('should return undefined if event not found', async () => {
      eventServiceMock.getEvent.mockResolvedValue(undefined as any);
      const request = { user: { organisation: { _id: validOrganisationId } } } as NHRequest;
      const eventId = 'event1';
      const result = await eventController.getEvent(request, eventId);
      expect(eventServiceMock.getEvent).toHaveBeenCalledWith(eventId, validOrganisationId);
      expect(result).toBeUndefined();
    });
  });

  describe('getEvents', () => {
    it('should return a list of events', async () => {
      const eventsList = { events: [validEvent], pagination: { page: 0, itemsPerPage: 10, total: 1 } };
      eventServiceMock.getEvents.mockResolvedValue(eventsList);
      const request = { user: { organisation: { _id: validOrganisationId } } } as NHRequest;
      const result = await eventController.getEvents(request, 0, 10, 'Test Event');
      expect(eventServiceMock.getEvents).toHaveBeenCalledWith(validOrganisationId, 0, 10, 'Test Event', 'updated_at', 'desc');
      expect(result).toEqual(eventsList);
    });

    it('should return an empty array if no events found', async () => {
      const eventsList = { events: [], pagination: { page: 0, itemsPerPage: 10, total: 0 } };
      eventServiceMock.getEvents.mockResolvedValue(eventsList);
      const request = { user: { organisation: { _id: validOrganisationId } } } as NHRequest;
      const result = await eventController.getEvents(request, 0, 10, 'Test Event');
      expect(eventServiceMock.getEvents).toHaveBeenCalledWith(validOrganisationId, 0, 10, 'Test Event', 'updated_at', 'desc');
      expect(result).toEqual(eventsList);
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event and respond with status 204', async () => {
      eventServiceMock.deleteEvent.mockResolvedValueOnce();
      const request = { user: { organisation: { _id: validOrganisationId } } } as NHRequest;
      const eventId = 'event1';
      await eventController.deleteEvent(request, eventId);
      expect(eventServiceMock.deleteEvent).toHaveBeenCalledWith(eventId, validOrganisationId);
      expect(eventController.setStatus).toHaveBeenCalledWith(204);
    });
    it('should throw Error if delete fails', async () => {
      eventServiceMock.deleteEvent.mockImplementation(() => {
        throw new BadRequest('Event does not exist');
      });
      const request = { user: { organisation: { _id: validOrganisationId } } } as NHRequest;
      const eventId = 'event1';
      await expect(eventController.deleteEvent(request, eventId)).rejects.toThrow(BadRequest);
      expect(eventServiceMock.deleteEvent).toHaveBeenCalledWith(eventId, validOrganisationId);
    });
  });
});
