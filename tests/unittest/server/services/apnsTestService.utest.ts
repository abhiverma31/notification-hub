import 'reflect-metadata';
import { ApnsTestService } from '../../../../src/server/services/ApnsTestService';
import { OrganisationService } from '../../../../src/server/services/Organisation';
import { BadRequest } from '../../../../src/server/utils/errors/BadRequest';
import { PushProviders } from '../../../../src/server/types/Enum/PushProviders';
import { getError } from '../../../common/errors/NoErrorThrown';

const mockSend = jest.fn();
const mockApnsClient = jest.fn().mockImplementation(() => ({
  send: mockSend,
}));
const mockNotification = jest.fn().mockImplementation((token, payload) => ({ token, payload }));

jest.mock('apns2', () => ({
  ApnsClient: mockApnsClient,
  Notification: mockNotification,
}));

jest.mock('../../../../src/server/utils/KeyTools', () => ({
  decryptData: jest.fn((data) => `decrypted_${data}`),
}));

describe('ApnsTestService', () => {
  let apnsTestService: ApnsTestService;
  let mockOrganisationService: jest.Mocked<OrganisationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrganisationService = {
      getOrganisationById: jest.fn(),
    } as any;

    apnsTestService = new ApnsTestService(mockOrganisationService);
  });

  describe('testApnsNotification', () => {
    const orgId = 'org-123';
    const deviceToken = 'abc123token';
    const testMessage = 'Test notification';

    it('should send APNs test notification successfully', async () => {
      mockOrganisationService.getOrganisationById.mockResolvedValue({
        _id: orgId,
        name: 'Test Org',
        settings: {
          push: [
            {
              provider: PushProviders.APNS,
              enabled: true,
              settings: {
                teamId: 'TEAM123',
                keyId: 'KEY123',
                privateKey: 'encrypted_key',
                bundleId: 'com.test.app',
                environment: 'sandbox',
              },
            },
          ],
        },
      } as any);

      mockSend.mockResolvedValue({ sent: [deviceToken] });

      const result = await apnsTestService.testApnsNotification(orgId, deviceToken, testMessage);

      expect(result.success).toBe(true);
      expect(result.message).toBe('APNs test notification sent successfully');
      expect(mockSend).toHaveBeenCalled();
    });

    it('should throw when organisation not found', async () => {
      mockOrganisationService.getOrganisationById.mockResolvedValue(null);

      const error = await getError(async () => apnsTestService.testApnsNotification(orgId, deviceToken));

      expect(error).toBeInstanceOf(BadRequest);
      expect(error.message).toBe('Organisation or push settings not found');
    });

    it('should throw when APNs provider not configured', async () => {
      mockOrganisationService.getOrganisationById.mockResolvedValue({
        _id: orgId,
        name: 'Test Org',
        settings: { push: [] },
      } as any);

      const error = await getError(async () => apnsTestService.testApnsNotification(orgId, deviceToken));

      expect(error).toBeInstanceOf(BadRequest);
      expect(error.message).toBe('APNs provider is not configured or not enabled');
    });

    it('should throw when APNs provider not enabled', async () => {
      mockOrganisationService.getOrganisationById.mockResolvedValue({
        _id: orgId,
        name: 'Test Org',
        settings: {
          push: [{ provider: PushProviders.APNS, enabled: false, settings: {} }],
        },
      } as any);

      const error = await getError(async () => apnsTestService.testApnsNotification(orgId, deviceToken));

      expect(error).toBeInstanceOf(BadRequest);
      expect(error.message).toBe('APNs provider is not configured or not enabled');
    });

    it('should return failure on APNs send error', async () => {
      mockOrganisationService.getOrganisationById.mockResolvedValue({
        _id: orgId,
        name: 'Test Org',
        settings: {
          push: [
            {
              provider: PushProviders.APNS,
              enabled: true,
              settings: {
                teamId: 'TEAM123',
                keyId: 'KEY123',
                privateKey: 'encrypted_key',
                bundleId: 'com.test.app',
                environment: 'production',
              },
            },
          ],
        },
      } as any);

      mockSend.mockRejectedValue(new Error('Invalid token'));

      const result = await apnsTestService.testApnsNotification(orgId, deviceToken);

      expect(result.success).toBe(false);
      expect(result.message).toBe('APNs test notification failed');
      expect(result.details).toBe('Invalid token');
    });
  });
});
