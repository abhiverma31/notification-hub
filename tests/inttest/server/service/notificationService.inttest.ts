import 'reflect-metadata';
import { container } from 'tsyringe';
import { SQS } from '@aws-sdk/client-sqs';
import { NotificationService } from '../../../../src/server/services/Notification';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { UserDto } from '../../../../src/shared-library/types/Dto/Notification';
import { NotFound } from '../../../../src/server/utils/errors/BadRequest';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';
import { insertSeedData, SeedDataResult } from '../../../../scripts/seedData/insertSeedData';
import { OnDeckNotificationModel } from '../../../../src/shared-library/models/OnDeck';
import { UserId } from '../../../../src/shared-library/models/User';
import { EventRepository } from '../../../../src/shared-library/repositories/Event';

const localElasticMQEndpoint = 'http://sqs:9324';

const sqs = new SQS({
  region: 'local',
  endpoint: localElasticMQEndpoint,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

describe('notificationEngineHandler Integration Test', () => {
  const db: DatabaseConnector = container.resolve(DatabaseConnector);
    let seedData: SeedDataResult;
    let seedNotificationId: string;
  
    beforeAll(async () => {
      await db.connect('OnDeck Integration Test:BeforeAll');
      await sqs.purgeQueue({ QueueUrl: `${localElasticMQEndpoint}/queue/NotificationEngineQueue.fifo` });
      seedData = await insertSeedData();
      seedNotificationId = (
        await OnDeckNotificationModel.create({
          title: 'Test Title',
          content: 'Test Content',
          actionUrl: 'Test Action URL',
          recipient_id: UserId.build(seedData.OrganisationId, seedData.UserEmail),
          source_creation_timestamp: Date.now(),
          source: 'Test',
        })
      )._id;
    });
  
    afterAll(async () => {
      await db.clearTestDatabase();
      await db.disconnect('OnDeck Integration Test:AfterAll');
    });

  it('should process SQS event when event is fired', async () => {
    const notificationService = container.resolve(NotificationService);

    const organisation = {
      _id: '101',
      name: 'testOrg',
      api_key: 'random-api-key',
      api_secret_hash: 'random-secret-hash',
    };

    const recipients: UserDto[] = [
      {
        channels: [ChannelType.EMAIL],
        email: 'test@test.com',
      },
      {
        channels: [ChannelType.PUSH],
        fcmToken: ['random-fcm-token'],
        email: 'test@test.com',
      },
    ];

    const emailChannels = {
      [ChannelType.EMAIL]: {
        templateId: '1',
      },
    } as unknown as { [key in ChannelType]: Record<string, string> };

    const data = { subject: 'Hi', content: 'Test' };

    await notificationService.sendNotification(recipients, data, organisation, emailChannels);
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const result = await sqs
      .receiveMessage({
        QueueUrl: `${localElasticMQEndpoint}/queue/NotificationEngineQueue.fifo`,
        MaxNumberOfMessages: 1,
      });

    expect(result.Messages).toHaveLength(1);

    const body = JSON.parse(result.Messages![0].Body!);

    expect(body.recipients![0].email).toBe('test@test.com');
  });

  it('should send notification by event name (integration)', async () => {
    const notificationService = container.resolve(NotificationService);
    const organisation = {
      _id: seedData.OrganisationId,
      name: 'testOrg',
      api_key: 'random-api-key',
      api_secret_hash: 'random-secret-hash',
    };
    const recipients: UserDto[] = [
      {
        channels: [ChannelType.EMAIL],
        email: 'test@test.com',
      },
    ];
    const data = { subject: 'Hi', content: 'Test' };
    // Assume event 'TestEvent' exists in DB with templateIds
    await notificationService.sendNotificationByEvent(recipients, data, organisation, 'On order placed');
    await new Promise((resolve) => setTimeout(resolve, 10000));
    // Check lastUsedAt updated
    const eventRepository = container.resolve(EventRepository);
    const event = await eventRepository.findEventByName('On order placed', organisation._id);
    expect(event?.lastUsedAt).toBeInstanceOf(Date);
    const result = await sqs
      .receiveMessage({
        QueueUrl: `${localElasticMQEndpoint}/queue/NotificationEngineQueue.fifo`,
        MaxNumberOfMessages: 1,
      });
    expect(result.Messages).toHaveLength(1);
    const body = JSON.parse(result.Messages![0].Body!);
    expect(body.recipients![0].email).toBe('test@test.com');
  });

  it('should throw error if event not found by name (integration)', async () => {
    const notificationService = container.resolve(NotificationService);
    const organisation = {
      _id: '101',
      name: 'testOrg',
      api_key: 'random-api-key',
      api_secret_hash: 'random-secret-hash',
    };
    const recipients: UserDto[] = [
      {
        channels: [ChannelType.EMAIL],
        email: 'test@test.com',
      },
    ];
    const data = { subject: 'Hi', content: 'Test' };
    await expect(
      notificationService.sendNotificationByEvent(recipients, data, organisation, 'MissingEvent')
    ).rejects.toThrow(new NotFound("Event with name 'MissingEvent' not found for organisation 101"));
  });
});
