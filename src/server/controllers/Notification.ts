import { inject, injectable } from 'tsyringe';
import { NotificationService } from '../services/Notification';
import { Request, Post, Route, Response, Body, Security } from 'tsoa';
import { Controller, Tags } from '@tsoa/runtime';
import { SendNotificationRequest, SendNotificationByEventRequest } from '../types/request/SendNotification';
import { NHRequest } from '../types/internal/NHRequest';
import { SendNotificationResponse } from '../types/response/SendNotification';
import { AuthSchemes } from '../middlewares/Authentication';
import { ServerLogger } from '../utils/ServerLogger';

@injectable()
@Security(AuthSchemes.orgOwner)
@Security(AuthSchemes.frontendToken)
@Route('api/notification')
@Tags('Send Notifications')
export class NotificationController extends Controller {
  private readonly logger = new ServerLogger();
  constructor(@inject(NotificationService) private notificationService: NotificationService) {
    super();
  }

  /**
   * Sends a notification to the End User using various channels such as *email*, *push*, *slack*, and *onDeck*.
   * @summary Sends a notification to the End User.
   * @param {SendNotificationRequest} body - The request body containing recipients, data, and channels.
   */
  @Post()
  @Response<SendNotificationResponse>('202', 'Notification is being processed')
  public async sendNotification(
    @Request() req: NHRequest,
    @Body() body: SendNotificationRequest,
  ): Promise<SendNotificationResponse> {
    this.logger.trace('> server > NotificationController > sendNotification ', { body, user: req.user });
    const sendResult = await this.notificationService.sendNotification(
      body.recipients!,
      body.data!,
      req.user.organisation!,
      body.channels,
    );
    this.logger.trace('> server > NotificationController > Notification sent to consumer for processing ', sendResult);
    this.setStatus(202);

    return sendResult;
  }

  /**
   * Sends a notification to the End User using an event name to determine channels/templates.
   * @summary Sends a notification to the End User using eventName.
   * @param {SendNotificationByEventNameRequest} body - The request body containing recipients, data, and eventName.
   */
  @Post('by-event')
  @Response<SendNotificationResponse>('202', 'Notification is being processed')
  public async sendNotificationByEventName(
    @Request() req: NHRequest,
    @Body() body: SendNotificationByEventRequest,
  ): Promise<SendNotificationResponse> {
    this.logger.trace('> server > NotificationController > sendNotificationByEventName ', { body, user: req.user });
    const sendResult = await this.notificationService.sendNotificationByEvent(
      body.recipients!,
      body.data!,
      req.user.organisation!,
      body.eventName,
      body.eventId,
      body.channels,
    );
    this.logger.trace(
      '> server > NotificationController > Notification sent to consumer for processing (eventName) ',
      sendResult,
    );
    this.setStatus(202);

    return sendResult;
  }
}
