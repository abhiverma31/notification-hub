import 'reflect-metadata';
import { AnalyticsService } from '../../../../src/server/services/Analytics';
import { AnalyticsRepository } from '../../../../src/shared-library/repositories/Analytics';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockRepo: jest.Mocked<AnalyticsRepository>;
  const orgId = 'org-1';
  const startDate = new Date('2026-06-01');
  const endDate = new Date('2026-06-07');

  const createMock = <T>(overrides: Partial<Record<keyof T, jest.Mock>>): jest.Mocked<T> =>
    overrides as unknown as jest.Mocked<T>;

  beforeEach(() => {
    mockRepo = createMock<AnalyticsRepository>({
      getOverview: jest.fn(),
      getVolumeTrend: jest.fn(),
      getChannelBreakdown: jest.fn(),
      getDeliverySpeedDelays: jest.fn(),
      getTimeToSeeDelays: jest.fn(),
      getSeenByHour: jest.fn(),
      getBestDaySent: jest.fn(),
      getBestDaySeen: jest.fn(),
      getFailures: jest.fn(),
    });
    service = new AnalyticsService(mockRepo);
  });

  describe('getOverview', () => {
    it('should compute successRate and failureRate from raw counts', async () => {
      mockRepo.getOverview.mockResolvedValue({ total: 200, sent: 180, errored: 20 });

      const result = await service.getOverview(orgId, startDate, endDate);

      expect(result).toEqual({ total: 200, sent: 180, errored: 20, successRate: 90, failureRate: 10 });
    });

    it('should return zero rates when total is 0', async () => {
      mockRepo.getOverview.mockResolvedValue({ total: 0, sent: 0, errored: 0 });

      const result = await service.getOverview(orgId, startDate, endDate);

      expect(result.successRate).toBe(0);
      expect(result.failureRate).toBe(0);
    });
  });

  describe('getDeliverySpeed', () => {
    it('should compute median and p90 correctly from delays array', async () => {
      mockRepo.getDeliverySpeedDelays.mockResolvedValue([
        { channel: 'email', delays: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000] },
      ]);

      const result = await service.getDeliverySpeed(orgId, startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].channel).toBe('email');
      expect(result[0].medianMs).toBe(6000);
      expect(result[0].p90Ms).toBe(10000);
      expect(result[0].avgMs).toBe(5500);
    });

    it('should compute threshold percentage correctly', async () => {
      // threshold for delivery speed is 10000ms
      mockRepo.getDeliverySpeedDelays.mockResolvedValue([
        { channel: 'sms', delays: [5000, 8000, 12000, 15000] },
      ]);

      const result = await service.getDeliverySpeed(orgId, startDate, endDate);

      // 2 out of 4 are <= 10000
      expect(result[0].thresholdPct).toBe(50);
    });

    it('should return 100% threshold when delays is empty', async () => {
      mockRepo.getDeliverySpeedDelays.mockResolvedValue([{ channel: 'email', delays: [] }]);

      const result = await service.getDeliverySpeed(orgId, startDate, endDate);

      expect(result[0].thresholdPct).toBe(100);
      expect(result[0].medianMs).toBe(0);
    });
  });

  describe('getTimeToSee', () => {
    it('should use 300000ms threshold for time-to-see percentiles', async () => {
      mockRepo.getTimeToSeeDelays.mockResolvedValue([
        { channel: 'email', delays: [100000, 200000, 400000, 500000] },
      ]);

      const result = await service.getTimeToSee(orgId, startDate, endDate);

      expect(result[0].thresholdPct).toBe(50);
      expect(result[0].channel).toBe('email');
    });
  });

  describe('getVolumeTrend', () => {
    it('should delegate to repository with all parameters', async () => {
      const expected = [{ date: '2026-06-01', count: 10 }];
      mockRepo.getVolumeTrend.mockResolvedValue(expected);

      const result = await service.getVolumeTrend(orgId, startDate, endDate, 'day', 'UTC');

      expect(result).toEqual(expected);
      expect(mockRepo.getVolumeTrend).toHaveBeenCalledWith(orgId, startDate, endDate, 'day', 'UTC');
    });
  });

  describe('getChannelBreakdown', () => {
    it('should delegate to repository', async () => {
      const expected = [{ channel: 'email', count: 50 }];
      mockRepo.getChannelBreakdown.mockResolvedValue(expected);

      const result = await service.getChannelBreakdown(orgId, startDate, endDate);

      expect(result).toEqual(expected);
    });
  });

  describe('getSeenByHour', () => {
    it('should delegate to repository with timezone', async () => {
      const expected = [{ hour: 14, count: 25 }];
      mockRepo.getSeenByHour.mockResolvedValue(expected);

      const result = await service.getSeenByHour(orgId, startDate, endDate, 'Asia/Kolkata');

      expect(result).toEqual(expected);
      expect(mockRepo.getSeenByHour).toHaveBeenCalledWith(orgId, startDate, endDate, 'Asia/Kolkata');
    });
  });

  describe('getFailures', () => {
    it('should delegate to repository with limit', async () => {
      const expected = [{ error: 'bounce', count: 3 }];
      mockRepo.getFailures.mockResolvedValue(expected);

      const result = await service.getFailures(orgId, startDate, endDate, 5);

      expect(result).toEqual(expected);
      expect(mockRepo.getFailures).toHaveBeenCalledWith(orgId, startDate, endDate, 5);
    });
  });

  describe('getBestDay', () => {
    it('should compute seenRate as percentage of total seen', async () => {
      mockRepo.getBestDaySent.mockResolvedValue([
        { day: 2, sent: 100 },
        { day: 5, sent: 200 },
      ]);
      mockRepo.getBestDaySeen.mockResolvedValue([
        { day: 2, seen: 80 },
        { day: 5, seen: 20 },
      ]);

      const result = await service.getBestDay(orgId, startDate, endDate, 'UTC');

      expect(result).toEqual([
        { day: 2, sent: 100, seen: 80, seenRate: 80 },
        { day: 5, sent: 200, seen: 20, seenRate: 20 },
      ]);
    });

    it('should return zero seenRate when totalSeen is 0', async () => {
      mockRepo.getBestDaySent.mockResolvedValue([{ day: 1, sent: 50 }]);
      mockRepo.getBestDaySeen.mockResolvedValue([{ day: 1, seen: 0 }]);

      const result = await service.getBestDay(orgId, startDate, endDate, 'UTC');

      expect(result[0].seenRate).toBe(0);
    });

    it('should use 0 for sent when day has no matching sent entry', async () => {
      mockRepo.getBestDaySent.mockResolvedValue([]);
      mockRepo.getBestDaySeen.mockResolvedValue([{ day: 3, seen: 10 }]);

      const result = await service.getBestDay(orgId, startDate, endDate, 'UTC');

      expect(result[0].sent).toBe(0);
    });
  });
});
