import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { OnDeckRepository } from '../../shared-library/repositories/OnDeck';
import { OnDeckNotificationViewModel } from '../types/view/OnDeckNotification';
import { OnDeckViewAdapter } from '../../shared-library/models/adapters/OnDeckViewAdapter';
import UserRepository from '../../shared-library/repositories/User';
import { ServerLogger } from '../utils/ServerLogger';

@injectable()
export class OnDeckService {
  private readonly logger = new ServerLogger();

  constructor(
    @inject(OnDeckRepository) private notificationRepository: OnDeckRepository,
    @inject(UserRepository) private userRepository: UserRepository,
  ) {}

  async getNotifications(
    organisationId: string,
    email: string,
    page: number,
    itemsPerPage: number = 10,
    includeRead: boolean,
  ): Promise<OnDeckNotificationViewModel[] | undefined> {
    this.logger.traceStart(
      { organisationId, email, page, itemsPerPage, includeRead },
      'server > getNotification Getting onDeck Notification',
    );
    try {
      const notifications = await this.notificationRepository.get(
        organisationId,
        page * itemsPerPage,
        itemsPerPage,
        email,
        includeRead,
      );

      return OnDeckViewAdapter.adaptToOnDeckViews(notifications);
    } catch (error) {
      this.logger.error({ error }, 'server > getNotification < error in getting onDeck Notification');
    } finally {
      this.logger.traceEnd(
        { organisationId, email, page, itemsPerPage, includeRead },
        'server > getNotification Getting onDeck Notification',
      );
    }
  }

  async updateNotification(organisationId: string, id: string, markRead: boolean) {
    const result = await this.notificationRepository.updateReadStatus(organisationId, id, markRead);
    this.logger.trace({ result, id, markRead }, 'server > updateNotification marking notification as read');
  }

  async readAllNotifications(organisationId: string, email: string) {
    const result = await this.notificationRepository.readAllUnread(organisationId, email);
    this.logger.trace({ result, email }, 'server > readAllNotifications marking all notifications as read');

    return result;
  }

  async archiveNotification(organisationId: string, id: string) {
    const result = await this.notificationRepository.archive(organisationId, id);
    this.logger.trace({ result, id }, 'server > archiveNotification marking notification as archive');

    return result;
  }

  async viewAllNotifications(organisationId: string, email: string) {
    const result = await this.notificationRepository.viewAllNotifications(organisationId, email);
    this.logger.trace(
      { result, email, organisationId },
      'server > archiveNotification marking notification as archive',
    );

    return result;
  }
}
