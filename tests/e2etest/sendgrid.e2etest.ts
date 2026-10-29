import 'dotenv/config';
import request from 'supertest';

describe('SendGrid Email E2E', () => {
  const baseUrl = 'http://localhost:4000';
  let orgKey: string;
  let orgId: string;

  beforeAll(async () => {
    // Create test organisation
    const orgResponse = await request(baseUrl)
      .post('/api/organisation')
      .set('X-ADMIN-KEY', process.env.ADMIN_KEY || 'test')
      .send({ name: `SendGrid Test Org ${Date.now()}` })
      .expect(201);

    orgKey = orgResponse.body.org_key;
    orgId = orgResponse.body.id;
  });

  describe('SendGrid Configuration', () => {
    it('should configure SendGrid email provider', async () => {
      const sendGridConfig = [
        {
          provider: 'SENDGRID',
          enabled: true,
          settings: {
            apiKey: 'SG.test_api_key_12345',
            fromEmail: 'test@example.com',
            fromName: 'Test Sender',
          },
        },
      ];

      await request(baseUrl)
        .post(`/api/organisation/${orgId}/settings/email`)
        .set('X-ADMIN-KEY', process.env.ADMIN_KEY || 'test')
        .send(sendGridConfig)
        .expect(200);
    });

    it('should retrieve SendGrid configuration', async () => {
      const response = await request(baseUrl)
        .get(`/api/organisation/${orgId}/settings`)
        .set('X-ADMIN-KEY', process.env.ADMIN_KEY || 'test')
        .expect(200);

      expect(response.body.email).toBeDefined();
      expect(response.body.email[0].provider).toBe('SENDGRID');
      expect(response.body.email[0].enabled).toBe(true);
    });
  });
});
