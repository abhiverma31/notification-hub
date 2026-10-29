import 'reflect-metadata';

import { container } from 'tsyringe';
import request from 'supertest';
import { TemplateRepository } from '../../../../src/shared-library/repositories/Template';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';
import { SeedDataResult, insertSeedData } from '../../../../scripts/seedData/insertSeedData';
import { logger } from '../../../common/utils/TestLogger';
import { TemplateInterface} from '../../../../src/shared-library/models/Template';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { UpdateTemplateRequest } from '../../../../src/server/types/request/UpdateTemplateRequest';

const appBaseUrl = 'http://localhost:4000';

let seedData: SeedDataResult;
const db = container.resolve(DatabaseConnector);
describe('Template API', () => {
  beforeAll(async () => {
    await db.connect('Template E2E Test:BeforeAll');
    seedData = await insertSeedData();
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('Template E2E Test:BeforeAll');
  });

  it('should handle POST /template for Email', async () => {
    const validPayload: Omit<TemplateInterface, 'organisationId' > = {
      name: 'Promotional Email Template E2E Test',
      channelType: ChannelType.EMAIL,
      templateDetails: {
        subject: 'Special Offer - {{recipient.name}}',
        body: "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Promotional Email</title></head><body style='font-family: Arial, sans-serif;'><table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%'><tr><td style='padding: 20px 0; text-align: center;'><h1>Special Offer!</h1></td></tr><tr><td><p>Hello {{recipient.name}},</p><p>We're excited to share a special offer with you!</p><p>Click the link below to claim your offer:</p><p><a href='{{data.offerUrl}}'>Claim Your Offer</a></p><p>Thank you for choosing us!</p></td></tr></table></body></html>",
        json: {},
      },
    };

    const response = await request(appBaseUrl)
      .post('/api/template')
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(201)
      .expect('Content-Type', 'application/json; charset=utf-8');

    const responseBody = JSON.parse(response.text);
    if (response.error) {
      logger.error(responseBody);
    }

    const templateRepository = new TemplateRepository();
    const template = await templateRepository.findTemplateById(responseBody.id, seedData.OrganisationId);

    expect(template!.name).toEqual(validPayload.name);
  });

  it('should handle POST /template for Push', async () => {
    const validPayload: Omit<TemplateInterface, 'organisationId' > = {
      name: 'Promotional Push Template E2E Test',
      channelType: ChannelType.PUSH,
      templateDetails: {
        title: 'Special Offer - {{recipient.name}}',
        body: "Hello, {{recipient.name}}. We're excited to share a special offer with you! Click the link {{data.offerUrl}}",
      },
    };

    const response = await request(appBaseUrl)
      .post('/api/template')
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(201)
      .expect('Content-Type', 'application/json; charset=utf-8');

    const responseBody = JSON.parse(response.text);
    if (response.error) {
      logger.error(responseBody);
    }

    const templateRepository = new TemplateRepository();
    const template = await templateRepository.findTemplateById(responseBody.id, seedData.OrganisationId);

    expect(template!.name).toEqual(validPayload.name);
  });

  it('should handle POST /template for slack', async () => {
    const validPayload: Omit<TemplateInterface, 'organisationId' > = {
      name: 'Promotional Slack Template E2E Test',
      channelType: ChannelType.SLACK,
      templateDetails: {
        text: "Hello there, I am a basic rich text block!",
        html: "<p><strong>bold</strong></p>"
        },
    };

    const response = await request(appBaseUrl)
      .post('/api/template')
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(201)
      .expect('Content-Type', 'application/json; charset=utf-8');

    const responseBody = JSON.parse(response.text);
    if (response.error) {
      logger.error(responseBody);
    }

    const templateRepository = new TemplateRepository();
    const template = await templateRepository.findTemplateById(responseBody.id, seedData.OrganisationId);

    expect(template!.name).toEqual(validPayload.name);
  });

  it('should handle POST /template for onDeck', async () => {
    const validPayload: Omit<TemplateInterface, 'organisationId' >  = {
      name: 'Promotional Ondeck Template E2E Test',
      channelType: ChannelType.ONDECK,
      templateDetails: {
        title: 'Special Offer - {{recipient.name}}',
        content: "Hello, {{recipient.name}}. We're excited to share a special offer with you!",
        actionUrl: "www.google.com"
      },
    };

    const response = await request(appBaseUrl)
      .post('/api/template')
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(201)
      .expect('Content-Type', 'application/json; charset=utf-8');

    const responseBody = JSON.parse(response.text);
    if (response.error) {
      logger.error(responseBody);
    }

    const templateRepository = new TemplateRepository();
    const template = await templateRepository.findTemplateById(responseBody.id, seedData.OrganisationId);

    expect(template!.name).toEqual(validPayload.name);
  });

  it('should handle update /template/:templateId/update for OnDeck', async () => {
    const createPayload: Omit<TemplateInterface, 'organisationId' > = {
      name: 'Initial onDeck Template E2E Test',
      channelType: ChannelType.ONDECK,
      templateDetails: {
        title: 'Initial Title',
        content: 'Initial content',
        actionUrl: 'http://initial-url.com'
      },
    };

    const createResponse = await request(appBaseUrl)
      .post('/api/template')
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(createPayload)
      .expect(201)
      .expect('Content-Type', 'application/json; charset=utf-8');

    const createdTemplateId = JSON.parse(createResponse.text).id;
   
    const updatePayload: UpdateTemplateRequest = {
      channelType: ChannelType.ONDECK,
      templateDetails: {
        title: 'Updated Title',
        content: 'Updated content',
        actionUrl: 'http://updated-url.com'
      }
        
    };

    await request(appBaseUrl)
      .post(`/api/template/${createdTemplateId}/update`)
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(updatePayload)
      .expect(200)
     
    const templateRepository = new TemplateRepository();
    const updatedTemplate = await templateRepository.findTemplateById(createdTemplateId, seedData.OrganisationId);
    expect(updatedTemplate).not.toBeNull();
    expect(updatedTemplate!.name).toEqual(createPayload.name);
    expect(updatedTemplate!.templateDetails.title).toEqual(updatePayload.templateDetails.title);
    expect(updatedTemplate!.templateDetails.content).toEqual(updatePayload.templateDetails.content);
    expect(updatedTemplate!.templateDetails.actionUrl).toEqual(updatePayload.templateDetails.actionUrl);
  });

  it('should handle update /template/:templateId/update for push', async () => {
    const createPayload: Omit<TemplateInterface, 'organisationId'> = {
      name: 'Initial Push Template E2E Test',
      channelType: ChannelType.PUSH,
      templateDetails: {
        title: 'Initial Push Title',
        body: 'Initial Push body content',
      },
    };
  
    const createResponse = await request(appBaseUrl)
      .post('/api/template')
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(createPayload)
      .expect(201);
    
    const createdTemplateId = JSON.parse(createResponse.text).id;
    
    const updatePayload: UpdateTemplateRequest = {
      channelType: ChannelType.PUSH,
      templateDetails: {
        title: 'Updated Push Title',
        body: 'Updated Push body content',
      },
    };
  
    await request(appBaseUrl)
      .post(`/api/template/${createdTemplateId}/update`)
      .set('Content-Type', 'application/json')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(updatePayload)
      .expect(200);
    
    const templateRepository = new TemplateRepository();
    const updatedTemplate = await templateRepository.findTemplateById(createdTemplateId, seedData.OrganisationId);
    
    expect(updatedTemplate).not.toBeNull();
    expect(updatedTemplate!.name).toEqual(createPayload.name);
    expect(updatedTemplate!.templateDetails.title).toEqual(updatePayload.templateDetails.title);
    expect(updatedTemplate!.templateDetails.body).toEqual(updatePayload.templateDetails.body);
  });

  it('should handle update /template/:templateId/update for email', async () => {
  const createPayload: Omit<TemplateInterface, 'organisationId'> = {
    name: 'Initial Email Template E2E Test',
    channelType: ChannelType.EMAIL,
    templateDetails: {
      subject: 'Initial Email Subject',
      body: 'Initial Email body content',
      json: {}
    },
  };

  const createResponse = await request(appBaseUrl)
    .post('/api/template')
    .set('Content-Type', 'application/json')
    .set('X-ORG-KEY', seedData.X_ORG_KEY)
    .send(createPayload)
    .expect(201);
  
  const createdTemplateId = JSON.parse(createResponse.text).id;
  
  const updatePayload: UpdateTemplateRequest = {
    channelType: ChannelType.EMAIL,
    templateDetails: {
      subject: 'Updated Email Subject',
      body: 'Updated Email body content',
      json: {}
    }
  };

  await request(appBaseUrl)
    .post(`/api/template/${createdTemplateId}/update`)
    .set('Content-Type', 'application/json')
    .set('X-ORG-KEY', seedData.X_ORG_KEY)
    .send(updatePayload)
    .expect(200);
  
  const templateRepository = new TemplateRepository();
  const updatedTemplate = await templateRepository.findTemplateById(createdTemplateId, seedData.OrganisationId);
  
  expect(updatedTemplate).not.toBeNull();
  expect(updatedTemplate!.name).toEqual(createPayload.name);
  expect(updatedTemplate!.templateDetails.subject).toEqual(updatePayload.templateDetails.subject);
  expect(updatedTemplate!.templateDetails.body).toEqual(updatePayload.templateDetails.body);
});

it('should handle update /template/:templateId/update for slack', async () => {
  const createPayload: Omit<TemplateInterface, 'organisationId'> = {
    name: 'Initial Slack Template E2E Test',
    channelType: ChannelType.SLACK,
    templateDetails: {
      text: 'Initial Slack markdown content',
      html: 'Initial Slack HTML content'
    },
  };

  const createResponse = await request(appBaseUrl)
    .post('/api/template')
    .set('Content-Type', 'application/json')
    .set('X-ORG-KEY', seedData.X_ORG_KEY)
    .send(createPayload)
    .expect(201);
  
  const createdTemplateId = JSON.parse(createResponse.text).id;
  
  const updatePayload: UpdateTemplateRequest = {
    channelType: ChannelType.SLACK,
    templateDetails: {
      text: 'Updated Slack markdown content',
      html: 'Updated Slack HTML content'
    }
  };

  await request(appBaseUrl)
    .post(`/api/template/${createdTemplateId}/update`)
    .set('Content-Type', 'application/json')
    .set('X-ORG-KEY', seedData.X_ORG_KEY)
    .send(updatePayload)
    .expect(200);
  
  const templateRepository = new TemplateRepository();
  const updatedTemplate = await templateRepository.findTemplateById(createdTemplateId, seedData.OrganisationId);
  
  expect(updatedTemplate).not.toBeNull();
  expect(updatedTemplate!.name).toEqual(createPayload.name);
  expect(updatedTemplate!.templateDetails.text).toEqual(updatePayload.templateDetails.text);
  expect(updatedTemplate!.templateDetails.html).toEqual(updatePayload.templateDetails.html);
});
  
  

});
