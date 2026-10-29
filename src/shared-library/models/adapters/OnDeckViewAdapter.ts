import { OnDeckNotificationViewModel } from '../../../server/types/view/OnDeckNotification';
import { OnDeckNotification } from '../OnDeck';
import { UserId } from '../User';

export class OnDeckViewAdapter {
  public static adaptToOnDeckView(dbItem: OnDeckNotification): OnDeckNotificationViewModel {
    return {
      id: dbItem._id!,
      title: dbItem.title,
      content: dbItem.content,
      action_url: dbItem.actionUrl,
      is_viewed: !!dbItem.viewed_at,
      is_read: !!dbItem.read_at,
      is_archived: !!dbItem.archived_at,
      source_creation_timestamp: dbItem.source_creation_timestamp,
      recipient: UserId.extractEmailId(dbItem.recipient_id),
    };
  }

  public static adaptToOnDeckViews(dbItems: Array<OnDeckNotification>): Array<OnDeckNotificationViewModel> {
    return dbItems.map<OnDeckNotificationViewModel>(this.adaptToOnDeckView);
  }
}
