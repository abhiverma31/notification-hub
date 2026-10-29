import { OnDeckNotification } from '../OnDeck';
import { Recipient } from '../../types/Dto/Recipient';
import { UserId } from '../User';

export default function adaptToNotificationInterface(
  title: string,
  content: string,
  actionUrl: string,
  recipient: Recipient,
  organisationId: string,
): OnDeckNotification {
  return {
    content,
    recipient_id: UserId.build(organisationId, recipient.email),
    title,
    actionUrl,
    source_creation_timestamp: new Date(),
  };
}
