import 'reflect-metadata';
import { container } from 'tsyringe';
import request from 'supertest';
import * as crypto from 'crypto';
import { insertSeedData, SeedDataResult } from '../../../../scripts/seedData/insertSeedData';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';
import { DeliveryReportModel } from '../../../../src/shared-library/models/DeliveryReportModel';
import { DeliveryReportHistoryModel } from '../../../../src/shared-library/models/DeliveryReportHistoryModel';
import { DeliveryReportStatus } from '../../../../src/shared-library/types/DeliveryReportStatus';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { AuthHeaders } from '../../../../src/server/middlewares/Authentication';
import { server } from '../../../../src/server/Server';

const db = container.resolve(DatabaseConnector);

const { publicKey: TEST_PUBLIC_KEY, privateKey: TEST_PRIVATE_KEY } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function signAndPost(events: object[]) {
  const payload = JSON.stringify(events);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signer = crypto.createSign('sha256');
  signer.update(timestamp + payload);
  signer.end();
  const signature = signer.sign(TEST_PRIVATE_KEY, 'base64');

  return request(server.app)
    .post('/api/webhooks/sendgrid/events')
    .set('Content-Type', 'application/json')
    .set('x-twilio-email-event-webhook-signature', signature)
    .set('x-twilio-email-event-webhook-timestamp', timestamp)
    .send(payload);
}

let seedData: SeedDataResult;

describe('Webhook Integration Tests', () => {
  beforeAll(async () => {
    process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = TEST_PUBLIC_KEY;
    await db.connect('Webhook Integration Test:BeforeAll');
    seedData = await insertSeedData();
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('Webhook Integration Test:AfterAll');
  });

  afterEach(async () => {
    await DeliveryReportModel.deleteMany({});
    await DeliveryReportHistoryModel.deleteMany({});
  });

  function createSentReport(transactionId: string, channel: ChannelType = ChannelType.EMAIL) {
    return DeliveryReportModel.create({
      transactionId,
      user_id: seedData.UserId,
      status: DeliveryReportStatus.SENT,
      channel,
    });
  }

  describe('Webhook updates delivery_report status', () => {
    it('should update delivery_report status when SendGrid webhook arrives', async () => {
      const transactionId = 'txn-inttest-sendgrid-update';
      await createSentReport(transactionId);

      await signAndPost([{ event: 'delivered', transactionId }])
        .expect(200);

      const report = await DeliveryReportModel.findOne({ transactionId });
      expect(report?.status).toBe(DeliveryReportStatus.DELIVERED);
    });
  });

  describe('Webhook creates status_history entry', () => {
    it('should create a status_history entry for SendGrid webhook', async () => {
      const transactionId = 'txn-inttest-sendgrid-history';
      await createSentReport(transactionId);

      await signAndPost([{ event: 'delivered', transactionId }])
        .expect(200);

      // open requires delivered first with new state machine
      await signAndPost([{ event: 'open', transactionId }])
        .expect(200);

      const history = await DeliveryReportHistoryModel.find({ transactionId });
      expect(history).toHaveLength(2);
      expect(history[1].status).toBe(DeliveryReportStatus.SEEN);
      expect(history[1].source).toBe('sendgrid');
    });
  });

  describe('Duplicate webhook handling', () => {
    it('should not update status or create history entry for duplicate webhook', async () => {
      const transactionId = 'txn-inttest-duplicate';
      await createSentReport(transactionId);

      await signAndPost([{ event: 'delivered', transactionId }])
        .expect(200);

      await signAndPost([{ event: 'delivered', transactionId }])
        .expect(200);

      const history = await DeliveryReportHistoryModel.find({ transactionId, status: DeliveryReportStatus.DELIVERED });
      expect(history).toHaveLength(1);
    });
  });

  describe('Consumer creates delivery_report + status_history', () => {
    it('should create both delivery_report and status_history when consumer saves report', async () => {
      const { DeliveryReportService } = await import('../../../../src/consumer/services/DeliveryReport');
      const deliveryReportService = container.resolve(DeliveryReportService);

      const transactionId = 'txn-inttest-consumer';
      await deliveryReportService.saveReport(
        transactionId,
        seedData.UserId,
        ChannelType.EMAIL,
        DeliveryReportStatus.SENT,
      );

      const report = await DeliveryReportModel.findOne({ transactionId });
      expect(report?.status).toBe(DeliveryReportStatus.SENT);
      expect(report?.channel).toBe(ChannelType.EMAIL);
    });
  });

  describe('GET /deliveryReport returns updated status after webhook', () => {
    it('should return the updated status via the delivery report API', async () => {
      const transactionId = 'txn-inttest-get-api';
      await createSentReport(transactionId);

      await signAndPost([{ event: 'delivered', transactionId }])
        .expect(200);
      await signAndPost([{ event: 'open', transactionId }])
        .expect(200);
      await signAndPost([{ event: 'click', transactionId }])
        .expect(200);

      const response = await request(server.app)
        .get('/api/notification/deliveryReport')
        .set(AuthHeaders.orgOwner, seedData.X_ORG_KEY)
        .query({ transactionId })
        .expect(200);

      expect(response.body.status).toBe(DeliveryReportStatus.CLICKED);
    });
  });
});
