import { inject, injectable } from 'tsyringe';
import {
  FirebaseSettings,
  ApnsSettings,
  GupshupSmsSettings,
  NodemailerSettings,
  PushProvider,
  PusherSettings,
  PusherBeamsSettings,
  SendGridSettings,
  SlackSettings,
  SmsSettings,
  TelegramSettings,
  WhatsappSettings,
} from '../../shared-library/models/submodels/OrganisationSettings';
import { OrganisationRepository } from '../../shared-library/repositories/Organisation';
import { ChannelType } from '../../shared-library/types/Enum/ChannelType';
import { ConsumerLogger } from '../utils/ConsumerLogger';
import { SmsProviders } from '../../server/types/Enum/SmsProviders';

export interface SmsProviderConfig {
  provider: SmsProviders;
  settings: SmsSettings | GupshupSmsSettings;
}

@injectable()
export class OrganisationService {
  private readonly logger = new ConsumerLogger();

  constructor(@inject(OrganisationRepository) private organisationRepository: OrganisationRepository) {}

  public async getSmsProviderConfig(organisationId: string): Promise<SmsProviderConfig | undefined> {
    const orgDetails = await this.organisationRepository.findByID(organisationId);

    if (!orgDetails?.settings) {
      this.logger.info('No Organisation settings found');

      return;
    }

    const enabledSms = orgDetails.settings.sms.filter((s) => s.enabled);
    if (enabledSms.length === 0) {
      this.logger.info(`No SMS provider enabled for organisation ${organisationId}`);

      return;
    }

    return {
      provider: enabledSms[0].provider,
      settings: enabledSms[0].settings,
    };
  }

  public async getAllEnabledPushProviders(organisationId: string): Promise<PushProvider[]> {
    const orgDetails = await this.organisationRepository.findByID(organisationId);

    return orgDetails?.settings?.push?.filter((p) => p.enabled) ?? [];
  }

  public async getProviderSettings(
    organisationId: string,
    channel: ChannelType,
  ): Promise<
    | FirebaseSettings
    | ApnsSettings
    | PusherSettings
    | PusherBeamsSettings
    | NodemailerSettings
    | SendGridSettings
    | SlackSettings
    | SmsSettings
    | GupshupSmsSettings
    | WhatsappSettings
    | TelegramSettings
    | undefined
  > {
    const orgDetails = await this.organisationRepository.findByID(organisationId);

    if (!orgDetails) {
      this.logger.info('No such organisation.');

      return;
    }

    if (!orgDetails?.settings) {
      this.logger.info('No Organisation settings found');

      return;
    }
    let enabledSettings;
    switch (channel) {
      case ChannelType.PUSH:
        enabledSettings = orgDetails!.settings!.push?.filter((s) => s.enabled) || [];
        break;
      case ChannelType.EMAIL:
        enabledSettings = orgDetails!.settings!.email?.filter((s) => s.enabled) || [];
        break;
      case ChannelType.SLACK:
        enabledSettings = orgDetails!.settings!.slack?.filter((s) => s.enabled) || [];
        break;
      case ChannelType.SMS:
        enabledSettings = orgDetails!.settings!.sms?.filter((s) => s.enabled) || [];
        break;
      case ChannelType.WHATSAPP:
        enabledSettings = orgDetails!.settings!.whatsapp?.filter((s) => s.enabled) || [];
        break;

      case ChannelType.TEAMS:
        enabledSettings = orgDetails!.settings!.teams?.filter((s) => s.enabled) || [];
        break;
      case ChannelType.TELEGRAM:
        enabledSettings = orgDetails!.settings!.telegram?.filter((s) => s.enabled);
        break;
      default:
        this.logger.info(`Requested settings not found`);

        return;
    }

    if (!enabledSettings || enabledSettings.length === 0) {
      this.logger.info(`No Provider settings enabled for this organisation ${organisationId}`);

      return;
      // throw new Error (`No ${channel} Provider settings enabled for this organisation ${organisationId}`);
    }

    return enabledSettings[0].settings;
  }
}
