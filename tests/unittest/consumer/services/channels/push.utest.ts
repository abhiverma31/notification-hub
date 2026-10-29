import 'reflect-metadata';
import { PushService } from '../../../../../src/consumer/services/channels/Push';
import { FirebaseIntegration } from '../../../../../src/consumer/services/integrations/Firebase';
import { TemplateDetails } from '../../../../../src/consumer/types/Interfaces/Template';
import { FirebaseSettings } from '../../../../../src/shared-library/models/submodels/OrganisationSettings';
import { ChannelType } from '../../../../../src/shared-library/types/Enum/ChannelType';
import { PushProviders } from '../../../../../src/server/types/Enum/PushProviders';
import * as admin from 'firebase-admin';
import UserRepository from '../../../../../src/shared-library/repositories/User';
import { UserInterface } from '../../../../../src/shared-library/models/User';
import { PusherService } from '../../../../../src/consumer/services/channels/Pusher';

jest.mock('../../../../../src/consumer/services/integrations/Firebase');
jest.mock('../../../../../src/consumer/services/channels/Pusher');

jest.mock('../../../../../src/server/utils/KeyTools', () => ({
  decryptData: jest.fn().mockReturnValue('testPrivateKey1'),
  decodeFromBase64: jest.fn().mockReturnValue('Base64EncodedString'),
}));

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: { cert: jest.fn() },
}));

const firebaseProvider = {
  provider: PushProviders.FIREBASE,
  enabled: true,
  settings: {
    firebaseClientEmail: 'test-client-email',
    privateKey: 'test-private-key',
    projectId: 'test-project-id',
  } as FirebaseSettings,
};

