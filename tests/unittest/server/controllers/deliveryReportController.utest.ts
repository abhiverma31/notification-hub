import 'reflect-metadata';
import { DeliveryReportController } from '../../../../src/server/controllers/DeliveryReport';
import { DeliveryReportService } from '../../../../src/consumer/services/DeliveryReport';
import { BadRequest } from '../../../../src/server/utils/errors/BadRequest';
import { DeliveryReportStatus } from '../../../../src/shared-library/types/DeliveryReportStatus';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';

jest.mock('../../../../src/consumer/services/DeliveryReport');

describe('DeliveryReportController', () => {
  let controller: DeliveryReportController;
  let deliveryReportServiceMock: jest.Mocked<DeliveryReportService>;

  beforeEach(() => {
    deliveryReportServiceMock = new DeliveryReportService(null as any, null as any) as jest.Mocked<DeliveryReportService>;
    controller = new DeliveryReportController(deliveryReportServiceMock);
  });

  describe('getDeliveryReport', () => {
    it('should return the delivery report for a valid transactionId', async () => {
      const mockReport = {
        _id: 'report-1',
        transactionId: 'txn-123',
        status: DeliveryReportStatus.DELIVERED,
        channel: ChannelType.EMAIL,
        user_id: 'user-1',
      };
      deliveryReportServiceMock.getDeliveryReport.mockResolvedValue(mockReport as any);

      const result = await controller.getDeliveryReport({} as any, 'txn-123');

      expect(result).toEqual(mockReport);
      expect(deliveryReportServiceMock.getDeliveryReport).toHaveBeenCalledWith('txn-123');
    });

    it('should propagate BadRequest when transactionId is invalid', async () => {
      deliveryReportServiceMock.getDeliveryReport.mockRejectedValue(new BadRequest('Invalid transaction id'));

      await expect(controller.getDeliveryReport({} as any, 'invalid')).rejects.toThrow(BadRequest);
    });
  });

  describe('getDeliveryReportsForUser', () => {
    it('should return paginated delivery reports for a user', async () => {
      const mockResponse = {
        deliveryReportsList: [{ transactionId: 'txn-1', status: DeliveryReportStatus.SENT }],
        pagination: { currentPage: 0, itemsPerPage: 10, totalItems: 1, totalPages: 1 },
      };
      deliveryReportServiceMock.getDeliveryReportsByUserId.mockResolvedValue(mockResponse as any);

      const result = await controller.getDeliveryReportsForUser({} as any, 'user-1', 0, 10);

      expect(result).toEqual(mockResponse);
      expect(deliveryReportServiceMock.getDeliveryReportsByUserId).toHaveBeenCalledWith('user-1', 0, 10, 'createdAt', 'asc');
    });

    it('should pass custom sortBy and sortOrder parameters', async () => {
      deliveryReportServiceMock.getDeliveryReportsByUserId.mockResolvedValue({} as any);

      await controller.getDeliveryReportsForUser({} as any, 'user-1', 1, 5, 'status', 'desc');

      expect(deliveryReportServiceMock.getDeliveryReportsByUserId).toHaveBeenCalledWith('user-1', 1, 5, 'status', 'desc');
    });

    it('should propagate BadRequest when no reports found', async () => {
      deliveryReportServiceMock.getDeliveryReportsByUserId.mockRejectedValue(new BadRequest('No delivery reports found for user'));

      await expect(controller.getDeliveryReportsForUser({} as any, 'user-none', 0, 10)).rejects.toThrow(BadRequest);
    });
  });
});
