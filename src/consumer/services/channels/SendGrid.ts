import 'reflect-metadata';
import { TemplateDetails } from '../../../shared-library/models/Template';
import { Recipient } from '../../../shared-library/types/Dto/Recipient';
import { ConsumerLogger } from '../../utils/ConsumerLogger';
import { ChannelService } from './base/ChannelService';
import sgMail from '@sendgrid/mail';
import { SendGridSettings } from '../../../shared-library/models/submodels/OrganisationSettings';
import { OrganisationService } from '../Organisation';
import { inject, injectable } from 'tsyringe';
import { ChannelType } from '../../../shared-library/types/Enum/ChannelType';
import { decryptData } from '../../../server/utils/KeyTools';

interface SendGridMessage {
  to: string;
  from: {
    email: string;
    name: string;
  };
  subject: string;
  html: string;
  customArgs?: { transactionId: string };
}

@injectable()
export class SendGridService extends ChannelService {
  private readonly logger = new ConsumerLogger();
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1000;

  constructor(@inject(OrganisationService) private organisationService: OrganisationService) {
    super();
  }

  public async send(
    hydratedTemplate: TemplateDetails,
    organisationId: string,
    recipient: Recipient,
    transactionId?: string,
  ): Promise<void> {
    this.logger.traceStart({ recipient, hydratedTemplate, organisationId }, 'Sending Email via SendGrid');

    const sendGridSettings = (await this.organisationService.getProviderSettings(
      organisationId,
      ChannelType.EMAIL,
    )) as SendGridSettings;

    if (!sendGridSettings?.apiKey) {
      throw new Error('SendGrid API key is not configured');
    }

    const apiKey = decryptData(sendGridSettings.apiKey);
    sgMail.setApiKey(apiKey);

    const msg = {
      to: recipient.email,
      from: {
        email: sendGridSettings.fromEmail,
        name: sendGridSettings.fromName || sendGridSettings.fromEmail,
      },
      subject: hydratedTemplate.subject,
      html: hydratedTemplate.body,
      customArgs: { transactionId: transactionId || '' },
    };

    await this.sendWithRetry(msg);

    this.logger.traceEnd({ recipient, hydratedTemplate, organisationId }, 'Email sent via SendGrid');
  }

  private async sendWithRetry(msg: SendGridMessage, attempt = 1): Promise<void> {
    try {
      await sgMail.send(msg);
    } catch (error: unknown) {
      const err = error as { message: string; code?: number; response?: { body?: unknown } };
      this.logger.error('SendGrid send failed', {
        attempt,
        error: err.message,
        statusCode: err.code,
        response: err.response?.body,
      });

      if (attempt >= this.MAX_RETRIES) {
        const errorDetails = (err.response?.body as { errors?: unknown[] })?.errors?.[0] || err.message;
        throw new Error(`SendGrid send failed after ${this.MAX_RETRIES} attempts: ${JSON.stringify(errorDetails)}`);
      }

      const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.sendWithRetry(msg, attempt + 1);
    }
  }
}
