import 'reflect-metadata';
import { TemplateDetails } from '../../../shared-library/models/Template';
import { Recipient } from '../../../shared-library/types/Dto/Recipient';
import { ConsumerLogger } from '../../utils/ConsumerLogger';
import { ChannelService } from './base/ChannelService';
import * as nodemailer from 'nodemailer';
import {
  NodemailerSettings,
  SendGridSettings,
  EmailProvider,
} from '../../../shared-library/models/submodels/OrganisationSettings';
import { OrganisationService } from '../Organisation';
import { inject, injectable } from 'tsyringe';
import { ChannelType } from '../../../shared-library/types/Enum/ChannelType';
import { decryptData } from '../../../server/utils/KeyTools';
import { SendGridService } from './SendGrid';
import { EmailProviders } from '../../../server/types/Enum/EmailProviders';
import { OrganisationRepository } from '../../../shared-library/repositories/Organisation';

@injectable()
export class EmailService extends ChannelService {
  private readonly logger = new ConsumerLogger();

  constructor(
    @inject(OrganisationService) private organisationService: OrganisationService,
    @inject(SendGridService) private sendGridService: SendGridService,
    @inject(OrganisationRepository) private organisationRepository: OrganisationRepository,
  ) {
    super();
  }

  public async send(
    hydratedTemplate: TemplateDetails,
    organisationId: string,
    recipient: Recipient,
    transactionId?: string,
  ) {
    this.logger.traceStart({ recipient, hydratedTemplate, organisationId }, 'Sending Email');

    const orgDetails = await this.organisationRepository.findByID(organisationId);

    // Check if new email settings structure exists
    if (orgDetails?.settings?.email && orgDetails.settings.email.length > 0) {
      const enabledProvider = orgDetails.settings.email.find((p) => p.enabled);
      if (!enabledProvider) {
        throw new Error('No email provider is enabled');
      }

      // Route to appropriate service based on provider
      switch (enabledProvider.provider) {
        case EmailProviders.SENDGRID:
          return this.sendGridService.send(hydratedTemplate, organisationId, recipient, transactionId);

        case EmailProviders.NODEMAILER:
        case EmailProviders.GMAIL:
          return this.sendViaNodemailer(hydratedTemplate, recipient, enabledProvider.settings as NodemailerSettings);

        default:
          throw new Error(`Unsupported email provider: ${enabledProvider.provider}`);
      }
    }

    // Fallback to legacy getProviderSettings for backward compatibility
    const emailSettings: NodemailerSettings = (await this.organisationService.getProviderSettings(
      organisationId,
      ChannelType.EMAIL,
    )) as NodemailerSettings;

    if (!emailSettings) {
      throw new Error('Email settings are not provided!');
    }

    return this.sendViaNodemailer(hydratedTemplate, recipient, emailSettings);
  }

  private async sendViaNodemailer(
    hydratedTemplate: TemplateDetails,
    recipient: Recipient,
    emailSettings: NodemailerSettings,
  ): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: emailSettings.host,
      port: emailSettings.port,
      auth: {
        user: decryptData(emailSettings.auth.user),
        pass: decryptData(emailSettings.auth.pass),
      },
    });

    await transporter.sendMail({
      from: emailSettings.fromAddress || decryptData(emailSettings.auth.user),
      to: recipient.email,
      subject: hydratedTemplate.subject,
      html: hydratedTemplate.body,
    });

    this.logger.traceEnd({ recipient, hydratedTemplate }, 'Email sent via Nodemailer');
  }
}
