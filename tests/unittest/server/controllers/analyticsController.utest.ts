import 'reflect-metadata';
import { AnalyticsController } from '../../../../src/server/controllers/Analytics';
import { AnalyticsService } from '../../../../src/server/services/Analytics';
import { NHRequest } from '../../../../src/server/types/internal/NHRequest';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let mockService: jest.Mocked<AnalyticsService>;

  const mockRequest = {
    user: { role: 'org-owner', organisation: { _id: 'org-123' } },
  } as unknown as NHRequest;

  const createMock = <T>(overrides: Partial<Record<keyof T, jest.Mock>>): jest.Mocked<T> =>
    overrides as unknown as jest.Mocked<T>;

  beforeEach(() => {
    mockService = createMock<AnalyticsService>({
      getOverview: jest.fn(),
      getVolumeTrend: jest.fn(),
      getChannelBreakdown: jest.fn(),
      getDeliverySpeed: jest.fn(),
      getTimeToSee: jest.fn(),
      getSeenByHour: jest.fn(),
      getBestDay: jest.fn(),
      getFailures: jest.fn(),
    });
    controller = new AnalyticsController(mockService);
  });

  it('should extract org_id from request context and pass to service', async () => {
    mockService.getOverview.mockResolvedValue({ total: 10, sent: 9, errored: 1, successRate: 90, failureRate: 10 });

    await controller.getOverview(mockRequest, '2026-06-01', '2026-06-07');

    expect(mockService.getOverview).toHaveBeenCalledWith('org-123', new Date('2026-06-01'), new Date('2026-06-07'));
  });

  it('should throw BadRequestError when startDate is missing', async () => {
    await expect(controller.getOverview(mockRequest, '', '2026-06-07')).rejects.toThrow('startDate and endDate are required');
  });

  it('should throw BadRequestError when endDate is missing', async () => {
    await expect(controller.getOverview(mockRequest, '2026-06-01', '')).rejects.toThrow('startDate and endDate are required');
  });

  it('should throw BadRequestError for invalid date strings', async () => {
    await expect(controller.getOverview(mockRequest, 'not-a-date', '2026-06-07')).rejects.toThrow('valid ISO date strings');
  });

  it('should default granularity to day when not provided', async () => {
    mockService.getVolumeTrend.mockResolvedValue([]);

    await controller.getVolumeTrend(mockRequest, '2026-06-01', '2026-06-07');

    expect(mockService.getVolumeTrend).toHaveBeenCalledWith('org-123', expect.any(Date), expect.any(Date), 'day', 'UTC');
  });

  it('should pass custom granularity when provided', async () => {
    mockService.getVolumeTrend.mockResolvedValue([]);

    await controller.getVolumeTrend(mockRequest, '2026-06-01', '2026-06-07', 'hour');

    expect(mockService.getVolumeTrend).toHaveBeenCalledWith('org-123', expect.any(Date), expect.any(Date), 'hour', 'UTC');
  });

  it('should default invalid granularity to day', async () => {
    mockService.getVolumeTrend.mockResolvedValue([]);

    await controller.getVolumeTrend(mockRequest, '2026-06-01', '2026-06-07', '$malicious');

    expect(mockService.getVolumeTrend).toHaveBeenCalledWith('org-123', expect.any(Date), expect.any(Date), 'day', 'UTC');
  });

  it('should default limit to 10 when not provided', async () => {
    mockService.getFailures.mockResolvedValue([]);

    await controller.getFailures(mockRequest, '2026-06-01', '2026-06-07');

    expect(mockService.getFailures).toHaveBeenCalledWith('org-123', expect.any(Date), expect.any(Date), 10);
  });

  it('should pass custom limit when provided', async () => {
    mockService.getFailures.mockResolvedValue([]);

    await controller.getFailures(mockRequest, '2026-06-01', '2026-06-07', 5);

    expect(mockService.getFailures).toHaveBeenCalledWith('org-123', expect.any(Date), expect.any(Date), 5);
  });

  it('should throw BadRequestError when organisation context is missing', async () => {
    const noOrgRequest = { user: { role: 'org-owner' } } as unknown as NHRequest;

    await expect(controller.getOverview(noOrgRequest, '2026-06-01', '2026-06-07'))
      .rejects.toThrow('Organisation context is required');
  });

  it('should delegate getChannelBreakdown to service', async () => {
    mockService.getChannelBreakdown.mockResolvedValue([]);

    await controller.getChannelBreakdown(mockRequest, '2026-06-01', '2026-06-07');

    expect(mockService.getChannelBreakdown).toHaveBeenCalledWith('org-123', expect.any(Date), expect.any(Date));
  });

  it('should delegate getDeliverySpeed to service', async () => {
    mockService.getDeliverySpeed.mockResolvedValue([]);

    await controller.getDeliverySpeed(mockRequest, '2026-06-01', '2026-06-07');

    expect(mockService.getDeliverySpeed).toHaveBeenCalledWith('org-123', expect.any(Date), expect.any(Date));
  });

  it('should delegate getTimeToSee to service', async () => {
    mockService.getTimeToSee.mockResolvedValue([]);

    await controller.getTimeToSee(mockRequest, '2026-06-01', '2026-06-07');

    expect(mockService.getTimeToSee).toHaveBeenCalledWith('org-123', expect.any(Date), expect.any(Date));
  });

  it('should delegate getSeenByHour with default timezone', async () => {
    mockService.getSeenByHour.mockResolvedValue([]);

    await controller.getSeenByHour(mockRequest, '2026-06-01', '2026-06-07');

    expect(mockService.getSeenByHour).toHaveBeenCalledWith('org-123', expect.any(Date), expect.any(Date), 'UTC');
  });

  it('should delegate getBestDay with default timezone', async () => {
    mockService.getBestDay.mockResolvedValue([]);

    await controller.getBestDay(mockRequest, '2026-06-01', '2026-06-07');

    expect(mockService.getBestDay).toHaveBeenCalledWith('org-123', expect.any(Date), expect.any(Date), 'UTC');
  });

  it('should throw BadRequest for invalid timezone in getVolumeTrend', async () => {
    await expect(
      controller.getVolumeTrend(mockRequest, '2026-06-01', '2026-06-07', 'day', 'Invalid/Zone'),
    ).rejects.toThrow('Invalid timezone: Invalid/Zone');
  });

  it('should throw BadRequest for invalid timezone in getSeenByHour', async () => {
    await expect(
      controller.getSeenByHour(mockRequest, '2026-06-01', '2026-06-07', 'Not_A_Timezone'),
    ).rejects.toThrow('Invalid timezone: Not_A_Timezone');
  });

  it('should accept valid IANA timezone', async () => {
    mockService.getVolumeTrend.mockResolvedValue([]);

    await controller.getVolumeTrend(mockRequest, '2026-06-01', '2026-06-07', 'day', 'Asia/Kolkata');

    expect(mockService.getVolumeTrend).toHaveBeenCalledWith('org-123', expect.any(Date), expect.any(Date), 'day', 'Asia/Kolkata');
  });
});
