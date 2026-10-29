import { injectable } from 'tsyringe';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { logger } from '../../utils/ConsumerLogger';
import { OnDeckNotification } from '../../../shared-library/models/OnDeck';
import { OnDeckViewAdapter } from '../../../shared-library/models/adapters/OnDeckViewAdapter';
import { WebSocketClientResponse } from '../../../shared-library/types/Interfaces/WebSocketClientResponse';
import { GetWebsocketDetails } from '../../utils/GetWebSocketDetails';
import { ConfigurationError } from '../../utils/errors/Configuration';

@injectable()
export class OnDeckWebSocketGateway {
  private client: ApiGatewayManagementApiClient;

  constructor() {
    try {
      const { connectionURL } = GetWebsocketDetails();
      const region = process.env.AWS_REGION;

      if (!region) {
        logger.error('AWS_REGION environment variable is not defined');
        throw new ConfigurationError('AWS_REGION environment variable is not defined');
      }

      this.client = new ApiGatewayManagementApiClient({
        endpoint: connectionURL,
        region: region,
      });
    } catch (error) {
      logger.error('WebSocket configuration error during initialization', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async sendNotification(connectionId: string, notification: OnDeckNotification): Promise<WebSocketClientResponse> {
    try {
      const notificationViewModel = OnDeckViewAdapter.adaptToOnDeckView(notification);
      logger.info('Sending notification via WebSocket', { connectionId, notification: notificationViewModel });
      const command = new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(notificationViewModel),
      });
      logger.info('PostToConnectionCommand created');
      await this.client.send(command);

      return {
        statusCode: 200,
        sent: true,
      };
    } catch (err: any) {
      logger.error('Error sending notification via WebSocket', {
        connectionId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      const status = err?.$metadata.httpStatusCode;

      return {
        statusCode: status,
        sent: false,
        exceptionName: err.name,
        message: err.message,
      };
    }
  }
}
