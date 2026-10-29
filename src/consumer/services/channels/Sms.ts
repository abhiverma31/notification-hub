import { inject, injectable } from 'tsyringe';
import { ChannelService } from './base/ChannelService';
import { TemplateDetails } from '../../../shared-library/models/Template';
import { Recipient } from '../../../shared-library/types/Dto/Recipient';
import { ServerLogger } from '../../../server/utils/ServerLogger';
import twilio from 'twilio';
import { MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message';
import { OrganisationService } from '../Organisation';
import { GupshupSmsSettings, SmsSettings } from '../../../shared-library/models/submodels/OrganisationSettings';
import { decryptData } from '../../../server/utils/KeyTools';
import { SmsProviders } from '../../../server/types/Enum/SmsProviders';
import { GupshupSmsService } from '../integrations/GupshupSmsService';

@injectable()
export class SmsService extends ChannelService {
  private readonly logger = new ServerLogger();
  constructor(
    @inject(OrganisationService) private organisationService: OrganisationService,
    @inject(GupshupSmsService) private gupshupSmsService: GupshupSmsService,
  ) {
    super();
  }

  public async send(
    hydratedTemplate: TemplateDetails,
    organisationId: string,
    recipient: Recipient,
    transactionId?: string,
  ): Promise<void> {
    this.logger.traceStart({ recipient, hydratedTemplate, organisationId }, 'Sending Sms');

    const providerConfig = await this.organisationService.getSmsProviderConfig(organisationId);
    if (!providerConfig) {
      throw new Error('SMS settings are not provided!');
    }

    if (providerConfig.provider === SmsProviders.GUPSHUP) {
      await this.sendViaGupshup(hydratedTemplate, recipient, providerConfig.settings as GupshupSmsSettings);
    } else if (providerConfig.provider === SmsProviders.TWILIO) {
      await this.sendViaTwilio(
        hydratedTemplate,
        recipient,
        providerConfig.settings as SmsSettings,
        transactionId,
        organisationId,
      );
    }
  }

  private async sendViaGupshup(
    hydratedTemplate: TemplateDetails,
    recipient: Recipient,
    settings: GupshupSmsSettings,
  ): Promise<void> {
    const decryptedSettings: GupshupSmsSettings = {
      ...settings,
      password: decryptData(settings.password),
    };
    await this.gupshupSmsService.send(hydratedTemplate.body as string, recipient.phone_number || '', decryptedSettings);
  }

  private async sendViaTwilio(
    hydratedTemplate: TemplateDetails,
    recipient: Recipient,
    settings: SmsSettings,
    transactionId?: string,
    organisationId?: string,
  ): Promise<void> {
    const accountSid = decryptData(settings.auth.accountSid);
    const authToken = decryptData(settings.auth.authToken);
    const senderNumber = settings.smsNumber;

    const client = twilio(accountSid, authToken);

    const createParams: MessageListInstanceCreateOptions = {
      body: hydratedTemplate.body as string,
      from: senderNumber,
      to: recipient.phone_number || '',
    };

    if (transactionId) {
      const baseUrl = process.env.SERVER_URL;
      if (!baseUrl) {
        throw new Error('SERVER_URL environment variable is not configured');
      }
      createParams.statusCallback = `${baseUrl}/api/webhooks/twilio/sms?transactionId=${encodeURIComponent(transactionId)}&organisationId=${encodeURIComponent(organisationId!)}`;
    }

    await client.messages.create(createParams);
  }
}
