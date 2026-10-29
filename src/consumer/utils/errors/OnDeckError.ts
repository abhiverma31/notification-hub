import { HandledConsumerError } from './HandledConsumer';

export class NoConnectionsError extends HandledConsumerError {
  constructor(recipientEmail: string, organisationId: string) {
    super(`No OnDeck connections found for recipient ${recipientEmail} in organisation ${organisationId}`);
  }
}

export class NotificationSendError extends HandledConsumerError {
  constructor(recipientId: string, reason: string) {
    super(`Failed to send OnDeck notification to recipient ${recipientId}: ${reason}`);
  }
}
