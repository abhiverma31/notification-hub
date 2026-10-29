import 'reflect-metadata';
import { container } from 'tsyringe';
import { handler } from '../../../src/consumer/NotificationEngine';
import { DeliveryReportService } from '../../../src/consumer/services/DeliveryReport';
import { NotificationService } from '../../../src/consumer/services/Notification';
import { DatabaseConnector } from '../../../src/shared-library/connectors/DatabaseConnector';
import { DeliveryReportStatus } from '../../../src/shared-library/types/DeliveryReportStatus';
import { SQSEvent } from 'aws-lambda';

describe('NotificationEngine handler', () => {
  let mockDeliveryReportService: jest.Mocked<Partial<DeliveryReportService>>;
  let mockNotificationService: jest.Mocked<Partial<NotificationService>>;
  let mockDb: jest.Mocked<Partial<DatabaseConnector>>;

  const buildSqsEvent = (body: object, messageId = 'msg-001'): SQSEvent => ({
    Records: [
      {
        messageId,
        body: JSON.stringify(body),
        receiptHandle: 'handle',
        attributes: {} as any,
        messageAttributes: {},
        md5OfBody: '',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:000:queue',
        awsRegion: 'us-east-1',
      },
    ],
  });

  const validQueueMessage = {
    channels: { email: {} },
    recipients: [{ email: 'test@example.com', channel: 'email' }],
    organisationId: 'org-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = { connect: jest.fn().mockResolvedValue(undefined) };
    mockDeliveryReportService = {
      saveReport: jest.fn().mockResolvedValue({}),
      updateReportStatus: jest.fn().mockResolvedValue({}),
      updateUserId: jest.fn().mockResolvedValue(undefined),
    };
    mockNotificationService = {
      sendNotification: jest.fn().mockResolvedValue({ userId: 'user-1', errorObj: null }),
      retryFetchingUserId: jest.fn(),
    };

    jest.spyOn(container, 'resolve').mockImplementation((token: any) => {
      if (token === DatabaseConnector) return mockDb;
      if (token === DeliveryReportService) return mockDeliveryReportService;
      if (token === NotificationService) return mockNotificationService;
      return {};
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('saves delivery report with INITIATED status before sending notification', async () => {
    const event = buildSqsEvent(validQueueMessage);

    await handler(event);

    expect(mockDeliveryReportService.saveReport).toHaveBeenCalledWith(
      'msg-001',
      'N/A',
      'email',
      DeliveryReportStatus.INITIATED,
      undefined,
      'org-1',
    );

    const saveCallOrder = mockDeliveryReportService.saveReport!.mock.invocationCallOrder[0];
    const sendCallOrder = mockNotificationService.sendNotification!.mock.invocationCallOrder[0];
    expect(saveCallOrder).toBeLessThan(sendCallOrder);
  });

  it('updates report status to SENT when sendNotification succeeds', async () => {
    const event = buildSqsEvent(validQueueMessage);

    await handler(event);

    expect(mockDeliveryReportService.updateReportStatus).toHaveBeenCalledWith(
      'msg-001',
      DeliveryReportStatus.SENT,
    );
  });

  it('updates report status to ERRORED when sendNotification throws', async () => {
    mockNotificationService.sendNotification!.mockResolvedValue({
      userId: 'user-1',
      errorObj: new Error('Provider timeout'),
    });

    const event = buildSqsEvent(validQueueMessage);
    const result = await handler(event);

    expect(mockDeliveryReportService.updateReportStatus).toHaveBeenCalledWith(
      'msg-001',
      DeliveryReportStatus.ERRORED,
      { message: 'Provider timeout' },
    );
    expect(result.batchItemFailures).toHaveLength(1);
    expect(result.batchItemFailures[0].itemIdentifier).toBe('msg-001');
  });
});
