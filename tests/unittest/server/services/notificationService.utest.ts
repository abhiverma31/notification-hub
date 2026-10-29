import 'reflect-metadata';
import { NotificationService } from '../../../../src/server/services/Notification';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { UserDto } from '../../../../src/shared-library/types/Dto/Notification';
import { mockClient } from 'aws-sdk-client-mock';
import { SQSClient, SendMessageBatchCommand, SendMessageBatchCommandOutput } from '@aws-sdk/client-sqs';
import { BatchUtil } from '../../../../src/server/utils/sqsUtils/SQSBatchUtil';
import { getChannelNames } from '../../../../src/shared-library/utils/ChannelUtil';

jest.mock('../../../../src/server/utils/sqsUtils/SQSBatchUtil', () => ({
  BatchUtil: {
    constructBatchQueueMessage: jest.fn(),
  },
}));
jest.mock('../../../../src/shared-library/utils/ChannelUtil', () => ({
  getChannelNames: jest.fn(),
}));

const mockEventRepository = {
  findEventByName: jest.fn(),
  findEventById: jest.fn(),
  updateLastUsedAt: jest.fn(),
};
const mockTemplateRepository = {
  findTemplateById: jest.fn(),
};

describe('NotificationService', () => {
  let notificationService: NotificationService;
  const sqsMock = mockClient(SQSClient);
  beforeEach(() => {
    notificationService = new NotificationService(
      mockEventRepository as any,
      mockTemplateRepository as any,
    );
    sqsMock.reset();
    jest.clearAllMocks();
  });

  const organisation = {
    _id: '101',
    name: 'testOrg',
    api_key: 'random-api-key',
    api_secret_hash: 'random-secret-hash',
  };

  let recipients: UserDto[] = [
    {
      channels: [ChannelType.EMAIL, ChannelType.ONDECK],
      email: 'test1@test.com',
      name: {
        first: 'Test1',
      },
    },
    {
      channels: [ChannelType.PUSH],
      fcmToken: ['random-fcm-token'],
      email: 'test2@test.com',
      name: {
        first: 'Test2',
      },
    },
  ];

  const emailChannels = {
    [ChannelType.EMAIL]: {
      templateId: '1',
    },
  } as unknown as { [key in ChannelType]: Record<string, string> };

  const pushChannels = {
    [ChannelType.PUSH]: {
      templateId: '1',
    },
  } as unknown as { [key in ChannelType]: Record<string, string> };

  const onDeckChannels = {
    [ChannelType.ONDECK]: {
      templateId: '1',
    },
  } as unknown as { [key in ChannelType]: Record<string, string> };

  const slackChannels = {
    [ChannelType.SLACK]: {
      template: {
        message: 'Test',
      },
    },
  } as unknown as { [key in ChannelType]: Record<string, string> };

  const data = { subject: 'Hi', content: 'Test' };
  it('should return array of transaction id for channel onDeck', async () => {
    const mockResponse: SendMessageBatchCommandOutput = {
      Successful: [
        { Id: 'msg1', MessageId: '12345', MD5OfMessageBody: 'd41d8cd98f00b204e9800998ecf8427e' },
        { Id: 'msg2', MessageId: '67890', MD5OfMessageBody: 'd41d8cd98f00b204e9800998ecf8427e' },
        { Id: 'msg3', MessageId: '67890', MD5OfMessageBody: 'd41d8cd98f00b204e9800998ecf8427e' },
      ],
      Failed: [],
      $metadata: {
        httpStatusCode: 200,
      },
    };
    sqsMock.on(SendMessageBatchCommand).resolves(mockResponse);

    (BatchUtil.constructBatchQueueMessage as jest.Mock).mockResolvedValueOnce([
      {
        MessageBody:
          '{"recipients":[{"name":{"first":"Test2","last":""},"email":"test2@test.com","channel":"onDeck"}],"data":{"title":"Test Notification #1","content":"test","actionUrl":"www.google.com"},"channels":{"onDeck":{"templateDetails":"662b4817ca13d6f63e688e74"}},"organisationId":"662b4817ca13d6f63e688e69"}',
        Id: 'msg1',
        MessageGroupId: 'df0e4f7f-f4a3-40c0-b249-5420ef5ecb28',
        MessageDeduplicationId: '624f0faa-a7c8-4346-9f85-c9af943f8a6f',
      },
      {
        MessageBody:
          '{"recipients":[{"name":{"first":"Test1","last":""},"email":"test1@test.com","channel":"onDeck"}],"data":{"title":"Test Notification #1","content":"test","actionUrl":"www.google.com"},"channels":{"onDeck":{"templateDetails":"662b4817ca13d6f63e688e74"}},"organisationId":"662b4817ca13d6f63e688e69"}',
        Id: 'msg2',
        MessageGroupId: '45f802d5-6b3d-4840-b90e-48835091ec5f',
        MessageDeduplicationId: '37ca0d7d-8910-4b8e-b706-cf810b147a78',
      },
      {
        MessageBody:
          '{"recipients":[{"name":{"first":"Test1","last":""},"email":"test1@test.com","channel":"email"}],"data":{"title":"Test Notification #1","content":"test","actionUrl":"www.google.com"},"channels":{"onDeck":{"templateDetails":"662b4817ca13d6f63e688e74"}},"organisationId":"662b4817ca13d6f63e688e69"}',
        Id: 'msg3',
        MessageGroupId: '56a399a3-3400-4ff0-8338-775a5d4ebf55',
        MessageDeduplicationId: 'f014167d-8339-4ae3-9d0c-0d07ef3de891',
      },
    ]);
    const responses = await notificationService.sendNotification(recipients, data, organisation, onDeckChannels);
    expect(Array.isArray(responses.transactions)).toBe(true);
    expect(responses.transactions).toHaveLength(3);
  });

  it('should return array of transaction id including failure for channel onDeck', async () => {
    const mockResponse: SendMessageBatchCommandOutput = {
      Successful: [{ Id: 'msg1', MessageId: '12345', MD5OfMessageBody: 'd41d8cd98f00b204e9800998ecf8427e' }],
      Failed: [
        { Id: 'msg2', Code: 'InvalidContent', SenderFault: true, Message: 'The message has invalid content' },
        { Id: 'msg3', Code: 'InvalidContent', SenderFault: true, Message: 'The message has invalid content' },
      ],
      $metadata: {
        httpStatusCode: 200,
      },
    };

    sqsMock.on(SendMessageBatchCommand).resolves(mockResponse);
    (BatchUtil.constructBatchQueueMessage as jest.Mock).mockResolvedValueOnce([
      {
        MessageBody:
          '{"recipients":[{"name":{"first":"Test2","last":""},"email":"test2@test.com","channel":"onDeck"}],"data":{"title":"Test Notification #1","content":"test","actionUrl":"www.google.com"},"channels":{"onDeck":{"templateDetails":"662b4817ca13d6f63e688e74"}},"organisationId":"662b4817ca13d6f63e688e69"}',
        Id: 'msg1',
        MessageGroupId: 'df0e4f7f-f4a3-40c0-b249-5420ef5ecb28',
        MessageDeduplicationId: '624f0faa-a7c8-4346-9f85-c9af943f8a6f',
      },
      {
        MessageBody:
          '{"recipients":[{"name":{"first":"Test1","last":""},"email":"test1@test.com","channel":"onDeck"}],"data":{"title":"Test Notification #1","content":"test","actionUrl":"www.google.com"},"channels":{"onDeck":{"templateDetails":"662b4817ca13d6f63e688e74"}},"organisationId":"662b4817ca13d6f63e688e69"}',
        Id: 'msg2',
        MessageGroupId: '45f802d5-6b3d-4840-b90e-48835091ec5f',
        MessageDeduplicationId: '37ca0d7d-8910-4b8e-b706-cf810b147a78',
      },
      {
        MessageBody:
          '{"recipients":[{"name":{"first":"Test1","last":""},"email":"test1@test.com","channel":"email"}],"data":{"title":"Test Notification #1","content":"test","actionUrl":"www.google.com"},"channels":{"onDeck":{"templateDetails":"662b4817ca13d6f63e688e74"}},"organisationId":"662b4817ca13d6f63e688e69"}',
        Id: 'msg3',
        MessageGroupId: '56a399a3-3400-4ff0-8338-775a5d4ebf55',
        MessageDeduplicationId: 'f014167d-8339-4ae3-9d0c-0d07ef3de891',
      },
    ]);

    const response = await notificationService.sendNotification(recipients, data, organisation, onDeckChannels);
    expect(response.transactions).toHaveLength(3);
    expect(Array.isArray(response.transactions)).toBe(true);
    expect(response.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: 'onDeck',
          error: 'The message has invalid content',
          id: 'msg2',
          recipient: 'test1@test.com',
        }),
      ]),
    );
  });

  it('should retry on SQS send failure and eventually succeed', async () => {
    (BatchUtil.constructBatchQueueMessage as jest.Mock).mockResolvedValueOnce([
      {
        MessageBody:
          '{"recipients":[{"name":{"first":"Test2","last":""},"email":"test2@test.com","channel":"onDeck"}],"data":{"title":"Test Notification #1","content":"test","actionUrl":"www.google.com"},"channels":{"onDeck":{"templateDetails":"662b4817ca13d6f63e688e74"}},"organisationId":"662b4817ca13d6f63e688e69"}',
        Id: 'msg1',
        MessageGroupId: 'df0e4f7f-f4a3-40c0-b249-5420ef5ecb28',
        MessageDeduplicationId: '624f0faa-a7c8-4346-9f85-c9af943f8a6f',
      },
    ]);
    const mockResponse: SendMessageBatchCommandOutput = {
      Successful: [{ Id: 'msg1', MessageId: 'messageId-1', MD5OfMessageBody: 'd41d8cd98f00b204e9800998ecf8427e' }],
      Failed: [],
      $metadata: {
        httpStatusCode: 200,
      },
    };

    sqsMock.on(SendMessageBatchCommand).rejectsOnce(new Error('Temporary failure'));
    sqsMock.on(SendMessageBatchCommand).resolves(mockResponse);

    const response = await notificationService.sendNotification(recipients, data, organisation, onDeckChannels);

    expect(response.transactions.length).toBe(1);
    expect(response.transactions[0].id).toBe('messageId-1');
    expect(response.transactions[0].recipient).toBe('test2@test.com');
  });

  it('should throw error saying message_Id is undefined', async () => {
    (BatchUtil.constructBatchQueueMessage as jest.Mock).mockResolvedValueOnce([
      {
        MessageBody:
          '{"recipients":[{"name":{"first":"Test2","last":""},"email":"test2@test.com","channel":"onDeck"}],"data":{"title":"Test Notification #1","content":"test","actionUrl":"www.google.com"},"channels":{"onDeck":{"templateDetails":"662b4817ca13d6f63e688e74"}},"organisationId":"662b4817ca13d6f63e688e69"}',
        Id: 'msg1',
        MessageGroupId: 'df0e4f7f-f4a3-40c0-b249-5420ef5ecb28',
        MessageDeduplicationId: '624f0faa-a7c8-4346-9f85-c9af943f8a6f',
      },
    ]);
    const mockResponse: SendMessageBatchCommandOutput = {
      Successful: [{ Id: 'msg1', MessageId: undefined, MD5OfMessageBody: 'd41d8cd98f00b204e9800998ecf8427e' }],
      Failed: [],
      $metadata: {
        httpStatusCode: 200,
      },
    };

    sqsMock.on(SendMessageBatchCommand).resolves(mockResponse);

    await expect(notificationService.sendNotification(recipients, data, organisation, onDeckChannels)).rejects.toThrow(
      'MessageId is undefined in SQS response, send notification failed',
    );
  });
  it('should return array of transaction id for channel slack', async () => {
    recipients = [];
    const mockResponse: SendMessageBatchCommandOutput = {
      Successful: [{ Id: 'msg1', MessageId: '12345', MD5OfMessageBody: 'd41d8cd98f00b204e9800998ecf8427e' }],
      Failed: [],
      $metadata: {
        httpStatusCode: 200,
      },
    };
    sqsMock.on(SendMessageBatchCommand).resolves(mockResponse);
    jest.spyOn(JSON, 'parse').mockReturnValue({
      recipients: [null, null, null],
    });
    (getChannelNames as jest.Mock).mockReturnValue(['slack']);
    (BatchUtil.constructBatchQueueMessage as jest.Mock).mockResolvedValueOnce([
      {
        MessageBody:
          '{"channels":{"slack":{"templateDetails":"662b4817ca13d6f63e688e74"}},"organisationId":"662b4817ca13d6f63e688e69"}',
        Id: 'msg1',
        MessageGroupId: 'df0e4f7f-f4a3-40c0-b249-5420ef5ecb28',
        MessageDeduplicationId: '624f0faa-a7c8-4346-9f85-c9af943f8a6f',
      },
    ]);
    const responses = await notificationService.sendNotification(recipients, data, organisation, slackChannels);
    expect(Array.isArray(responses.transactions)).toBe(true);
    expect(responses.transactions).toHaveLength(1);
  });

  it('should send notification by event name', async () => {
    const event = {
      _id: 'event1',
      name: 'TestEvent',
      organisationId: '101',
      templateIds: ['template1', 'template2'],
    };
    const template1 = { _id: 'template1', channelType: ChannelType.EMAIL, templateDetails: {} };
    const template2 = { _id: 'template2', channelType: ChannelType.PUSH, templateDetails: {} };
    mockEventRepository.findEventByName.mockResolvedValueOnce(event);
    mockTemplateRepository.findTemplateById
      .mockResolvedValueOnce(template1)
      .mockResolvedValueOnce(template2);
    (BatchUtil.constructBatchQueueMessage as jest.Mock).mockResolvedValueOnce([
      { MessageBody: '{}', Id: 'msg1' },
    ]);
    sqsMock.on(SendMessageBatchCommand).resolves({ Successful: [{ Id: 'msg1', MessageId: 'mid1', MD5OfMessageBody: 'd41d8cd98f00b204e9800998ecf8427e' }], Failed: [], $metadata: { httpStatusCode: 200 } });
    const recipients = [{ email: 'test@test.com', channels: [ChannelType.EMAIL] }];
    const data = { subject: 'Test' };
    const organisation = { _id: '101', name: 'testOrg', api_key: 'key', api_secret_hash: 'hash' };
    const response = await notificationService.sendNotificationByEvent(recipients, data, organisation, 'TestEvent');
    expect(response.transactions.length).toBe(1);
    expect(mockEventRepository.findEventByName).toHaveBeenCalledWith('TestEvent', '101');
    expect(mockTemplateRepository.findTemplateById).toHaveBeenCalledWith('template1', '101');
    expect(mockTemplateRepository.findTemplateById).toHaveBeenCalledWith('template2', '101');
  });

  it('should throw error if event not found in sendNotificationByEventName', async () => {
    mockEventRepository.findEventByName.mockResolvedValueOnce(null);
    const recipients = [{ email: 'test@test.com', channels: [ChannelType.EMAIL] }];
    const data = { subject: 'Test' };
    const organisation = { _id: '101', name: 'testOrg', api_key: 'key', api_secret_hash: 'hash' };
    await expect(
      notificationService.sendNotificationByEvent(recipients, data, organisation, 'MissingEvent')
    ).rejects.toThrow("Event with name 'MissingEvent' not found for organisation 101");
  });

  it('should get channels from event', async () => {
    const event = {
      organisationId: '101',
      templateIds: ['template1', 'template2'],
    };
    const template1 = { _id: 'template1', channelType: ChannelType.EMAIL, templateDetails: {} };
    const template2 = { _id: 'template2', channelType: ChannelType.PUSH, templateDetails: {} };
    mockTemplateRepository.findTemplateById
      .mockResolvedValueOnce(template1)
      .mockResolvedValueOnce(template2);
    const channels = await (notificationService as any).getChannelsFromEvent(event);
    expect(channels[ChannelType.EMAIL]).toEqual({ templateId: 'template1' });
    expect(channels[ChannelType.PUSH]).toEqual({ templateId: 'template2' });
  });

  it('should send notification by event ID', async () => {
    const event = {
      _id: 'event2',
      name: 'EventById',
      organisationId: '101',
      templateIds: ['template3'],
    };
    const template3 = { _id: 'template3', channelType: ChannelType.PUSH, templateDetails: {} };
    mockEventRepository.findEventById = jest.fn().mockResolvedValueOnce(event);
    mockTemplateRepository.findTemplateById.mockResolvedValueOnce(template3);
    (BatchUtil.constructBatchQueueMessage as jest.Mock).mockResolvedValueOnce([
      { MessageBody: '{}', Id: 'msg1' },
    ]);
    sqsMock.on(SendMessageBatchCommand).resolves({ Successful: [{ Id: 'msg1', MessageId: 'mid2', MD5OfMessageBody: 'd41d8cd98f00b204e9800998ecf8427e' }], Failed: [], $metadata: { httpStatusCode: 200 } });
    const recipients = [{ email: 'test2@test.com', channels: [ChannelType.PUSH] }];
    const data = { subject: 'TestById' };
    const organisation = { _id: '101', name: 'testOrg', api_key: 'key', api_secret_hash: 'hash' };
    const response = await notificationService.sendNotificationByEvent(recipients, data, organisation, undefined, 'event2');
    expect(response.transactions.length).toBe(1);
    expect(mockEventRepository.findEventById).toHaveBeenCalledWith('event2', '101');
    expect(mockTemplateRepository.findTemplateById).toHaveBeenCalledWith('template3', '101');
    expect(mockEventRepository.updateLastUsedAt).toHaveBeenCalledWith('event2', '101');
  });

  it('should throw error if event not found by ID in sendNotificationByEvent', async () => {
    mockEventRepository.findEventById = jest.fn().mockResolvedValueOnce(null);
    const recipients = [{ email: 'test2@test.com', channels: [ChannelType.PUSH] }];
    const data = { subject: 'TestById' };
    const organisation = { _id: '101', name: 'testOrg', api_key: 'key', api_secret_hash: 'hash' };
    await expect(
      notificationService.sendNotificationByEvent(recipients, data, organisation, undefined, 'missingId')
    ).rejects.toThrow("Event with name 'undefined' not found for organisation 101");
  });
});
