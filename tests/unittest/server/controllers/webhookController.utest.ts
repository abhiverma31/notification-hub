import 'reflect-metadata';
import { SendGridWebhookController } from '../../../../src/server/controllers/SendGridWebhook';
import { WebhookService } from '../../../../src/server/services/Webhook';
import { DeliveryReportStatus } from '../../../../src/shared-library/types/DeliveryReportStatus';

jest.mock('../../../../src/server/services/Webhook');

describe('SendGridWebhookController', () => {
  let controller: SendGridWebhookController;
  let webhookServiceMock: jest.Mocked<WebhookService>;

  beforeEach(() => {
    webhookServiceMock = new WebhookService(null as any, null as any) as jest.Mocked<WebhookService>;
    controller = new SendGridWebhookController(webhookServiceMock);
    controller.setStatus = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleEvents', () => {
    it('should return error when events exceed max limit', async () => {
      const events = Array.from({ length: 1001 }, (_, i) => ({ event: 'delivered', transactionId: `txn-${i}` }));

      const result = await controller.handleEvents(events);

      expect(result).toEqual({ status: 'error' });
      expect(controller.setStatus).toHaveBeenCalledWith(400);
      expect(webhookServiceMock.processEvent).not.toHaveBeenCalled();
    });

    it('should process valid events and return ok', async () => {
      webhookServiceMock.mapSendGridEvent.mockReturnValue(DeliveryReportStatus.CLICKED);
      webhookServiceMock.processEvent.mockResolvedValue({ processed: true });

      const result = await controller.handleEvents([
        { event: 'click', transactionId: 'txn-1' },
      ]);

      expect(result).toEqual({ status: 'ok' });
      expect(webhookServiceMock.processEvent).toHaveBeenCalledWith({
        transactionId: 'txn-1',
        status: DeliveryReportStatus.CLICKED,
        source: 'sendgrid',
        error: undefined,
      });
    });

    it('should pass error when event has reason', async () => {
      webhookServiceMock.mapSendGridEvent.mockReturnValue(DeliveryReportStatus.BOUNCED);
      webhookServiceMock.processEvent.mockResolvedValue({ processed: true });

      const result = await controller.handleEvents([
        { event: 'bounce', transactionId: 'txn-2', reason: 'Mailbox full' },
      ]);

      expect(result).toEqual({ status: 'ok' });
      expect(webhookServiceMock.processEvent).toHaveBeenCalledWith({
        transactionId: 'txn-2',
        status: DeliveryReportStatus.BOUNCED,
        source: 'sendgrid',
        error: { message: 'Mailbox full' },
      });
    });

    it('should skip events missing transactionId', async () => {
      const result = await controller.handleEvents([{ event: 'click' }]);

      expect(result).toEqual({ status: 'ok' });
      expect(webhookServiceMock.processEvent).not.toHaveBeenCalled();
    });

    it('should skip events with transactionId exceeding max length', async () => {
      const result = await controller.handleEvents([
        { event: 'click', transactionId: 'x'.repeat(257) },
      ]);

      expect(result).toEqual({ status: 'ok' });
      expect(webhookServiceMock.processEvent).not.toHaveBeenCalled();
    });

    it('should skip unrecognized event types', async () => {
      webhookServiceMock.mapSendGridEvent.mockReturnValue(null);

      const result = await controller.handleEvents([
        { event: 'unknown_event', transactionId: 'txn-1' },
      ]);

      expect(result).toEqual({ status: 'ok' });
      expect(webhookServiceMock.processEvent).not.toHaveBeenCalled();
    });

    it('should return ok even when processEvent throws', async () => {
      webhookServiceMock.mapSendGridEvent.mockReturnValue(DeliveryReportStatus.DELIVERED);
      webhookServiceMock.processEvent.mockRejectedValue(new Error('DB error'));

      const result = await controller.handleEvents([
        { event: 'delivered', transactionId: 'txn-err' },
      ]);

      expect(result).toEqual({ status: 'ok' });
    });

    it('should process only valid events in a mixed batch', async () => {
      webhookServiceMock.mapSendGridEvent.mockImplementation((type: string) =>
        type === 'delivered' ? DeliveryReportStatus.DELIVERED : null,
      );
      webhookServiceMock.processEvent.mockResolvedValue({ processed: true });

      const result = await controller.handleEvents([
        { event: 'delivered', transactionId: 'txn-valid' },
        { event: 'delivered' },
        { event: 'unknown', transactionId: 'txn-unknown' },
      ]);

      expect(result).toEqual({ status: 'ok' });
      expect(webhookServiceMock.processEvent).toHaveBeenCalledTimes(1);
      expect(webhookServiceMock.processEvent).toHaveBeenCalledWith(
        expect.objectContaining({ transactionId: 'txn-valid' }),
      );
    });
  });
});
