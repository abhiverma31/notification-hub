import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'crypto';
import UserRepository from '../../shared-library/repositories/User';
import { UserId, UserInterface } from '../../shared-library/models/User';
import { logger } from '../utils/ServerLogger';

export interface TelegramWebhookBody {
  message?: {
    chat: { id: number };
    text?: string;
    contact?: { phone_number: string };
    from?: { first_name?: string; last_name?: string };
  };
}

const PHONE_COMMAND_REGEX = /^\/start\s+(\+?\d{7,15})$/;

@injectable()
export class TelegramWebhookService {
  constructor(@inject(UserRepository) private userRepository: UserRepository) {}

  public async handleWebhook(organisationId: string, body: TelegramWebhookBody): Promise<void> {
    const message = body.message;
    if (!message) return;

    const chatId = String(message.chat.id);
    const phoneNumber = this.extractPhoneNumber(message);

    // Use phone number as email if available, otherwise use chatId as synthetic identifier
    const email = phoneNumber ? `${phoneNumber}@telegram` : `tg_${chatId}@telegram`;

    const user: UserInterface = {
      _id: UserId.build(organisationId, email),
      user_id: randomUUID(),
      email,
      name: {
        first: message.from?.first_name ?? 'Telegram',
        last: message.from?.last_name,
      },
      telegram_chat_id: chatId,
      external_user_id: chatId,
      ...(phoneNumber && { phone_number: phoneNumber }),
    };

    await this.userRepository.upsert(user);
    logger.info('Telegram user upserted', { organisationId, email, chatId });
  }

  private extractPhoneNumber(message: TelegramWebhookBody['message']): string | null {
    if (message?.contact?.phone_number) {
      return message.contact.phone_number.replace(/\s+/g, '');
    }
    const match = message?.text?.match(PHONE_COMMAND_REGEX);

    return match ? match[1] : null;
  }
}
