import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import axios from 'axios';
import { ChannelService } from './base/ChannelService';
import { TelegramTemplateDetails } from '../../../shared-library/models/Template';
import { TelegramSettings } from '../../../shared-library/models/submodels/OrganisationSettings';
import { ChannelType } from '../../../shared-library/types/Enum/ChannelType';
import { OrganisationService } from '../Organisation';
import { BadRequest } from '../../../server/utils/errors/BadRequest';
import { logger } from '../../utils/ConsumerLogger';
import { Recipient } from '../../../shared-library/types/Dto/Recipient';
import { decryptData } from '../../../server/utils/KeyTools';

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';

@injectable()
export class TelegramService extends ChannelService {
  constructor(@inject(OrganisationService) private organisationService: OrganisationService) {
    super();
  }

  public async send(template: TelegramTemplateDetails, organisationId: string, recipient?: Recipient): Promise<void> {
    logger.traceStart({ template, organisationId }, 'Sending Telegram Notification');

    const settings = (await this.organisationService.getProviderSettings(
      organisationId,
      ChannelType.TELEGRAM,
    )) as TelegramSettings;

    if (!settings) {
      logger.error('Telegram settings not found for org', { organisationId });
      throw new BadRequest('Telegram settings are not provided!');
    }

    const chatId = recipient?.telegramChatId ?? settings.chatId;

    if (!chatId) {
      throw new BadRequest('Telegram chatId is not provided! Set it on the user or in org settings.');
    }

    try {
      await axios.post(`${TELEGRAM_API_BASE_URL}/bot${decryptData(settings.botToken)}/sendMessage`, {
        chat_id: chatId,
        text: template.text,
        ...(template.parseMode && { parse_mode: template.parseMode }),
      });
      logger.info('Message sent to Telegram successfully.');
    } catch (error) {
      logger.error('Telegram API error', { error });
      throw new Error(`Error sending message to Telegram: ${(error as Error).message}`);
    }

    logger.traceEnd({ template, organisationId }, 'Sending Telegram Notification');
  }
}
