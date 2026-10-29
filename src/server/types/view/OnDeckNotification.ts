/**
 * @example
 * [
  {
    "id": "65b9e7c72f28649615b1d7d4",
    "recipient": "test@test.com",
    "title": "test title",
    "content": "test content",
    "action_url": "https://google.com/",
    "is_viewed": false,
    "is_read": false,
    "is_archived": false
  }
]
 */
export interface OnDeckNotificationViewModel {
  id: string;
  recipient: string;
  source_creation_timestamp: Date;
  title: string | undefined;
  content: string;
  action_url: string;
  is_viewed: boolean;
  is_read: boolean;
  is_archived: boolean;
}
