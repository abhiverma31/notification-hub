import 'reflect-metadata';
import { OnDeckRepository } from '../../../../src/shared-library/repositories/OnDeck';
import { OnDeckNotificationModel } from '../../../../src/shared-library/models/OnDeck';
import { DeliveryReportRepository } from '../../../../src/shared-library/repositories/DeliveryReport';
import { DeliveryReportModel } from '../../../../src/shared-library/models/DeliveryReportModel';
import { DeliveryReportHistoryRepository } from '../../../../src/shared-library/repositories/DeliveryReportHistory';
import { DeliveryReportHistoryModel } from '../../../../src/shared-library/models/DeliveryReportHistoryModel';
import { DeliveryReportStatus } from '../../../../src/shared-library/types/DeliveryReportStatus';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';

jest.mock('../../../../src/shared-library/models/OnDeck', () => ({
  OnDeckNotificationModel: {
    find: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

jest.mock('../../../../src/shared-library/models/DeliveryReportModel', () => ({
  DeliveryReportModel: {
    find: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    countDocuments: jest.fn(),
    bulkWrite: jest.fn(),
  },
}));

jest.mock('../../../../src/shared-library/models/DeliveryReportHistoryModel', () => ({
  DeliveryReportHistoryModel: {
    find: jest.fn(),
    deleteMany: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock('../../../../src/shared-library/models/User', () => ({
  UserModel: { find: jest.fn() },
  UserId: { extractOrganisationId: jest.fn(), build: jest.fn() },
}));

function mockFindChain(model: any, results: any[]) {
  (model.find as jest.Mock).mockReturnValueOnce({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(results),
      }),
    }),
  });
}

const cutoff = new Date('2026-01-01');

describe('Archival repository methods', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('OnDeckRepository.findForArchival', () => {
    const repo = new OnDeckRepository();

    it('queries by source_creation_timestamp < cutoffDate', async () => {
      mockFindChain(OnDeckNotificationModel, []);
      await repo.findForArchival(cutoff, null, 100);
      expect(OnDeckNotificationModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ source_creation_timestamp: { $lt: cutoff } }),
      );
    });

    it('adds _id > lastId filter when lastId provided', async () => {
      mockFindChain(OnDeckNotificationModel, []);
      const lastCreatedAt = new Date('2025-01-01');
      await repo.findForArchival(cutoff, 'abc123', 100, lastCreatedAt);
      expect(OnDeckNotificationModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ 
          $or: expect.arrayContaining([
            expect.objectContaining({ _id: { $gt: 'abc123' } })
          ])
        }),
      );
    });

    it('returns matched records', async () => {
      const records = [{ _id: '1', source_creation_timestamp: new Date('2025-01-01') }];
      mockFindChain(OnDeckNotificationModel, records);
      const result = await repo.findForArchival(cutoff, null, 100);
      expect(result).toEqual(records);
    });

    it('returns empty array when no records match', async () => {
      mockFindChain(OnDeckNotificationModel, []);
      const result = await repo.findForArchival(cutoff, null, 100);
      expect(result).toEqual([]);
    });
  });

  describe('OnDeckRepository.deleteByIds', () => {
    const repo = new OnDeckRepository();

    it('calls deleteMany with the provided ids', async () => {
      (OnDeckNotificationModel.deleteMany as jest.Mock).mockResolvedValue({});
      await repo.deleteByIds(['id1', 'id2']);
      expect(OnDeckNotificationModel.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['id1', 'id2'] } });
    });
  });

  describe('DeliveryReportRepository.findForArchival', () => {
    const repo = new DeliveryReportRepository();

    it('queries by createdAt < cutoffDate', async () => {
      mockFindChain(DeliveryReportModel, []);
      await repo.findForArchival(cutoff, null, 100);
      expect(DeliveryReportModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: { $lt: cutoff } }),
      );
    });

    it('adds _id > lastId filter when lastId provided', async () => {
      mockFindChain(DeliveryReportModel, []);
      await repo.findForArchival(cutoff, 'abc123', 100);
      expect(DeliveryReportModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ _id: { $gt: 'abc123' } }),
      );
    });

    it('returns matched records', async () => {
      const records = [{ _id: '1', transactionId: 'txn-1', status: DeliveryReportStatus.SENT, channel: ChannelType.EMAIL, user_id: 'u1' }];
      mockFindChain(DeliveryReportModel, records);
      const result = await repo.findForArchival(cutoff, null, 100);
      expect(result).toEqual(records);
    });

    it('returns empty array when no records match', async () => {
      mockFindChain(DeliveryReportModel, []);
      const result = await repo.findForArchival(cutoff, null, 100);
      expect(result).toEqual([]);
    });
  });

  describe('DeliveryReportRepository.deleteByIds', () => {
    const repo = new DeliveryReportRepository();

    it('calls deleteMany with the provided ids', async () => {
      (DeliveryReportModel.deleteMany as jest.Mock).mockResolvedValue({});
      await repo.deleteByIds(['id1', 'id2']);
      expect(DeliveryReportModel.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['id1', 'id2'] } });
    });
  });

  describe('DeliveryReportHistoryRepository.findForArchival', () => {
    const repo = new DeliveryReportHistoryRepository();

    it('queries by createdAt < cutoffDate', async () => {
      mockFindChain(DeliveryReportHistoryModel, []);
      await repo.findForArchival(cutoff, null, 100);
      expect(DeliveryReportHistoryModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: { $lt: cutoff } }),
      );
    });

    it('adds _id > lastId filter when lastId provided', async () => {
      mockFindChain(DeliveryReportHistoryModel, []);
      const lastCreatedAt = new Date('2025-01-01');
      await repo.findForArchival(cutoff, 'abc123', 100, lastCreatedAt);
      expect(DeliveryReportHistoryModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ 
          $or: expect.arrayContaining([
            expect.objectContaining({ _id: { $gt: 'abc123' } })
          ])
        }),
      );
    });

    it('returns matched records', async () => {
      const records = [{ _id: '1', transactionId: 'txn-1', status: DeliveryReportStatus.SENT, channel: ChannelType.EMAIL, user_id: 'u1' }];
      mockFindChain(DeliveryReportHistoryModel, records);
      const result = await repo.findForArchival(cutoff, null, 100);
      expect(result).toEqual(records);
    });

    it('returns empty array when no records match', async () => {
      mockFindChain(DeliveryReportHistoryModel, []);
      const result = await repo.findForArchival(cutoff, null, 100);
      expect(result).toEqual([]);
    });
  });

  describe('DeliveryReportHistoryRepository.deleteByIds', () => {
    const repo = new DeliveryReportHistoryRepository();

    it('calls deleteMany with the provided ids', async () => {
      (DeliveryReportHistoryModel.deleteMany as jest.Mock).mockResolvedValue({});
      await repo.deleteByIds(['id1', 'id2']);
      expect(DeliveryReportHistoryModel.deleteMany).toHaveBeenCalledWith({ _id: { $in: ['id1', 'id2'] } });
    });
  });
});
