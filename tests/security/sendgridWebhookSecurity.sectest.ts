import 'reflect-metadata';
import { container } from 'tsyringe';
import request from 'supertest';
import { DatabaseConnector } from '../../src/shared-library/connectors/DatabaseConnector';
import { DeliveryReportModel } from '../../src/shared-library/models/DeliveryReportModel';
import { DeliveryReportHistoryModel } from '../../src/shared-library/models/DeliveryReportHistoryModel';
import { DeliveryReportStatus } from '../../src/shared-library/types/DeliveryReportStatus';
import { ChannelType } from '../../src/shared-library/types/Enum/ChannelType';
import { server } from '../../src/server/Server';

const db = container.resolve(DatabaseConnector);
const app = server.app;

function sendEvent(events: object[]) {
  return request(app)
    .post('/api/webhooks/sendgrid/events')
    .set('Content-Type', 'application/json')
    .send(events);
}

describe('SendGrid Webhook Security Tests', () => {
  beforeAll(async () => {
    await db.connect('Security Test:BeforeAll');
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('Security Test:AfterAll');
  });

  afterEach(async () => {
    await DeliveryReportModel.deleteMany({});
    await DeliveryReportHistoryModel.deleteMany({});
  });

  function createSentReport(transactionId: string) {
    return DeliveryReportModel.create({
      transactionId,
      user_id: 'user-sec-test',
      status: DeliveryReportStatus.SENT,
      channel: ChannelType.EMAIL,
      organisation_id: 'org-sec-test',
    });
  }

  // ============================================================
  // SECTION 2: Denial of Service (DoS)
  // ============================================================
  describe('2. Denial of Service (DoS)', () => {
    it('2.1 - Rate limiting is configured (skipped in test env, verified via config)', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const promises = Array.from({ length: 110 }, (_, i) =>
        sendEvent([{ event: 'delivered', transactionId: `flood-${i}` }]),
      );
      const responses = await Promise.all(promises);
      const throttled = responses.some((r) => r.status === 429);
      expect(throttled).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('2.2 - Large array payload should be rejected (max events limit)', async () => {
      const events = Array.from({ length: 1001 }, (_, i) => ({
        event: 'delivered',
        transactionId: `bomb-${i}`,
      }));
      const res = await sendEvent(events);
      expect(res.status).toBe(400);
    });

    it('2.3 - Oversized request body should be rejected with 413', async () => {
      const largeString = 'x'.repeat(2 * 1024 * 1024);
      const events = [{ event: 'delivered', transactionId: 'large', reason: largeString }];

      const res = await request(app)
        .post('/api/webhooks/sendgrid/events')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(events));

      expect(res.status).toBe(413);
    });

    it('2.7 - Repeated invalid transactionIds handled efficiently', async () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        event: 'delivered',
        transactionId: `nonexistent-${i}`,
      }));

      const start = Date.now();
      const res = await sendEvent(events);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(5000);
    });
  });

  // ============================================================
  // SECTION 5: Input Validation & Injection
  // ============================================================
  describe('5. Input Validation & Injection', () => {
    it('5.1 - NoSQL injection in transactionId should be rejected by TSOA validation', async () => {
      const res = await request(app)
        .post('/api/webhooks/sendgrid/events')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify([{ event: 'delivered', transactionId: { $gt: '' } }]));

      expect([400, 422]).toContain(res.status);
    });

    it('5.7 - Extremely long string in transactionId should be skipped', async () => {
      const longId = 'a'.repeat(300);
      const res = await sendEvent([{ event: 'delivered', transactionId: longId }]);
      expect(res.status).toBe(200);

      const history = await DeliveryReportHistoryModel.find({ transactionId: longId });
      expect(history).toHaveLength(0);
    });

    it('5.8 - Invalid/unknown event type should be handled gracefully', async () => {
      const res = await sendEvent([{ event: 'nonexistent_type', transactionId: 'txn-invalid-event' }]);
      expect(res.status).toBe(200);
    });

    it('5.9 - Negative timestamp in payload is accepted (not used for logic)', async () => {
      const res = await sendEvent([{ event: 'delivered', transactionId: 'txn-neg-ts', timestamp: -9999 }]);
      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // SECTION 6: Information Disclosure
  // ============================================================
  describe('6. Information Disclosure', () => {
    it('6.1 - Malformed body should NOT leak stack traces', async () => {
      const res = await request(app)
        .post('/api/webhooks/sendgrid/events')
        .set('Content-Type', 'application/json')
        .send('not-valid-json{{{');

      expect(res.body.details).toBeUndefined();
      expect(res.body.stack).toBeUndefined();
      if (res.body.message) {
        expect(res.body.message).not.toContain('at ');
      }
    });

    it('6.4 - X-Powered-By header should NOT be present', async () => {
      const res = await sendEvent([{ event: 'delivered', transactionId: 'test-headers' }]);
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('6.5 - OPTIONS should not reveal sensitive info', async () => {
      const res = await request(app).options('/webhooks/sendgrid');
      if (res.headers['allow']) {
        expect(res.headers['allow']).not.toContain('TRACE');
      }
    });
  });

  // ============================================================
  // SECTION 10: Business Logic Attacks
  // ============================================================
  describe('10. Business Logic Attacks', () => {
    it('10.1 - Replay attack: duplicate events should be deduplicated', async () => {
      await createSentReport('txn-replay');

      await sendEvent([{ event: 'delivered', transactionId: 'txn-replay' }]);
      await sendEvent([{ event: 'delivered', transactionId: 'txn-replay' }]);

      const history = await DeliveryReportHistoryModel.find({
        transactionId: 'txn-replay',
        status: DeliveryReportStatus.DELIVERED,
      });
      expect(history).toHaveLength(1);
    });

    it('10.3 - Status progression bypass: click without delivered first should be blocked', async () => {
      await createSentReport('txn-skip-states');

      await sendEvent([{ event: 'click', transactionId: 'txn-skip-states' }]);

      const report = await DeliveryReportModel.findOne({ transactionId: 'txn-skip-states' });
      expect(report?.status).toBe(DeliveryReportStatus.SENT);
    });
  });

  // ============================================================
  // SECTION 11: Application-Level Vulnerabilities
  // ============================================================
  describe('11. Application-Level Vulnerabilities', () => {
    it('11.3 - Content-Type text/plain should be rejected', async () => {
      const res = await request(app)
        .post('/api/webhooks/sendgrid/events')
        .set('Content-Type', 'text/plain')
        .send(JSON.stringify([{ event: 'delivered', transactionId: 'txn-ct' }]));

      expect([400, 401, 415, 422]).toContain(res.status);
    });

    it('11.4 - Unusual charset should be handled safely (no 500)', async () => {
      const res = await request(app)
        .post('/api/webhooks/sendgrid/events')
        .set('Content-Type', 'application/json; charset=utf-16')
        .send(JSON.stringify([{ event: 'delivered', transactionId: 'txn-charset' }]));

      expect([400, 401, 415, 422]).toContain(res.status);
    });
  });
});
