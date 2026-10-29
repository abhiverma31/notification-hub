import { localEnv, testEnv } from '../../shared-library/constants/EnvironmentConstants';
import { WebsocketDetails } from '../../shared-library/types/Interfaces/WebSocketDetails';
import { ConfigurationError } from './errors/Configuration';

export const GetWebsocketDetails = (): WebsocketDetails => {
  if (
    process.env.NODE_ENV?.toUpperCase() === testEnv.toUpperCase() ||
    process.env.NODE_ENV?.toUpperCase() === localEnv.toUpperCase()
  ) {
    return {
      connectionURL: process.env.WEBSOCKET_OFFLINE_CONNECTION_URL || 'http://localhost:4001',
    };
  }

  if (!process.env.AWS_WEBSOCKET_CONNECTION_URL) {
    throw new ConfigurationError('AWS_WEBSOCKET_CONNECTION_URL is required');
  }

  return {
    connectionURL: process.env.AWS_WEBSOCKET_CONNECTION_URL!,
  };
};
