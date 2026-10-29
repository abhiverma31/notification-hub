import 'reflect-metadata';
import { container } from 'tsyringe';
import request from 'supertest';
import { insertSeedData, SeedDataResult } from '../../../../scripts/seedData/insertSeedData';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';
import { server } from '../../../../src/server/Server';
import { AuthHeaders } from '../../../../src/server/middlewares/Authentication';

const db = container.resolve(DatabaseConnector);

let seedData: SeedDataResult;

describe('Gupshup SMS Integration', () => {
  beforeAll(async () => {
    await db.connect('Gupshup SMS Integration Test:BeforeAll');
    seedData = await insertSeedData();
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('Gupshup SMS Integration Test:AfterAll');
  });

  describe('Configure Gupshup SMS Provider', () => {
    const getRoute = () => request(server.app).post(`/api/organisation/${seedData.OrganisationId}/settings/sms`);

    it('should return 200 when configuring Gupshup with valid settings', async () => {
      await getRoute()
        .set(AuthHeaders.admin, process.env.ADMIN_KEY!)
        .send([{
          provider: 'gupshup',
          enabled: true,
          settings: {
            userid: 'test_user',
            password: 'test_pass',
            mask: 'TESTER',
          },
        }])
        .expect(200);
    });

    it('should return 401 without auth header', async () => {
      await getRoute()
        .send([{
          provider: 'gupshup',
          enabled: true,
          settings: { userid: 'user', password: 'pass', mask: 'MASK' },
        }])
        .expect(401);
    });
  });

  describe('Configure Gupshup via combined SMS-WhatsApp endpoint', () => {
    const getRoute = () => request(server.app).post(`/api/organisation/${seedData.OrganisationId}/settings/sms-whatsapp`);

    it('should return 200 with valid Gupshup SMS settings', async () => {
      await getRoute()
        .set(AuthHeaders.admin, process.env.ADMIN_KEY!)
        .send({
          sms: [{
            provider: 'gupshup',
            enabled: true,
            settings: { userid: 'gup_user', password: 'gup_pass', mask: 'SENDER' },
          }],
          whatsapp: [],
        })
        .expect(200);
    });

    it('should return 422 with invalid Gupshup settings (missing mask)', async () => {
      await getRoute()
        .set(AuthHeaders.admin, process.env.ADMIN_KEY!)
        .send({
          sms: [{
            provider: 'gupshup',
            enabled: true,
            settings: { userid: 'gup_user', password: 'gup_pass' },
          }],
          whatsapp: [],
        })
        .expect(422);
    });
  });

  describe('Create SMS Template', () => {
    const getRoute = () => request(server.app).post('/api/template');

    it('should return 201 when creating an SMS template', async () => {
      const response = await getRoute()
        .set(AuthHeaders.orgOwner, seedData.X_ORG_KEY)
        .send({
          name: 'Test SMS Template',
          channelType: 'sms',
          templateDetails: { body: 'Your OTP is {{data.otp}}' },
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
    });

    it('should return 422 when creating SMS template without body', async () => {
      await getRoute()
        .set(AuthHeaders.orgOwner, seedData.X_ORG_KEY)
        .send({
          name: 'Invalid SMS Template',
          channelType: 'sms',
          templateDetails: { subject: 'wrong field' },
        })
        .expect(422);
    });
  });

  describe('Send SMS Notification via Gupshup', () => {
    let smsTemplateId: string;

    beforeAll(async () => {
      // Configure Gupshup
      await request(server.app)
        .post(`/api/organisation/${seedData.OrganisationId}/settings/sms`)
        .set(AuthHeaders.admin, process.env.ADMIN_KEY!)
        .send([{
          provider: 'gupshup',
          enabled: true,
          settings: { userid: 'test_user', password: 'test_pass', mask: 'TESTER' },
        }]);

      // Create SMS template
      const templateRes = await request(server.app)
        .post('/api/template')
        .set(AuthHeaders.orgOwner, seedData.X_ORG_KEY)
        .send({
          name: 'Gupshup OTP Template',
          channelType: 'sms',
          templateDetails: { body: 'Your OTP is {{data.otp}}. Valid for 5 min.' },
        });
      smsTemplateId = templateRes.body.id;
    });

    it('should return 202 when sending SMS notification with templateId', async () => {
      const response = await request(server.app)
        .post('/api/notification')
        .set(AuthHeaders.orgOwner, seedData.X_ORG_KEY)
        .send({
          recipients: [{
            email: 'smsuser@test.com',
            phone_number: '+919876543210',
            channels: ['sms'],
          }],
          channels: {
            sms: { templateId: smsTemplateId },
          },
          data: { otp: '4567' },
        })
        .expect(202);

      expect(response.body.transactions).toBeDefined();
      expect(response.body.transactions.length).toBe(1);
      expect(response.body.transactions[0].channel).toBe('sms');
    });

    it('should return 202 when sending SMS notification with inline template', async () => {
      const response = await request(server.app)
        .post('/api/notification')
        .set(AuthHeaders.orgOwner, seedData.X_ORG_KEY)
        .send({
          recipients: [{
            email: 'smsuser2@test.com',
            phone_number: '+919876543211',
            channels: ['sms'],
          }],
          channels: {
            sms: { template: { body: 'Hello from Gupshup!' } },
          },
          data: {},
        })
        .expect(202);

      expect(response.body.transactions).toBeDefined();
      expect(response.body.transactions[0].channel).toBe('sms');
    });
  });
});
