import 'reflect-metadata';
import { ApnsIntegration } from '../../../../../src/consumer/services/integrations/ApnsIntegration';
import { ApnsClient, Notification } from 'apns2';

jest.mock('apns2');

describe('ApnsIntegration', () => {
  const apnsIntegration = new ApnsIntegration();
  const settings = {
    teamId: 'TEAM123',
    keyId: 'KEY123',
    bundleId: 'com.example.app',
    environment: 'sandbox' as const,
    privateKey: 'fake-private-key',
  };
  const payload = {
    alert: { title: 'Test', body: 'Hello' },
    sound: 'default',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send notification to all device tokens successfully', async () => {
    const mockSend = jest.fn().mockResolvedValue({ status: 200 });
    (ApnsClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

    const result = await apnsIntegration.sendPushNotification(settings, ['token1', 'token2'], payload);

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(Notification).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('should handle failures for individual tokens', async () => {
    const mockSend = jest.fn()
      .mockResolvedValueOnce({ status: 200 })
      .mockRejectedValueOnce(new Error('Invalid token'));
    (ApnsClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

    const result = await apnsIntegration.sendPushNotification(settings, ['token1', 'bad-token'], payload);

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
  });

  it('should use production host when environment is production', async () => {
    const mockSend = jest.fn().mockResolvedValue({ status: 200 });
    (ApnsClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

    const prodSettings = { ...settings, environment: 'production' as const };
    await apnsIntegration.sendPushNotification(prodSettings, ['token1'], payload);

    expect(ApnsClient).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'api.push.apple.com' }),
    );
  });

  it('should use sandbox host when environment is sandbox', async () => {
    const mockSend = jest.fn().mockResolvedValue({ status: 200 });
    (ApnsClient as jest.Mock).mockImplementation(() => ({ send: mockSend }));

    await apnsIntegration.sendPushNotification(settings, ['token1'], payload);

    expect(ApnsClient).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'api.sandbox.push.apple.com' }),
    );
  });
});
