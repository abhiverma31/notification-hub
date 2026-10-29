import 'reflect-metadata';
import { DeliveryReportHistoryRepository } from '../../../../src/shared-library/repositories/DeliveryReportHistory';
import { DeliveryReportHistoryModel } from '../../../../src/shared-library/models/DeliveryReportHistoryModel';
import { DeliveryReportStatus } from '../../../../src/shared-library/types/DeliveryReportStatus';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';

jest.mock('../../../../src/shared-library/models/DeliveryReportHistoryModel');

const mockHistoryEvent = {
  _id: 'history-1',
  transactionId: 'txn-123',
  user_id: 'user-1',
  organisation_id: 'org-1',
  status: DeliveryReportStatus.SENT,
  channel: ChannelType.EMAIL,
  createdAt: new Date('2026-01-01'),
};

describe('DeliveryReportHistoryRepository', () => {
  let repository: DeliveryReportHistoryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DeliveryReportHistoryRepository();
  });

  describe('append', () => {
    it('should insert a new history event', async () => {
      (DeliveryReportHistoryModel.create as jest.Mock).mockResolvedValue(mockHistoryEvent);

      const result = await repository.append({
        transactionId: 'txn-123',
        user_id: 'user-1',
        organisation_id: 'org-1',
        status: DeliveryReportStatus.SENT,
        channel: ChannelType.EMAIL,
        createdAt: new Date('2026-01-01'),
      });

      expect(DeliveryReportHistoryModel.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockHistoryEvent);
    });

    it('should insert history event with error details', async () => {
      const errorObj = { message: 'timeout' };
      const eventWithError = { ...mockHistoryEvent, status: DeliveryReportStatus.ERRORED, error: errorObj };
      (DeliveryReportHistoryModel.create as jest.Mock).mockResolvedValue(eventWithError);

      const result = await repository.append({
        transactionId: 'txn-123',
        user_id: 'user-1',
        organisation_id: 'org-1',
        status: DeliveryReportStatus.ERRORED,
        channel: ChannelType.EMAIL,
        error: errorObj,
        createdAt: new Date('2026-01-01'),
      });

      expect(result.error).toEqual(errorObj);
      expect(result.status).toBe(DeliveryReportStatus.ERRORED);
    });
  });

  describe('getHistoryByTransactionId', () => {
    it('should return history events sorted by createdAt ascending', async () => {
      const events = [
        { ...mockHistoryEvent, status: DeliveryReportStatus.INITIATED, createdAt: new Date('2026-01-01T00:00:00') },
        { ...mockHistoryEvent, status: DeliveryReportStatus.SENT, createdAt: new Date('2026-01-01T00:01:00') },
      ];
      const mockSort = jest.fn().mockResolvedValue(events);
      (DeliveryReportHistoryModel.find as jest.Mock).mockReturnValue({ sort: mockSort });

      const result = await repository.getHistoryByTransactionId('txn-123');

      expect(DeliveryReportHistoryModel.find).toHaveBeenCalledWith({ transactionId: 'txn-123' });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: 1 });
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe(DeliveryReportStatus.INITIATED);
      expect(result[1].status).toBe(DeliveryReportStatus.SENT);
    });

    it('should return empty array when no history exists', async () => {
      const mockSort = jest.fn().mockResolvedValue([]);
      (DeliveryReportHistoryModel.find as jest.Mock).mockReturnValue({ sort: mockSort });

      const result = await repository.getHistoryByTransactionId('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getHistoryByUserId', () => {
    it('should return paginated history for a user', async () => {
      const mockLimit = jest.fn().mockResolvedValue([mockHistoryEvent]);
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      (DeliveryReportHistoryModel.find as jest.Mock).mockReturnValue({ sort: mockSort });

      const result = await repository.getHistoryByUserId('user-1', 0, 10);

      expect(DeliveryReportHistoryModel.find).toHaveBeenCalledWith({ user_id: 'user-1' });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
    });
  });
});
