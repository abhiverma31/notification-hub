import { inject, injectable } from 'tsyringe';
import { DeliveryReportRepository } from '../../shared-library/repositories/DeliveryReport';
import { DeliveryReportHistoryRepository } from '../../shared-library/repositories/DeliveryReportHistory';
import { DeliveryReportStatus } from '../../shared-library/types/DeliveryReportStatus';
import { ServerLogger } from '../utils/ServerLogger';

export interface SendGridWebhookEvent {
  transactionId: string;
  status: DeliveryReportStatus;
  source: string;
  error?: { message: string };
}

const SENDGRID_EVENT_MAP: Record<string, DeliveryReportStatus> = {
  delivered: DeliveryReportStatus.DELIVERED,
  open: DeliveryReportStatus.SEEN,
  click: DeliveryReportStatus.CLICKED,
  bounce: DeliveryReportStatus.BOUNCED,
  dropped: DeliveryReportStatus.BOUNCED,
};

const VALID_TRANSITIONS: Record<string, DeliveryReportStatus[]> = {
  [DeliveryReportStatus.INITIATED]: [
    DeliveryReportStatus.DELIVERED,
    DeliveryReportStatus.BOUNCED,
    DeliveryReportStatus.FAILED,
  ],
  [DeliveryReportStatus.SENT]: [
    DeliveryReportStatus.DELIVERED,
    DeliveryReportStatus.SEEN,
    DeliveryReportStatus.BOUNCED,
    DeliveryReportStatus.FAILED,
  ],
  [DeliveryReportStatus.DELIVERED]: [DeliveryReportStatus.SEEN, DeliveryReportStatus.BOUNCED],
  [DeliveryReportStatus.SEEN]: [DeliveryReportStatus.CLICKED],
};

@injectable()
export class WebhookService {
  private readonly logger = new ServerLogger('WebhookService');

  constructor(
    @inject(DeliveryReportRepository) private deliveryReportRepository: DeliveryReportRepository,
    @inject(DeliveryReportHistoryRepository) private deliveryReportHistoryRepository: DeliveryReportHistoryRepository,
  ) {}

  public async processEvent(event: SendGridWebhookEvent): Promise<{ processed: boolean }> {
    const isDuplicate = await this.deliveryReportHistoryRepository.exists(event.transactionId, event.status);
    if (isDuplicate) {
      this.logger.info(`Duplicate event skipped: ${event.transactionId} ${event.status}`);

      return { processed: false };
    }

    const report = await this.deliveryReportRepository.getReport(event.transactionId);

    if (!report) {
      this.logger.info(`No delivery report found, skipping: ${event.transactionId}`);

      return { processed: false };
    }

    if (!this.isValidTransition(report.status, event.status)) {
      this.logger.info(`Invalid status transition: ${report.status} -> ${event.status} for ${event.transactionId}`);

      return { processed: false };
    }

    await this.deliveryReportRepository.updateStatus(event.transactionId, event.status, event.error);
    await this.deliveryReportHistoryRepository.append({
      transactionId: event.transactionId,
      status: event.status,
      user_id: report.user_id ?? null,
      organisation_id: report.organisation_id ?? null,
      channel: report.channel,
      source: event.source,
    });

    return { processed: true };
  }

  private isValidTransition(currentStatus: DeliveryReportStatus, newStatus: DeliveryReportStatus): boolean {
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed) return false;

    return allowed.includes(newStatus);
  }

  public mapSendGridEvent(eventType: string): DeliveryReportStatus | null {
    return SENDGRID_EVENT_MAP[eventType] ?? null;
  }
}
