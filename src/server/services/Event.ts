import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { EventRepository } from '../../shared-library/repositories/Event';
import { BadRequest, Conflict } from '../utils/errors/BadRequest';
import { EventInterface, EventQuery } from '../../shared-library/models/Event';
import { ServerLogger } from '../utils/ServerLogger';

@injectable()
export class EventService {
  private readonly logger = new ServerLogger();

  constructor(@inject(EventRepository) private eventRepository: EventRepository) {}

  public async createEvent(
    eventReq: Omit<EventInterface, 'organisationId'>,
    organisationId: string,
  ): Promise<{ id: string } | undefined> {
    if (!(await this.isUniqueEventName(eventReq.name, organisationId))) {
      throw new Conflict(`Event name '${eventReq.name}' already exists`);
    }
    const insertedEvent = await this.eventRepository.insertEvent({ ...eventReq, organisationId });
    this.logger.trace('new event created ', insertedEvent._id);

    return { id: insertedEvent._id as string };
  }

  public async getEvent(eventId: string, organisationId: string) {
    const event = await this.eventRepository.findEventById(eventId, organisationId.toString());
    if (!event) {
      throw new BadRequest('No Matching Event Found');
    }
    this.logger.trace('fetched event ', event._id);

    return event;
  }

  public async getEventByName(eventName: string, organisationId: string) {
    const event = await this.eventRepository.findEventByName(eventName, organisationId.toString());
    if (!event) {
      throw new BadRequest('No Matching Event Found');
    }
    this.logger.trace('fetched event ', event._id);

    return event;
  }

  private async isUniqueEventName(eventName: string, organisationId: string): Promise<boolean> {
    const existingEvent = await this.eventRepository.findEventByName(eventName, organisationId);

    return !existingEvent;
  }

  public async getEvents(
    organisationId: string,
    page?: number,
    itemsPerPage?: number,
    name?: string,
    sortBy: string = 'updated_at',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<{ events: EventInterface[]; pagination: any } | undefined> {
    this.logger.traceStart(
      { organisationId, page, itemsPerPage, name, sortBy, sortOrder },
      'server > getEvents Getting Events',
    );
    const query: EventQuery = { organisationId };
    if (name) {
      query.name = new RegExp(name, 'i');
    }
    try {
      const [events, totalItems] = await Promise.all([
        this.eventRepository.getEvents(query, page! * itemsPerPage!, itemsPerPage, sortBy, sortOrder),
        this.eventRepository.getEventsCount(query),
      ]);
      const totalPages = Math.ceil(totalItems / itemsPerPage!);
      this.logger.trace('fetched events ', events);

      return {
        events: events,
        pagination: {
          currentPage: page!,
          itemsPerPage: itemsPerPage!,
          totalItems: totalItems,
          totalPages: totalPages,
        },
      };
    } catch (error) {
      this.logger.error({ error }, 'server > getEvents < error in getting Events');
    } finally {
      this.logger.traceEnd(
        { organisationId, page, itemsPerPage, name, sortBy, sortOrder },
        'server > getEvents Getting Events',
      );
    }
  }

  public async updateEvent(
    eventId: string,
    updateEvent: Partial<EventInterface>,
    organisationId: string,
  ): Promise<void> {
    const event = await this.eventRepository.findEventById(eventId, organisationId);
    if (!event) {
      throw new BadRequest('Event does not exist');
    }
    await this.eventRepository.updateEvent(eventId, updateEvent, organisationId);
    this.logger.trace(`Updated event `, eventId);
  }

  public async deleteEvent(eventId: string, organisationId: string): Promise<void> {
    const deleted = await this.eventRepository.deleteEventById(eventId, organisationId);
    if (!deleted) {
      throw new BadRequest('Event does not exist or could not be deleted');
    }
    this.logger.trace(`Deleted event `, eventId);
  }
}
