import { OnDeckService } from '../../../../../src/consumer/services/channels/OnDeck';
import { OnDeckRepository } from '../../../../../src/shared-library/repositories/OnDeck';
import { OnDeckConnectionRepository } from '../../../../../src/shared-library/repositories/OnDeckConnection';
import { OnDeckWebSocketGateway } from '../../../../../src/consumer/services/integrations/OnDeckWebSocketGateway';
import { Recipient } from '../../../../../src/shared-library/types/Dto/Recipient';
import { ChannelType } from '../../../../../src/shared-library/types/Enum/ChannelType';
import { onDeckTemplateDetails } from '../../../../../src/shared-library/models/Template';
import adaptToNotificationInterface from '../../../../../src/shared-library/models/adapters/Notification';
import { UserId } from '../../../../../src/shared-library/models/User';
import { OnDeckNotification } from '../../../../../src/shared-library/models/OnDeck';
import { OnDeckConnection } from '../../../../../src/shared-library/models/OnDeckConnection';
import { randomUUID } from 'crypto';
import { DeleteResult } from 'mongoose';
import { NotificationSendError } from '../../../../../src/consumer/utils/errors/OnDeckError';

jest.mock('../../../../../src/shared-library/repositories/OnDeck');
jest.mock('../../../../../src/shared-library/repositories/OnDeckConnection');
jest.mock('../../../../../src/consumer/services/integrations/OnDeckWebSocketGateway');
jest.mock('../../../../../src/shared-library/models/adapters/Notification');

