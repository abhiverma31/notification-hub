import 'reflect-metadata';
import { container } from 'tsyringe';
import request from 'supertest';
import { insertSeedData, SeedDataResult } from '../../../../scripts/seedData/insertSeedData';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';
import { server } from '../../../../src/server/Server';
import { AuthHeaders } from '../../../../src/server/middlewares/Authentication';
import { OnDeckNotificationModel } from '../../../../src/shared-library/models/OnDeck';
import supertest from 'supertest';
import { UserId } from '../../../../src/shared-library/models/User';

describe('On Deck API', () => {
  const db: DatabaseConnector = container.resolve(DatabaseConnector);
  let seedData: SeedDataResult;
  let seedNotificationId: string;

  beforeAll(async () => {
    await db.connect('OnDeck Integration Test:BeforeAll');
    await db.clearTestDatabase();
    seedData = await insertSeedData();
    seedNotificationId = (
      await OnDeckNotificationModel.create({
        title: 'Test Title',
        content: 'Test Content',
        actionUrl: 'Test Action URL',
        recipient_id: UserId.build(seedData.OrganisationId, seedData.UserEmail),
        source_creation_timestamp: Date.now(),
        source: 'Test',
      })
    )._id;
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('OnDeck Integration Test:AfterAll');
  });

  describe('Get Notifications', () => {
    const req = request(server.app).get('/api/notification/on-deck');

    it('should return 401 Unauthorized with valid X-ORG-KEY', async () => {
      await req.set(AuthHeaders.orgOwner, seedData.X_ORG_KEY).send().expect(401);
    });

    it('should return 204 No Content with valid X-ORG-LP-KEY', async () => {
      await req
        .set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY)
        .set(AuthHeaders.userId, seedData.UserEmail)
        .send()
        .expect(200);
    });

    it('should return 204 No Content with valid X-ORG-USER-KEY', async () => {
      await req.set(AuthHeaders.orgUser, seedData.X_ORG_USER_KEY).send().expect(200);
    });

    it('should return 401 Unauthorized with invalid X-ORG-KEY', async () => {
      await req.set(AuthHeaders.orgOwner, 'invalid').send().expect(401);
    });

    it('should return 401 Unauthorized with invalid X-ORG-LP-KEY', async () => {
      await req.set(AuthHeaders.orgLp, 'invalid').set(AuthHeaders.userId, seedData.UserEmail).send().expect(401);
    });

    it('should return 403 Forbidden with valid X-ORG-LP-KEY but invalid X-USER-ID', async () => {
      await req.set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY).set(AuthHeaders.userId, 'invalid').send().expect(403);
    });

    it('should return 401 Unauthorized with invalid X-ORG-USER-KEY', async () => {
      await req.set(AuthHeaders.orgUser, 'invalid').send().expect(401);
    });

    it('should return 401 Unauthorized without any Auth Headers', async () => {
      await req.send().expect(401);
    });
  });

  describe('Read Notification', () => {
    let req: supertest.Test;

    beforeAll(() => {
      req = request(server.app).put(`/api/notification/on-deck/${seedNotificationId}/read`);
    });

    it('should return 401 Unauthorized with valid X-ORG-KEY', async () => {
      await req.set(AuthHeaders.orgOwner, seedData.X_ORG_KEY).send().expect(401);
    });

    it('should return 204 No Content with valid X-ORG-LP-KEY', async () => {
      await req
        .set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY)
        .set(AuthHeaders.userId, seedData.UserEmail)
        .send()
        .expect(204);
    });

    it('should return 204 No Content with valid X-ORG-USER-KEY', async () => {
      await req.set(AuthHeaders.orgUser, seedData.X_ORG_USER_KEY).send().expect(204);
    });

    it('should return 401 Unauthorized with invalid X-ORG-KEY', async () => {
      await req.set(AuthHeaders.orgOwner, 'invalid').send().expect(401);
    });

    it('should return 401 Unauthorized with invalid X-ORG-LP-KEY', async () => {
      await req.set(AuthHeaders.orgLp, 'invalid').set(AuthHeaders.userId, seedData.UserEmail).send().expect(401);
    });

    it('should return 403 Forbidden with valid X-ORG-LP-KEY but invalid X-USER-ID', async () => {
      await req.set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY).set(AuthHeaders.userId, 'invalid').send().expect(403);
    });

    it('should return 401 Unauthorized with invalid X-ORG-USER-KEY', async () => {
      await req.set(AuthHeaders.orgUser, 'invalid').send().expect(401);
    });

    it('should return 401 Unauthorized without any Auth Headers', async () => {
      await req.send().expect(401);
    });
  });

  describe('Unread Notification', () => {
    let req: supertest.Test;

    beforeAll(() => {
      req = request(server.app).put(`/api/notification/on-deck/${seedNotificationId}/unread`);
    });

    it('should return 401 Unauthorized with valid X-ORG-KEY', async () => {
      await req.set(AuthHeaders.orgOwner, seedData.X_ORG_KEY).send().expect(401);
    });

    it('should return 204 No Content with valid X-ORG-LP-KEY', async () => {
      await req
        .set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY)
        .set(AuthHeaders.userId, seedData.UserEmail)
        .send()
        .expect(204);
    });

    it('should return 401 Unauthorized with valid X-ORG-USER-KEY', async () => {
      await req.set(AuthHeaders.orgUser, seedData.X_ORG_USER_KEY).send().expect(401);
    });

    it('should return 401 Unauthorized with invalid X-ORG-KEY', async () => {
      await req.set(AuthHeaders.orgOwner, 'invalid').send().expect(401);
    });

    it('should return 401 Unauthorized with invalid X-ORG-LP-KEY', async () => {
      await req.set(AuthHeaders.orgLp, 'invalid').set(AuthHeaders.userId, seedData.UserEmail).send().expect(401);
    });

    it('should return 403 Forbidden with valid X-ORG-LP-KEY but invalid X-USER-ID', async () => {
      await req.set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY).set(AuthHeaders.userId, 'invalid').send().expect(403);
    });

    it('should return 401 Unauthorized with invalid X-ORG-USER-KEY', async () => {
      await req.set(AuthHeaders.orgUser, 'invalid').send().expect(401);
    });

    it('should return 401 Unauthorized without any Auth Headers', async () => {
      await req.send().expect(401);
    });
  });

  describe('Read All Notifications', () => {
    let req: supertest.Test;

    beforeAll(() => {
      req = request(server.app).put(`/api/notification/on-deck/readAll`).query({ emailId: seedData.UserEmail });
    });

    it('should return 401 Unauthorized with valid X-ORG-KEY', async () => {
      await req.set(AuthHeaders.orgOwner, seedData.X_ORG_KEY).send().expect(401);
    });

    it('should return 204 No Content with valid X-ORG-LP-KEY', async () => {
      await req
        .set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY)
        .set(AuthHeaders.userId, seedData.UserEmail)
        .send()
        .expect(204);
    });

    it('should return 401 Unauthorised with valid X-ORG-USER-KEY', async () => {
      await req.set(AuthHeaders.orgUser, seedData.X_ORG_USER_KEY).send().expect(401);
    });

    it('should return 401 Unauthorized with invalid X-ORG-KEY', async () => {
      await req.set(AuthHeaders.orgOwner, 'invalid').send().expect(401);
    });

    it('should return 401 Unauthorized with invalid X-ORG-LP-KEY', async () => {
      await req.set(AuthHeaders.orgLp, 'invalid').set(AuthHeaders.userId, seedData.UserEmail).send().expect(401);
    });

    it('should return 403 Forbidden with valid X-ORG-LP-KEY but invalid X-USER-ID', async () => {
      await req.set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY).set(AuthHeaders.userId, 'invalid').send().expect(403);
    });

    it('should return 401 Unauthorized with invalid X-ORG-USER-KEY', async () => {
      await req.set(AuthHeaders.orgUser, 'invalid').send().expect(401);
    });

    it('should return 401 Unauthorized without any Auth Headers', async () => {
      await req.send().expect(401);
    });
  });

  describe('View All Notifications', () => {
    let req: supertest.Test;

    beforeAll(() => {
      req = request(server.app).put(`/api/notification/on-deck/viewAll`).query({ emailId: seedData.UserEmail });
    });

    it('should return 401 Unauthorized with valid X-ORG-KEY', async () => {
      await req.set(AuthHeaders.orgOwner, seedData.X_ORG_KEY).send().expect(401);
    });

    it('should return 204 No Content with valid X-ORG-LP-KEY', async () => {
      await req
        .set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY)
        .set(AuthHeaders.userId, seedData.UserEmail)
        .send()
        .expect(204);
    });

    it('should return 401 Unauthorised with valid X-ORG-USER-KEY', async () => {
      await req.set(AuthHeaders.orgUser, seedData.X_ORG_USER_KEY).send().expect(401);
    });

    it('should return 401 Unauthorized with invalid X-ORG-KEY', async () => {
      await req.set(AuthHeaders.orgOwner, 'invalid').send().expect(401);
    });

    it('should return 401 Unauthorized with invalid X-ORG-LP-KEY', async () => {
      await req.set(AuthHeaders.orgLp, 'invalid').set(AuthHeaders.userId, seedData.UserEmail).send().expect(401);
    });

    it('should return 403 Forbidden with valid X-ORG-LP-KEY but invalid X-USER-ID', async () => {
      await req.set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY).set(AuthHeaders.userId, 'invalid').send().expect(403);
    });

    it('should return 401 Unauthorized with invalid X-ORG-USER-KEY', async () => {
      await req.set(AuthHeaders.orgUser, 'invalid').send().expect(401);
    });

    it('should return 401 Unauthorized without any Auth Headers', async () => {
      await req.send().expect(401);
    });
  });

  describe('View All Notifications', () => {
    let req: supertest.Test;

    beforeAll(() => {
      req = request(server.app).delete(`/api/notification/on-deck/${seedNotificationId}/archive`);
    });

    it('should return 401 Unauthorized with valid X-ORG-KEY', async () => {
      await req.set(AuthHeaders.orgOwner, seedData.X_ORG_KEY).send().expect(401);
    });

    it('should return 204 No Content with valid X-ORG-LP-KEY', async () => {
      await req
        .set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY)
        .set(AuthHeaders.userId, seedData.UserEmail)
        .send()
        .expect(204);
    });

    it('should return 401 Unauthorised with valid X-ORG-USER-KEY', async () => {
      await req.set(AuthHeaders.orgUser, seedData.X_ORG_USER_KEY).send().expect(401);
    });

    it('should return 401 Unauthorized with invalid X-ORG-KEY', async () => {
      await req.set(AuthHeaders.orgOwner, 'invalid').send().expect(401);
    });

    it('should return 401 Unauthorized with invalid X-ORG-LP-KEY', async () => {
      await req.set(AuthHeaders.orgLp, 'invalid').set(AuthHeaders.userId, seedData.UserEmail).send().expect(401);
    });

    it('should return 403 Forbidden with valid X-ORG-LP-KEY but invalid X-USER-ID', async () => {
      await req.set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY).set(AuthHeaders.userId, 'invalid').send().expect(403);
    });

    it('should return 401 Unauthorized with invalid X-ORG-USER-KEY', async () => {
      await req.set(AuthHeaders.orgUser, 'invalid').send().expect(401);
    });

    it('should return 401 Unauthorized without any Auth Headers', async () => {
      await req.send().expect(401);
    });
  });
});
