import 'reflect-metadata';
import { WebhookService } from '../../../../src/server/services/Webhook';
import { DeliveryReportRepository } from '../../../../src/shared-library/repositories/DeliveryReport';
import { DeliveryReportHistoryRepository } from '../../../../src/shared-library/repositories/DeliveryReportHistory';
import { DeliveryReportStatus } from '../../../../src/shared-library/types/DeliveryReportStatus';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';

jest.mock('../../../../src/shared-library/repositories/DeliveryReport');
jest.mock('../../../../src/shared-library/repositories/DeliveryReportHistory');

describe('WebhookService', () => {
  let webhookService: WebhookService;
  let reportRepoMock: jest.Mocked<DeliveryReportRepository>;
  let historyRepoMock: jest.Mocked<DeliveryReportHistoryRepository>;

  beforeEach(() => {
    reportRepoMock = new DeliveryReportRepository() as jest.Mocked<DeliveryReportRepository>;
    historyRepoMock = new DeliveryReportHistoryRepository() as jest.Mocked<DeliveryReportHistoryRepository>;
    webhookService = new WebhookService(reportRepoMock, historyRepoMock);
  });

  describe('processEvent', () => {
    const baseEvent = {
      transactionId: 'txn-123',
      status: DeliveryReportStatus.DELIVERED,
      source: 'sendgrid',
    };

    it('should skip duplicate events', async () => {
      historyRepoMock.exists.mockResolvedValue(true);

      const result = await webhookService.processEvent(baseEvent);

      expect(result).toEqual({ processed: false });
      expect(reportRepoMock.getReport).not.toHaveBeenCalled();
      expect(reportRepoMock.updateStatus).not.toHaveBeenCalled();
      expect(historyRepoMock.append).not.toHaveBeenCalled();
    });

    it('should skip event when delivery report is missing', async () => {
      historyRepoMock.exists.mockResolvedValue(false);
      reportRepoMock.getReport.mockResolvedValue(null);

      const result = await webhookService.processEvent(baseEvent);

      expect(result).toEqual({ processed: false });
      expect(reportRepoMock.updateStatus).not.toHaveBeenCalled();
      expect(historyRepoMock.append).not.toHaveBeenCalled();
    });

    it('should reject invalid status transitions', async () => {
      historyRepoMock.exists.mockResolvedValue(false);
      reportRepoMock.getReport.mockResolvedValue({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.DELIVERED,
        user_id: 'user-1',
        channel: ChannelType.EMAIL,
      } as any);

      const result = await webhookService.processEvent({
        ...baseEvent,
        status: DeliveryReportStatus.DELIVERED,
      });

      expect(result).toEqual({ processed: false });
      expect(reportRepoMock.updateStatus).not.toHaveBeenCalled();
      expect(historyRepoMock.append).not.toHaveBeenCalled();
    });

    it('should reject when current status has no allowed transitions', async () => {
      historyRepoMock.exists.mockResolvedValue(false);
      reportRepoMock.getReport.mockResolvedValue({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.CLICKED,
        user_id: 'user-1',
        channel: ChannelType.EMAIL,
      } as any);

      const result = await webhookService.processEvent({
        ...baseEvent,
        status: DeliveryReportStatus.DELIVERED,
      });

      expect(result).toEqual({ processed: false });
      expect(reportRepoMock.updateStatus).not.toHaveBeenCalled();
    });

    it('should update status and append history on valid transition', async () => {
      historyRepoMock.exists.mockResolvedValue(false);
      reportRepoMock.getReport.mockResolvedValue({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.SENT,
        user_id: 'user-1',
        organisation_id: 'org-1',
        channel: ChannelType.EMAIL,
      } as any);
      reportRepoMock.updateStatus.mockResolvedValue(null);
      historyRepoMock.append.mockResolvedValue({} as any);

      const result = await webhookService.processEvent(baseEvent);

      expect(result).toEqual({ processed: true });
      expect(reportRepoMock.updateStatus).toHaveBeenCalledWith('txn-123', DeliveryReportStatus.DELIVERED, undefined);
      expect(historyRepoMock.append).toHaveBeenCalledWith({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.DELIVERED,
        user_id: 'user-1',
        organisation_id: 'org-1',
        channel: ChannelType.EMAIL,
        source: 'sendgrid',
      });
    });

    it('should persist error when provided', async () => {
      historyRepoMock.exists.mockResolvedValue(false);
      reportRepoMock.getReport.mockResolvedValue({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.SENT,
        user_id: 'user-1',
        organisation_id: 'org-1',
        channel: ChannelType.EMAIL,
      } as any);
      reportRepoMock.updateStatus.mockResolvedValue(null);
      historyRepoMock.append.mockResolvedValue({} as any);

      const result = await webhookService.processEvent({
        ...baseEvent,
        status: DeliveryReportStatus.BOUNCED,
        error: { message: 'Mailbox full' },
      });

      expect(result).toEqual({ processed: true });
      expect(reportRepoMock.updateStatus).toHaveBeenCalledWith(
        'txn-123',
        DeliveryReportStatus.BOUNCED,
        { message: 'Mailbox full' },
      );
    });

    it('should default user_id and organisation_id to null when undefined on report', async () => {
      historyRepoMock.exists.mockResolvedValue(false);
      reportRepoMock.getReport.mockResolvedValue({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.SENT,
        channel: ChannelType.EMAIL,
      } as any);
      reportRepoMock.updateStatus.mockResolvedValue(null);
      historyRepoMock.append.mockResolvedValue({} as any);

      await webhookService.processEvent(baseEvent);

      expect(historyRepoMock.append).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: null, organisation_id: null }),
      );
    });
  });

  describe('status transitions from INITIATED', () => {
    it('should accept transition from INITIATED to DELIVERED', async () => {
      historyRepoMock.exists.mockResolvedValue(false);
      reportRepoMock.getReport.mockResolvedValue({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.INITIATED,
        user_id: 'user-1',
        organisation_id: 'org-1',
        channel: ChannelType.EMAIL,
      } as any);
      reportRepoMock.updateStatus.mockResolvedValue(null);
      historyRepoMock.append.mockResolvedValue({} as any);

      const result = await webhookService.processEvent({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.DELIVERED,
        source: 'sendgrid',
      });

      expect(result).toEqual({ processed: true });
      expect(reportRepoMock.updateStatus).toHaveBeenCalledWith('txn-123', DeliveryReportStatus.DELIVERED, undefined);
    });

    it('should accept transition from INITIATED to BOUNCED', async () => {
      historyRepoMock.exists.mockResolvedValue(false);
      reportRepoMock.getReport.mockResolvedValue({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.INITIATED,
        user_id: 'user-1',
        organisation_id: 'org-1',
        channel: ChannelType.EMAIL,
      } as any);
      reportRepoMock.updateStatus.mockResolvedValue(null);
      historyRepoMock.append.mockResolvedValue({} as any);

      const result = await webhookService.processEvent({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.BOUNCED,
        source: 'sendgrid',
      });

      expect(result).toEqual({ processed: true });
    });

    it('should accept transition from INITIATED to FAILED', async () => {
      historyRepoMock.exists.mockResolvedValue(false);
      reportRepoMock.getReport.mockResolvedValue({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.INITIATED,
        user_id: 'user-1',
        organisation_id: 'org-1',
        channel: ChannelType.EMAIL,
      } as any);
      reportRepoMock.updateStatus.mockResolvedValue(null);
      historyRepoMock.append.mockResolvedValue({} as any);

      const result = await webhookService.processEvent({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.FAILED,
        source: 'sendgrid',
      });

      expect(result).toEqual({ processed: true });
    });

    it('should reject transition from INITIATED to SENT', async () => {
      historyRepoMock.exists.mockResolvedValue(false);
      reportRepoMock.getReport.mockResolvedValue({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.INITIATED,
        user_id: 'user-1',
        organisation_id: 'org-1',
        channel: ChannelType.EMAIL,
      } as any);

      const result = await webhookService.processEvent({
        transactionId: 'txn-123',
        status: DeliveryReportStatus.SENT,
        source: 'sendgrid',
      });

      expect(result).toEqual({ processed: false });
      expect(reportRepoMock.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('mapSendGridEvent', () => {
    it('should map standard delivery events', () => {
      expect(webhookService.mapSendGridEvent('delivered')).toBe(DeliveryReportStatus.DELIVERED);
      expect(webhookService.mapSendGridEvent('open')).toBe(DeliveryReportStatus.SEEN);
      expect(webhookService.mapSendGridEvent('click')).toBe(DeliveryReportStatus.CLICKED);
    });

    it('should map bounce and dropped to BOUNCED', () => {
      expect(webhookService.mapSendGridEvent('bounce')).toBe(DeliveryReportStatus.BOUNCED);
      expect(webhookService.mapSendGridEvent('dropped')).toBe(DeliveryReportStatus.BOUNCED);
    });

    it('should return null for unrecognized event types', () => {
      expect(webhookService.mapSendGridEvent('processed')).toBeNull();
      expect(webhookService.mapSendGridEvent('deferred')).toBeNull();
      expect(webhookService.mapSendGridEvent('unknown')).toBeNull();
    });
  });
});
