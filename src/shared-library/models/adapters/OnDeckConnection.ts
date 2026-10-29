import { OnDeckConnection } from '../OnDeckConnection';
import { UserId } from '../User';

export default function adaptToOnDeckConnectionInterface(
  connectionId: string,
  recipientEmail: string,
  organisationId: string,
): OnDeckConnection {
  return {
    connection_id: connectionId,
    recipient_id: UserId.build(organisationId, recipientEmail),
    source_creation_timestamp: new Date(),
  };
}
