import 'reflect-metadata';

import request from 'supertest';
import { container } from 'tsyringe';
import { insertSeedData, SeedDataResult } from '../../../../scripts/seedData/insertSeedData';
import { EventRepository } from '../../../../src/shared-library/repositories/Event';
import { EventInterface } from '../../../../src/shared-library/models/Event';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';

const appBaseUrl = 'http://localhost:4000';

let seedData: SeedDataResult;
const db = container.resolve(DatabaseConnector);

describe('Event API', () => {
  beforeAll(async () => {
    await db.connect('Event E2E Test:BeforeAll');
    seedData = await insertSeedData();
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('Event E2E Test:AfterAll');
  });

  it('should handle POST /event to create a new event', async () => {
    const validPayload: Omit<EventInterface, 'organisationId'> = {
      name: 'Promotional Event E2E Test',
      templateIds: [seedData.EmailTemplateId, seedData.PushTemplateId],
    };

    const response = await request(appBaseUrl)
      .post('/api/event')
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(201)
      .expect('Content-Type', /json/);

    const responseBody = JSON.parse(response.text);
    expect(responseBody.id).toBeDefined();

    const eventRepository = new EventRepository();
    const event = await eventRepository.findEventById(responseBody.id, seedData.OrganisationId);
    expect(event!.name).toEqual(validPayload.name);
    expect(event!.templateIds).toEqual([seedData.EmailTemplateId.toString(), seedData.PushTemplateId.toString()]);
  });

  it('should handle POST /event/:eventId/update to update an event', async () => {
    // Create event first
    const createPayload: Omit<EventInterface, 'organisationId'> = {
      name: 'Initial Event E2E Test',
      templateIds: [seedData.EmailTemplateId],
    };
    const createResponse = await request(appBaseUrl)
      .post('/api/event')
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(createPayload)
      .expect(201);
    const createdEventId = JSON.parse(createResponse.text).id;

    // Update event
    const updatePayload = {
      name: 'Updated Event E2E Test',
      templateIds: [seedData.EmailTemplateId, seedData.PushTemplateId, seedData.OnDeckTemplateId],
    };
    await request(appBaseUrl)
      .post(`/api/event/${createdEventId}/update`)
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(updatePayload)
      .expect(200);

    const eventRepository = new EventRepository();
    const updatedEvent = await eventRepository.findEventById(createdEventId, seedData.OrganisationId);
    expect(updatedEvent).not.toBeNull();
    expect(updatedEvent!.name).toEqual(updatePayload.name);
    expect(updatedEvent!.templateIds).toEqual([seedData.EmailTemplateId.toString(), seedData.PushTemplateId.toString(), seedData.OnDeckTemplateId.toString()]);
  });

  it('should handle GET /event/:eventId to fetch event by id', async () => {
    // Create event first
    const createPayload: Omit<EventInterface, 'organisationId'> = {
      name: 'Fetch Event E2E Test',
      templateIds: [seedData.EmailTemplateId],
    };
    const createResponse = await request(appBaseUrl)
      .post('/api/event')
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(createPayload)
      .expect(201);
    const createdEventId = JSON.parse(createResponse.text).id;

    const response = await request(appBaseUrl)
      .get(`/api/event/${createdEventId}`)
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .expect(200)
      .expect('Content-Type', /json/);
    const event = JSON.parse(response.text);
    expect(event.name).toEqual(createPayload.name);
    expect(event.templateIds).toEqual([seedData.EmailTemplateId.toString()]);
  });

  it('should handle GET /event to list events with pagination', async () => {
    const response = await request(appBaseUrl)
      .get('/api/event?page=0&itemsPerPage=10')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .expect(200)
      .expect('Content-Type', /json/);
    const body = JSON.parse(response.text);
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.itemsPerPage).toBe(10);
    expect(body.events.length).toBeGreaterThanOrEqual(4);
  });

  it('should handle DELETE /event/:eventId to delete an event', async () => {
    // Create event first
    const createPayload: Omit<EventInterface, 'organisationId'> = {
      name: 'Delete Event E2E Test',
      templateIds: [seedData.EmailTemplateId],
    };
    const createResponse = await request(appBaseUrl)
      .post('/api/event')
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(createPayload)
      .expect(201);
    const createdEventId = JSON.parse(createResponse.text).id;

    // Delete event
    await request(appBaseUrl)
      .delete(`/api/event/${createdEventId}`)
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .expect(204);

    // Verify event is deleted
    const eventRepository = new EventRepository();
    const deletedEvent = await eventRepository.findEventById(createdEventId, seedData.OrganisationId);
    expect(deletedEvent).toBeNull();
  });
});
