import { EmailProviders } from '../../../server/types/Enum/EmailProviders';
import { PushProviders } from '../../../server/types/Enum/PushProviders';
import { SlackProviders } from '../../../server/types/Enum/SlackProvider';
import { WhatsappProviders } from '../../../server/types/Enum/WhatsappProviders';
import { SmsProviders } from '../../../server/types/Enum/SmsProviders';
import { TeamsProviders } from '../../../server/types/Enum/TeamProviders';
import { TelegramProviders } from '../../../server/types/Enum/TelegramProviders';

export interface NodemailerSettings {
  auth: NodeMailerAuthSettings;
  service?: string;
  port: number;
  host: string;
  secure?: boolean;
  fromAddress?: string;
}

export interface NodeMailerAuthSettings {
  user: string;
  pass: string;
}

export interface SendGridSettings {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
  webhookId?: string;
}

export interface FirebaseSettings {
  firebaseClientEmail: string;
  privateKey: string;
  projectId: string;
}

export interface ApnsSettings {
  teamId: string;
  keyId: string;
  bundleId: string;
  environment: 'sandbox' | 'production';
  privateKey: string;
}

export interface PusherSettings {
  appId: string;
  key: string;
  secret: string;
  cluster: string;
}

export interface PusherBeamsSettings {
  instanceId: string;
  secretKey: string; // encrypted at rest
}

export interface TwilioSettings {
  accountSid: string;
  authToken: string;
}

export interface SmsSettings {
  smsNumber: string;
  auth: TwilioSettings;
}

export interface GupshupSmsSettings {
  userid: string;
  password: string;
  mask: string;
  principalEntityId?: string;
  dltTemplateId?: string;
}

export interface WhatsappSettings {
  whatsappNumber: string;
  auth: TwilioSettings;
}

/**
 *
 * @example
 * {
 *   "channelType": "email",
 *   "provider": "GMAIL",
 *   "enabled": true,
 *   "settings": {
 *     "auth": {
 *       "user": "john@technogise.com",
 *       "pass": "iokphspryktchphb"
 *     },
 *     "service": "Gmail",
 *     "port": "587",
 *     "host": "smtp.gmail.com",
 *     "secure": true
 *   }
 * }
 */
export interface EmailProvider {
  provider: EmailProviders;
  enabled: boolean;
  settings: NodemailerSettings | SendGridSettings;
}

export interface SmsProvider {
  provider: SmsProviders;
  enabled: boolean;
  settings: SmsSettings | GupshupSmsSettings;
}

export interface WhatsappProvider {
  provider: WhatsappProviders;
  enabled: boolean;
  settings: WhatsappSettings;
}

/**
 *
 * @example
 * {
 *   "channelType": "push",
 *   "provider": "firebase",
 *   "enabled": true,
 *   "settings": {
 *     "firebaseClientEmail": "firebase-adminsdk-cezsj@aarambh-87cdd.iam.gserviceaccount.com",
 *     "privateKey": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBK...\n{include the whole string}",
 *     "projectId": "actual_project_id_given_by_firebase"
 *   }
 * }
 */

export interface PushProvider {
  provider: PushProviders;
  enabled?: boolean;
  settings: FirebaseSettings | ApnsSettings | PusherSettings | PusherBeamsSettings;
}

/**
 *
 * @example
 * {
 *   "channelType": "slack",
 *   "provider": "slack",
 *   "enabled": true,
 *   "settings": {
 *     "oAuthToken": "slack-oauth-token-placeholder",
 *     "slack_channel": "general",
 *     "bot_name": "Technogise Bot",
 *     "icon_url": "https://res.cloudinary.com/dqhzj9nig/image/upload/v1715930922/cld-sample-4.jpg",
 *     "icon_emoji": ":shallow_pan_of_food:",
 *     "always_online": false
 *   }
 * }
 */

export interface SlackSettings {
  webhook?: string;
  oAuthToken?: string;
  slack_channel?: string;
  bot_name?: string;
  icon_emoji?: string;
  icon_url?: string;
  always_online?: boolean;
}
export interface SlackProvider {
  provider: SlackProviders;
  enabled: boolean;
  settings: SlackSettings;
}

export interface TeamsSettings {
  webhook: string;
}

export interface TeamsProvider {
  provider: TeamsProviders;
  enabled: boolean;
  settings: TeamsSettings;
}

export interface TelegramSettings {
  botToken: string;
  chatId?: string;
  webhookSecretToken?: string;
}

export interface TelegramProvider {
  provider: TelegramProviders;
  enabled: boolean;
  settings: TelegramSettings;
}

export interface OrganisationSettingsInterface {
  email: EmailProvider[];
  push: PushProvider[];
  slack: SlackProvider[];
  sms: SmsProvider[];
  whatsapp: WhatsappProvider[];
  teams: TeamsProvider[];
  telegram?: TelegramProvider[];
}
