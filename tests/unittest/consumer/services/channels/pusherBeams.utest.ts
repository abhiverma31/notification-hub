import 'reflect-metadata';
import PushNotifications from '@pusher/push-notifications-server';
import { PusherBeamsService } from '../../../../../src/consumer/services/channels/PusherBeams';
import { ChannelType } from '../../../../../src/shared-library/types/Enum/ChannelType';

jest.mock('../../../../../src/server/utils/KeyTools', () => ({
  decryptData: jest.fn().mockReturnValue('decrypted-key'),
}));

const mockPublish = jest.fn().mockResolvedValue({});
(PushNotifications as jest.Mock).mockImplementation(() => ({ publishToInterests: mockPublish }));

describe('PusherBeamsService', () => {
  let service: PusherBeamsService;
  const settings = { instanceId: 'inst-1', secretKey: 'encrypted-key' };
  const template = { title: 'Alert', body: 'Something happened' };
  const orgId = 'org-123';

  beforeEach(() => {
    service = new PusherBeamsService();
    jest.clearAllMocks();
  });

  it('should publish to provided beamsInterest', async () => {
    const recipient = { email: 'a@b.com', userId: 'u1', channel: ChannelType.PUSH, beamsInterest: ['interest-1'] };

    await service.send(template, orgId, recipient, settings);

    expect(mockPublish).toHaveBeenCalledWith(
      ['interest-1'],
      expect.objectContaining({ web: expect.objectContaining({ notification: { title: 'Alert', body: 'Something happened' } }) }),
    );
  });

  it('should fall back to email-based interest when beamsInterest not provided', async () => {
    const recipient = { email: 'user@test.com', userId: 'u1', channel: ChannelType.PUSH };

    await service.send(template, orgId, recipient, settings);

    expect(mockPublish).toHaveBeenCalledWith(
      ['user-user-test-com'],
      expect.any(Object),
    );
  });

  it('should fall back to email-based interest when beamsInterest is empty', async () => {
    const recipient = { email: 'a@b.com', userId: 'u1', channel: ChannelType.PUSH, beamsInterest: [] };

    await service.send(template, orgId, recipient, settings);

    expect(mockPublish).toHaveBeenCalledWith(['user-a-b-com'], expect.any(Object));
  });
});
