import 'reflect-metadata';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { inject, injectable } from 'tsyringe';
import { decryptData, encodeToBase64, encryptData, generateApiKeyWithSecret, verify } from '../utils/KeyTools';
import { OrganisationRepository } from '../../shared-library/repositories/Organisation';
import { CreateOrganisationRequest, CreateProviderSettingRequest } from '../types/request/CreateOrganisation';
import { CreateOrganisationResponse } from '../types/response/CreateOrganisation';
import { adaptToOrganisationInterface } from '../../shared-library/models/adapters/CreateOrganisation';
import { OrganisationInterface } from '../../shared-library/models/Organisation';
import { BadRequest, Conflict } from '../utils/errors/BadRequest';
import {
  EmailProvider,
  FirebaseSettings,
  ApnsSettings,
  GupshupSmsSettings,
  NodemailerSettings,
  SendGridSettings,
  OrganisationSettingsInterface,
  PushProvider,
  SlackProvider,
  SlackSettings,
  SmsProvider,
  SmsSettings,
  TeamsProvider,
  TeamsSettings,
  TelegramProvider,
  TelegramSettings,
  WhatsappProvider,
  WhatsappSettings,
} from '../../shared-library/models/submodels/OrganisationSettings';
import { UnauthorizedError } from '../utils/errors/Unauthorized';
import { ServerLogger } from '../utils/ServerLogger';
import { ChannelType } from '../../shared-library/types/Enum/ChannelType';
import { FirebaseService } from './FireBase';
import {
  CreatePushSettingsRequest,
  CreatePusherSettingsRequest,
  CreatePusherBeamsSettingsRequest,
} from '../types/request/PushSettings';
import { MemberInterface } from '../../shared-library/models/Member';
import { MemberRepository } from '../../shared-library/repositories/Member';
import { PushProviders } from '../types/Enum/PushProviders';
import { EMAIL_PROVIDER_HANDLERS } from '../../shared-library/utils/EmailProviderHandlers';
import { SmsProviders } from '../types/Enum/SmsProviders';
import { EmailProviders } from '../types/Enum/EmailProviders';
import { SendGridWebhookRegistrationService, RegistrationResult } from './SendGridWebhookRegistration';

export interface WebhookRegistrationResponse {
  status: 'created' | 'updated' | 'already-configured' | 'failed';
  reason?: string;
}

const FRIENDLY_REASONS: Record<string, string> = {
  'insufficient-permissions': "Your API key doesn't have permission to manage webhooks. Please use a Full Access key.",
  skipped: 'Webhook server is not configured. Please contact support.',
  error: 'Could not reach SendGrid. Please retry or register the webhook manually.',
};

@injectable()
export class OrganisationService {
  private readonly logger = new ServerLogger();

  constructor(
    @inject(OrganisationRepository) private organisationRepository: OrganisationRepository,
    @inject(FirebaseService) private firebaseService: FirebaseService,
    @inject(MemberRepository) private memberRepository: MemberRepository,
    @inject(SendGridWebhookRegistrationService) private sendGridWebhookRegistration: SendGridWebhookRegistrationService,
  ) {}

  public async getOrganisationDetailsById(organisation: OrganisationInterface) {
    if (organisation && organisation._id) {
      const id = organisation._id;
      const orgDetails = await this.organisationRepository.findByID(id);
      if (orgDetails) {
        return orgDetails;
      }
    }

    return null;
  }

  private async decryptProviderCredentials(settings: OrganisationSettingsInterface, providerType: 'sms' | 'whatsapp') {
    const providers = settings[providerType];
    if (providers) {
      providers.forEach((provider: SmsProvider | WhatsappProvider) => {
        if (provider.settings) {
          if ('provider' in provider && provider.provider === SmsProviders.GUPSHUP) {
            const gupshupSettings = provider.settings as unknown as GupshupSmsSettings;
            gupshupSettings.password = decryptData(gupshupSettings.password);
          } else {
            const twilioSettings = provider.settings as SmsSettings | WhatsappSettings;
            const decryptedAuthToken = decryptData(twilioSettings.auth.authToken);
            const decryptedAccountSid = decryptData(twilioSettings.auth.accountSid);
            twilioSettings.auth.authToken = decryptedAuthToken;
            twilioSettings.auth.accountSid = decryptedAccountSid;
          }
        }
      });
    }
  }

