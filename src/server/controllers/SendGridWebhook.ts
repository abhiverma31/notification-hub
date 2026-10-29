import { inject, injectable } from 'tsyringe';
import { Body, Post, Route, SuccessResponse, Response } from 'tsoa';
import { Controller, Tags } from '@tsoa/runtime';
import { WebhookService } from '../services/Webhook';
import { ServerLogger } from '../utils/ServerLogger';

const MAX_EVENTS_PER_REQUEST = 1000;
const MAX_TRANSACTION_ID_LENGTH = 256;

interface SendGridEvent {
  event: string;
  transactionId?: string;
  reason?: string;
  [key: string]: unknown;
}

@injectable()
@Route('api/webhooks/sendgrid')
export class SendGridWebhookController extends Controller {
  private readonly logger = new ServerLogger('SendGridWebhookController');

  constructor(@inject(WebhookService) private webhookService: WebhookService) {
    super();
  }

  /**
   * Webhook endpoint to receive SendGrid delivery events
   * @summary SendGrid Event Webhook
   */
  @Post('events')
  @SuccessResponse('200', 'OK')
  @Response('400', 'Bad Request')
  @Tags('Webhooks')
  public async handleEvents(@Body() events: SendGridEvent[]): Promise<{ status: string }> {
    if (events.length > MAX_EVENTS_PER_REQUEST) {
      this.setStatus(400);

      return { status: 'error' };
    }

    for (const event of events) {
      try {
        if (!event.transactionId || event.transactionId.length > MAX_TRANSACTION_ID_LENGTH) {
          this.logger.info('SendGrid event missing or invalid transactionId, skipping');
          continue;
        }

        const status = this.webhookService.mapSendGridEvent(event.event);
        if (!status) {
          this.logger.info(`Unrecognized SendGrid event type: ${event.event}, skipping`);
          continue;
        }

        const error = event.reason ? { message: event.reason } : undefined;

        await this.webhookService.processEvent({
          transactionId: event.transactionId,
          status,
          source: 'sendgrid',
          error,
        });
      } catch (err) {
        this.logger.error('Error processing SendGrid event', err);
      }
    }

    return { status: 'ok' };
  }
}
