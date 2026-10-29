import { Recipient } from '../../../../../src/server/utils/sqsUtils/RecipientList';
import { ChannelType } from '../../../../../src/shared-library/types/Enum/ChannelType';

describe('Recipient', () => {
  it('separateChannels should return empty array if recipients or channels are empty', () => {
    const recipients = [
      {
        email: 'test1@test.com',
        name: { first: 'Test1', last: '' },
        channels: [ChannelType.ONDECK, ChannelType.PUSH],
      },
    ];
    const channels = {
      email: {
        templateId: '',
      },
    };

    const result = Recipient.separateChannelsAndAddUserId(recipients, channels);

    expect(result).toEqual([]);
  });

  it('separateChannels should return empty array if recipients do not have specified channels', () => {
    const recipients = [
      {
        email: 'test1@test.com',
        name: { first: 'Test1', last: '' },
        channels: [ChannelType.ONDECK, ChannelType.PUSH],
      },
      {
        email: 'test2@test.com',
        name: { first: 'Test2', last: '' },
        channels: [ChannelType.ONDECK],
      },
    ];
    const channels = {
      email: {
        templateId: '',
      },
    };

    const result = Recipient.separateChannelsAndAddUserId(recipients, channels);

    expect(result).toEqual([]);
  });

  it('separateChannels should return array of user data with specified channels', () => {
    const recipients = [
      {
        email: 'test1@test.com',
        name: { first: 'Test1', last: '' },
        channels: [ChannelType.EMAIL, ChannelType.PUSH],
        fcmToken: ['123'],
      },
      { email: 'test2@test.com', name: { first: 'Test2', last: '' }, channels: [ChannelType.EMAIL] },
    ];
    const channels = {
      email: {
        templateId: '',
      },
    };

    const result = Recipient.separateChannelsAndAddUserId(recipients, channels);
    expect(result).toEqual([
      {
        name: { first: 'Test1', last: '' },
        email: 'test1@test.com',
        channel: 'email',
        userId: expect.any(String),
      },
      {
        name: { first: 'Test2', last: '' },
        email: 'test2@test.com',
        channel: 'email',
        userId: expect.any(String),
      },
    ]);
  });

  it('separateChannels should include only specified channels', () => {
    const recipients = [
      {
        email: 'test1@test.com',
        name: { first: 'Test1', last: '' },
        channels: [ChannelType.EMAIL, ChannelType.PUSH],
        fcmToken: ['123'],
      },
      {
        email: 'test2@test.com',
        name: { first: 'Test2', last: '' },
        channels: [ChannelType.EMAIL, ChannelType.ONDECK],
      },
    ];
    const channels = {
      push: {
        templateId: '',
      },
    };

    const result = Recipient.separateChannelsAndAddUserId(recipients, channels);
    expect(result).toEqual([
      {
        name: { first: 'Test1', last: '' },
        email: 'test1@test.com',
        channel: 'push',
        fcmToken: ['123'],
        userId: expect.any(String),
      },
    ]);
  });
});
