import 'reflect-metadata';
import { container } from 'tsyringe';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';
import request from 'supertest';
import { OnDeckNotification, OnDeckNotificationModel } from '../../../../src/shared-library/models/OnDeck';
import { SeedDataResult, insertSeedData } from '../../../../scripts/seedData/insertSeedData';
import { logger } from '../../../common/utils/TestLogger';
import { OnDeckNotificationViewModel } from '../../../../src/server/types/view/OnDeckNotification';

const appBaseUrl = 'http://localhost:4000';
let seedData: SeedDataResult;
let responseId: string;
const db = container.resolve(DatabaseConnector);

describe('onDeck API', () => {
  beforeAll(async () => {
    await db.connect('OnDeck E2E Test:BeforeAll');
    seedData = await insertSeedData();

    logger.traceStart('Inserting notifications into DB for on-deck testing');

    const payloads = [
      {
        title: 'test sample #1',
        content: 'test content 1',
        actionUrl: 'https://google.com/',
      },
      {
        title: 'test sample #2',
        content: 'test content 2',
        actionUrl: 'https://technogise.com/',
      },
      {
        title: 'test sample #3',
        content: 'test content 3',
        actionUrl: 'https://technogise.com/',
      },
      {
        title: 'test sample #4',
        content: 'test content 4',
        actionUrl: 'https://technogise.com/',
      },
    ];

    for (const payload of payloads) {
      await OnDeckNotificationModel.create({
        title: payload.title,
        content: payload.content,
        actionUrl: payload.actionUrl,
        recipient_id: `${seedData.OrganisationId}::test@test.com`,
        source_creation_timestamp: Date.now(),
      });
    }

    logger.traceEnd('Inserting notifications into DB for on-deck testing');
  }, 80000);

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('OnDeck E2E Test:AfterAll');
  });

  describe('Scenario 1: Get notifications /api/notification/on-deck as per pagination parameters for onDeck', () => {
    it('should get the latest notification at page 0', async () => {
      const response = await request(appBaseUrl)
        .get('/api/notification/on-deck')
        .set('X-ORG-LP-KEY', seedData.X_ORG_LP_KEY)
        .set('X-USER-ID', seedData.UserEmail)
        .query({ page: 0, itemsPerPage: 2 })
        .expect(200);
      expect(response.body.length).toBe(2);
    });

    it('should get the older notification at page 1', async () => {
      const response = await request(appBaseUrl)
        .get('/api/notification/on-deck')
        .set('X-ORG-LP-KEY', seedData.X_ORG_LP_KEY)
        .set('X-USER-ID', seedData.UserEmail)
        .query({ page: 1, itemsPerPage: 2 })
        .expect(200);
      expect(response.body.length).toBe(2);
    });
  });

  describe('Scenario 2: Get and Modify OnDeck Notifications', () => {
    it('should Get onDeck notification from /api/notification/on-deck', async () => {
      const response = await request(appBaseUrl)
        .get('/api/notification/on-deck')
        .set('X-ORG-LP-KEY', seedData.X_ORG_LP_KEY)
        .set('X-USER-ID', seedData.UserEmail)
        .query({ page: 0, itemsPerPage: 10 })
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);

      responseId = response.body[0].id;
      const onDeck: OnDeckNotificationViewModel = response.body[0];

      console.log(response.body);

      expect(onDeck.recipient).toBe(`test@test.com`);
      expect(onDeck.is_read).toBeFalsy();
      expect(onDeck.is_archived).toBeFalsy();
    });

    it('should  mark notification as read', async () => {
      const id = responseId;
      await request(appBaseUrl)
        .put(`/api/notification/on-deck/${id}/read`)
        .set('X-ORG-LP-KEY', seedData.X_ORG_LP_KEY)
        .set('X-USER-ID', seedData.UserEmail)
        .query('id' )
        .send({});

      const onDeckNotificationRead: OnDeckNotification[] = await OnDeckNotificationModel.find({ _id: id });
      expect(onDeckNotificationRead[0].read_at).toBeDefined();
    });

    it('should  mark notification as Unread', async () => {
      const id = responseId;
      await request(appBaseUrl)
        .put(`/api/notification/on-deck/${id}/unread`)
        .set('X-ORG-LP-KEY', seedData.X_ORG_LP_KEY)
        .set('X-USER-ID', seedData.UserEmail)
        .send({});
      const onDeckNotificationUnread: OnDeckNotification[] = await OnDeckNotificationModel.find({ _id: id });
      expect(onDeckNotificationUnread[0].read_at).not.toBeTruthy();
      expect(onDeckNotificationUnread[0].archived_at).toBeUndefined();
    });

    it('should mark all notification as read', async () => {
      await request(appBaseUrl)
        .put('/api/notification/on-deck/readAll')
        .set('X-ORG-LP-KEY', seedData.X_ORG_LP_KEY)
        .set('X-USER-ID', seedData.UserEmail)
        .send({});
      const onDeckNotificationReadAll: OnDeckNotification[] = await OnDeckNotificationModel.find({});

      expect(onDeckNotificationReadAll[0].read_at).toBeDefined();
      expect(onDeckNotificationReadAll[1].read_at).toBeDefined();
      expect(onDeckNotificationReadAll[2].read_at).toBeDefined();
      expect(onDeckNotificationReadAll[3].read_at).toBeDefined();
    });

    it('should  mark notification as archived', async () => {
      const id = responseId;
      await request(appBaseUrl)
        .delete(`/api/notification/on-deck/${id}/archive`)
        .set('X-ORG-LP-KEY', seedData.X_ORG_LP_KEY)
        .set('X-USER-ID', seedData.UserEmail)
        .send({});
      const onDeckNotificationArchive: OnDeckNotification[] = await OnDeckNotificationModel.find({ _id: id });
      expect(onDeckNotificationArchive[0].archived_at).toBeDefined();
    });

    it('should return only 3 notifications from get /api/notification/on-deck after archive', async () => {
      const response = await request(appBaseUrl)
        .get('/api/notification/on-deck')
        .set('X-ORG-LP-KEY', seedData.X_ORG_LP_KEY)
        .set('X-USER-ID', seedData.UserEmail)
        .query({ page: 0, itemsPerPage: 10 })
        .expect(200);
      expect(response.body.length).toBe(3);
    });
  });
});