describe('PushService', () => {
  let pushService: PushService;
  let organisationServiceMock: { getAllEnabledPushProviders: jest.Mock };
  let firebaseIntegrationMock: jest.Mocked<FirebaseIntegration>;
  let pusherServiceMock: jest.Mocked<PusherService>;
  const mockUserRepository: jest.Mocked<UserRepository> = {
    findByOrgIdEmailId: jest.fn(),
  } as unknown as jest.Mocked<UserRepository>;

  beforeEach(() => {
    organisationServiceMock = { getAllEnabledPushProviders: jest.fn() };
    firebaseIntegrationMock = new FirebaseIntegration() as jest.Mocked<FirebaseIntegration>;
    pusherServiceMock = new PusherService() as jest.Mocked<PusherService>;

    pushService = new PushService(
      firebaseIntegrationMock,
      {} as any,
      organisationServiceMock as any,
      mockUserRepository as any,
      pusherServiceMock,
      {} as any,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('send', () => {
    it('should send push notification via Firebase', async () => {
      const recipient = { fcmToken: ['fake-fcm-token'], email: 'test@mail.com', channel: ChannelType.PUSH };
      const hydratedTemplate: TemplateDetails = { title: 'Test Title', body: 'Test Body' };
      const result = { responses: [{ success: true, messageId: 'msg-id' }], successCount: 1, failureCount: 0 };

      organisationServiceMock.getAllEnabledPushProviders.mockResolvedValueOnce([firebaseProvider]);
      firebaseIntegrationMock.sendPushNotificationsViaFirebase.mockResolvedValueOnce(result);

      await pushService.send(hydratedTemplate, 'org-id', recipient);

      expect(admin.initializeApp).toHaveBeenCalled();
    });

    it('should send only via requested providers when pushProviders is specified', async () => {
      const recipient = {
        fcmToken: ['fake-fcm-token'],
        email: 'test@mail.com',
        channel: ChannelType.PUSH,
        pushProviders: [PushProviders.FIREBASE],
      };
      const hydratedTemplate: TemplateDetails = { title: 'Test Title', body: 'Test Body' };
      const result = { responses: [{ success: true, messageId: 'msg-id' }], successCount: 1, failureCount: 0 };

      organisationServiceMock.getAllEnabledPushProviders.mockResolvedValueOnce([firebaseProvider]);
      firebaseIntegrationMock.sendPushNotificationsViaFirebase.mockResolvedValueOnce(result);

      await pushService.send(hydratedTemplate, 'org-id', recipient);

      expect(admin.initializeApp).toHaveBeenCalled();
      expect(pusherServiceMock.send).not.toHaveBeenCalled();
    });

    it('should throw error when no enabled push providers found', async () => {
      const recipient = { fcmToken: ['fake-fcm-token'], email: 'test@mail.com', channel: ChannelType.PUSH };
      const hydratedTemplate: TemplateDetails = { title: 'Test Title', body: 'Test Body' };

      organisationServiceMock.getAllEnabledPushProviders.mockResolvedValueOnce([]);

      await expect(pushService.send(hydratedTemplate, 'org-id', recipient)).rejects.toThrow(
        'No enabled push provider found for organisation "org-id"',
      );
    });

    it('should throw error on Firebase failure', async () => {
      const recipient = { fcmToken: ['fake-fcm-token'], email: 'test@mailcom', channel: ChannelType.PUSH };
      const hydratedTemplate: TemplateDetails = { title: 'Test Title', body: 'Test Body' };
      const result = { responses: [{ success: false, messageId: 'msg-id' }], successCount: 0, failureCount: 1 };

      organisationServiceMock.getAllEnabledPushProviders.mockResolvedValueOnce([firebaseProvider]);
      firebaseIntegrationMock.sendPushNotificationsViaFirebase.mockResolvedValueOnce(result);

      await expect(pushService.send(hydratedTemplate, 'org-id', recipient)).rejects.toThrow(
        'Failed to send push notification to test@mailcom',
      );
    });
  });

  it('should get fcm tokens from user when fcmToken not in recipient', async () => {
    const recipient = { email: 'test@mailcom', channel: ChannelType.PUSH };
    const hydratedTemplate: TemplateDetails = { title: 'Test Title', body: 'Test Body' };
    const user: UserInterface = {
      _id: 'org::test@test.com',
      schema_version: 1,
      email: 'test@test.com',
      name: { first: 'First', last: 'Last' },
      last_updated_by: 'notification-engine',
      fcm_device_tokens: [{ token: 'fcm-token-1', created_at: new Date() }],
      created_at: new Date(),
      updated_at: new Date(),
    };
    const result = { responses: [{ success: true, messageId: 'msg-id' }], successCount: 1, failureCount: 0 };

    organisationServiceMock.getAllEnabledPushProviders.mockResolvedValueOnce([firebaseProvider]);
    mockUserRepository.findByOrgIdEmailId.mockResolvedValue(user);
    firebaseIntegrationMock.sendPushNotificationsViaFirebase.mockResolvedValueOnce(result);

    await pushService.send(hydratedTemplate, 'org-id', recipient);

    expect(admin.initializeApp).toHaveBeenCalled();
  });

  it('should throw error when no FCM tokens found', async () => {
    const recipient = { email: 'test@mailcom', channel: ChannelType.PUSH };
    const hydratedTemplate: TemplateDetails = { title: 'Test Title', body: 'Test Body' };
    const user: UserInterface = {
      _id: 'org::test@test.com',
      schema_version: 1,
      email: 'test@test.com',
      name: { first: 'First', last: 'Last' },
      last_updated_by: 'notification-engine',
      fcm_device_tokens: [],
      created_at: new Date(),
      updated_at: new Date(),
    };

    organisationServiceMock.getAllEnabledPushProviders.mockResolvedValueOnce([firebaseProvider]);
    mockUserRepository.findByOrgIdEmailId.mockResolvedValue(user);

    await expect(pushService.send(hydratedTemplate, 'org-id', recipient)).rejects.toThrow(
      'FCM tokens are empty for user with email "test@mailcom" in organisation "org-id"',
    );
  });
});
