import 'reflect-metadata';
import { NotificationService } from '../../../../src/server/services/Notification';
import { NotificationController } from '../../../../src/server/controllers/Notification';
import { SendNotificationRequest, SendNotificationByEventRequest } from '../../../../src/server/types/request/SendNotification';
import { container } from 'tsyringe';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { HttpStatusCode } from '../../../../src/server/types/Enum/HttpStatusCode';

jest.mock('../../../../src/server/services/Notification.ts');
const MockNotificationService = NotificationService as jest.MockedClass<typeof NotificationService>;

describe('NotificationController', () => {
  let notificationController: NotificationController;
  let mockBody: SendNotificationRequest;
  let mockRequest: any;

  beforeEach(() => {
    container.register(NotificationService, { useClass: MockNotificationService });
    notificationController = new NotificationController(container.resolve(NotificationService));
    notificationController.setStatus = jest.fn();

    mockBody = {
      recipients: [{ email: 'user1@example.com', name: 'User', channels: [ChannelType.EMAIL, ChannelType.ONDECK] }],
      data: { subject: 'Test Subject', content: 'Test Content' },
      channels: { email: { templateId: '1' } },
      source: 'Server',
    };

    mockRequest = { user: { organisation: { name: 'TestOrg' } } };
  });

  it('should send notification successfully', async () => {
    MockNotificationService.prototype.sendNotification.mockResolvedValue({ transactionId: '123' });

    const response = await notificationController.sendNotification(mockRequest, mockBody);

    expect(notificationController.setStatus).toHaveBeenCalledWith(HttpStatusCode.ACCEPTED);
    expect(NotificationService.prototype.sendNotification).toHaveBeenCalledWith(
      mockBody.recipients,
      mockBody.data,
      mockRequest.user.organisation,
      mockBody.channels,
    );
    expect(response.transactionId).toStrictEqual('123');
  });

  it('should send notification with empty recepients for slack', async () => {
    MockNotificationService.prototype.sendNotification.mockResolvedValue({ transactionId: '123' });
    mockBody.recipients = [];
    const response = await notificationController.sendNotification(mockRequest, mockBody);

    expect(notificationController.setStatus).toHaveBeenCalledWith(HttpStatusCode.ACCEPTED);
    expect(NotificationService.prototype.sendNotification).toHaveBeenCalledWith(
      mockBody.recipients,
      mockBody.data,
      mockRequest.user.organisation,
      mockBody.channels,
    );
    expect(response.transactionId).toStrictEqual('123');
  });

  it('should send notification by event name successfully', async () => {
    MockNotificationService.prototype.sendNotificationByEvent.mockResolvedValue({ transactions: [{ id: '456', recipient: 'user@test.com', channel: 'email' }] });

    const eventBody = {
      recipients: [{ email: 'user@test.com', channels: [ChannelType.EMAIL] }],
      data: { subject: 'Test' },
      eventName: 'order_placed',
      eventId: 'evt-1',
    };

    const response = await notificationController.sendNotificationByEventName(mockRequest, eventBody as any);

    expect(notificationController.setStatus).toHaveBeenCalledWith(HttpStatusCode.ACCEPTED);
    expect(NotificationService.prototype.sendNotificationByEvent).toHaveBeenCalledWith(
      eventBody.recipients,
      eventBody.data,
      mockRequest.user.organisation,
      'order_placed',
      'evt-1',
      undefined,
    );
    expect(response.transactions).toHaveLength(1);
  });
});
