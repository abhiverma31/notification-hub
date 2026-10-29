import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { onDeckTemplateDetails } from '../../../shared-library/models/Template';
import { Recipient } from '../../../shared-library/types/Dto/Recipient';
import { ConsumerLogger } from '../../utils/ConsumerLogger';
import { ChannelService } from './base/ChannelService';
import { OnDeckRepository } from '../../../shared-library/repositories/OnDeck';
import adaptToNotificationInterface from '../../../shared-library/models/adapters/Notification';
import { OnDeckConnectionRepository } from '../../../shared-library/repositories/OnDeckConnection';
import { OnDeckNotification } from '../../../shared-library/models/OnDeck';
import { OnDeckWebSocketGateway } from '../integrations/OnDeckWebSocketGateway';
import { OnDeckConnection } from '../../../shared-library/models/OnDeckConnection';
import { NoConnectionsError, NotificationSendError } from '../../utils/errors/OnDeckError';

@injectable()
export class OnDeckService extends ChannelService {
  constructor(
    @inject(OnDeckRepository) private onDeckRepository: OnDeckRepository,
    @inject(OnDeckConnectionRepository) private onDeckConnectionRepository: OnDeckConnectionRepository,
    @inject(OnDeckWebSocketGateway) private onDeckWebSocketGateway: OnDeckWebSocketGateway,
  ) {
    super();
  }

  private readonly logger = new ConsumerLogger();

  public async send(
    hydratedTemplate: onDeckTemplateDetails,
    organisationId: string,
    recipient: Recipient,
    transactionId?: string,
  ): Promise<void> {
    this.logger.traceStart({ recipient, hydratedTemplate, organisationId }, 'Sending OnDeck Notification');

    const notification = adaptToNotificationInterface(
      hydratedTemplate.title,
      hydratedTemplate.content,
      hydratedTemplate.actionUrl,
      recipient,
      organisationId,
    );

    const result = await this.onDeckRepository.create(notification);
    this.logger.traceEnd({ recipient, hydratedTemplate, organisationId }, 'OnDeck Notification Saved.', result);
    try {
      await this.sendWebsocketNotification(recipient, organisationId, notification);
      this.logger.traceEnd({ recipient, hydratedTemplate, organisationId }, 'OnDeck Notification Sent.', result);
    } catch (error) {
      this.logger.error('Failed to send OnDeck notification', {
        recipient,
        organisationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return;
  }

  private async sendWebsocketNotification(
    recipient: Recipient,
    organisationId: string,
    notification: OnDeckNotification,
  ): Promise<void> {
    const connections: OnDeckConnection[] = await this.onDeckConnectionRepository.getRecipientConnections(
      recipient.email,
      organisationId,
    );

    if (!connections || connections.length === 0) {
      this.logger.info('No connections found for recipient', { recipient, organisationId });

      return;
    }
    const failedNotifications: string[] = [];

    for (const connection of connections) {
      const response = await this.onDeckWebSocketGateway.sendNotification(connection.connection_id, notification);
      if (!response.sent) {
        if (response.statusCode === 410) {
          // 410 Gone - connection is expired, close it but don't treat as failure
          await this.onDeckConnectionRepository.closeConnection(connection.connection_id);
        }
        const errorMessage = `WebSocket response indicates failure - Status: ${response.statusCode}, Message: ${response.message || 'Unknown error'}`;
        this.logger.error(`Failed to send notification to recipient ${connection.recipient_id}`, {
          connectionId: connection.connection_id,
          response,
        });
        failedNotifications.push(`${connection.recipient_id}: ${errorMessage}`);
      }
    }
    if (failedNotifications.length > 0) {
      throw new NotificationSendError(recipient.email, failedNotifications.join('; '));
    }
  }
}
