import 'reflect-metadata';
import { container } from 'tsyringe';
import request from 'supertest';
import { insertSeedData, SeedDataResult } from '../../../../scripts/seedData/insertSeedData';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';
import { SendNotificationRequest } from '../../../../src/server/types/request/SendNotification';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { server } from '../../../../src/server/Server';
import { AuthHeaders } from '../../../../src/server/middlewares/Authentication';

const db = container.resolve(DatabaseConnector);

let seedData: SeedDataResult;

let validPayload: SendNotificationRequest;

describe('Notification API', () => {
  beforeAll(async () => {
    await db.connect('Notification Integration Test:BeforeAll');
    seedData = await insertSeedData();
    validPayload = {
      source: 'web-app',
      recipients: [
        {
          email: seedData.UserEmail,
          name: {
            first: 'firstName',
            last: 'lastName',
          },
          fcmToken:
            ['eSiDj3WH6T3pND7CTf2zqc:APA91bFzuK_3l0zLBJ-0r8KUncXh9B9CFUQ6GvWC4XF-LUo_0ARvmbnkimjH37J_RHhBv3Yjt1lNOuj-28jEQeMWdvQP3Vj6MM5PPTvKUtPdK9JIpXVzFB0aCDs-APyP5of1iQplkSGO'],
          channels: [ChannelType.EMAIL, ChannelType.PUSH, ChannelType.ONDECK],
        },
      ],
      channels: {
        email: {
          templateId: seedData.EmailTemplateId,
        },
        push: {
          templateId: seedData.PushTemplateId,
        },
        onDeck: {
          templateId: seedData.OnDeckTemplateId,
        },
      },
      data: {
        title: 'test title',
        content: 'test content',
        actionUrl: 'https://google.com/',
        offerUrl: 'https://google.com/',
      },
    };
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('Notification Integration Test:AfterAll');
  });

  describe('Send Notification', () => {
    const route = request(server.app).post('/api/notification');

    it('should return 202 Accepted with valid X-ORG-KEY', async () => {
      await route.set(AuthHeaders.orgOwner, seedData.X_ORG_KEY).send(validPayload).expect(202);
    });

    it('should return 401 Unauthorized with invalid X-ORG-KEY', async () => {
      await route.set(AuthHeaders.orgOwner, 'invalid').send(validPayload).expect(401);
    });

    it('should return 401 Unauthorized without any Auth Headers', async () => {
      await route.send(validPayload).expect(401);
    });

    it('should return 401 Unauthorized with valid X-ORG-LP-KEY', async () => {
      await route.set(AuthHeaders.orgLp, seedData.X_ORG_LP_KEY).send(validPayload).expect(401);
    });

    it('should return 401 Unauthorized with valid X-ORG-USER-KEY', async () => {
      await route.set(AuthHeaders.orgUser, seedData.X_ORG_USER_KEY).send(validPayload).expect(401);
    });
  });
});
