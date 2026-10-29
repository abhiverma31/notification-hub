import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { EventService } from '../services/Event';
import { Body, Delete, Post, Request, Response, Route, Security, SuccessResponse } from 'tsoa';
import { Controller, Get, Path, Query, Tags } from '@tsoa/runtime';
import { NHRequest } from '../types/internal/NHRequest';
import { AuthSchemes } from '../middlewares/Authentication';
import { ServerLogger } from '../utils/ServerLogger';
import { EventInterface } from '../../shared-library/models/Event';

@injectable()
@Security(AuthSchemes.orgOwner)
@Security(AuthSchemes.frontendToken)
@Route('api/event')
export class EventController extends Controller {
  private readonly logger = new ServerLogger();

  constructor(@inject(EventService) private eventService: EventService) {
    super();
  }

  /**
   * Create a new event for an organisation.
   * @summary Create Event
   * @param {EventInterface} body - The request body containing event details.
   */
  @Post()
  @Response('409', 'Event Exists')
  @SuccessResponse('201', 'Created')
  @Tags('Create Events')
  public async createEvent(
    @Request() request: NHRequest,
    @Body() body: Omit<EventInterface, 'organisationId'>,
  ): Promise<{ id: string } | undefined> {
    const response = await this.eventService.createEvent(body, request.user.organisation!._id!);
    if (response) {
      this.setStatus(201);

      return response;
    } else {
      this.setStatus(409);

      return;
    }
  }

  /**
   * Update an existing event for an organisation.
   * @summary Update Event
   * @param {string} eventId - The id of the event to be updated.
   * @param {Partial<EventInterface>} body - The request body containing event details to update.
   */
  @Post('{eventId}/update')
  @SuccessResponse('200', 'OK')
  @Tags('Update Events')
  public async updateEvent(
    @Request() request: NHRequest,
    @Path() eventId: string,
    @Body() body: Partial<EventInterface>,
  ): Promise<void> {
    await this.eventService.updateEvent(eventId, body, request.user.organisation!._id!);
  }

  /**
   * Get a single event by its id.
   * @summary Get Event by Id
   * @param {string} eventId - The id of the event to fetch.
   */
  @Get('{eventId}')
  @SuccessResponse('200', 'OK')
  @Tags('Get Events')
  public async getEvent(@Request() request: NHRequest, @Path() eventId: string) {
    return await this.eventService.getEvent(eventId, request.user.organisation!._id!);
  }

  /**
   * List all events for an organisation with pagination and search.
   * @summary List Events
   * @param page - current page number
   * @param itemsPerPage - number of events per page
   * @param name - event name to search
   * @param {string} sortBy - field to sort by (default: updated_at)
   * @param {('asc' | 'desc')} sortOrder - sort order, either 'asc' or 'desc' (default: 'desc')
   */
  @Get()
  @SuccessResponse('200', 'OK')
  @Tags('List Events')
  public async getEvents(
    @Request() request: NHRequest,
    @Query() page?: number,
    @Query() itemsPerPage?: number,
    @Query() name?: string,
    @Query() sortBy?: string,
    @Query() sortOrder?: 'asc' | 'desc',
  ) {
    // Default sortBy: 'updated_at', sortOrder: 'desc'
    const sortByParam = sortBy ?? 'updated_at';
    const sortOrderParam = sortOrder ?? 'desc';

    return await this.eventService.getEvents(
      request.user.organisation!._id!,
      page!,
      itemsPerPage!,
      name!,
      sortByParam,
      sortOrderParam,
    );
  }

  /**
   * Delete an event by its id.
   * @summary Delete Event
   * @param {string} eventId - The id of the event to delete.
   */
  @Delete('{eventId}')
  @SuccessResponse('204', 'No Content')
  @Tags('Delete Events')
  public async deleteEvent(@Request() request: NHRequest, @Path() eventId: string): Promise<void> {
    await this.eventService.deleteEvent(eventId, request.user.organisation!._id!);
    this.setStatus(204);
  }
}
