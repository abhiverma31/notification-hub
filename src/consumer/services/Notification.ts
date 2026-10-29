import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { EmailService } from './channels/Email';
import { PushService } from './channels/Push';
import { TemplateService } from './Template';
import { TemplateHydrationService } from './TemplateHydration';
import { ChannelType } from '../../shared-library/types/Enum/ChannelType';
import {
  EmailTemplateDetails,
  PushTemplateDetails,
  SlackTemplateDetails,
  TemplateDetails,
  onDeckTemplateDetails,
} from '../../shared-library/models/Template';
import { Data, TemplateDetailsInterface } from '../types/Interfaces/Template';
import { QueueMessage } from '../../shared-library/types/Interfaces/QueueMessage';
import { OnDeckService } from './channels/OnDeck';
import { Recipient } from '../../shared-library/types/Dto/Recipient';
import { ConsumerLogger } from '../utils/ConsumerLogger';
import { ChannelService } from './channels/base/ChannelService';
import UserRepository from '../../shared-library/repositories/User';
import adaptToUserInterface from '../../shared-library/models/adapters/User';
import { replacePlaceholders } from '../helper/ReplacePlaceholders';
import { SlackService } from './channels/Slack';
import { SmsService } from './channels/Sms';
import { WhatsappService } from './channels/Whatsapp';
import { UserInterface } from '../../shared-library/models/User';
import { TeamsService } from './channels/Teams';
import { TelegramService } from './channels/Telegram';

type ChannelDelivery = { service: ChannelService };

@injectable()
export class NotificationService {
  private readonly logger = new ConsumerLogger();
  private readonly batchSize: number;
  private readonly channelMap: {
    [ChannelType.EMAIL]: ChannelDelivery;
    [ChannelType.PUSH]: ChannelDelivery;
    [ChannelType.ONDECK]: ChannelDelivery;
    [ChannelType.SLACK]: ChannelDelivery;
    [ChannelType.SMS]: ChannelDelivery;
    [ChannelType.WHATSAPP]: ChannelDelivery;
    [ChannelType.TEAMS]: ChannelDelivery;
    [ChannelType.TELEGRAM]: ChannelDelivery;
  };

  constructor(
    @inject(EmailService) private emailService: EmailService,
    @inject(PushService) private pushService: PushService,
    @inject(TemplateService) private templateService: TemplateService,
    @inject(TemplateHydrationService) private templateHydrationService: TemplateHydrationService,
    @inject(OnDeckService) private onDeckService: OnDeckService,
    @inject(SlackService) private slackService: SlackService,
    @inject(UserRepository) private userRepository: UserRepository,
    @inject(SmsService) private smsService: SmsService,
    @inject(WhatsappService) private whatsAppService: WhatsappService,
    @inject(TeamsService) private teamsService: TeamsService,
    @inject(TelegramService) private telegramService: TelegramService,
  ) {
    this.channelMap = {
      [ChannelType.EMAIL]: { service: this.emailService },
      [ChannelType.PUSH]: { service: this.pushService },
      [ChannelType.ONDECK]: { service: this.onDeckService },
      [ChannelType.SLACK]: { service: this.slackService },
      [ChannelType.SMS]: { service: this.smsService },
      [ChannelType.WHATSAPP]: { service: this.whatsAppService },
      [ChannelType.TEAMS]: { service: this.teamsService },
      [ChannelType.TELEGRAM]: { service: this.telegramService },
    };
    this.batchSize = parseInt(process.env.BATCH_SIZE || '10');
  }

  public async sendNotification(queueMsg: QueueMessage, transactionId?: string) {
    let userId: string | null = null;
    let errorObj;
    try {
      const channelsToSend = Object.keys(queueMsg.channels) as ChannelType[];
      const now = new Date();
      const recipientBatches = this.chunkArray(queueMsg.recipients!, this.batchSize);

      await Promise.all([
        ...recipientBatches.map(async (batch) => {
          const batchUpsertPromises = batch.map(async (recipient) => {
            if (recipient !== null) {
              const user = adaptToUserInterface(recipient, queueMsg.organisationId);
              user.last_notified_at = now;
              this.logger.debug('User to be upserted', user);
              const upsertedUser = await this.userRepository.upsert(user);
              userId = upsertedUser ? upsertedUser.user_id : null;
            }
          });
          await Promise.all(batchUpsertPromises);
        }),
        ...channelsToSend.map((channel) => this.sendChannelMessage(channel, queueMsg, transactionId)),
      ]);
    } catch (error) {
      errorObj = error;
      this.logger.error('Error while sending notification', error);
    }

    return { userId, errorObj };
  }

  public async retryFetchingUserId(user: UserInterface): Promise<UserInterface | null> {
    return await this.userRepository.retryFetchingUserId(user);
  }

  private sendChannelMessage = async (channel: ChannelType, queueMsg: QueueMessage, transactionId?: string) => {
    const { recipients, data, organisationId, channels } = queueMsg;
    let hydratedTemplate = {};
    for (const recipient of recipients) {
      if (recipient === null || recipient.channel === channel) {
        if (channels?.[channel]?.templateId === undefined) {
          const templateDetails = channels?.[channel]?.template as TemplateDetails;
          hydratedTemplate = await this.hydrateRecepientForTemplate(templateDetails, recipient);
        } else {
          hydratedTemplate = await this.getTemplateAndHydrate(
            recipient,
            channels?.[channel]?.templateId as string,
            organisationId!,
            data,
          );
        }
        await this.channelMap[channel].service.send(hydratedTemplate, organisationId!, recipient, transactionId);
      }
    }
  };

  private getTemplateAndHydrate = async (
    recipient: Recipient,
    templateId: string,
    organisationId: string,
    data: Data,
  ) => {
    this.logger.trace(
      '> Consumer:NotificationService:getTemplateAndHydrate',
      recipient,
      templateId,
      organisationId,
      data,
    );

    const template = await this.templateService.getTemplate(templateId, organisationId);

    return await this.templateHydrationService.hydrate(template, recipient, data);
  };

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunkedArray: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunkedArray.push(array.slice(i, i + chunkSize));
    }

    return chunkedArray;
  }

  private hydrateRecepientForTemplate = async (templateDetails: TemplateDetails, recipient?: Recipient) => {
    const hydratedTemplate: TemplateDetailsInterface = {};
    for (const key in templateDetails) {
      if (Object.prototype.hasOwnProperty.call(templateDetails, key)) {
        const content = templateDetails[key] as string;
        hydratedTemplate[key] = replacePlaceholders(content, recipient as any);
      }
    }

    return hydratedTemplate as
      | EmailTemplateDetails
      | PushTemplateDetails
      | onDeckTemplateDetails
      | SlackTemplateDetails;
  };
}
