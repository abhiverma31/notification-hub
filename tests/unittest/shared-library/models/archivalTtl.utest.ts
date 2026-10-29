import { DeliveryReportModel } from '../../../../src/shared-library/models/DeliveryReportModel';
import { DeliveryReportHistoryModel } from '../../../../src/shared-library/models/DeliveryReportHistoryModel';
import { OnDeckNotificationModel } from '../../../../src/shared-library/models/OnDeck';

describe('Archival TTL characterisation', () => {
  describe('DeliveryReport', () => {
    it('createdAt has 180-day TTL', () => {
      const { options } = DeliveryReportModel.schema.paths['createdAt'];
      expect(options.expires).toBe('180d');
    });
  });

  describe('DeliveryReportHistory', () => {
    it('createdAt has no TTL after removal', () => {
      const { options } = DeliveryReportHistoryModel.schema.paths['createdAt'];
      expect(options.expires).toBeUndefined();
    });
  });

  describe('Notification (OnDeck)', () => {
    it('has no TTL on any field', () => {
      const ttlFields = Object.values(OnDeckNotificationModel.schema.paths).filter(
        (p: any) => p.options?.expires !== undefined,
      );
      expect(ttlFields).toHaveLength(0);
    });
  });
});