  public async decryptEmailProviderCredentials(settings: OrganisationSettingsInterface) {
    if (settings.email) {
      settings.email.forEach((emailProvider: EmailProvider) => {
        const handler = EMAIL_PROVIDER_HANDLERS[emailProvider.provider];
        emailProvider.settings = handler.decrypt(emailProvider.settings) as NodemailerSettings | SendGridSettings;
      });
    }

    return settings;
  }

  public async decryptPushProviderCredentials(settings: OrganisationSettingsInterface) {
    if (settings.push) {
      settings.push.forEach((pushProvider: PushProvider) => {
        if (pushProvider.provider === PushProviders.FIREBASE) {
          const firebaseSettings = pushProvider.settings as FirebaseSettings;
          firebaseSettings.privateKey = decryptData(firebaseSettings.privateKey);
        }
      });
    }

    return settings;
  }

  public async getOrganisationById(id: string) {
    return this.organisationRepository.findByID(id);
  }

  public async getOrganisationByApiKey(apiKey: string): Promise<OrganisationInterface | null> {
    this.logger.info('Get Org By API Key');

    return this.organisationRepository.findByAPIKey(apiKey);
  }

  public async createOrganisation(
    createOrganisation: CreateOrganisationRequest,
    member?: MemberInterface,
  ): Promise<CreateOrganisationResponse | undefined> {
    const orgExists = (await this.organisationRepository.findByName(createOrganisation.name)) !== null;

    if (orgExists) {
      throw new Conflict('Organisation already exist');
    }

    const apiKey = generateApiKeyWithSecret();
    const baseEncodedOrgKey = encodeToBase64(`${apiKey.key},${apiKey.secret}`);
    const dbModel = adaptToOrganisationInterface(createOrganisation, apiKey, baseEncodedOrgKey);

    const createdOrganisation = await this.organisationRepository.create(dbModel);
    if (member) {
      const result = await this.memberRepository.updateOrganisationIdByEmail(createdOrganisation._id!, member!.email!);
      if (result.matchedCount > 0) {
        this.logger.info('Organisation Id is updated inside member collection');
      }
    }

    return {
      id: createdOrganisation._id!,
      org_key: baseEncodedOrgKey,
      org_lp_key: apiKey.key,
    };
  }

  public async regenerateKeys(orgRequest: CreateOrganisationRequest): Promise<CreateOrganisationResponse | undefined> {
    const organisation = await this.organisationRepository.findByName(orgRequest.name);

    if (organisation === null) {
      throw new BadRequest('Organisation doesnt exist');
    }

    const apiKey = generateApiKeyWithSecret();
    organisation.api_key = apiKey.key;
    organisation.api_secret_hash = apiKey.secret_hash;

    await this.organisationRepository.update(organisation);
    const baseEncodedString = encodeToBase64(`${apiKey.key},${apiKey.secret}`);

    return {
      id: organisation!._id!,
      org_key: baseEncodedString,
      org_lp_key: apiKey.key,
    };
  }

  public async verifySecretAndGetOrganisation(apiKey: string, apiSecret: string) {
    const org = await this.organisationRepository.findByAPIKey(apiKey);

    if (!org || !verify(apiSecret, org!.api_secret_hash)) {
      throw new UnauthorizedError();
    }

    return org;
  }

  public async updateSmsProviderSettings(id: string, updateRequest: SmsProvider[]): Promise<void> {
    const enabledProviders = updateRequest.filter((provider) => provider.enabled);
    if (enabledProviders.length > 1) {
      throw new BadRequest('Only 1 Provider can be active');
    }

    const organisation: OrganisationInterface | null = await this.getOrganisationById(id);
    if (organisation == null) {
      throw new BadRequest('Invalid Organisation');
    }

    const smsProviders = updateRequest.map((provider) => {
      if (provider.settings) {
        if (provider.provider === SmsProviders.GUPSHUP) {
          const gupshupSettings = provider.settings as unknown as GupshupSmsSettings;
          gupshupSettings.password = encryptData(gupshupSettings.password);
          provider.settings = gupshupSettings as unknown as SmsSettings;
        } else {
          const twilioSettings = provider.settings as SmsSettings;
          twilioSettings.auth.authToken = encryptData(twilioSettings.auth.authToken);
          twilioSettings.auth.accountSid = encryptData(twilioSettings.auth.accountSid);
        }
      }

      return provider;
    });

    if (organisation.settings == null) {
      organisation.settings = {
        email: [],
        push: [],
        slack: [],
        sms: smsProviders,
        whatsapp: [],
        teams: [],
        telegram: [],
      };
    } else {
      organisation.settings.sms = smsProviders;
    }

    await this.organisationRepository.update(organisation);
  }

