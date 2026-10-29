import { encryptData, decryptData } from '../../server/utils/KeyTools';
import { NodemailerSettings, SendGridSettings } from '../models/submodels/OrganisationSettings';
import { EmailProviders } from '../../server/types/Enum/EmailProviders';

export interface EmailProviderHandler<T = unknown> {
  encrypt(settings: T): T;
  decrypt(settings: T): T;
}

class NodemailerHandler implements EmailProviderHandler<NodemailerSettings> {
  encrypt(settings: NodemailerSettings): NodemailerSettings {
    if (!settings.auth) {
      return settings;
    }

    return {
      ...settings,
      auth: {
        user: encryptData(settings.auth.user),
        pass: encryptData(settings.auth.pass),
      },
    };
  }

  decrypt(settings: NodemailerSettings): NodemailerSettings {
    if (!settings.auth) {
      return settings;
    }

    return {
      ...settings,
      auth: {
        user: decryptData(settings.auth.user),
        pass: decryptData(settings.auth.pass),
      },
    };
  }
}

class SendGridHandler implements EmailProviderHandler<SendGridSettings> {
  encrypt(settings: SendGridSettings): SendGridSettings {
    return {
      ...settings,
      apiKey: encryptData(settings.apiKey),
    };
  }

  decrypt(settings: SendGridSettings): SendGridSettings {
    return {
      ...settings,
      apiKey: decryptData(settings.apiKey),
    };
  }
}

export const EMAIL_PROVIDER_HANDLERS: Record<EmailProviders, EmailProviderHandler> = {
  [EmailProviders.NODEMAILER]: new NodemailerHandler(),
  [EmailProviders.GMAIL]: new NodemailerHandler(),
  [EmailProviders.SENDGRID]: new SendGridHandler(),
};
