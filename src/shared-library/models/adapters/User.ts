import { Recipient } from '../../types/Dto/Recipient';
import { UserId, UserInterface } from '../User';

export default function adaptToUserInterface(recipient: Recipient, organisationId: string): UserInterface {
  return {
    _id: UserId.build(organisationId, recipient.email),
    user_id: recipient.userId,
    email: recipient.email as string,
    name: recipient.name,
    ...(recipient.phone_number && { phone_number: recipient.phone_number }),
    ...(recipient.telegramChatId && { telegram_chat_id: recipient.telegramChatId }),
  };
}
