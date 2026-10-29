import 'reflect-metadata';
import { NotificationService } from '../../../../src/consumer/services/Notification';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { QueueMessage } from '../../../../src/shared-library/types/Interfaces/QueueMessage';
import { Recipient } from '../../../../src/shared-library/types/Dto/Recipient';
import { ChannelService } from '../../../../src/consumer/services/channels/base/ChannelService';
import { TemplateService } from '../../../../src/consumer/services/Template';
import { TemplateHydrationService } from '../../../../src/consumer/services/TemplateHydration';
import UserRepository from '../../../../src/shared-library/repositories/User';

jest.mock('../../../../src/shared-library/repositories/User');
jest.mock('../../../../src/shared-library/models/adapters/User', () => ({
  __esModule: true,
  default: jest.fn((recipient: Recipient, orgId: string) => ({
    _id: `${orgId}::${recipient.email}`,
    user_id: recipient.userId,
    email: recipient.email,
    name: recipient.name,
  })),
}));

interface MockChannelService extends Pick<ChannelService, 'send'> {
  send: jest.Mock;
}

function createMockChannelService(): MockChannelService {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockEmailService: MockChannelService;
  let mockPushService: MockChannelService;
  let mockTemplateService: Pick<TemplateService, 'getTemplate'>;
  let mockTemplateHydrationService: Pick<TemplateHydrationService, 'hydrate'>;
  let mockOnDeckService: MockChannelService;
  let mockSlackService: MockChannelService;
  let mockUserRepository: Pick<UserRepository, 'upsert' | 'retryFetchingUserId'>;
  let mockSmsService: MockChannelService;
  let mockWhatsappService: MockChannelService;
  let mockTeamsService: MockChannelService;

  beforeEach(() => {
    mockEmailService = createMockChannelService();
    mockPushService = createMockChannelService();
    mockTemplateService = { getTemplate: jest.fn().mockResolvedValue({ subject: 'Hi', body: 'Hello' }) };
    mockTemplateHydrationService = { hydrate: jest.fn().mockResolvedValue({ subject: 'Hi', body: 'Hello User' }) };
    mockOnDeckService = createMockChannelService();
    mockSlackService = createMockChannelService();
    mockUserRepository = { upsert: jest.fn().mockResolvedValue({ user_id: 'uid-1' }), retryFetchingUserId: jest.fn() };
    mockSmsService = createMockChannelService();
    mockWhatsappService = createMockChannelService();
    mockTeamsService = createMockChannelService();

    notificationService = new NotificationService(
      mockEmailService as never,
      mockPushService as never,
      mockTemplateService as never,
      mockTemplateHydrationService as never,
      mockOnDeckService as never,
      mockSlackService as never,
      mockUserRepository as never,
      mockSmsService as never,
      mockWhatsappService as never,
      mockTeamsService as never,
    );
  });

  const buildQueueMessage = (channel: ChannelType, recipient: Partial<Recipient> = {}): QueueMessage => ({
    recipients: [{
      userId: 'uid-1',
      email: 'test@test.com',
      channel,
      name: { first: 'Test' },
      ...recipient,
    }],
    data: { subject: 'Hi', content: 'Test' },
    channels: { [channel]: { templateId: 'tmpl-1' } },
    organisationId: 'org-1',
  });

  describe('sendNotification', () => {
    it('should upsert user and send via the specified channel', async () => {
      const queueMsg = buildQueueMessage(ChannelType.EMAIL);

      const result = await notificationService.sendNotification(queueMsg);

      expect(mockUserRepository.upsert).toHaveBeenCalled();
      expect(mockEmailService.send).toHaveBeenCalled();
      expect(result.userId).toBe('uid-1');
      expect(result.errorObj).toBeUndefined();
    });

    it('should return errorObj when an error occurs', async () => {
      mockEmailService.send.mockRejectedValue(new Error('SMTP failure'));
      const queueMsg = buildQueueMessage(ChannelType.EMAIL);

      const result = await notificationService.sendNotification(queueMsg);

      expect(result.errorObj).toBeInstanceOf(Error);
    });

    it('should send to the correct channel service for SMS', async () => {
      const queueMsg = buildQueueMessage(ChannelType.SMS, { phone_number: '+1234567890' });

      await notificationService.sendNotification(queueMsg);

      expect(mockSmsService.send).toHaveBeenCalled();
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });
  });

  describe('retryFetchingUserId', () => {
    it('should delegate to userRepository.retryFetchingUserId', async () => {
      const mockUser = { _id: 'org::email', user_id: 'uid-1', email: 'test@test.com' };
      (mockUserRepository.retryFetchingUserId as jest.Mock).mockResolvedValue(mockUser);

      const result = await notificationService.retryFetchingUserId(mockUser as never);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.retryFetchingUserId).toHaveBeenCalledWith(mockUser);
    });
  });
});
