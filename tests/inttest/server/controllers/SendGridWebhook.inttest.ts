import 'reflect-metadata';
import { container } from 'tsyringe';
import request from 'supertest';
import * as crypto from 'crypto';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';
import { server } from '../../../../src/server/Server';
import { DeliveryReportRepository } from '../../../../src/shared-library/repositories/DeliveryReport';
import { DeliveryReportHistoryRepository } from '../../../../src/shared-library/repositories/DeliveryReportHistory';
import { DeliveryReportStatus } from '../../../../src/shared-library/types/DeliveryReportStatus';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';

const db = container.resolve(DatabaseConnector);
const deliveryReportRepo = container.resolve(DeliveryReportRepository);
const historyRepo = container.resolve(DeliveryReportHistoryRepository);

const { publicKey: TEST_PUBLIC_KEY, privateKey: TEST_PRIVATE_KEY } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

describe('SendGrid Webhook Integration', () => {
  beforeAll(async () => {
    process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = TEST_PUBLIC_KEY;
    await db.connect('SendGrid Webhook Integration Test');
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('SendGrid Webhook Integration Test');
  });

  afterEach(async () => {
    await db.clearTestDatabase();
  });

  const postEvents = (events: object[]) => {
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
  };

  describe('POST /api/webhooks/sendgrid/events', () => {
    it('should update delivery report using transactionId', async () => {
      await deliveryReportRepo.save({
        transactionId: 'txn-custom-args-1',
        user_id: 'user-1',
        status: DeliveryReportStatus.SENT,
        channel: ChannelType.EMAIL,
      });

      await postEvents([{
        email: 'test@example.com',
        timestamp: Date.now(),
        event: 'delivered',
        sg_message_id: 'sg-unrelated-id',
        sg_event_id: 'evt-1',
        transactionId: 'txn-custom-args-1',
      }]).expect(200);

      const report = await deliveryReportRepo.getReport('txn-custom-args-1');
      expect(report?.status).toBe(DeliveryReportStatus.DELIVERED);
    });

    it('should record all events in DeliveryReportHistory for a transaction', async () => {
      await deliveryReportRepo.save({
        transactionId: 'txn-history-1',
        user_id: 'user-2',
        status: DeliveryReportStatus.SENT,
        channel: ChannelType.EMAIL,
      });

      await postEvents([
        {
          email: 'test@example.com',
          timestamp: Date.now(),
          event: 'delivered',
          sg_message_id: 'sg-msg-1',
          sg_event_id: 'evt-2',
          transactionId: 'txn-history-1',
        },
        {
          email: 'test@example.com',
          timestamp: Date.now(),
          event: 'open',
          sg_message_id: 'sg-msg-1',
          sg_event_id: 'evt-3',
          transactionId: 'txn-history-1',
        },
      ]).expect(200);

      const history = await historyRepo.getHistoryByTransactionId('txn-history-1');
      expect(history).toHaveLength(2);
      expect(history[0].status).toBe(DeliveryReportStatus.DELIVERED);
      expect(history[1].status).toBe(DeliveryReportStatus.SEEN);
    });

    it('should progress forward: delivered then open results in SEEN', async () => {
      await deliveryReportRepo.save({
        transactionId: 'txn-forward-1',
        user_id: 'user-3',
        status: DeliveryReportStatus.SENT,
        channel: ChannelType.EMAIL,
      });

      await postEvents([{
        email: 'test@example.com',
        timestamp: Date.now(),
        event: 'delivered',
        sg_message_id: 'sg-msg-2',
        sg_event_id: 'evt-4',
        transactionId: 'txn-forward-1',
      }]).expect(200);

      await postEvents([{
        email: 'test@example.com',
        timestamp: Date.now(),
        event: 'open',
        sg_message_id: 'sg-msg-2',
        sg_event_id: 'evt-5',
        transactionId: 'txn-forward-1',
      }]).expect(200);

      const report = await deliveryReportRepo.getReport('txn-forward-1');
      expect(report?.status).toBe(DeliveryReportStatus.SEEN);
    });

    it('should block regression: open then delivered keeps SEEN', async () => {
      await deliveryReportRepo.save({
        transactionId: 'txn-regress-1',
        user_id: 'user-4',
        status: DeliveryReportStatus.SEEN,
        channel: ChannelType.EMAIL,
      });

      await postEvents([{
        email: 'test@example.com',
        timestamp: Date.now(),
        event: 'delivered',
        sg_message_id: 'sg-msg-3',
        sg_event_id: 'evt-6',
        transactionId: 'txn-regress-1',
      }]).expect(200);

      const report = await deliveryReportRepo.getReport('txn-regress-1');
      expect(report?.status).toBe(DeliveryReportStatus.SEEN);
    });

    it('should skip events without transactionId (no sg_message_id fallback)', async () => {
      await deliveryReportRepo.save({
        transactionId: 'sg-fallback-id',
        user_id: 'user-5',
        status: DeliveryReportStatus.SENT,
        channel: ChannelType.EMAIL,
      });

      await postEvents([{
        email: 'test@example.com',
        timestamp: Date.now(),
        event: 'delivered',
        sg_message_id: 'sg-fallback-id',
        sg_event_id: 'evt-7',
      }]).expect(200);

      const report = await deliveryReportRepo.getReport('sg-fallback-id');
      expect(report?.status).toBe(DeliveryReportStatus.SENT);
    });
  });
});
