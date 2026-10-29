import 'reflect-metadata';
import { Request, Response } from 'express';
import { TwilioWebhookController } from '../../../../src/server/controllers/TwilioWebhook';
import { DeliveryReportService } from '../../../../src/consumer/services/DeliveryReport';
import { DeliveryReportStatus } from '../../../../src/shared-library/types/DeliveryReportStatus';

describe('TwilioWebhookController', () => {
  let controller: TwilioWebhookController;
  let mockService: { updateReportStatus: jest.Mock };
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockService = { updateReportStatus: jest.fn().mockResolvedValue({}) };
    controller = new TwilioWebhookController(mockService as unknown as DeliveryReportService);
    mockReq = {
      query: { transactionId: 'txn-123' },
      body: { MessageStatus: 'delivered' },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  it('should return 400 when transactionId is missing', async () => {
    mockReq.query = {};

    await controller.handleWhatsAppStatus(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Missing transactionId or MessageStatus' });
  });

  it('should return 400 when MessageStatus is missing', async () => {
    mockReq.body = {};

    await controller.handleWhatsAppStatus(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Missing transactionId or MessageStatus' });
  });

  it('should update status to DELIVERED when Twilio sends delivered', async () => {
    mockReq.body = { MessageStatus: 'delivered' };

    await controller.handleWhatsAppStatus(mockReq as Request, mockRes as Response);

    expect(mockService.updateReportStatus).toHaveBeenCalledWith('txn-123', DeliveryReportStatus.DELIVERED, undefined, 'twilio_whatsapp_webhook');
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalled();
  });

  it('should update status to SEEN when Twilio sends read', async () => {
    mockReq.body = { MessageStatus: 'read' };

    await controller.handleWhatsAppStatus(mockReq as Request, mockRes as Response);

    expect(mockService.updateReportStatus).toHaveBeenCalledWith('txn-123', DeliveryReportStatus.SEEN, undefined, 'twilio_whatsapp_webhook');
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('should update status to ERRORED when Twilio sends failed', async () => {
    mockReq.body = { MessageStatus: 'failed', ErrorCode: '30001', ErrorMessage: 'Queue overflow' };

    await controller.handleWhatsAppStatus(mockReq as Request, mockRes as Response);

    expect(mockService.updateReportStatus).toHaveBeenCalledWith('txn-123', DeliveryReportStatus.ERRORED, { errorCode: '30001', errorMessage: 'Queue overflow' }, 'twilio_whatsapp_webhook');
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('should return 200 without updating when Twilio sends an unhandled status', async () => {
    mockReq.body = { MessageStatus: 'accepted' };

    await controller.handleWhatsAppStatus(mockReq as Request, mockRes as Response);

    expect(mockService.updateReportStatus).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalled();
  });

  describe('handleSmsStatus', () => {
    it('should update status to DELIVERED when Twilio sends delivered for SMS', async () => {
      mockReq.body = { MessageStatus: 'delivered' };

      await controller.handleSmsStatus(mockReq as Request, mockRes as Response);

      expect(mockService.updateReportStatus).toHaveBeenCalledWith('txn-123', DeliveryReportStatus.DELIVERED, undefined, 'twilio_sms_webhook');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should update status to ERRORED when Twilio sends failed for SMS', async () => {
      mockReq.body = { MessageStatus: 'failed', ErrorCode: '30002', ErrorMessage: 'Account suspended' };

      await controller.handleSmsStatus(mockReq as Request, mockRes as Response);

      expect(mockService.updateReportStatus).toHaveBeenCalledWith('txn-123', DeliveryReportStatus.ERRORED, { errorCode: '30002', errorMessage: 'Account suspended' }, 'twilio_sms_webhook');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 200 without updating for unhandled SMS status', async () => {
      mockReq.body = { MessageStatus: 'accepted' };

      await controller.handleSmsStatus(mockReq as Request, mockRes as Response);

      expect(mockService.updateReportStatus).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  it('should return 500 when updateReportStatus throws', async () => {
    mockService.updateReportStatus.mockRejectedValueOnce(new Error('DB connection failed'));

    await controller.handleWhatsAppStatus(mockReq as Request, mockRes as Response);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Internal server error' });
  });
});
