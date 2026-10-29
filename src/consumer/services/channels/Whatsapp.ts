import { inject, injectable } from 'tsyringe';
import { ChannelService } from './base/ChannelService';
import { TemplateDetails } from '../../../shared-library/models/Template';
import { Recipient } from '../../../shared-library/types/Dto/Recipient';
import { ServerLogger } from '../../../server/utils/ServerLogger';
import twilio from 'twilio';
import { MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message';
import { OrganisationService } from '../Organisation';
import { ChannelType } from '../../../shared-library/types/Enum/ChannelType';
import { WhatsappSettings } from '../../../shared-library/models/submodels/OrganisationSettings';
import { decryptData } from '../../../server/utils/KeyTools';

@injectable()
export class WhatsappService extends ChannelService {
  private readonly logger = new ServerLogger();
  constructor(@inject(OrganisationService) private organisationService: OrganisationService) {
    super();
  }

  public async send(
    hydratedTemplate: TemplateDetails,
    organisationId: string,
    recipient: Recipient,
    transactionId?: string,
  ): Promise<void> {
    this.logger.traceStart({ recipient, hydratedTemplate, organisationId }, 'Sending Whatsapp message');
    const whatsAppSettings: WhatsappSettings = (await this.organisationService.getProviderSettings(
      organisationId as string,
      ChannelType.WHATSAPP,
    )) as WhatsappSettings;

    if (!whatsAppSettings) {
      throw new Error('Whatsapp settings are not provided!');
    }
    const accountSid = decryptData(whatsAppSettings.auth.accountSid);
    const authToken = decryptData(whatsAppSettings.auth.authToken);
    const senderNumber = whatsAppSettings.whatsappNumber;
    this.logger.debug('Sending Whatsapp message', whatsAppSettings);

    const client = twilio(accountSid, authToken);

    const createParams: MessageListInstanceCreateOptions = {
      body: hydratedTemplate.body as string,
      from: `whatsapp:${senderNumber}`,
      to: `whatsapp:${recipient.phone_number}`,
    };

    if (transactionId) {
      const baseUrl = process.env.SERVER_URL;
      if (!baseUrl) {
        throw new Error('SERVER_URL environment variable is not configured');
      }
      createParams.statusCallback = `${baseUrl}/api/webhooks/twilio/whatsapp?transactionId=${encodeURIComponent(transactionId)}&organisationId=${encodeURIComponent(organisationId)}`;
    }

    const result = await client.messages.create(createParams);
    this.logger.traceEnd({ recipient, hydratedTemplate, organisationId }, 'Whatsapp message Sent', result);
  }
}
