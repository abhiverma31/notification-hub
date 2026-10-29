import 'reflect-metadata';
import { AnalyticsRepository } from '../../../../src/shared-library/repositories/Analytics';
import { DeliveryReportModel } from '../../../../src/shared-library/models/DeliveryReportModel';
import { DeliveryReportHistoryModel } from '../../../../src/shared-library/models/DeliveryReportHistoryModel';

jest.mock('../../../../src/shared-library/models/DeliveryReportModel', () => ({
  DeliveryReportModel: { aggregate: jest.fn() },
}));

jest.mock('../../../../src/shared-library/models/DeliveryReportHistoryModel', () => ({
  DeliveryReportHistoryModel: { aggregate: jest.fn() },
}));

describe('AnalyticsRepository', () => {
  let repository: AnalyticsRepository;
  const orgId = 'org-1';
  const startDate = new Date('2026-06-01');
  const endDate = new Date('2026-06-07');

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new AnalyticsRepository();
  });

  describe('getOverview', () => {
    it('should return aggregated sent and errored counts', async () => {
      (DeliveryReportModel.aggregate as jest.Mock).mockResolvedValue([
        { _id: null, total: 100, sent: 90, errored: 10 },
      ]);

      const result = await repository.getOverview(orgId, startDate, endDate);

      expect(result).toEqual({ _id: null, total: 100, sent: 90, errored: 10 });
      expect(DeliveryReportModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $match: expect.objectContaining({ organisation_id: orgId }) }),
        ]),
      );
    });

    it('should return zeros when no data matches', async () => {
      (DeliveryReportModel.aggregate as jest.Mock).mockResolvedValue([]);

      const result = await repository.getOverview(orgId, startDate, endDate);

      expect(result).toEqual({ total: 0, sent: 0, errored: 0 });
    });
  });

  describe('getChannelBreakdown', () => {
    it('should return per-channel sent and errored counts', async () => {
      const mockResult = [
        { channel: 'whatsApp', sent: 50, errored: 5 },
        { channel: 'email', sent: 30, errored: 10 },
      ];
      (DeliveryReportModel.aggregate as jest.Mock).mockResolvedValue(mockResult);

      const result = await repository.getChannelBreakdown(orgId, startDate, endDate);

      expect(result).toEqual(mockResult);
    });
  });

  describe('getVolumeTrend', () => {
    it('should return time-bucketed sent and errored counts', async () => {
      const mockResult = [
        { timestamp: new Date('2026-06-01'), sent: 40, errored: 5 },
        { timestamp: new Date('2026-06-02'), sent: 50, errored: 3 },
      ];
      (DeliveryReportModel.aggregate as jest.Mock).mockResolvedValue(mockResult);

      const result = await repository.getVolumeTrend(orgId, startDate, endDate, 'day');

      expect(result).toHaveLength(2);
      expect(DeliveryReportModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $group: expect.objectContaining({ _id: { $dateTrunc: { date: '$createdAt', unit: 'day' } } }) }),
        ]),
      );
    });
  });

  describe('getDeliverySpeedDelays', () => {
    it('should return delays grouped by channel', async () => {
      const mockResult = [
        { channel: 'whatsApp', delays: [2000, 4000, 6000] },
        { channel: 'sms', delays: [3000, 5000] },
      ];
      (DeliveryReportHistoryModel.aggregate as jest.Mock).mockResolvedValue(mockResult);

      const result = await repository.getDeliverySpeedDelays(orgId, startDate, endDate);

      expect(result).toEqual(mockResult);
      expect(DeliveryReportHistoryModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({ channel: { $in: ['whatsApp', 'sms', 'email'] } }),
          }),
        ]),
      );
    });
  });

  describe('getTimeToSeeDelays', () => {
    it('should return delays grouped by channel for seen-capable channels', async () => {
      const mockResult = [{ channel: 'whatsApp', delays: [60000, 120000] }];
      (DeliveryReportHistoryModel.aggregate as jest.Mock).mockResolvedValue(mockResult);

      const result = await repository.getTimeToSeeDelays(orgId, startDate, endDate);

      expect(result).toEqual(mockResult);
      expect(DeliveryReportHistoryModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({ channel: { $in: ['whatsApp', 'email', 'onDeck'] } }),
          }),
        ]),
      );
    });
  });

  describe('getSeenByHour', () => {
    it('should return hourly counts for seen events', async () => {
      const mockResult = [
        { hour: 9, count: 45 },
        { hour: 19, count: 120 },
      ];
      (DeliveryReportHistoryModel.aggregate as jest.Mock).mockResolvedValue(mockResult);

      const result = await repository.getSeenByHour(orgId, startDate, endDate);

      expect(result).toEqual(mockResult);
    });
  });

  describe('getFailures', () => {
    it('should return failures grouped by channel and error message', async () => {
      const mockResult = [
        { channel: 'email', errorMessage: 'Mailbox not found', count: 50 },
        { channel: 'sms', errorMessage: 'Unreachable', count: 30 },
      ];
      (DeliveryReportModel.aggregate as jest.Mock).mockResolvedValue(mockResult);

      const result = await repository.getFailures(orgId, startDate, endDate, 10);

      expect(result).toEqual(mockResult);
    });

    it('should respect the limit parameter', async () => {
      (DeliveryReportModel.aggregate as jest.Mock).mockResolvedValue([]);

      await repository.getFailures(orgId, startDate, endDate, 5);

      expect(DeliveryReportModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ $limit: 5 })]),
      );
    });
  });

  describe('getBestDaySent and getBestDaySeen', () => {
    it('should return sent count per day of week', async () => {
      const mockResult = [{ day: 2, sent: 200 }, { day: 5, sent: 150 }];
      (DeliveryReportModel.aggregate as jest.Mock).mockResolvedValue(mockResult);

      const result = await repository.getBestDaySent(orgId, startDate, endDate);

      expect(result).toEqual(mockResult);
    });

    it('should return seen count per day of week', async () => {
      const mockResult = [{ day: 2, seen: 80 }, { day: 5, seen: 60 }];
      (DeliveryReportHistoryModel.aggregate as jest.Mock).mockResolvedValue(mockResult);

      const result = await repository.getBestDaySeen(orgId, startDate, endDate);

      expect(result).toEqual(mockResult);
    });
  });
});
