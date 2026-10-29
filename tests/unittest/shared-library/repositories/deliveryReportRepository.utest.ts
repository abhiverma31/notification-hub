import 'reflect-metadata';
import { DeliveryReportRepository } from '../../../../src/shared-library/repositories/DeliveryReport';
import { DeliveryReportInterface, DeliveryReportModel } from '../../../../src/shared-library/models/DeliveryReportModel';
import { UserModel } from '../../../../src/shared-library/models/User';
import { DeliveryReportStatus } from '../../../../src/shared-library/types/DeliveryReportStatus';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';

jest.mock('../../../../src/shared-library/models/DeliveryReportModel', () => ({
  DeliveryReportModel: {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    bulkWrite: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.mock('../../../../src/shared-library/models/User', () => ({
  UserModel: {
    find: jest.fn(),
  },
  UserId: {
    extractOrganisationId: jest.fn((id: string) => id.split('::')[0]),
  },
}));

function mockFindWithSortLimitLean(results: any[]) {
  (DeliveryReportModel.find as jest.Mock).mockReturnValueOnce({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(results),
      }),
    }),
  });
}

describe('DeliveryReportRepository', () => {
  let repository: DeliveryReportRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DeliveryReportRepository();
  });

  describe('save', () => {
    it('should create a document with the latest schema version', async () => {
      const deliveryReport: DeliveryReportInterface = {
        transactionId: 'txn-123',
        status: DeliveryReportStatus.SENT,
        channel: ChannelType.EMAIL,
        user_id: 'user-1',
      };

      jest.spyOn(DeliveryReportModel, 'create').mockResolvedValueOnce({
        ...deliveryReport,
        schema_version: DeliveryReportRepository.SCHEMA_VERSION,
      } as any);

      await repository.save(deliveryReport);

      expect(DeliveryReportModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          schema_version: DeliveryReportRepository.SCHEMA_VERSION,
        }),
      );
    });
  });

  describe('getReport', () => {
    it('should return the delivery report when found by transactionId', async () => {
      const mockReport: DeliveryReportInterface = {
        _id: 'report-1',
        transactionId: 'txn-123',
        status: DeliveryReportStatus.SENT,
        channel: ChannelType.EMAIL,
        user_id: 'user-1',
        schema_version: DeliveryReportRepository.SCHEMA_VERSION,
      };

      jest.spyOn(DeliveryReportModel, 'findOne').mockResolvedValueOnce(mockReport as any);

      const result = await repository.getReport('txn-123');

      expect(result).toEqual(mockReport);
      expect(DeliveryReportModel.findOne).toHaveBeenCalledWith({ transactionId: 'txn-123' });
    });

    it('should return null when no document matches the transactionId', async () => {
      jest.spyOn(DeliveryReportModel, 'findOne').mockResolvedValueOnce(null);

      const result = await repository.getReport('non-existent');

      expect(result).toBeNull();
    });
  });


  describe('migrate', () => {
    it('should backfill organisation_id from user lookup', async () => {
      const mockUsers = [
        { _id: 'org-1::user@test.com', user_id: 'uuid-1' },
        { _id: 'org-2::other@test.com', user_id: 'uuid-2' },
      ];
      (UserModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue(mockUsers) });

      const mockReports = [
        { _id: 'report-1', user_id: 'uuid-1', schema_version: 2 },
        { _id: 'report-2', user_id: 'uuid-2', schema_version: 2 },
      ];
      mockFindWithSortLimitLean(mockReports);
      mockFindWithSortLimitLean([]);
      (DeliveryReportModel.bulkWrite as jest.Mock).mockResolvedValue({});

      const result = await repository.migrate();

      expect(result).toBe(2);
      expect(DeliveryReportModel.bulkWrite).toHaveBeenCalledWith([
        {
          updateOne: {
            filter: { _id: 'report-1' },
            update: { $set: { organisation_id: 'org-1', schema_version: 3 } },
          },
        },
        {
          updateOne: {
            filter: { _id: 'report-2' },
            update: { $set: { organisation_id: 'org-2', schema_version: 3 } },
          },
        },
      ]);
    });

    it('should set organisation_id to null when user is not found', async () => {
      (UserModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

      const mockReports = [
        { _id: 'report-1', user_id: 'unknown-uuid', schema_version: 1 },
      ];
      mockFindWithSortLimitLean(mockReports);
      mockFindWithSortLimitLean([]);
      (DeliveryReportModel.bulkWrite as jest.Mock).mockResolvedValue({});

      const result = await repository.migrate();

      expect(result).toBe(1);
      expect(DeliveryReportModel.bulkWrite).toHaveBeenCalledWith([
        {
          updateOne: {
            filter: { _id: 'report-1' },
            update: { $set: { organisation_id: null, schema_version: 3 } },
          },
        },
      ]);
    });

    it('should return 0 when no reports need migration', async () => {
      (UserModel.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      mockFindWithSortLimitLean([]);

      const result = await repository.migrate();

      expect(result).toBe(0);
      expect(DeliveryReportModel.bulkWrite).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should return the updated document when transactionId exists', async () => {
      const updatedDoc = { transactionId: 'txn-123', status: DeliveryReportStatus.DELIVERED };
      jest.spyOn(DeliveryReportModel, 'findOneAndUpdate').mockResolvedValueOnce(updatedDoc as any);

      const result = await repository.updateStatus('txn-123', DeliveryReportStatus.DELIVERED);

      expect(result).toEqual(updatedDoc);
      expect(DeliveryReportModel.findOneAndUpdate).toHaveBeenCalledWith(
        { transactionId: 'txn-123' },
        { status: DeliveryReportStatus.DELIVERED },
        { new: true },
      );
    });

    it('should return null when transactionId does not exist', async () => {
      jest.spyOn(DeliveryReportModel, 'findOneAndUpdate').mockResolvedValueOnce(null);

      const result = await repository.updateStatus('non-existent', DeliveryReportStatus.SEEN);

      expect(result).toBeNull();
    });
  });
});
