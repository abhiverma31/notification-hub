import {
  GupshupSmsSettings,
  SmsProvider,
  SmsSettings,
  WhatsappProvider,
} from '../../models/submodels/OrganisationSettings';
import { SmsProviders } from '../../../server/types/Enum/SmsProviders';

export class SmsAndWhatsappSettingsDto {
  sms: SmsProvider[];
  whatsapp: WhatsappProvider[];

  constructor(sms: SmsProvider[], whatsapp: WhatsappProvider[]) {
    this.sms = sms;
    this.whatsapp = whatsapp;
  }

  validate() {
    this.sms.forEach((smsProvider) => {
      if (!smsProvider.settings) {
        throw new Error('SMS settings are required');
      }

      if (smsProvider.provider === SmsProviders.GUPSHUP) {
        const settings = smsProvider.settings as unknown as GupshupSmsSettings;
        if (!settings.userid) {
          throw new Error('Invalid userid in Gupshup SMS settings');
        }
        if (!settings.password) {
          throw new Error('Invalid password in Gupshup SMS settings');
        }
        if (!settings.mask) {
          throw new Error('Invalid mask (sender ID) in Gupshup SMS settings');
        }
      } else if (smsProvider.provider === SmsProviders.TWILIO) {
        const settings = smsProvider.settings as SmsSettings;
        if (!settings.smsNumber) {
          throw new Error('Invalid smsNumber in SMS settings');
        }
        if (!settings.auth || !settings.auth.accountSid || !settings.auth.authToken) {
          throw new Error('Invalid Twilio settings in SMS settings');
        }
      }
    });

    this.whatsapp.forEach((whatsappProvider) => {
      if (!whatsappProvider.settings) {
        throw new Error('WhatsApp settings are required');
      }
      if (!whatsappProvider.settings.whatsappNumber || typeof whatsappProvider.settings.whatsappNumber !== 'string') {
        throw new Error('Invalid whatsappNumber in WhatsApp settings');
      }
      if (
        !whatsappProvider.settings.auth ||
        !whatsappProvider.settings.auth.accountSid ||
        !whatsappProvider.settings.auth.authToken
      ) {
        throw new Error('Invalid Twilio settings in WhatsApp settings');
      }
    });
  }
}
