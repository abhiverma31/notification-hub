import { injectable, inject } from 'tsyringe';
import { TemplateDetails } from '../../../shared-library/models/Template';
import { Recipient } from '../../../shared-library/types/Dto/Recipient';
import { ApnsIntegration } from '../integrations/ApnsIntegration';
import { ConsumerLogger } from '../../utils/ConsumerLogger';
import { ChannelService } from './base/ChannelService';
import { decryptData } from '../../../server/utils/KeyTools';
import { OrganisationService } from '../Organisation';
import { ApnsSettings } from '../../../shared-library/models/submodels/OrganisationSettings';
import { PushProviders } from '../../../server/types/Enum/PushProviders';
import UserRepository from '../../../shared-library/repositories/User';

@injectable()
export class ApnsService extends ChannelService {
  private readonly logger = new ConsumerLogger();

  constructor(
    @inject(ApnsIntegration) private apnsIntegration: ApnsIntegration,
    @inject(OrganisationService) private organisationService: OrganisationService,
    @inject(UserRepository) private userRepository: UserRepository,
  ) {
    super();
  }

  public async send(
    hydratedTemplate: TemplateDetails,
    organisationId: string,
    recipient: Recipient,
    _transactionId?: string,
  ) {
    this.logger.traceStart({ recipient, hydratedTemplate, organisationId }, 'Sending APNS Notification');

    const allEnabled = await this.organisationService.getAllEnabledPushProviders(organisationId);
    const apnsProvider = allEnabled.find((p) => p.provider === PushProviders.APNS);

    if (!apnsProvider) {
      throw new Error(`APNS provider not enabled for organisation "${organisationId}"`);
    }

    await this.sendViaApns(hydratedTemplate, organisationId, recipient, apnsProvider.settings as ApnsSettings);

    this.logger.traceEnd({ recipient, hydratedTemplate, organisationId }, 'Sending APNS Notification');
  }

  private async sendViaApns(
    hydratedTemplate: TemplateDetails,
    organisationId: string,
    recipient: Recipient,
    apnsSettings: ApnsSettings,
  ) {
    const fcmTokens = await ChannelService.getFcmTokensByRecipientAndOrg(recipient, organisationId, this.userRepository);

    const decryptedSettings: ApnsSettings = { ...apnsSettings, privateKey: decryptData(apnsSettings.privateKey) };

    const title = typeof hydratedTemplate.title === 'string' ? hydratedTemplate.title : String(hydratedTemplate.title);
    const body = typeof hydratedTemplate.body === 'string' ? hydratedTemplate.body : String(hydratedTemplate.body);
    const sound = typeof hydratedTemplate.sound === 'string' ? hydratedTemplate.sound : 'default';
    const url = typeof hydratedTemplate.offerUrl === 'string' ? hydratedTemplate.offerUrl : undefined;
    const icon = typeof hydratedTemplate.icon === 'string' ? hydratedTemplate.icon : undefined;

    const payload = {
      alert: { title, body },
      sound,
      data: { url, icon },
    };

    const result = await this.apnsIntegration.sendPushNotification(decryptedSettings, fcmTokens, payload);

    if (result.failureCount > 0) {
      throw new Error(`Failed to send APNs notification to ${recipient.email}: ${JSON.stringify(result)}`);
    }
  }

}
