import 'reflect-metadata';
import Pusher from 'pusher';
import { PusherService } from '../../../../../src/consumer/services/channels/Pusher';
import { ChannelType } from '../../../../../src/shared-library/types/Enum/ChannelType';

jest.mock('../../../../../src/server/utils/KeyTools', () => ({
  decryptData: jest.fn().mockReturnValue('decrypted-secret'),
}));

const mockTrigger = jest.fn().mockResolvedValue({});
(Pusher as jest.Mock).mockImplementation(() => ({ trigger: mockTrigger }));

describe('PusherService', () => {
  let service: PusherService;
  const settings = { appId: 'app-1', key: 'key-1', secret: 'encrypted-secret', cluster: 'ap2' };
  const template = { title: 'Hello', body: 'World' };
  const orgId = 'org-123';

  beforeEach(() => {
    service = new PusherService();
    jest.clearAllMocks();
  });

  it('should send notification to all pusher channels', async () => {
    const recipient = { email: 'a@b.com', userId: 'u1', channel: ChannelType.PUSH, pusherChannel: ['ch-1', 'ch-2'], pusherEvent: 'my-event' };

    await service.send(template, orgId, recipient, settings);

    expect(mockTrigger).toHaveBeenCalledTimes(2);
    expect(mockTrigger).toHaveBeenCalledWith('ch-1', 'my-event', { title: 'Hello', body: 'World' });
    expect(mockTrigger).toHaveBeenCalledWith('ch-2', 'my-event', { title: 'Hello', body: 'World' });
  });

  it('should use default event name when pusherEvent not provided', async () => {
    const recipient = { email: 'a@b.com', userId: 'u1', channel: ChannelType.PUSH, pusherChannel: ['ch-1'] };

    await service.send(template, orgId, recipient, settings);

    expect(mockTrigger).toHaveBeenCalledWith('ch-1', 'notification', { title: 'Hello', body: 'World' });
  });

  it('should throw when pusherChannel is empty', async () => {
    const recipient = { email: 'a@b.com', userId: 'u1', channel: ChannelType.PUSH, pusherChannel: [] };

    await expect(service.send(template, orgId, recipient, settings)).rejects.toThrow('pusherChannel is required');
  });

  it('should throw when pusherChannel is undefined', async () => {
    const recipient = { email: 'a@b.com', userId: 'u1', channel: ChannelType.PUSH };

    await expect(service.send(template, orgId, recipient, settings)).rejects.toThrow('pusherChannel is required');
  });
});
