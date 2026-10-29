import 'reflect-metadata';
import 'dotenv/config';
import { container } from 'tsyringe';
import request from 'supertest';
import { server } from '../../../../src/server/Server';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';
import { insertSeedData, SeedDataResult } from '../../../../scripts/seedData/insertSeedData';
import { AuthHeaders } from '../../../../src/server/middlewares/Authentication';

const db = container.resolve(DatabaseConnector);

describe('Test Email Integration Tests', () => {
  let seedData: SeedDataResult;

  beforeAll(async () => {
    await db.connect('TestEmail Integration Test');
    seedData = await insertSeedData();
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('TestEmail Integration Test');
  });

  describe('POST /api/organisation/:orgId/test-email', () => {
    it('should reject invalid email format', async () => {
      const response = await request(server.app)
        .post(`/api/organisation/${seedData.OrganisationId}/test-email`)
        .set(AuthHeaders.orgOwner, seedData.X_ORG_KEY)
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
    });

    it('should reject when no email provider configured', async () => {
      // Seed data org has no email settings configured by default
      const response = await request(server.app)
        .post(`/api/organisation/${seedData.OrganisationId}/test-email`)
        .set(AuthHeaders.orgOwner, seedData.X_ORG_KEY)
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(server.app)
        .post(`/api/organisation/${seedData.OrganisationId}/test-email`)
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(401);
    });
  });
});
