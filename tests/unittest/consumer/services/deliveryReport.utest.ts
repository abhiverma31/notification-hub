import 'reflect-metadata';
import { DeliveryReportService } from '../../../../src/consumer/services/DeliveryReport';
import { BadRequest } from '../../../../src/server/utils/errors/BadRequest';
import { DeliveryReportRepository } from '../../../../src/shared-library/repositories/DeliveryReport';
import { DeliveryReportHistoryRepository } from '../../../../src/shared-library/repositories/DeliveryReportHistory';
import { DeliveryReportStatus } from '../../../../src/shared-library/types/DeliveryReportStatus';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';

describe('DeliveryReportService', () => {
  let service: DeliveryReportService;
  let mockRepo: jest.Mocked<DeliveryReportRepository>;
  let mockHistoryRepo: jest.Mocked<DeliveryReportHistoryRepository>;

  const createMock = <T>(overrides: Partial<Record<keyof T, jest.Mock>>): jest.Mocked<T> =>
    overrides as unknown as jest.Mocked<T>;

  beforeEach(() => {
    mockRepo = createMock<DeliveryReportRepository>({
      save: jest.fn(),
      getReport: jest.fn(),
      updateStatus: jest.fn(),
      getReportsByUserId: jest.fn(),
      getTotalReportsCountByUserId: jest.fn(),
    });
    mockHistoryRepo = createMock<DeliveryReportHistoryRepository>({
      append: jest.fn().mockResolvedValue({}),
    });
    service = new DeliveryReportService(mockRepo, mockHistoryRepo);
  });

  describe('saveReport', () => {
    it('should persist a delivery report with correct fields', async () => {
      mockRepo.save.mockResolvedValue({} as any);

      await service.saveReport('msg-1', 'user-1', ChannelType.EMAIL, DeliveryReportStatus.SENT);

      expect(mockRepo.save).toHaveBeenCalledWith({
        transactionId: 'msg-1',
        user_id: 'user-1',
        status: DeliveryReportStatus.SENT,
        channel: ChannelType.EMAIL,
        error: undefined,
        organisation_id: null,
      });
    });

    it('should include error when provided', async () => {
      mockRepo.save.mockResolvedValue({} as any);
      const error = { message: 'Failed to send' };

      await service.saveReport('msg-2', 'user-2', ChannelType.EMAIL, DeliveryReportStatus.ERRORED, error);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ error: { message: 'Failed to send' } }),
      );
    });

    it('should append to history after saving', async () => {
      mockRepo.save.mockResolvedValue({} as any);

      await service.saveReport('msg-1', 'user-1', ChannelType.EMAIL, DeliveryReportStatus.SENT, undefined, 'org-1');

      expect(mockHistoryRepo.append).toHaveBeenCalledWith(expect.objectContaining({
        transactionId: 'msg-1',
        user_id: 'user-1',
        channel: ChannelType.EMAIL,
        status: DeliveryReportStatus.SENT,
        organisation_id: 'org-1',
      }));
    });

    it('should not fail when history append throws', async () => {
      mockRepo.save.mockResolvedValue({ _id: 'saved' } as any);
      mockHistoryRepo.append.mockRejectedValue(new Error('DB error'));

      const result = await service.saveReport('msg-1', 'user-1', ChannelType.EMAIL, DeliveryReportStatus.SENT);

      expect(result).toEqual({ _id: 'saved' });
    });
  });

  describe('updateReportStatus', () => {
    it('should update status and append to history', async () => {
      mockRepo.updateStatus.mockResolvedValue({
        transactionId: 'txn-1',
        user_id: 'user-1',
        channel: ChannelType.EMAIL,
        organisation_id: 'org-1',
        status: DeliveryReportStatus.DELIVERED,
      } as any);

      const result = await service.updateReportStatus('txn-1', DeliveryReportStatus.DELIVERED);

      expect(result?.status).toBe(DeliveryReportStatus.DELIVERED);
      expect(mockHistoryRepo.append).toHaveBeenCalledWith(expect.objectContaining({
        transactionId: 'txn-1',
        status: DeliveryReportStatus.DELIVERED,
      }));
    });

    it('should not append history when report not found', async () => {
      mockRepo.updateStatus.mockResolvedValue(null);

      const result = await service.updateReportStatus('nonexistent', DeliveryReportStatus.DELIVERED);

      expect(result).toBeNull();
      expect(mockHistoryRepo.append).not.toHaveBeenCalled();
    });

    it('should pass error to history when provided', async () => {
      const error = { message: 'bounce' };
      mockRepo.updateStatus.mockResolvedValue({
        transactionId: 'txn-1',
        user_id: 'user-1',
        channel: ChannelType.EMAIL,
        organisation_id: null,
        status: DeliveryReportStatus.ERRORED,
      } as any);

      await service.updateReportStatus('txn-1', DeliveryReportStatus.ERRORED, error);

      expect(mockHistoryRepo.append).toHaveBeenCalledWith(expect.objectContaining({
        status: DeliveryReportStatus.ERRORED,
        error,
      }));
    });

    it('should pass source to history when provided', async () => {
      mockRepo.updateStatus.mockResolvedValue({
        transactionId: 'txn-1',
        user_id: 'user-1',
        channel: ChannelType.EMAIL,
        organisation_id: 'org-1',
        status: DeliveryReportStatus.DELIVERED,
      } as any);

      await service.updateReportStatus('txn-1', DeliveryReportStatus.DELIVERED, undefined, 'twilio_sms_webhook');

      expect(mockHistoryRepo.append).toHaveBeenCalledWith(expect.objectContaining({
        transactionId: 'txn-1',
        source: 'twilio_sms_webhook',
      }));
    });
  });

  describe('getDeliveryReport', () => {
    it('should return the delivery report when it exists', async () => {
      const report = { transactionId: 'txn-1', status: DeliveryReportStatus.SENT };
      mockRepo.getReport.mockResolvedValue(report as any);

      const result = await service.getDeliveryReport('txn-1');

      expect(result).toEqual(report);
    });

    it('should throw BadRequest when report does not exist', async () => {
      mockRepo.getReport.mockResolvedValue(null);

      await expect(service.getDeliveryReport('bad-id')).rejects.toThrow(BadRequest);
    });
  });

  describe('getDeliveryReportsByUserId', () => {
    it('should return paginated delivery reports', async () => {
      const reports = [{ transactionId: 'txn-1' }, { transactionId: 'txn-2' }];
      mockRepo.getTotalReportsCountByUserId.mockResolvedValue(12);
      mockRepo.getReportsByUserId.mockResolvedValue(reports as any);

      const result = await service.getDeliveryReportsByUserId('user-1', 0, 5);

      expect(result?.pagination.totalItems).toBe(12);
      expect(result?.pagination.totalPages).toBe(3);
      expect(result?.deliveryReportsList).toHaveLength(2);
    });

    it('should calculate offset from page and itemsPerPage', async () => {
      mockRepo.getTotalReportsCountByUserId.mockResolvedValue(20);
      mockRepo.getReportsByUserId.mockResolvedValue([{ transactionId: 'txn-1' }] as any);

      await service.getDeliveryReportsByUserId('user-1', 2, 5, 'status', 'asc');

      expect(mockRepo.getReportsByUserId).toHaveBeenCalledWith('user-1', 10, 5, 'status', 'asc');
    });

    it('should throw BadRequest when no reports found for user', async () => {
      mockRepo.getTotalReportsCountByUserId.mockResolvedValue(0);
      mockRepo.getReportsByUserId.mockResolvedValue([]);

      await expect(service.getDeliveryReportsByUserId('user-x', 0, 10)).rejects.toThrow(BadRequest);
    });
  });

  describe('getDeliveryReportsByUserId', () => {
    it('should return paginated delivery reports for a user', async () => {
      const report = { transactionId: 'txn-1', status: DeliveryReportStatus.SENT, channel: ChannelType.EMAIL };
      mockRepo.getTotalReportsCountByUserId.mockResolvedValueOnce(2);
      mockRepo.getReportsByUserId.mockResolvedValueOnce([report, report] as any);

      const result = await service.getDeliveryReportsByUserId('user-1', 0, 10);

      expect(result?.deliveryReportsList).toHaveLength(2);
      expect(result?.pagination).toEqual({
        currentPage: 0,
        itemsPerPage: 10,
        totalItems: 2,
        totalPages: 1,
      });
    });

    it('should throw BadRequest when no reports found for user', async () => {
      mockRepo.getTotalReportsCountByUserId.mockResolvedValueOnce(0);
      mockRepo.getReportsByUserId.mockResolvedValueOnce([]);

      await expect(service.getDeliveryReportsByUserId('user-none', 0, 10)).rejects.toThrow(BadRequest);
    });

    it('should calculate correct offset from page and itemsPerPage', async () => {
      const report = { transactionId: 'txn-1', status: DeliveryReportStatus.SENT, channel: ChannelType.EMAIL };
      mockRepo.getTotalReportsCountByUserId.mockResolvedValueOnce(25);
      mockRepo.getReportsByUserId.mockResolvedValueOnce([report] as any);

      await service.getDeliveryReportsByUserId('user-1', 2, 10, 'status', 'asc');

      expect(mockRepo.getReportsByUserId).toHaveBeenCalledWith('user-1', 20, 10, 'status', 'asc');
    });
  });
});