  public async updateWhatsappProviderSettings(id: string, updateRequest: WhatsappProvider[]): Promise<void> {
    const enabledProviders = updateRequest.filter((provider) => provider.enabled);
    if (enabledProviders.length > 1) {
      throw new BadRequest('Only 1 Provider can be active');
    }

    const organisation: OrganisationInterface | null = await this.getOrganisationById(id);
    if (organisation == null) {
      throw new BadRequest('Invalid Organisation');
    }

    const whatsappProviders = updateRequest.map((provider) => {
      if (provider.settings) {
        provider.settings.auth.authToken = encryptData(provider.settings.auth.authToken);
        provider.settings.auth.accountSid = encryptData(provider.settings.auth.accountSid);
      }

      return provider;
    });

    if (organisation.settings == null) {
      organisation.settings = {
        email: [],
        push: [],
        slack: [],
        sms: [],
        whatsapp: whatsappProviders,
        teams: [],
        telegram: [],
      };
    } else {
      organisation.settings.whatsapp = whatsappProviders;
    }

    await this.organisationRepository.update(organisation);
  }

  public async getSettings(id: string): Promise<OrganisationSettingsInterface> {
    const organisation = await this.getOrganisationById(id);

    if (organisation == null) {
      throw new BadRequest('Invalid Organisation');
    }

    if (organisation.settings && organisation.settings.email) {
      await this.decryptEmailProviderCredentials(organisation.settings);
    }

    if (organisation.settings && organisation.settings.push) {
      await this.decryptPushProviderCredentials(organisation.settings);
    }
    if (organisation.settings && organisation.settings.sms) {
      await this.decryptProviderCredentials(organisation.settings, 'sms');
    }
    if (organisation.settings && organisation.settings.whatsapp) {
      await this.decryptProviderCredentials(organisation.settings, 'whatsapp');
    }

    return organisation.settings ?? { email: [], push: [], slack: [], sms: [], whatsapp: [], teams: [], telegram: [] };
  }

  public async updateEmailSettings(
    id: string,
    updateRequest: EmailProvider[],
  ): Promise<WebhookRegistrationResponse | undefined> {
    const enabledProviders = updateRequest.filter((provider) => provider.enabled);
    if (enabledProviders.length > 1) {
      throw new BadRequest('Only 1 Provider can be active');
    }

    const organisation: OrganisationInterface | null = await this.getOrganisationById(id);

    if (organisation == null) {
      throw new BadRequest('Invalid Organisation');
    }

    const previousSendGrid = this.findPreviousSendGridWithWebhook(organisation);

    const enabledSendGrid = updateRequest.find((p) => p.provider === EmailProviders.SENDGRID && p.enabled);
    const sendGridApiKey = enabledSendGrid ? (enabledSendGrid.settings as SendGridSettings).apiKey : undefined;

    const encryptedProviders = updateRequest.map((provider) => {
      const handler = EMAIL_PROVIDER_HANDLERS[provider.provider];

      return {
        ...provider,
        settings: handler.encrypt(provider.settings) as NodemailerSettings | SendGridSettings,
      };
    });

    if (organisation.settings == null) {
      organisation.settings = {
        email: encryptedProviders,
        push: [],
        slack: [],
        sms: [],
        whatsapp: [],
        teams: [],
        telegram: [],
      };
    } else {
      organisation.settings.email = encryptedProviders;
    }

    await this.organisationRepository.update(organisation);

    if (sendGridApiKey) {
      return await this.registerSendGridWebhook(sendGridApiKey, organisation);
    } else if (previousSendGrid) {
      this.cleanupSendGridWebhook(previousSendGrid, updateRequest);
    }

    return undefined;
  }