describe('OnDeckService', () => {
  let onDeckService: OnDeckService;
  let onDeckRepository: jest.Mocked<OnDeckRepository>;
  let onDeckConnectionRepository: jest.Mocked<OnDeckConnectionRepository>;
  let onDeckWebSocketGateway: jest.Mocked<OnDeckWebSocketGateway>;

  beforeEach(() => {
    onDeckRepository = new OnDeckRepository() as jest.Mocked<OnDeckRepository>;
    onDeckConnectionRepository = new OnDeckConnectionRepository() as jest.Mocked<OnDeckConnectionRepository>;
    onDeckWebSocketGateway = new OnDeckWebSocketGateway() as jest.Mocked<OnDeckWebSocketGateway>;
    onDeckService = new OnDeckService(onDeckRepository, onDeckConnectionRepository, onDeckWebSocketGateway);
  });

  describe('send', () => {
    it('should send notification successfully', async () => {
      const organisationId: string = '65e5a0e5536477f325f5da66';
      const recipient: Recipient = {
        email: 'test@technogise.com',
        channel: ChannelType.EMAIL,
        userId: UserId.build(organisationId, 'test@technogise.com'),
      };
      const hydratedTemplate: onDeckTemplateDetails = {
        title: 'Test Notification-#2',
        content: 'Test ',
        actionUrl: 'www.google.com',
      };

      (adaptToNotificationInterface as jest.MockedFunction<typeof adaptToNotificationInterface>).mockReturnValue({
        content: hydratedTemplate.content,
        recipient_id: UserId.build(organisationId, recipient.email),
        title: hydratedTemplate.title,
        actionUrl: hydratedTemplate.actionUrl,
        source_creation_timestamp: new Date(),
      });

      onDeckRepository.create.mockResolvedValue({
        _id: '65e5ba4af1c4d9b606f8e6b3',
        recipient_id: '65e5b9aa2cc8927f4d0ceefc::sandhya@technogise.com',
        title: 'Test Notification-#2',
        content: 'Test ',
        actionUrl: 'www.google.com',
        read_at: undefined,
        viewed_at: undefined,
        archived_at: undefined,
        schema_version: OnDeckRepository.SCHEMA_VERSION,
        source_creation_timestamp: new Date(),
      } as any);

      // Mock the websocket notification dependencies
      onDeckConnectionRepository.getRecipientConnections.mockResolvedValue([]);
      onDeckWebSocketGateway.sendNotification.mockResolvedValue({
        statusCode: 200,
        sent: true,
      });

      await onDeckService.send(hydratedTemplate, organisationId, recipient);

      expect(adaptToNotificationInterface).toHaveBeenCalledWith(
        hydratedTemplate.title,
        hydratedTemplate.content,
        hydratedTemplate.actionUrl,
        recipient,
        organisationId,
      );
      expect(onDeckRepository.create).toHaveBeenCalledWith({
        actionUrl: 'www.google.com',
        content: 'Test ',
        recipient_id: '65e5a0e5536477f325f5da66::test@technogise.com',
        source_creation_timestamp: expect.any(Date),
        title: 'Test Notification-#2',
      });
      expect(onDeckConnectionRepository.getRecipientConnections).toHaveBeenCalledWith(recipient.email, organisationId);
    });
  });

  describe('sendWebsocketNotification', () => {
    const organisationId: string = '65e5a0e5536477f325f5da66';
    const recipient: Recipient = {
      email: 'test@technogise.com',
      channel: ChannelType.EMAIL,
      userId: UserId.build(organisationId, 'test@technogise.com'),
    };
    
    const notification: OnDeckNotification = {
      recipient_id: UserId.build(organisationId, recipient.email),
      title: 'Test Notification',
      content: 'Test content',
      actionUrl: 'www.google.com',
      source_creation_timestamp: new Date(),
    };

    it('should send websocket notification successfully when connections exist', async () => {
      const connections: OnDeckConnection[] = [
        {
          connection_id: randomUUID(),
          recipient_id: UserId.build(organisationId, recipient.email),
          source_creation_timestamp: new Date(),
        },
        {
          connection_id: randomUUID(),
          recipient_id: UserId.build(organisationId, recipient.email),
          source_creation_timestamp: new Date(),
        },
      ];

      onDeckConnectionRepository.getRecipientConnections.mockResolvedValue(connections);
      onDeckWebSocketGateway.sendNotification.mockResolvedValue({
        statusCode: 200,
        sent: true,
      });

      // Use any to access private method for testing
      await (onDeckService as any).sendWebsocketNotification(recipient, organisationId, notification);

      expect(onDeckConnectionRepository.getRecipientConnections).toHaveBeenCalledWith(recipient.email, organisationId);
      expect(onDeckWebSocketGateway.sendNotification).toHaveBeenCalledTimes(2);
      expect(onDeckWebSocketGateway.sendNotification).toHaveBeenCalledWith(connections[0].connection_id, notification);
      expect(onDeckWebSocketGateway.sendNotification).toHaveBeenCalledWith(connections[1].connection_id, notification);
    });

    it('should close connection and throw error when status code is 410', async () => {
      const connections: OnDeckConnection[] = [
        {
          connection_id: randomUUID(),
          recipient_id: UserId.build(organisationId, recipient.email),
          source_creation_timestamp: new Date(),
        },
      ];

      onDeckConnectionRepository.getRecipientConnections.mockResolvedValue(connections);
      onDeckWebSocketGateway.sendNotification.mockResolvedValue({
        statusCode: 410,
        sent: false,
      });
      const ok: DeleteResult = {acknowledged: true, deletedCount: 1};
      onDeckConnectionRepository.closeConnection.mockResolvedValue(ok);

      await expect((onDeckService as any).sendWebsocketNotification(recipient, organisationId, notification))
        .rejects.toThrow(NotificationSendError);

      expect(onDeckWebSocketGateway.sendNotification).toHaveBeenCalledWith(connections[0].connection_id, notification);
      expect(onDeckConnectionRepository.closeConnection).toHaveBeenCalledWith(connections[0].connection_id);
    });

    it('should throw NotificationSendError when notification sending fails', async () => {
      const connections: OnDeckConnection[] = [
        {
          connection_id: randomUUID(),
          recipient_id: UserId.build(organisationId, recipient.email),
          source_creation_timestamp: new Date(),
        },
      ];

      onDeckConnectionRepository.getRecipientConnections.mockResolvedValue(connections);
      onDeckWebSocketGateway.sendNotification.mockResolvedValue({
        statusCode: 500,
        sent: false,
        exceptionName: 'ConnectionError',
        message: 'Connection failed',
      });

      await expect((onDeckService as any).sendWebsocketNotification(recipient, organisationId, notification))
        .rejects.toThrow(NotificationSendError);

      expect(onDeckWebSocketGateway.sendNotification).toHaveBeenCalledWith(connections[0].connection_id, notification);
      expect(onDeckConnectionRepository.closeConnection).not.toHaveBeenCalled();
    });

    it('should throw NotificationSendError when some notifications fail', async () => {
      const connections: OnDeckConnection[] = [
        {
          connection_id: randomUUID(),
          recipient_id: UserId.build(organisationId, recipient.email),
          source_creation_timestamp: new Date(),
        },
        {
          connection_id: randomUUID(),
          recipient_id: UserId.build(organisationId, recipient.email),
          source_creation_timestamp: new Date(),
        },
      ];

      onDeckConnectionRepository.getRecipientConnections.mockResolvedValue(connections);
      onDeckWebSocketGateway.sendNotification
        .mockResolvedValueOnce({
          statusCode: 200,
          sent: true,
        })
        .mockResolvedValueOnce({
          statusCode: 410,
          sent: false,
        });
      const ok: DeleteResult = {acknowledged: true, deletedCount: 1};
      onDeckConnectionRepository.closeConnection.mockResolvedValue(ok);

      await expect((onDeckService as any).sendWebsocketNotification(recipient, organisationId, notification))
        .rejects.toThrow(NotificationSendError);

      expect(onDeckWebSocketGateway.sendNotification).toHaveBeenCalledTimes(2);
      expect(onDeckConnectionRepository.closeConnection).toHaveBeenCalledWith(connections[1].connection_id);
    });

    it('should handle websocket gateway throwing an exception', async () => {
      const connections: OnDeckConnection[] = [
        {
          connection_id: randomUUID(),
          recipient_id: UserId.build(organisationId, recipient.email),
          source_creation_timestamp: new Date(),
        },
      ];

      onDeckConnectionRepository.getRecipientConnections.mockResolvedValue(connections);
      onDeckWebSocketGateway.sendNotification.mockRejectedValue(new Error('WebSocket connection failed'));

      // Mock the logger to avoid console output during tests
      const loggerSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect((onDeckService as any).sendWebsocketNotification(recipient, organisationId, notification))
        .rejects.toThrow('WebSocket connection failed');

      expect(onDeckWebSocketGateway.sendNotification).toHaveBeenCalledWith(connections[0].connection_id, notification);
      expect(onDeckConnectionRepository.closeConnection).not.toHaveBeenCalled();

      loggerSpy.mockRestore();
    });

    it('should handle closeConnection throwing an exception', async () => {
      const connections: OnDeckConnection[] = [
        {
          connection_id: randomUUID(),
          recipient_id: UserId.build(organisationId, recipient.email),
          source_creation_timestamp: new Date(),
        },
      ];

      onDeckConnectionRepository.getRecipientConnections.mockResolvedValue(connections);
      onDeckWebSocketGateway.sendNotification.mockResolvedValue({
        statusCode: 410,
        sent: false,
      });
      onDeckConnectionRepository.closeConnection.mockRejectedValue(new Error('Failed to close connection'));

      // Mock the logger to avoid console output during tests
      const loggerSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect((onDeckService as any).sendWebsocketNotification(recipient, organisationId, notification))
        .rejects.toThrow('Failed to close connection');

      expect(onDeckWebSocketGateway.sendNotification).toHaveBeenCalledWith(connections[0].connection_id, notification);
      expect(onDeckConnectionRepository.closeConnection).toHaveBeenCalledWith(connections[0].connection_id);

      loggerSpy.mockRestore();
    });

    it('should throw NotificationSendError when multiple notifications fail', async () => {
      const connections: OnDeckConnection[] = [
        {
          connection_id: randomUUID(),
          recipient_id: UserId.build(organisationId, recipient.email),
          source_creation_timestamp: new Date(),
        },
        {
          connection_id: randomUUID(),
          recipient_id: UserId.build(organisationId, recipient.email),
          source_creation_timestamp: new Date(),
        },
        {
          connection_id: randomUUID(),
          recipient_id: UserId.build(organisationId, recipient.email),
          source_creation_timestamp: new Date(),
        },
      ];

      onDeckConnectionRepository.getRecipientConnections.mockResolvedValue(connections);
      onDeckWebSocketGateway.sendNotification
        .mockResolvedValueOnce({
          statusCode: 200,
          sent: true,
        })
        .mockResolvedValueOnce({
          statusCode: 410,
          sent: false,
        })
        .mockResolvedValueOnce({
          statusCode: 500,
          sent: false,
          exceptionName: 'ConnectionError',
          message: 'Connection failed',
        });
      const ok: DeleteResult = {acknowledged: true, deletedCount: 1};
      onDeckConnectionRepository.closeConnection.mockResolvedValue(ok);

      await expect((onDeckService as any).sendWebsocketNotification(recipient, organisationId, notification))
        .rejects.toThrow(NotificationSendError);

      expect(onDeckWebSocketGateway.sendNotification).toHaveBeenCalledTimes(3);
      expect(onDeckWebSocketGateway.sendNotification).toHaveBeenCalledWith(connections[0].connection_id, notification);
      expect(onDeckWebSocketGateway.sendNotification).toHaveBeenCalledWith(connections[1].connection_id, notification);
      expect(onDeckWebSocketGateway.sendNotification).toHaveBeenCalledWith(connections[2].connection_id, notification);
      expect(onDeckConnectionRepository.closeConnection).toHaveBeenCalledWith(connections[1].connection_id);
    });
  });
});
