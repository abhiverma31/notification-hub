import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { DeliveryReportService } from '../../consumer/services/DeliveryReport';
import { DeliveryReportStatus } from '../../shared-library/types/DeliveryReportStatus';
import { logger } from '../utils/ServerLogger';

const TWILIO_STATUS_MAP: Record<string, DeliveryReportStatus | undefined> = {
  queued: DeliveryReportStatus.INGESTED,
  sent: DeliveryReportStatus.SENT,
  delivered: DeliveryReportStatus.DELIVERED,
  read: DeliveryReportStatus.SEEN,
  failed: DeliveryReportStatus.ERRORED,
  undelivered: DeliveryReportStatus.ERRORED,
};

@injectable()
export class TwilioWebhookController {
  constructor(@inject(DeliveryReportService) private deliveryReportService: DeliveryReportService) {}

  public async handleWhatsAppStatus(req: Request, res: Response): Promise<void> {
    return this.handleStatus(req, res, 'WhatsApp');
  }

  public async handleSmsStatus(req: Request, res: Response): Promise<void> {
    return this.handleStatus(req, res, 'SMS');
  }

  private async handleStatus(req: Request, res: Response, channel: string): Promise<void> {
    const transactionId = req.query.transactionId as string;
    const messageStatus = req.body.MessageStatus as string;

    if (!transactionId || !messageStatus) {
      res.status(400).json({ message: 'Missing transactionId or MessageStatus' });

      return;
    }

    const mappedStatus = TWILIO_STATUS_MAP[messageStatus];

    if (!mappedStatus) {
      logger.info(`Ignoring unhandled Twilio ${channel} status`, { messageStatus, transactionId });
      res.status(200).send();

      return;
    }

    try {
      const error =
        mappedStatus === DeliveryReportStatus.ERRORED
          ? { errorCode: req.body.ErrorCode, errorMessage: req.body.ErrorMessage }
          : undefined;
      await this.deliveryReportService.updateReportStatus(
        transactionId,
        mappedStatus,
        error,
        `twilio_${channel.toLowerCase()}_webhook`,
      );
      logger.info(`${channel} webhook status updated`, { transactionId, messageStatus, mappedStatus });
      res.status(200).send();
    } catch (error) {
      logger.error(`Failed to update ${channel} webhook status`, { transactionId, messageStatus, error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}