  private async registerSendGridWebhook(
    apiKey: string,
    organisation: OrganisationInterface,
  ): Promise<WebhookRegistrationResponse> {
    try {
      const result = await this.sendGridWebhookRegistration.register(apiKey);
      if ('webhookId' in result) {
        await this.persistWebhookId(organisation, result.webhookId);

        return { status: result.status as 'created' | 'updated' | 'already-configured' };
      }
      const reason = FRIENDLY_REASONS[result.status] || ('reason' in result ? result.reason : 'Unknown error');

      return { status: 'failed', reason };
    } catch (err) {
      this.logger.error('SendGrid webhook registration failed', err);

      return { status: 'failed', reason: FRIENDLY_REASONS['error'] };
    }
  }

  private async persistWebhookId(organisation: OrganisationInterface, webhookId: string): Promise<void> {
    const sendGridProvider = organisation.settings?.email?.find((p) => p.provider === EmailProviders.SENDGRID);
    if (!sendGridProvider) return;

    try {
      (sendGridProvider.settings as SendGridSettings).webhookId = webhookId;
      await this.organisationRepository.update(organisation);
    } catch (err) {
      this.logger.error('Failed to persist SendGrid webhookId', {
        webhookId,
        organisationId: organisation._id,
        error: err,
      });
    }
  }

  private cleanupSendGridWebhook(
    previous: { apiKey: string; webhookId: string },
    updateRequest: EmailProvider[],
  ): void {
    const sendGridStillPresent = updateRequest.find((p) => p.provider === EmailProviders.SENDGRID);

    if (sendGridStillPresent) {
      this.sendGridWebhookRegistration.disable(previous.apiKey, previous.webhookId).catch((err) => {
        this.logger.error('Failed to disable SendGrid webhook', err);
      });
    } else {
      this.sendGridWebhookRegistration.deleteWebhook(previous.apiKey, previous.webhookId).catch((err) => {
        this.logger.error('Failed to delete SendGrid webhook', err);
      });
    }
  }

  public async retryWebhookRegistration(id: string): Promise<WebhookRegistrationResponse> {
    const organisation = await this.getOrganisationById(id);
    if (!organisation) {
      throw new BadRequest('Invalid Organisation');
    }

    const sendGridProvider = organisation.settings?.email?.find(
      (p) => p.provider === EmailProviders.SENDGRID && p.enabled,
    );
    if (!sendGridProvider) {
      throw new BadRequest('SendGrid integration is not enabled');
    }

    const apiKey = decryptData((sendGridProvider.settings as SendGridSettings).apiKey);

    return await this.registerSendGridWebhook(apiKey, organisation);
  }

  private findPreviousSendGridWithWebhook(
    organisation: OrganisationInterface,
  ): { apiKey: string; webhookId: string } | undefined {
    const previous = organisation.settings?.email?.find(
      (p) => p.provider === EmailProviders.SENDGRID && (p.settings as SendGridSettings).webhookId,
    );
    if (!previous) return undefined;

    const settings = previous.settings as SendGridSettings;

    return { apiKey: decryptData(settings.apiKey), webhookId: settings.webhookId! };
  }

  public async updatePushSettings(id: string, updateRequest: PushProvider[]): Promise<void> {
    const enabledProviders = updateRequest.filter((provider) => provider.enabled);
    if (enabledProviders.length > 1) {
      throw new BadRequest('Only 1 Provider can be active');
    }

    const organisation: OrganisationInterface | null = await this.getOrganisationById(id);
    if (organisation == null) {
      throw new BadRequest('Invalid Organisation');
    }

    // Validate and encrypt Firebase settings
    const firebasePushSettings = updateRequest.find((provider) => provider.provider === PushProviders.FIREBASE);
    if (firebasePushSettings) {
      const firebaseSettings = firebasePushSettings.settings as FirebaseSettings;
      if (await this.firebaseService.verifySettings(firebaseSettings)) {
        firebaseSettings.privateKey = encryptData(firebaseSettings.privateKey);
        firebasePushSettings.settings = firebaseSettings;
      } else {
        throw new BadRequest('Firebase credentials are not valid, please verify again');
      }
    }

    // Validate and encrypt APNs settings
    const apnsPushSettings = updateRequest.find((provider) => provider.provider === PushProviders.APNS);
    if (apnsPushSettings) {
      const apnsSettings = apnsPushSettings.settings as ApnsSettings;

      // Validate required fields
      if (!apnsSettings.teamId || !apnsSettings.keyId || !apnsSettings.bundleId || !apnsSettings.privateKey) {
        throw new BadRequest('APNs credentials are incomplete. Required: teamId, keyId, bundleId, privateKey');
      }

      // Validate environment
      if (apnsSettings.environment !== 'sandbox' && apnsSettings.environment !== 'production') {
        throw new BadRequest('APNs environment must be either "sandbox" or "production"');
      }

      // Encrypt private key
      apnsSettings.privateKey = encryptData(apnsSettings.privateKey);
      apnsPushSettings.settings = apnsSettings;
    }

    if (organisation.settings == null) {
      organisation.settings = {
        email: [],
        push: updateRequest,
        slack: [],
        sms: [],
        whatsapp: [],
        teams: [],
        telegram: [],
      };
    } else {
      organisation.settings.push = updateRequest;
    }

    this.logger.trace('Organisation Service -> updatePushSettings');
    this.logger.trace(organisation.settings);
    this.logger.trace(organisation);

    await this.organisationRepository.update(organisation);
  }

