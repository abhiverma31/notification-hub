import 'reflect-metadata';
import { container } from 'tsyringe';
import { DatabaseConnector } from '../shared-library/connectors/DatabaseConnector';
import { OnDeckConnectionRepository } from '../shared-library/repositories/OnDeckConnection';
import adaptToOnDeckConnectionInterface from '../shared-library/models/adapters/OnDeckConnection';
import { logger } from './utils/ConsumerLogger';
import { OnDeckWebsocketActionResponse } from './types/Interfaces/OnDeckPushNotification';
import { OrganisationRepository } from '../shared-library/repositories/Organisation';
import { OrganisationInterface } from '../shared-library/models/Organisation';
import { OnDeckConnection } from '../shared-library/models/OnDeckConnection';

const saveUserConnection = async (
  recipientEmailId: string,
  orgApiKey: string,
  connectionId: string,
  onDeckConnectionRepository: OnDeckConnectionRepository,
): Promise<OnDeckWebsocketActionResponse> => {
  const organisationRepository: OrganisationRepository = container.resolve(OrganisationRepository);
  if (!orgApiKey || !recipientEmailId) {
    logger.error('Missing required fields recipientEmail or orgApiKey to save user connection');

    return {
      statusCode: 400,
      body: 'Missing required fields: orgApiKey, recipientEmail',
    };
  }
  const org: OrganisationInterface | null = await organisationRepository.findByAPIKey(orgApiKey);
  if (!org) {
    logger.error('Organisation not found', { orgApiKey: orgApiKey, connectionId });

    return {
      statusCode: 404,
      body: 'Organisation not found',
    };
  }

  return saveToOnDeckConnection(
    adaptToOnDeckConnectionInterface(connectionId, recipientEmailId, org!._id!),
    onDeckConnectionRepository,
  );
};

const saveToOnDeckConnection = async (
  connectionData: OnDeckConnection,
  onDeckConnectionRepository: OnDeckConnectionRepository,
): Promise<OnDeckWebsocketActionResponse> => {
  try {
    await onDeckConnectionRepository.create(connectionData);
    logger.info('Connection saved to database', connectionData);

    return {
      statusCode: 200,
      body: 'User set and connection saved',
    };
  } catch (error) {
    logger.error('Failed to save connection to database', { connectionData, error });

    return {
      statusCode: 500,
      body: 'Failed to save connection',
    };
  }
};

const disconnect = async (
  connectionId: string,
  onDeckConnectionRepository: OnDeckConnectionRepository,
): Promise<OnDeckWebsocketActionResponse> => {
  try {
    // Delete connection from database
    await onDeckConnectionRepository.closeConnection(connectionId);
    logger.info('Connection deleted from database', { connectionId });
  } catch (error) {
    logger.error('Failed to delete connection from database', { connectionId, error });
  }

  return {
    statusCode: 200,
    body: 'Disconnected',
  };
};

exports.handler = async (event: any) => {
  logger.trace('> Consumer:onDeckPushNotificationEngineHandler', event);
  logger.info(
    `Received websocket routeKey ${event.requestContext.routeKey} with connection id ${event.requestContext.connectionId}`,
  );
  logger.info(`Received payload as:`, event.body);
  let db: DatabaseConnector;
  let onDeckConnectionRepository: OnDeckConnectionRepository;

  try {
    db = container.resolve(DatabaseConnector);
    onDeckConnectionRepository = container.resolve(OnDeckConnectionRepository);
    await db.connect('Consumer OnDeck Notification');
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database', error);

    return {
      statusCode: 500,
      body: 'Database connection failed',
    };
  }

  if (event.requestContext) {
    const connectionId = event.requestContext.connectionId;
    const routeKey = event.requestContext.routeKey;
    let body: any = {};
    try {
      if (event.body) {
        body = JSON.parse(event.body);
      }
    } catch (e) {
      logger.error('Invalid JSON body', e);
    }

    switch (routeKey) {
      case '$connect':
        logger.info('New WebSocket connection established', { connectionId });

        return {
          statusCode: 200,
          body: 'Connected',
        };
        break;

      case '$disconnect':
        logger.info('WebSocket connection disconnected', { connectionId });

        return disconnect(connectionId, onDeckConnectionRepository);
        break;

      case '$default':
        logger.info('Invoked default routeKey', { connectionId });

        return {
          statusCode: 200,
          body: 'Default route',
        };
        break;
      case 'saveUserConnection':
        logger.info('Invoked saveUserConnection routeKey', { connectionId, body });
        const { recipientEmailId, orgApiKey } = body;
        const response = await saveUserConnection(
          recipientEmailId,
          orgApiKey,
          connectionId,
          onDeckConnectionRepository,
        );

        return response;
        break;
      default:
        logger.info('Unknown route:', routeKey);

        return {
          statusCode: 200,
          body: 'unknown route',
        };
        break;
    }
  }
};
