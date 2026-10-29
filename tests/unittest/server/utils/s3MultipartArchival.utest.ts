import { getDailyArchiveKey } from '../../../../src/server/utils/s3MultipartArchival';

describe('s3MultipartArchival', () => {
  describe('getDailyArchiveKey', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('generates correct S3 key path structure', () => {
      const date = new Date('2024-04-05T10:30:00Z');
      const key = getDailyArchiveKey('Notification', date);

      expect(key).toMatch(/^Notification\/2024\/04\/05\/notification-2024-04-05-\d+-[a-z0-9]+\.ndjson$/);
    });

    it('includes timestamp in filename', () => {
      const date = new Date('2024-04-05T10:30:00Z');
      const beforeTimestamp = Date.now();
      const key = getDailyArchiveKey('Notification', date);
      const afterTimestamp = Date.now();

      // Extract timestamp from filename
      const match = key.match(/notification-2024-04-05-(\d+)-[a-z0-9]+\.ndjson$/);
      expect(match).not.toBeNull();
      
      const timestamp = parseInt(match![1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(timestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it('includes Lambda execution ID when AWS_REQUEST_ID is set', () => {
      process.env.AWS_REQUEST_ID = 'abc12345-test-request-id';
      
      const date = new Date('2024-04-05T10:30:00Z');
      const key = getDailyArchiveKey('Notification', date);

      expect(key).toContain('abc12345-test-request-id');
      expect(key).toMatch(/notification-2024-04-05-\d+-abc12345-test-request-id\.ndjson$/);
    });

    it('uses random ID when AWS_REQUEST_ID is not set', () => {
      delete process.env.AWS_REQUEST_ID;
      
      const date = new Date('2024-04-05T10:30:00Z');
      const key1 = getDailyArchiveKey('Notification', date);
      const key2 = getDailyArchiveKey('Notification', date);

      // Both should have valid format
      expect(key1).toMatch(/^Notification\/2024\/04\/05\/notification-2024-04-05-\d+-[a-z0-9]+\.ndjson$/);
      expect(key2).toMatch(/^Notification\/2024\/04\/05\/notification-2024-04-05-\d+-[a-z0-9]+\.ndjson$/);

      // Random IDs should be different
      expect(key1).not.toBe(key2);
    });

    it('handles different collection names correctly', () => {
      process.env.AWS_REQUEST_ID = 'test-id';
      const date = new Date('2024-04-05T10:30:00Z');

      const notificationKey = getDailyArchiveKey('Notification', date);
      const deliveryKey = getDailyArchiveKey('DeliveryReportHistory', date);

      expect(notificationKey).toContain('Notification/2024/04/05/notification-');
      expect(deliveryKey).toContain('DeliveryReportHistory/2024/04/05/deliveryreporthistory-');
    });

    it('generates unique keys for concurrent executions', () => {
      // Simulate two Lambda executions
      process.env.AWS_REQUEST_ID = 'execution-1';
      const key1 = getDailyArchiveKey('Notification', new Date('2024-04-05'));

      process.env.AWS_REQUEST_ID = 'execution-2';
      const key2 = getDailyArchiveKey('Notification', new Date('2024-04-05'));

      // Keys should be different due to different execution IDs
      expect(key1).not.toBe(key2);
      expect(key1).toContain('execution-1');
      expect(key2).toContain('execution-2');
    });

    it('formats date components with leading zeros', () => {
      const date = new Date('2024-01-05T10:30:00Z');
      const key = getDailyArchiveKey('Notification', date);

      expect(key).toContain('Notification/2024/01/05/');
      expect(key).toContain('notification-2024-01-05-');
    });
  });
});