  public async updateSlackSettings(id: string, updateRequest: SlackProvider[]): Promise<void> {
    const enabledProviders = updateRequest.filter((provider) => provider.enabled);
    if (enabledProviders.length > 1) {
      throw new BadRequest('Only 1 Provider can be active');
    }

    const organisation: OrganisationInterface | null = await this.getOrganisationById(id);

    if (organisation == null) {
      throw new BadRequest('Invalid Organisation');
    }

    if (organisation.settings == null) {
      organisation.settings = {
        email: [],
        push: [],
        slack: updateRequest,
        sms: [],
        whatsapp: [],
        teams: [],
        telegram: [],
      };
    } else {
      organisation.settings.slack = updateRequest;
    }

    this.logger.trace('Organisation Service -> updateSlackSettings');
    this.logger.trace(organisation.settings);
    this.logger.trace(organisation);

    await this.organisationRepository.update(organisation);
  }

  public async updateTeamsSettings(id: string, updateRequest: TeamsProvider[]): Promise<void> {
    const enabledProviders = updateRequest.filter((provider) => provider.enabled);
    if (enabledProviders.length > 1) {
      throw new BadRequest('Only 1 Provider can be active');
    }

    const organisation: OrganisationInterface | null = await this.getOrganisationById(id);

    if (organisation == null) {
      throw new BadRequest('Invalid Organisation');
    }

    if (organisation.settings == null) {
      organisation.settings = {
        email: [],
        push: [],
        slack: [],
        sms: [],
        whatsapp: [],
        teams: updateRequest,
        telegram: [],
      };
    } else {
      organisation.settings.teams = updateRequest;
    }

    this.logger.trace('Organisation Service -> updateTeamsSettings');
    this.logger.trace(organisation.settings);
    this.logger.trace(organisation);

    await this.organisationRepository.update(organisation);
  }

  public async updateTelegramSettings(id: string, updateRequest: TelegramProvider[]): Promise<void> {
    const enabledProviders = updateRequest.filter((provider) => provider.enabled);
    if (enabledProviders.length > 1) {
      throw new BadRequest('Only 1 Provider can be active');
    }

    const organisation: OrganisationInterface | null = await this.getOrganisationById(id);

    if (organisation == null) {
      throw new BadRequest('Invalid Organisation');
    }

    if (organisation.settings == null) {
      organisation.settings = {
        email: [],
        push: [],
        slack: [],
        sms: [],
        whatsapp: [],
        teams: [],
        telegram: updateRequest,
      };
    } else {
      organisation.settings.telegram = updateRequest;
    }

    this.logger.trace('Organisation Service -> updateTelegramSettings');
    this.logger.trace(organisation.settings);
    this.logger.trace(organisation);
    await this.organisationRepository.update(organisation);
  }

