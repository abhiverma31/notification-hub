import { inject, injectable } from 'tsyringe';
import { OnDeckService } from '../services/OnDeck';
import { Response, Request, Query, Route, Get, Put, Delete, Path } from 'tsoa';
import { Controller, Security, Tags } from '@tsoa/runtime';
import { OnDeckNotificationViewModel } from '../types/view/OnDeckNotification';
import { NHRequest } from '../types/internal/NHRequest';
import { AuthSchemes } from '../middlewares/Authentication';

@injectable()
@Route('api/notification/on-deck')
@Security(AuthSchemes.orgUser)
@Security(AuthSchemes.orgLp)
@Tags('OnDeck Notifications')
export class OnDeckController extends Controller {
  constructor(@inject(OnDeckService) private onDeckService: OnDeckService) {
    super();
  }

  /**
   * Fetch onDeck Notifications by using organisation Id and end User email id.this Api is called from onDeck component which is bellIcon.
   * since the param values are defaulted in the backend, we can not change it.
   * @summary Fetch onDeck Notifications for end user
   * @param page - current Page number
   * @param itemsPerPage - Number of items per page to be displayed
   * @param includeRead - Include Read notifications
   */
  @Get()
  @Response<OnDeckNotificationViewModel[]>('200', 'Get On Deck Notifications')
  public async getNotifications(
    @Request() request: NHRequest,
    @Query() page: number = 0,
    @Query() itemsPerPage: number = 10,
    @Query() includeRead: boolean = true,
  ) {
    return this.onDeckService.getNotifications(
      request.user.organisation!._id!,
      request.user?.user?.email!,
      page,
      itemsPerPage,
      includeRead,
    );
  }

  /**
   * Mark onDeck Notifications as read by using organisation Id and notification id.this Api is called from onDeck component which is bellIcon.
   * @summary Mark Notification as read
   * @param id - Id of the notification which need to be marked as read.
   */
  @Put('{id}/read')
  async readNotification(@Request() request: NHRequest, @Path() id: string): Promise<void> {
    await this.onDeckService.updateNotification(request.user.organisation!._id!, id, true);
  }

  /**
   * Mark onDeck Notifications as unread by using organisation Id and notification id.this Api is called from onDeck component which is bellIcon.
   * @summary Mark Notification as unread
   * @param id - Id of the notification which need to be marked as unread.
   */
  @Put('{id}/unread')
  async unreadNotification(@Request() request: NHRequest, @Path() id: string): Promise<void> {
    await this.onDeckService.updateNotification(request.user.organisation!._id!, id, false);
  }

  /**
   * Mark All onDeck Notifications as read by using organisation Id and end user email id.this Api is called from onDeck component which is bellIcon.
   * The params are directly taken from the request.
   * @summary Mark All Notification as read
   */
  @Put('readAll')
  async readAllNotifications(@Request() request: NHRequest): Promise<void> {
    await this.onDeckService.readAllNotifications(request.user.organisation!._id!, request.user?.user?.email!);
  }

  /**
   * Mark onDeck Notifications as archived by using organisation Id and notification id.this Api is called from onDeck component which is bellIcon.
   * once the notification is marked as archived, this wont be shown in the UI.
   * @summary Mark Notification as archived
   * @param id - Id of the notification which need to be marked as archived.
   */
  @Delete('{id}/archive')
  async archiveNotification(@Request() request: NHRequest, @Path() id: string): Promise<void> {
    await this.onDeckService.archiveNotification(request.user.organisation!._id!, id);
  }

  /**
   * Mark All unviewed onDeck Notifications as viewed  by using organisation Id and end user email id.i.e the count on the bellicon will disappear. this Api is called from onDeck component which is bellIcon.
   * The params are directly taken from the request.
   * @summary Mark All Notification as viewed.
   */
  @Put('viewAll')
  async viewAllNotifications(@Request() request: NHRequest): Promise<void> {
    await this.onDeckService.viewAllNotifications(request.user.organisation!._id!, request.user?.user?.email!);
  }
}
