import 'dotenv/config';
import 'reflect-metadata';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';
import { container } from 'tsyringe';
import request from 'supertest';
import { SeedDataResult, insertSeedData } from '../../../../scripts/seedData/insertSeedData';
import { OrganisationInterface, OrganisationModel } from '../../../../src/shared-library/models/Organisation';
import { decodeFromBase64 } from '../../../../src/server/utils/KeyTools';

const appBaseUrl = 'http://localhost:4000';
const adminKey = process.env.ADMIN_KEY || 'test';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let seedData: SeedDataResult;
const db = container.resolve(DatabaseConnector);
describe('Organisation API', () => {
  beforeAll(async () => {
    await db.connect('Organisation E2E Test:BeforeAll');
    seedData = await insertSeedData();
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('Organisation E2E Test:AfterAll');
  });
  const validPayload = {
    name: 'e2e Organisation',
  };

  const validPayloadForEmailSettings = {
    channelType: 'email',
    provider: 'GMAIL',
    enabled: true,
    settings: {
      auth: {
        user: 'test@technogise.com',
        pass: 'pwd',
      },
      service: 'Gmail',
      port: '587',
      host: 'smtp.gmail.com',
      secure: 'true',
    },
  };

  const validPayloadForSlackSettings = {
    channelType: 'slack',
    provider: 'slack',
    enabled: true,
    settings: {
      webhook: 'test-webhook',
    },
  };

  const validPayloadForTeamsSettings = {
    channelType: 'teams',
    provider: 'teams',
    enabled: true,
    settings: {
      webhook: 'https://teams-webhook-url',
    },
  };

  it('should handle POST /api/organisation', async () => {
    const response = await request(appBaseUrl)
      .post('/api/organisation')
      .set('X-ADMIN-KEY', adminKey)
      .send(validPayload)
      .expect(201)
      .expect('Content-Type', 'application/json; charset=utf-8');

    const responseBody = JSON.parse(response.text);
    const organisations: OrganisationInterface[] = await OrganisationModel.find({ _id: responseBody.id });
    expect(responseBody.org_key).toBeNaN;

    const responseApiKey = decodeFromBase64(responseBody.org_key).split(',');
    expect(organisations[0].name).toBe('e2e Organisation');
    expect(responseApiKey[0]).toBe(organisations[0].api_key);
  });

  it('should return 409 when the organisation already exists ', async () => {
    const response = await request(appBaseUrl)
      .post('/api/organisation')
      .set('X-ADMIN-KEY', adminKey)
      .send(validPayload)
      .expect(409)
      .expect('Content-Type', 'application/json; charset=utf-8');

    const responseBody = JSON.parse(response.text);
    expect(responseBody.message).toBe('Organisation already exist');
  });

  it('should throw 401 Unauthorized on sending invalid Api Key', async () => {
    await request('http://localhost:4000')
      .post('/api/organisation')
      .set('X-ADMIN-KEY', 'invalidApiKey')
      .send(validPayload)
      .expect(401);
  });

  it('should handle POST /api/organisation/regenerate-keys', async () => {
    const response = await request(appBaseUrl)
      .post('/api/organisation/regenerate-keys')
      .set('X-ADMIN-KEY', adminKey)
      .send(validPayload)
      .expect(200)
      .expect('Content-Type', 'application/json; charset=utf-8');

    const responseBody = JSON.parse(response.text);
    const organisations: OrganisationInterface[] = await OrganisationModel.find({ _id: responseBody.id });
    expect(responseBody.org_key).toBeNaN;

    const responseApiKey = decodeFromBase64(responseBody.org_key).split(',');
    expect(organisations[0].name).toBe('e2e Organisation');
    expect(responseApiKey[0]).toBe(organisations[0].api_key);
  });

  it('should handle POST /api/organisation/settings for EMAIL', async () => {
    await request(appBaseUrl)
      .post('/api/organisation/settings')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayloadForEmailSettings)
      .expect(201);
    const organisationSettings: OrganisationInterface | null = await OrganisationModel.findOne({
      _id: seedData.OrganisationId,
    });

    expect(organisationSettings).toBeDefined();
    expect(organisationSettings!.settings?.email).toBeDefined();
  });

  it('should handle POST /api/organisation/settings for SLACK', async () => {
    await request(appBaseUrl)
      .post('/api/organisation/settings')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayloadForSlackSettings)
      .expect(201);
    const organisationSettings: OrganisationInterface | null = await OrganisationModel.findOne({
      _id: seedData.OrganisationId,
    });

    expect(organisationSettings).toBeDefined();
    expect(organisationSettings!.settings?.slack).toBeDefined();
  });

  it('should handle POST /api/organisation/settings for TEAMS', async () => {
    await request(appBaseUrl)
      .post('/api/organisation/settings')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayloadForTeamsSettings)
      .expect(201);
    const organisationSettings: OrganisationInterface | null = await OrganisationModel.findOne({
      _id: seedData.OrganisationId,
    });

    expect(organisationSettings).toBeDefined();
    expect(organisationSettings!.settings?.teams).toBeDefined();
  });
});