  public async createProviderSetting(orgId: string, providerSetting: CreateProviderSettingRequest): Promise<void> {
    try {
      const organisation: OrganisationInterface | null = await this.getOrganisationById(orgId);
      if (!organisation) {
        throw new BadRequest('Invalid Organisation');
      }
      if (!organisation.settings) {
        organisation.settings = { email: [], push: [], slack: [], sms: [], whatsapp: [], teams: [], telegram: [] };
      }
      switch (providerSetting.channelType) {
        case ChannelType.PUSH:
          {
            if (providerSetting.provider === PushProviders.PUSHER) {
              const pusherSettings = providerSetting.settings as CreatePusherSettingsRequest;
              if (!pusherSettings.appId || !pusherSettings.key || !pusherSettings.secret || !pusherSettings.cluster) {
                throw new BadRequest(
                  'Pusher credentials are incomplete. Please provide appId, key, secret and cluster',
                );
              }
              pusherSettings.secret = encryptData(pusherSettings.secret);
              providerSetting.settings = pusherSettings;
            } else if (providerSetting.provider === PushProviders.PUSHER_BEAMS) {
              const beamsSettings = providerSetting.settings as CreatePusherBeamsSettingsRequest;
              if (!beamsSettings.instanceId || !beamsSettings.secretKey) {
                throw new BadRequest(
                  'Pusher Beams credentials are incomplete. Please provide instanceId and secretKey',
                );
              }
              beamsSettings.secretKey = encryptData(beamsSettings.secretKey);
              providerSetting.settings = beamsSettings;
            } else {
              const pushSettings = providerSetting.settings as CreatePushSettingsRequest;
              if (await this.firebaseService.verifySettings(pushSettings)) {
                pushSettings.privateKey = encryptData(pushSettings.privateKey);
                providerSetting.settings = pushSettings;
              } else {
                throw new BadRequest('Firebase credentials are not valid, please verify again');
              }
            }
            const existingProviderIndex = organisation.settings.push.findIndex(
              (provider) => provider.provider === providerSetting.provider,
            );
            if (existingProviderIndex >= 0) {
              organisation.settings.push[existingProviderIndex] = providerSetting as PushProvider;
            } else {
              organisation.settings.push.push(providerSetting as PushProvider);
            }
          }
          break;
        case ChannelType.EMAIL:
          {
            const emailSettings = providerSetting.settings as NodemailerSettings;
            emailSettings.auth.user = encryptData(emailSettings.auth.user);
            emailSettings.auth.pass = encryptData(emailSettings.auth.pass);
            providerSetting.settings = emailSettings;
            const existingProviderIndex = organisation.settings.email.findIndex(
              (provider) => provider.provider === providerSetting.provider,
            );
            if (existingProviderIndex >= 0) {
              organisation.settings.email[existingProviderIndex] = providerSetting as EmailProvider;
            } else {
              organisation.settings.email.push(providerSetting as EmailProvider);
            }
          }
          break;
        case ChannelType.SLACK:
          {
            const slackSettings = providerSetting.settings as SlackSettings;

            if (!slackSettings.webhook && !slackSettings.oAuthToken) {
              throw new BadRequest('Slack token or webhook url are not provided!. Please provide one of them');
            }

            if (slackSettings.webhook && slackSettings.oAuthToken) {
              throw new BadRequest('Please provide any one , either webhook url or token, but not both');
            }

            if (slackSettings.oAuthToken && !slackSettings.slack_channel) {
              throw new BadRequest('Slack channel is mandatory for oAuthToken!. Please provide slack channel name.');
            }

            providerSetting.settings = slackSettings;

            const existingProviderIndex = organisation.settings.slack.findIndex(
              (provider) => provider.provider === providerSetting.provider,
            );

            if (existingProviderIndex >= 0) {
              organisation.settings.slack[existingProviderIndex] = providerSetting as SlackProvider;
            } else {
              organisation.settings.slack.push(providerSetting as SlackProvider);
            }
          }
          break;
        case ChannelType.TEAMS:
          {
            const teamsSettings = providerSetting.settings as TeamsSettings;
            if (!teamsSettings.webhook) {
              throw new BadRequest('Teams webhook url is not provided!. Please provide it');
            }
            providerSetting.settings = teamsSettings;
            if (organisation && organisation.settings && organisation.settings.teams) {
              const existingProviderIndex = organisation.settings.teams.findIndex(
                (provider) => provider.provider === providerSetting.provider,
              );
              if (existingProviderIndex >= 0) {
                organisation.settings.teams[existingProviderIndex] = providerSetting as TeamsProvider;
              } else {
                organisation.settings.teams.push(providerSetting as TeamsProvider);
              }
            }
          }
          break;
        case ChannelType.TELEGRAM:
          {
            const telegramSettings = providerSetting.settings as TelegramSettings;
            if (!telegramSettings.botToken) {
              throw new BadRequest('Telegram botToken is not provided!. Please provide it');
            }
            if (providerSetting.enabled && !/^\d+:[A-Za-z0-9_-]+$/.test(telegramSettings.botToken)) {
              throw new BadRequest('Invalid Telegram bot token format');
            }
            const plainBotToken = telegramSettings.botToken;
            telegramSettings.botToken = encryptData(telegramSettings.botToken);
            providerSetting.settings = telegramSettings;
            if (!organisation.settings.telegram) {
              organisation.settings.telegram = [];
            }
            const existingProviderIndex = organisation.settings.telegram.findIndex(
              (provider) => provider.provider === providerSetting.provider,
            );
            if (existingProviderIndex >= 0) {
              organisation.settings.telegram[existingProviderIndex] = providerSetting as TelegramProvider;
            } else {
              organisation.settings.telegram.push(providerSetting as TelegramProvider);
            }
            // Auto-register/deregister webhook with Telegram using SERVER_URL from env
            const baseUrl = process.env.SERVER_URL;
            if (baseUrl) {
              try {
                if (providerSetting.enabled) {
                  const webhookUrl = `${baseUrl}/api/telegram/${organisation._id}/webhook`;
                  const secretToken = randomUUID().replace(/-/g, '');
                  await axios.post(`https://api.telegram.org/bot${plainBotToken}/setWebhook`, {
                    url: webhookUrl,
                    secret_token: secretToken,
                  });
                  // Store secret token for webhook validation
                  const providerIndex = organisation.settings.telegram!.findIndex(
                    (p) => p.provider === providerSetting.provider,
                  );
                  if (providerIndex >= 0) {
                    organisation.settings.telegram![providerIndex].settings.webhookSecretToken = secretToken;
                  }
                } else {
                  await axios.post(`https://api.telegram.org/bot${plainBotToken}/deleteWebhook`);
                }
              } catch (err) {
                this.logger.error('Failed to update Telegram webhook registration', err);
              }
            }
          }
          break;
        case ChannelType.SMS:
          {
            if (providerSetting.provider === SmsProviders.GUPSHUP) {
              const gupshupSettings = providerSetting.settings as unknown as GupshupSmsSettings;
              gupshupSettings.password = encryptData(gupshupSettings.password);
              providerSetting.settings = gupshupSettings as unknown as SmsSettings;
            } else {
              const smsSettings = providerSetting.settings as SmsSettings;
              smsSettings.auth.authToken = encryptData(smsSettings.auth.authToken);
              smsSettings.auth.accountSid = encryptData(smsSettings.auth.accountSid);
              providerSetting.settings = smsSettings;
            }
            const existingProviderIndex = organisation.settings.sms.findIndex(
              (provider) => provider.provider === providerSetting.provider,
            );
            if (existingProviderIndex >= 0) {
              organisation.settings.sms[existingProviderIndex] = providerSetting as SmsProvider;
            } else {
              organisation.settings.sms.push(providerSetting as SmsProvider);
            }
          }
          break;
        case ChannelType.WHATSAPP:
          {
            const whatsappSettings = providerSetting.settings as WhatsappSettings;
            whatsappSettings.auth.authToken = encryptData(whatsappSettings.auth.authToken);
            whatsappSettings.auth.accountSid = encryptData(whatsappSettings.auth.accountSid);
            providerSetting.settings = whatsappSettings;
            const existingProviderIndex = organisation.settings.whatsapp.findIndex(
              (provider) => provider.provider === providerSetting.provider,
            );
            if (existingProviderIndex >= 0) {
              organisation.settings.whatsapp[existingProviderIndex] = providerSetting as WhatsappProvider;
            } else {
              organisation.settings.whatsapp.push(providerSetting as WhatsappProvider);
            }
          }
          break;

        default:
          throw new BadRequest('Invalid channel type provided');
      }
      await this.organisationRepository.update(organisation);
      this.logger.trace('Saved provider settings for the request', JSON.stringify(providerSetting));
    } catch (err) {
      this.logger.error(
        `Got error while saving Provider settings for request ${JSON.stringify(providerSetting)} | ${err}`,
      );
      throw err;
    }
  }
}
