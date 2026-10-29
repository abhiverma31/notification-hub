import 'reflect-metadata';
import { ApiKey } from '../../../../src/server/types/internal/ApiKey';
import axios from 'axios';
import { OrganisationService } from '../../../../src/server/services/Organisation';
import { OrganisationRepository } from '../../../../src/shared-library/repositories/Organisation';
import {
  CreateOrganisationRequest,
  CreateProviderSettingRequest,
} from '../../../../src/server/types/request/CreateOrganisation';
import { adaptToOrganisationInterface } from '../../../../src/shared-library/models/adapters/CreateOrganisation';
import { encryptData, generateApiKeyWithSecret, verify } from '../../../../src/server/utils/KeyTools';
import { UnauthorizedError } from '../../../../src/server/utils/errors/Unauthorized';
import { EmailProviders } from '../../../../src/server/types/Enum/EmailProviders';
import { BadRequest, Conflict } from '../../../../src/server/utils/errors/BadRequest';
import {
  EmailProvider,
  OrganisationSettingsInterface,
  PushProvider,
  SlackProvider,
  SmsProvider,
  WhatsappProvider,
} from '../../../../src/shared-library/models/submodels/OrganisationSettings';
import { PushProviders } from '../../../../src/server/types/Enum/PushProviders';
import { OrganisationInterface } from '../../../../src/shared-library/models/Organisation';
import { getError, NoErrorThrownError } from '../../../common/errors/NoErrorThrown';
import { FirebaseService } from '../../../../src/server/services/FireBase';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { SlackProviders } from '../../../../src/server/types/Enum/SlackProvider';
import { SmsProviders } from '../../../../src/server/types/Enum/SmsProviders';
import { WhatsappProviders } from '../../../../src/server/types/Enum/WhatsappProviders';
import { MemberRepository } from '../../../../src/shared-library/repositories/Member';
import { SendGridWebhookRegistrationService } from '../../../../src/server/services/SendGridWebhookRegistration';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../../../../src/shared-library/models/adapters/CreateOrganisation', () => ({
  adaptToOrganisationInterface: jest.fn(),
}));

jest.mock('../../../../src/server/utils/KeyTools', () => ({
  generateApiKeyWithSecret: jest.fn().mockReturnValue({
    key: 'mocked-api-key',
    secret: 'mocked-secret',
    secret_hash: 'mocked-secret-hash',
  } as ApiKey),
  verify: jest.fn(),
  encodeToBase64: jest.fn().mockReturnValue('Base64EncodedString'),
  encryptData: jest.fn().mockReturnValue('testPrivateKey1'),
  decryptData: jest.fn((data) => {
    if (data === 'encryptedUser') return 'decryptedUser';
    if (data === 'encryptedPass') return 'decryptedPass';
    if (data === 'encryptedPrivateKey') return 'decryptedPrivateKey';

    return data;
  }),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn().mockResolvedValue({ data: { ok: true } }) },
}));

describe('OrganisationService', () => {
  let organisationService: OrganisationService;
  const mockOrganisationRepository: jest.Mocked<OrganisationRepository> = {
    create: jest.fn(),
    findByName: jest.fn(),
    findByID: jest.fn(),
    findByAPIKey: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<OrganisationRepository>;

  const mockFirebaseService: jest.Mocked<FirebaseService> = {
    verifySettings: jest.fn(),
  } as unknown as jest.Mocked<FirebaseService>;

  const mockMemberService: jest.Mocked<MemberRepository> = {
    updateOrganisationIdByEmail: jest.fn(),
  } as unknown as jest.Mocked<MemberRepository>;

  const mockSendGridWebhookRegistration: jest.Mocked<SendGridWebhookRegistrationService> = {
    register: jest.fn().mockResolvedValue({ status: 'skipped', reason: 'SERVER_URL not configured' }),
    disable: jest.fn().mockResolvedValue(undefined),
    deleteWebhook: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<SendGridWebhookRegistrationService>;

  const mockExistingOrganisation: OrganisationInterface = {
    _id: '1234',
    name: 'Test Organisation',
    api_key: 'mocked-api-key',
    api_secret_hash: 'mocked-secret-hash',
    settings: {
      email: [
        {
          enabled: true,
          provider: EmailProviders.NODEMAILER,
          settings: {
            user: 'user',
            password: 'pwd',
          },
        },
      ],
      push: [],
    },
  };

  beforeEach(() => {
    organisationService = new OrganisationService(mockOrganisationRepository, mockFirebaseService, mockMemberService, mockSendGridWebhookRegistration);
  });

  describe('updateTeamsSettings', () => {
    it('should throw when more than one Teams provider is enabled', async () => {
      const updateRequest = [
        {
          provider: 'TEAMS',
          enabled: true,
          settings: { webhook: 'https://webhook1' },
        },
        {
          provider: 'TEAMS',
          enabled: true,
          settings: { webhook: 'https://webhook2' },
        },
      ];
      await expect(organisationService.updateTeamsSettings('1234', updateRequest)).rejects.toThrow(
        'Only 1 Provider can be active',
      );
    });

    it('should throw when organisation is invalid', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue(null);
      const updateRequest = [
        {
          provider: 'TEAMS',
          enabled: true,
          settings: { webhook: 'https://webhook1' },
        },
      ];
      await expect(organisationService.updateTeamsSettings('1234', updateRequest)).rejects.toThrow(
        'Invalid Organisation',
      );
    });

    it('should update teams settings when organisation is valid and only one provider is enabled', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation });
      const updateRequest = [
        {
          provider: 'TEAMS',
          enabled: true,
          settings: { webhook: 'https://webhook1' },
        },
      ];
      await organisationService.updateTeamsSettings('1234', updateRequest);
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });

    it('should update teams settings when organisation.settings is null', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: undefined });
      const updateRequest = [
        {
          provider: 'TEAMS',
          enabled: true,
          settings: { webhook: 'https://webhook1' },
        },
      ];
      await organisationService.updateTeamsSettings('1234', updateRequest);
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });
  });

  describe('updateTelegramSettings', () => {
    it('should throw when more than one Telegram provider is enabled', async () => {
      const updateRequest = [
        { provider: 'telegram', enabled: true, settings: { botToken: '123456:ABCdef-xyz' } },
        { provider: 'telegram', enabled: true, settings: { botToken: '789012:XYZabc-def' } },
      ];
      await expect(organisationService.updateTelegramSettings('1234', updateRequest as any)).rejects.toThrow(
        'Only 1 Provider can be active',
      );
    });

    it('should throw when organisation is invalid', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue(null);
      const updateRequest = [{ provider: 'telegram', enabled: true, settings: { botToken: '123456:ABCdef-xyz' } }];
      await expect(organisationService.updateTelegramSettings('1234', updateRequest as any)).rejects.toThrow(
        'Invalid Organisation',
      );
    });

    it('should update telegram settings when organisation is valid', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation });
      const updateRequest = [{ provider: 'telegram', enabled: true, settings: { botToken: '123456:ABCdef-xyz' } }];
      await organisationService.updateTelegramSettings('1234', updateRequest as any);
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });

    it('should update telegram settings when organisation.settings is null', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: undefined });
      const updateRequest = [{ provider: 'telegram', enabled: true, settings: { botToken: '123456:ABCdef-xyz' } }];
      await organisationService.updateTelegramSettings('1234', updateRequest as any);
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });
  });

  // Fix 4: Bot token format validation
  describe('createProviderSetting - Telegram bot token validation', () => {
    it('should throw when bot token has invalid format', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { email: [], push: [], slack: [], sms: [], whatsapp: [], teams: [], telegram: [] } });
      const request = {
        channelType: ChannelType.TELEGRAM,
        provider: 'telegram',
        enabled: true,
        settings: { botToken: 'invalid-token' },
      } as unknown as CreateProviderSettingRequest;

      await expect(organisationService.createProviderSetting('1234', request)).rejects.toThrow(
        'Invalid Telegram bot token format',
      );
    });

    it('should accept valid bot token format', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { email: [], push: [], slack: [], sms: [], whatsapp: [], teams: [], telegram: [] } });
      const request = {
        channelType: ChannelType.TELEGRAM,
        provider: 'telegram',
        enabled: true,
        settings: { botToken: '123456:ABCdef-xyz' },
      } as unknown as CreateProviderSettingRequest;

      await expect(organisationService.createProviderSetting('1234', request)).resolves.not.toThrow();
    });
  });

  describe('createProviderSetting - Teams', () => {
    it('should throw BadRequest if Teams webhook is missing', async () => {
      const orgId = 'org123';
      const createTeamsSettings = {
        channelType: ChannelType.TEAMS,
        provider: 'TEAMS',
        enabled: true,
        settings: {
          webhook: '',
        },
      } as unknown as CreateProviderSettingRequest;
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation });
      await expect(organisationService.createProviderSetting(orgId, createTeamsSettings)).rejects.toThrow(
        'Teams webhook url is not provided!. Please provide it',
      );
    });

    it('should update Teams settings if webhook is present', async () => {
      const orgId = 'org123';
      const createTeamsSettings = {
        channelType: ChannelType.TEAMS,
        provider: 'TEAMS',
        enabled: true,
        settings: {
          webhook: 'https://webhook1',
        },
      } as unknown as CreateProviderSettingRequest;
      mockOrganisationRepository.findByID.mockResolvedValue({
        ...mockExistingOrganisation,
        settings: { ...mockExistingOrganisation.settings, teams: [] } as unknown as OrganisationSettingsInterface,
      });
      mockOrganisationRepository.update.mockResolvedValueOnce({ ...mockExistingOrganisation });
      await organisationService.createProviderSetting(orgId, createTeamsSettings);
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });
  });

  describe('createProviderSetting - Slack', () => {
    it('should throw BadRequest when neither webhook nor oAuthToken is provided', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { ...mockExistingOrganisation.settings, slack: [] } as unknown as OrganisationSettingsInterface });
      const request = { channelType: ChannelType.SLACK, provider: SlackProviders.SLACK, enabled: true, settings: {} } as unknown as CreateProviderSettingRequest;

      await expect(organisationService.createProviderSetting('1234', request)).rejects.toThrow('Slack token or webhook url are not provided!');
    });

    it('should throw BadRequest when both webhook and oAuthToken are provided', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { ...mockExistingOrganisation.settings, slack: [] } as unknown as OrganisationSettingsInterface });
      const request = { channelType: ChannelType.SLACK, provider: SlackProviders.SLACK, enabled: true, settings: { webhook: 'https://hook', oAuthToken: 'token' } } as unknown as CreateProviderSettingRequest;

      await expect(organisationService.createProviderSetting('1234', request)).rejects.toThrow('Please provide any one');
    });

    it('should throw BadRequest when oAuthToken provided without slack_channel', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { ...mockExistingOrganisation.settings, slack: [] } as unknown as OrganisationSettingsInterface });
      const request = { channelType: ChannelType.SLACK, provider: SlackProviders.SLACK, enabled: true, settings: { oAuthToken: 'token' } } as unknown as CreateProviderSettingRequest;

      await expect(organisationService.createProviderSetting('1234', request)).rejects.toThrow('Slack channel is mandatory');
    });

    it('should save Slack settings when webhook is valid', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { ...mockExistingOrganisation.settings, slack: [] } as unknown as OrganisationSettingsInterface });
      mockOrganisationRepository.update.mockResolvedValueOnce({} as unknown as OrganisationInterface);
      const request = { channelType: ChannelType.SLACK, provider: SlackProviders.SLACK, enabled: true, settings: { webhook: 'https://hooks.slack.com/test' } } as unknown as CreateProviderSettingRequest;

      await organisationService.createProviderSetting('1234', request);

      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });
  });

  describe('createProviderSetting - Pusher', () => {
    it('should throw BadRequest when Pusher credentials are incomplete', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { ...mockExistingOrganisation.settings, push: [] } as unknown as OrganisationSettingsInterface });
      const request = { channelType: ChannelType.PUSH, provider: PushProviders.PUSHER, enabled: true, settings: { appId: '123' } } as unknown as CreateProviderSettingRequest;

      await expect(organisationService.createProviderSetting('1234', request)).rejects.toThrow('Pusher credentials are incomplete');
    });

    it('should save Pusher settings when all credentials provided', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { ...mockExistingOrganisation.settings, push: [] } as unknown as OrganisationSettingsInterface });
      mockOrganisationRepository.update.mockResolvedValueOnce({} as unknown as OrganisationInterface);
      const request = { channelType: ChannelType.PUSH, provider: PushProviders.PUSHER, enabled: true, settings: { appId: '1', key: 'k', secret: 's', cluster: 'us2' } } as unknown as CreateProviderSettingRequest;

      await organisationService.createProviderSetting('1234', request);

      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });
  });

  describe('createProviderSetting - Pusher Beams', () => {
    it('should throw BadRequest when instanceId or secretKey is missing', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { ...mockExistingOrganisation.settings, push: [] } as unknown as OrganisationSettingsInterface });
      const request = { channelType: ChannelType.PUSH, provider: PushProviders.PUSHER_BEAMS, enabled: true, settings: { instanceId: 'id' } } as unknown as CreateProviderSettingRequest;

      await expect(organisationService.createProviderSetting('1234', request)).rejects.toThrow('Pusher Beams credentials are incomplete');
    });

    it('should encrypt secretKey and save when credentials are complete', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { ...mockExistingOrganisation.settings, push: [] } as unknown as OrganisationSettingsInterface });
      mockOrganisationRepository.update.mockResolvedValueOnce({} as unknown as OrganisationInterface);
      const request = { channelType: ChannelType.PUSH, provider: PushProviders.PUSHER_BEAMS, enabled: true, settings: { instanceId: 'id-1', secretKey: 'secret-1' } } as unknown as CreateProviderSettingRequest;

      await organisationService.createProviderSetting('1234', request);

      expect(encryptData).toHaveBeenCalledWith('secret-1');
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });
  });

  describe('createProviderSetting - SMS (Gupshup)', () => {
    it('should encrypt Gupshup password and save settings', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { ...mockExistingOrganisation.settings, sms: [] } as unknown as OrganisationSettingsInterface });
      mockOrganisationRepository.update.mockResolvedValueOnce({} as unknown as OrganisationInterface);
      const request = { channelType: ChannelType.SMS, provider: SmsProviders.GUPSHUP, enabled: true, settings: { userId: 'user', password: 'pass' } } as unknown as CreateProviderSettingRequest;

      await organisationService.createProviderSetting('1234', request);

      expect(encryptData).toHaveBeenCalledWith('pass');
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });

    it('should encrypt Twilio SMS credentials and save', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { ...mockExistingOrganisation.settings, sms: [] } as unknown as OrganisationSettingsInterface });
      mockOrganisationRepository.update.mockResolvedValueOnce({} as unknown as OrganisationInterface);
      const request = { channelType: ChannelType.SMS, provider: SmsProviders.TWILIO, enabled: true, settings: { auth: { authToken: 'tok', accountSid: 'sid' }, from: '+1234' } } as unknown as CreateProviderSettingRequest;

      await organisationService.createProviderSetting('1234', request);

      expect(encryptData).toHaveBeenCalledWith('tok');
      expect(encryptData).toHaveBeenCalledWith('sid');
    });
  });

  describe('createProviderSetting - WhatsApp', () => {
    it('should encrypt WhatsApp credentials and save', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { ...mockExistingOrganisation.settings, whatsapp: [] } as unknown as OrganisationSettingsInterface });
      mockOrganisationRepository.update.mockResolvedValueOnce({} as unknown as OrganisationInterface);
      const request = { channelType: ChannelType.WHATSAPP, provider: WhatsappProviders.TWILIO, enabled: true, settings: { auth: { authToken: 'tok', accountSid: 'sid' }, from: 'whatsapp:+1234' } } as unknown as CreateProviderSettingRequest;

      await organisationService.createProviderSetting('1234', request);

      expect(encryptData).toHaveBeenCalledWith('tok');
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });
  });

  describe('createProviderSetting - invalid channel type', () => {
    it('should throw BadRequest for unsupported channel type', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation });
      const request = { channelType: 'INVALID' as ChannelType, provider: 'UNKNOWN', enabled: true, settings: {} } as unknown as CreateProviderSettingRequest;

      await expect(organisationService.createProviderSetting('1234', request)).rejects.toThrow('Invalid channel type provided');
    });
  });

  describe('decryptEmailProviderCredentials', () => {
    it('should decrypt email provider credentials successfully', async () => {
      const settings: OrganisationSettingsInterface = {
        email: [
          {
            provider: EmailProviders.NODEMAILER,
            settings: {
              auth: {
                user: 'encryptedUser',
                pass: 'encryptedPass',
              },
              port: 0,
              host: '',
            },
            enabled: false,
          },
        ],
        push: [],
        slack: [],
      } as unknown as OrganisationSettingsInterface;

      const decryptedSettings = await organisationService.decryptEmailProviderCredentials(settings);

      expect(decryptedSettings.email[0].settings.auth.user).toBe('decryptedUser');
      expect(decryptedSettings.email[0].settings.auth.pass).toBe('decryptedPass');
    });

    it('should handle missing email settings gracefully', async () => {
      const settings: OrganisationSettingsInterface = {
        email: [],
        push: [],
        slack: [],
      } as unknown as OrganisationSettingsInterface;

      const decryptedSettings = await organisationService.decryptEmailProviderCredentials(settings);

      expect(decryptedSettings).toEqual(settings);
    });

    it('should not attempt decryption if auth settings are missing', async () => {
      const settings: OrganisationSettingsInterface = {
        email: [
          {
            provider: EmailProviders.NODEMAILER,
            settings: {},
          },
        ],
      };

      const decryptedSettings = await organisationService.decryptEmailProviderCredentials(settings);

      expect(decryptedSettings.email[0].settings).toEqual({});
    });
  });

  describe('decryptPushProviderCredentials', () => {
    it('should decrypt push provider credentials successfully', async () => {
      const settings: OrganisationSettingsInterface = {
        push: [
          {
            provider: PushProviders.FIREBASE,
            settings: {
              privateKey: 'encryptedPrivateKey',
            },
          },
        ],
      };

      const decryptedSettings = await organisationService.decryptPushProviderCredentials(settings);

      expect(decryptedSettings.push[0].settings.privateKey).toBe('decryptedPrivateKey');
    });

    it('should handle missing push settings gracefully', async () => {
      const settings: OrganisationSettingsInterface = {};

      const decryptedSettings = await organisationService.decryptPushProviderCredentials(settings);

      expect(decryptedSettings).toEqual(settings);
    });

    it('should not attempt decryption if privateKey settings are missing', async () => {
      const settings: OrganisationSettingsInterface = {
        push: [
          {
            provider: PushProviders.FIREBASE,
            settings: {},
          },
        ],
      };

      const decryptedSettings = await organisationService.decryptPushProviderCredentials(settings);

      expect(decryptedSettings.push[0].settings).toEqual({});
    });
  });

  describe('Create', () => {
    const createOrganisationData: CreateOrganisationRequest = {
      name: 'Test Organisation',
    };
    const mockCreatedOrganisation: OrganisationInterface = {
      _id: '1234',
      name: 'Test Organisation',
      api_key: 'mocked-api-key',
      api_secret_hash: 'mocked-secret-hash',
    };

    beforeEach(() => {
      (adaptToOrganisationInterface as jest.Mock).mockReturnValue({
        name: 'Test Organisation',
        api_key: 'mocked-api-key',
        api_secret_hash: 'mocked-secret-hash',
      });
      mockOrganisationRepository.create.mockResolvedValueOnce(mockCreatedOrganisation);
      mockOrganisationRepository.findByName.mockResolvedValueOnce(null);
    });

    it('should generate API key and adapt to interface with correct params', async () => {
      await organisationService.createOrganisation(createOrganisationData);

      expect(generateApiKeyWithSecret).toHaveBeenCalled();
      expect(adaptToOrganisationInterface).toHaveBeenCalledWith(
        createOrganisationData,
        expect.objectContaining({ key: 'mocked-api-key', secret: 'mocked-secret', secret_hash: 'mocked-secret-hash' }),
        'Base64EncodedString',
      );
    });

    it('should return created organisation response with keys', async () => {
      const result = await organisationService.createOrganisation(createOrganisationData);

      expect(result).toEqual({
        id: mockCreatedOrganisation._id,
        org_key: 'Base64EncodedString',
        org_lp_key: mockCreatedOrganisation.api_key,
      });
    });

    it('should not create an organisation and return 409 status code with message if organisation with the same name exists', async () => {
      mockOrganisationRepository.findByName.mockReset();
      mockOrganisationRepository.findByName.mockResolvedValueOnce(mockExistingOrganisation);

      const error = await getError(async () => await organisationService.createOrganisation(createOrganisationData));

      expect(error).not.toBeInstanceOf(NoErrorThrownError);
      expect(error).toBeInstanceOf(Conflict);

      const badRequestError = error as Conflict;
      expect(badRequestError.message).toStrictEqual('Organisation already exist');
    });
  });

  describe('Regenerate API Keys', () => {
    it('should recreate API and Secret for an existing organisation', async () => {
      const regenerateKeysForOrganisation: CreateOrganisationRequest = {
        name: 'Test Organisation',
      };
      const mockExistingOrganisation: OrganisationInterface = {
        _id: '1234',
        name: 'Test Organisation',
        api_key: 'mocked-api-key',
        api_secret_hash: 'mocked-secret-hash',
      };
      const mockUpdatedOrganisation: OrganisationInterface = {
        _id: '1234',
        name: 'Test Organisation',
        api_key: 'updated-api-key',
        api_secret_hash: 'updated-secret-hash',
      };

      (generateApiKeyWithSecret as jest.Mock).mockImplementationOnce(
        () =>
          ({
            key: 'updated-api-key',
            secret: 'updated-secret',
            secret_hash: 'updated-secret-hash',
          }) as ApiKey,
      );

      mockOrganisationRepository.findByName.mockResolvedValueOnce(mockExistingOrganisation);
      mockOrganisationRepository.update.mockResolvedValueOnce(mockUpdatedOrganisation);

      const result = await organisationService.regenerateKeys(regenerateKeysForOrganisation);

      expect(generateApiKeyWithSecret).toHaveBeenCalled();

      expect(mockOrganisationRepository.update).toHaveBeenCalledWith(mockUpdatedOrganisation);

      expect(result).toEqual({
        id: mockExistingOrganisation._id,
        org_key: 'Base64EncodedString',
        org_lp_key: mockUpdatedOrganisation.api_key,
      });
    });

    it('should throw BadRequest if organisation does not exist', async () => {
      const regenerateKeysForOrganisation: CreateOrganisationRequest = {
        name: 'Test Organisation',
      };

      mockOrganisationRepository.findByName.mockResolvedValue(null);

      await expect(organisationService.regenerateKeys(regenerateKeysForOrganisation)).rejects.toThrow('Organisation doesnt exist');
    });

    it('should not call generateApiKeyWithSecret or update when organisation does not exist', async () => {
      const regenerateKeysForOrganisation: CreateOrganisationRequest = {
        name: 'Test Organisation',
      };

      mockOrganisationRepository.findByName.mockResolvedValue(null);

      await organisationService.regenerateKeys(regenerateKeysForOrganisation).catch(() => {});

      expect(generateApiKeyWithSecret).not.toHaveBeenCalled();
      expect(mockOrganisationRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('Read', () => {
    it('should get organisation details by org id', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue(mockExistingOrganisation);

      const result = await organisationService.getOrganisationDetailsById(mockExistingOrganisation!);

      expect(mockOrganisationRepository.findByID).toHaveBeenCalledWith(mockExistingOrganisation._id!);
      expect(result).toEqual(mockExistingOrganisation);
    });

    it('should get organisation by id', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue(mockExistingOrganisation);

      const result = await organisationService.getOrganisationById(mockExistingOrganisation._id!);

      expect(mockOrganisationRepository.findByID).toHaveBeenCalledWith(mockExistingOrganisation._id!);
      expect(result).toEqual(mockExistingOrganisation);
    });

    it('should get organisation by api key', async () => {
      mockOrganisationRepository.findByAPIKey.mockResolvedValue(mockExistingOrganisation);

      const result = await organisationService.getOrganisationByApiKey(mockExistingOrganisation.api_key);

      expect(mockOrganisationRepository.findByAPIKey).toHaveBeenCalledWith(mockExistingOrganisation.api_key);
      expect(result).toEqual(mockExistingOrganisation);
    });

    it('should verify organisation with api key and secret', async () => {
      const secret: string = 'secret';

      mockOrganisationRepository.findByAPIKey.mockResolvedValue(mockExistingOrganisation);
      (verify as jest.Mock).mockReturnValue(true);

      const result = await organisationService.verifySecretAndGetOrganisation(mockExistingOrganisation.api_key, secret);

      expect(mockOrganisationRepository.findByAPIKey).toHaveBeenCalledWith(mockExistingOrganisation.api_key);
      expect(verify).toHaveBeenCalledWith(secret, mockExistingOrganisation.api_secret_hash);
      expect(result).toEqual(mockExistingOrganisation);
    });

    it('should throw when organisation is not found', async () => {
      const secret: string = 'secret';

      mockOrganisationRepository.findByAPIKey.mockResolvedValue(null);

      const error = await getError(
        async () => await organisationService.verifySecretAndGetOrganisation(mockExistingOrganisation.api_key, secret),
      );

      expect(error).not.toBeInstanceOf(NoErrorThrownError);
      expect(error).toBeInstanceOf(UnauthorizedError);
    });

    it('should invalidate wrong api key and secret', async () => {
      const secret: string = 'secret';

      mockOrganisationRepository.findByAPIKey.mockResolvedValue(mockExistingOrganisation);
      (verify as jest.Mock).mockReturnValue(false);

      const error = await getError(
        async () => await organisationService.verifySecretAndGetOrganisation(mockExistingOrganisation.api_key, secret),
      );

      expect(error).not.toBeInstanceOf(NoErrorThrownError);
      expect(error).toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('Settings', () => {
    it('should get settings', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue(mockExistingOrganisation);

      const settings = await organisationService.getSettings(mockExistingOrganisation._id!);

      expect(settings).toStrictEqual(mockExistingOrganisation.settings);
    });

    it('should throw when getting settings for invalid organisation', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue(null);

      const error = await getError(async () => await organisationService.getSettings('1234'));

      expect(error).not.toBeInstanceOf(NoErrorThrownError);
      expect(error).toBeInstanceOf(BadRequest);
    });

    it('should throw when pushing email settings with more than 1 providers enabled', async () => {
      const updateRequest: EmailProvider[] = [
        {
          provider: EmailProviders.NODEMAILER,
          enabled: true,
          settings: {
            service: ' ',
            port: 123,
            secure: false,
            host: ' ',
            auth: {
              user: 'user',
              pass: 'pwd',
            },
          },
        },
        {
          provider: EmailProviders.NODEMAILER,
          enabled: true,
          settings: {
            service: ' ',
            port: 123,
            secure: false,
            host: ' ',
            auth: {
              user: 'user',
              pass: 'pwd',
            },
          },
        },
      ];

      const error = await getError(async () => await organisationService.updateEmailSettings('1234', updateRequest));

      expect(error).not.toBeInstanceOf(NoErrorThrownError);
      expect(error).toBeInstanceOf(BadRequest);

      const badRequestError = error as BadRequest;

      expect(badRequestError.message).toBe('Only 1 Provider can be active');
    });

    it('should throw when pushing push settings with more than 1 providers enabled', async () => {
      const updateRequest: PushProvider[] = [
        {
          provider: PushProviders.FIREBASE,
          enabled: true,
          settings: {
            firebaseClientEmail: '',
            privateKey: '',
            projectId: '',
          },
        },
        {
          provider: PushProviders.FIREBASE,
          enabled: true,
          settings: {
            firebaseClientEmail: '',
            privateKey: '',
            projectId: '',
          },
        },
      ];

      const error = await getError(async () => await organisationService.updatePushSettings('1234', updateRequest));

      expect(error).not.toBeInstanceOf(NoErrorThrownError);
      expect(error).toBeInstanceOf(BadRequest);

      const badRequestError = error as BadRequest;

      expect(badRequestError.message).toBe('Only 1 Provider can be active');
    });

    it('should not throw when pushing email settings with multiple providers provider but only 1 enabled', async () => {
      const updateRequest: EmailProvider[] = [
        {
          provider: EmailProviders.NODEMAILER,
          enabled: true,
          settings: {
            service: ' ',
            port: 123,
            secure: false,
            host: ' ',
            auth: {
              user: 'user',
              pass: 'pwd',
            },
          },
        },
        {
          provider: EmailProviders.NODEMAILER,
          enabled: false,
          settings: {
            service: ' ',
            port: 123,
            secure: false,
            host: ' ',
            auth: {
              user: 'user',
              pass: 'pwd',
            },
          },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue(mockExistingOrganisation);

      const error = await getError(async () => await organisationService.updateEmailSettings('1234', updateRequest));

      expect(error).toBeInstanceOf(NoErrorThrownError);
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });

    it('should not throw when pushing push settings with multiple providers provider but only 1 enabled', async () => {
      const updateRequest: PushProvider[] = [
        {
          provider: PushProviders.FIREBASE,
          enabled: true,
          settings: {
            firebaseClientEmail: '',
            privateKey: '',
            projectId: '',
          },
        },
        {
          provider: PushProviders.FIREBASE,
          enabled: false,
          settings: {
            firebaseClientEmail: '',
            privateKey: '',
            projectId: '',
          },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue(mockExistingOrganisation);
      mockFirebaseService.verifySettings.mockResolvedValue(true);

      const error = await getError(async () => await organisationService.updatePushSettings('1234', updateRequest));

      expect(error).toBeInstanceOf(NoErrorThrownError);
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });

    it('should throw when pushing email settings for invalid organisation', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue(null);

      const error = await getError(async () => await organisationService.updateEmailSettings('1234', []));

      expect(error).not.toBeInstanceOf(NoErrorThrownError);
      expect(error).toBeInstanceOf(BadRequest);

      const badRequestError = error as BadRequest;

      expect(badRequestError.message).toBe('Invalid Organisation');
    });

    it('should throw when pushing push settings for invalid organisation', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue(null);

      const error = await getError(async () => await organisationService.updatePushSettings('1234', []));

      expect(error).not.toBeInstanceOf(NoErrorThrownError);
      expect(error).toBeInstanceOf(BadRequest);

      const badRequestError = error as BadRequest;

      expect(badRequestError.message).toBe('Invalid Organisation');
    });

    it('should not throw when pushing email settings when organisation settings is null', async () => {
      const updateRequest: EmailProvider[] = [
        {
          provider: EmailProviders.NODEMAILER,
          enabled: false,
          settings: {
            auth: { user: 'user', pass: 'pwd' },
            port: 587,
            host: 'smtp.example.com',
          },
        },
        {
          provider: EmailProviders.NODEMAILER,
          enabled: true,
          settings: {
            auth: { user: 'user', pass: 'pwd' },
            port: 587,
            host: 'smtp.example.com',
          },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: undefined });

      const error = await getError(async () => await organisationService.updateEmailSettings('1234', updateRequest));

      expect(error).toBeInstanceOf(NoErrorThrownError);
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });

    it('should not throw when pushing push settings when organisation settings is null', async () => {
      const updateRequest: PushProvider[] = [
        {
          provider: PushProviders.FIREBASE,
          enabled: true,
          settings: {
            firebaseClientEmail: '',
            privateKey: '',
            projectId: '',
          },
        },
        {
          provider: PushProviders.FIREBASE,
          enabled: false,
          settings: {
            firebaseClientEmail: '',
            privateKey: '',
            projectId: '',
          },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: undefined });

      const error = await getError(async () => await organisationService.updatePushSettings('1234', updateRequest));

      expect(error).toBeInstanceOf(NoErrorThrownError);
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });

    it('should not throw error when pushing slack settings when organisation settings is null', async () => {
      const updateRequest: SlackProvider[] = [
        {
          provider: SlackProviders.SLACK,
          enabled: true,
          settings: {
            oAuthToken: ' ',
            slack_channel: ' ',
            bot_name: ' ',
            icon_url: ' ',
            icon_emoji: ' ',
            always_online: false,
          },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: undefined });

      const error = await getError(async () => await organisationService.updateSlackSettings('1234', updateRequest));

      expect(error).toBeInstanceOf(NoErrorThrownError);
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });
  });

  describe('CreatePushSettings', () => {
    let organisationService: OrganisationService;
    let firebaseService: FirebaseService;
    let organisationRepositoryMock: OrganisationRepository;

    beforeEach(() => {
      organisationService = new OrganisationService(mockOrganisationRepository, mockFirebaseService);
      firebaseService = new FirebaseService();
      organisationRepositoryMock = {
        findByID: jest.fn(),
        findByAPIKey: jest.fn(),
        findByName: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      } as unknown as jest.Mocked<OrganisationRepository>;
    });

    it('should create push settings and return the expected response', async () => {
      const createPushSettings: CreateProviderSettingRequest = {
        channelType: ChannelType.PUSH,
        provider: PushProviders.FIREBASE,
        enabled: true,
        settings: {
          firebaseClientEmail: 'testClientEmail@gmail.com',
          privateKey: 'testPrivateKey1',
          projectId: 'project01',
        },
      };

      const organisationMock = {
        _id: 'TestId',
        name: 'Test Organisation',
        api_key: 'mocked-api-key',
        api_secret_hash: 'mocked-secret-hash',
        is_archived: false,
        settings: {
          email: [],
          push: [],
        },
      };
      const mockUpdatedOrganisation: OrganisationInterface = {
        _id: 'TestId',
        name: 'Test Organisation',
        api_key: 'mocked-api-key',
        api_secret_hash: 'mocked-secret-hash',
        is_archived: false,
        settings: {
          email: [],
          push: [
            {
              provider: PushProviders.FIREBASE,
              enabled: true,
              settings: {
                firebaseClientEmail: 'testClientEmail@gmail.com',
                privateKey: 'testPrivateKe  y1',
                projectId: 'project01',
              },
            },
          ],
        },
      };

      mockFirebaseService.verifySettings.mockResolvedValueOnce(true);
      mockOrganisationRepository.findByID.mockResolvedValue(organisationMock);
      mockOrganisationRepository.update.mockResolvedValueOnce(mockUpdatedOrganisation);
      await organisationService.createProviderSetting(organisationMock._id as string, createPushSettings);

      expect(mockOrganisationRepository.findByID).toHaveBeenCalledWith(organisationMock._id!);
      expect(mockFirebaseService.verifySettings).toHaveBeenCalledWith(createPushSettings.settings);
    });
  });

  it('should throw BadRequest error when Firebase credentials are not valid', async () => {
    // Mock necessary dependencies and setup required for the test case
    const orgId = 'org123';
    const createPushSettings = {
      channelType: ChannelType.PUSH,
      provider: PushProviders.FIREBASE,
      enabled: true,
      settings: {
        firebaseClientEmail: 'testClientEmail@gmail.com',
        privateKey: 'testPrivateKey1',
        projectId: 'project01',
      },
    };

    const organisationMock = {
      _id: 'TestId',
      name: 'Test Organisation',
      api_key: 'mocked-api-key',
      api_secret_hash: 'mocked-secret-hash',
      is_archived: false,
      settings: {
        email: [],
        push: [],
      },
    };

    mockOrganisationRepository.findByID.mockResolvedValue(organisationMock);
    jest.spyOn(organisationService['firebaseService'], 'verifySettings').mockResolvedValueOnce(false);

    await expect(organisationService.createProviderSetting(orgId, createPushSettings)).rejects.toThrow(BadRequest);
  });

  it('should log error when saving Provider settings fails', async () => {
    const orgId = 'org123';
    const createPushSettings = {
      channelType: ChannelType.PUSH,
      provider: PushProviders.FIREBASE,
      enabled: true,
      settings: {
        firebaseClientEmail: 'testClientEmail@gmail.com',
        privateKey: 'testPrivateKey1',
        projectId: 'project01',
      },
    };

    const organisationMock = {
      _id: 'TestId',
      name: 'Test Organisation',
      api_key: 'mocked-api-key',
      api_secret_hash: 'mocked-secret-hash',
      is_archived: false,
      settings: {
        email: [],
        push: [],
      },
    };

    jest.spyOn(organisationService, 'getOrganisationById').mockResolvedValueOnce(organisationMock);
    jest.spyOn(organisationService['firebaseService'], 'verifySettings').mockResolvedValueOnce(true);

    jest
      .spyOn(organisationService['organisationRepository'], 'update')
      .mockRejectedValueOnce(new Error('Update failed'));

    const loggerSpy = jest.spyOn(organisationService['logger'], 'error');
    await expect(organisationService.createProviderSetting(orgId, createPushSettings)).rejects.toThrow(Error);
    expect(loggerSpy).toHaveBeenCalled();
  });

  describe('Settings', () => {
    it('should throw when pushing SMS settings for invalid organisation', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue(null);
      const error = await getError(async () => await organisationService.updateSmsProviderSettings('1234', []));
      expect(error).not.toBeInstanceOf(NoErrorThrownError);
      expect(error).toBeInstanceOf(BadRequest);
    });

    it('should not throw when pushing valid SMS settings', async () => {
      const updateRequest: SmsProvider[] = [
        {
          provider: SmsProviders.TWILIO,
          enabled: true,
          settings: {
            smsNumber: 'yourSmsNumber',
            auth: {
              accountSid: 'yourAccountSid',
              authToken: 'yourAuthToken',
            },
          },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue(mockExistingOrganisation);
      const error = await getError(
        async () => await organisationService.updateSmsProviderSettings('1234', updateRequest),
      );
      expect(error).toBeInstanceOf(NoErrorThrownError);
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });

    it('should throw when pushing WhatsApp settings for invalid organisation', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue(null);
      const error = await getError(async () => await organisationService.updateWhatsappProviderSettings('1234', []));
      expect(error).not.toBeInstanceOf(NoErrorThrownError);
      expect(error).toBeInstanceOf(BadRequest);
    });

    it('should not throw when pushing valid WhatsApp settings', async () => {
      const updateRequest: WhatsappProvider[] = [
        {
          provider: WhatsappProviders.TWILIO,
          enabled: true,
          settings: {
            whatsappNumber: 'yourWhatsAppNumber',
            auth: {
              accountSid: 'yourAccountSid',
              authToken: 'yourAuthToken',
            },
          },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue(mockExistingOrganisation);
      const error = await getError(
        async () => await organisationService.updateWhatsappProviderSettings('1234', updateRequest),
      );
      expect(error).toBeInstanceOf(NoErrorThrownError);
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });
  });

  describe('createProviderSetting - Telegram webhook auto-registration', () => {
    beforeEach(() => {
      mockedAxios.post.mockResolvedValue({ data: { ok: true } });
      process.env.SERVER_URL = 'https://example.ngrok.io';
    });

    afterEach(() => {
      delete process.env.SERVER_URL;
    });

    it('registers webhook with Telegram when bot token is saved with enabled=true', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { email: [], push: [], slack: [], sms: [], whatsapp: [], teams: [], telegram: [] } });
      mockOrganisationRepository.update.mockResolvedValueOnce({} as unknown as OrganisationInterface);
      const request = {
        channelType: ChannelType.TELEGRAM,
        provider: 'telegram',
        enabled: true,
        settings: { botToken: '123456:ABCdef-xyz' },
      } as unknown as CreateProviderSettingRequest;

      await organisationService.createProviderSetting('1234', request);

      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });

    it('saves Telegram settings when disabled (deleteWebhook path)', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { email: [], push: [], slack: [], sms: [], whatsapp: [], teams: [], telegram: [] } });
      mockOrganisationRepository.update.mockResolvedValueOnce({} as unknown as OrganisationInterface);
      const request = {
        channelType: ChannelType.TELEGRAM,
        provider: 'telegram',
        enabled: false,
        settings: { botToken: 'test-bot-token' },
      } as unknown as CreateProviderSettingRequest;

      await organisationService.createProviderSetting('1234', request);

      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });

    it('throws when bot token is missing', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { email: [], push: [], slack: [], sms: [], whatsapp: [], teams: [], telegram: [] } });
      const request = {
        channelType: ChannelType.TELEGRAM,
        provider: 'telegram',
        enabled: true,
        settings: { botToken: '' },
      } as unknown as CreateProviderSettingRequest;

      await expect(organisationService.createProviderSetting('1234', request)).rejects.toThrow(
        'Telegram botToken is not provided!. Please provide it',
      );
    });
  });

  describe('updateEmailSettings - SendGrid provider', () => {
    it('should encrypt SendGrid API key and save', async () => {
      const updateRequest: EmailProvider[] = [
        {
          provider: EmailProviders.SENDGRID,
          enabled: true,
          settings: {
            apiKey: 'SG.test-key',
            fromEmail: 'test@example.com',
            fromName: 'Test',
          },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue(mockExistingOrganisation);

      await organisationService.updateEmailSettings('1234', updateRequest);

      expect(encryptData).toHaveBeenCalledWith('SG.test-key');
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });

    it('should trigger webhook registration for enabled SendGrid provider', async () => {
      mockSendGridWebhookRegistration.register.mockResolvedValue({ status: 'created', webhookId: 'wh-abc' });
      const updateRequest: EmailProvider[] = [
        {
          provider: EmailProviders.SENDGRID,
          enabled: true,
          settings: { apiKey: 'SG.plain-key', fromEmail: 'test@example.com' },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation });

      await organisationService.updateEmailSettings('1234', updateRequest);

      await new Promise(process.nextTick);

      expect(mockSendGridWebhookRegistration.register).toHaveBeenCalledWith('SG.plain-key');
    });

    it('should persist webhookId after successful registration', async () => {
      mockSendGridWebhookRegistration.register.mockResolvedValue({ status: 'created', webhookId: 'wh-new' });
      mockOrganisationRepository.update.mockResolvedValue({} as unknown as OrganisationInterface);
      const updateRequest: EmailProvider[] = [
        {
          provider: EmailProviders.SENDGRID,
          enabled: true,
          settings: { apiKey: 'SG.key', fromEmail: 'x@y.com' },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation });

      await organisationService.updateEmailSettings('1234', updateRequest);

      await new Promise(process.nextTick);

      expect(mockOrganisationRepository.update).toHaveBeenCalledTimes(2);
    });

    it('should not trigger webhook registration when SendGrid is disabled', async () => {
      const updateRequest: EmailProvider[] = [
        {
          provider: EmailProviders.SENDGRID,
          enabled: false,
          settings: { apiKey: 'SG.key', fromEmail: 'x@y.com' },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation });

      await organisationService.updateEmailSettings('1234', updateRequest);

      await new Promise(process.nextTick);

      expect(mockSendGridWebhookRegistration.register).not.toHaveBeenCalled();
    });

    it('should not fail settings save when webhook registration errors', async () => {
      mockSendGridWebhookRegistration.register.mockRejectedValue(new Error('Network failure'));
      const updateRequest: EmailProvider[] = [
        {
          provider: EmailProviders.SENDGRID,
          enabled: true,
          settings: { apiKey: 'SG.key', fromEmail: 'x@y.com' },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation });

      await expect(organisationService.updateEmailSettings('1234', updateRequest)).resolves.toEqual({
        status: 'failed',
        reason: 'Could not reach SendGrid. Please retry or register the webhook manually.',
      });
    });

    it('should persist webhookId when result is already-configured', async () => {
      mockSendGridWebhookRegistration.register.mockResolvedValue({ status: 'already-configured', webhookId: 'wh-existing' });
      mockOrganisationRepository.update.mockResolvedValue({} as unknown as OrganisationInterface);
      const updateRequest: EmailProvider[] = [
        {
          provider: EmailProviders.SENDGRID,
          enabled: true,
          settings: { apiKey: 'SG.key', fromEmail: 'x@y.com' },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation });

      await organisationService.updateEmailSettings('1234', updateRequest);

      await new Promise(process.nextTick);

      expect(mockOrganisationRepository.update).toHaveBeenCalledTimes(2);
    });

    it('should handle webhookId persist failure silently', async () => {
      mockSendGridWebhookRegistration.register.mockResolvedValue({ status: 'created', webhookId: 'wh-new' });
      mockOrganisationRepository.update
        .mockResolvedValueOnce({} as unknown as OrganisationInterface)
        .mockRejectedValueOnce(new Error('DB write failed'));
      const updateRequest: EmailProvider[] = [
        {
          provider: EmailProviders.SENDGRID,
          enabled: true,
          settings: { apiKey: 'SG.key', fromEmail: 'x@y.com' },
        },
      ];

      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation });

      await organisationService.updateEmailSettings('1234', updateRequest);

      await new Promise(process.nextTick);

      expect(mockOrganisationRepository.update).toHaveBeenCalledTimes(2);
    });

    it('should disable webhook when SendGrid provider is disabled but still present', async () => {
      const orgWithWebhook = {
        ...mockExistingOrganisation,
        settings: {
          ...mockExistingOrganisation.settings,
          email: [
            {
              provider: EmailProviders.SENDGRID,
              enabled: true,
              settings: { apiKey: 'encrypted-key', fromEmail: 'x@y.com', webhookId: 'wh-123' },
            },
          ],
        },
      };
      mockOrganisationRepository.findByID.mockResolvedValue(orgWithWebhook);

      const updateRequest: EmailProvider[] = [
        {
          provider: EmailProviders.SENDGRID,
          enabled: false,
          settings: { apiKey: 'SG.key', fromEmail: 'x@y.com' },
        },
      ];

      await organisationService.updateEmailSettings('1234', updateRequest);

      await new Promise(process.nextTick);

      expect(mockSendGridWebhookRegistration.disable).toHaveBeenCalledWith('encrypted-key', 'wh-123');
      expect(mockSendGridWebhookRegistration.register).not.toHaveBeenCalled();
    });

    it('should delete webhook when SendGrid provider is removed entirely', async () => {
      const orgWithWebhook = {
        ...mockExistingOrganisation,
        settings: {
          ...mockExistingOrganisation.settings,
          email: [
            {
              provider: EmailProviders.SENDGRID,
              enabled: true,
              settings: { apiKey: 'encrypted-key', fromEmail: 'x@y.com', webhookId: 'wh-456' },
            },
          ],
        },
      };
      mockOrganisationRepository.findByID.mockResolvedValue(orgWithWebhook);

      const updateRequest: EmailProvider[] = [];

      await organisationService.updateEmailSettings('1234', updateRequest);

      await new Promise(process.nextTick);

      expect(mockSendGridWebhookRegistration.deleteWebhook).toHaveBeenCalledWith('encrypted-key', 'wh-456');
      expect(mockSendGridWebhookRegistration.register).not.toHaveBeenCalled();
    });

    it('should not attempt cleanup when previous SendGrid has no webhookId', async () => {
      const orgWithoutWebhookId = {
        ...mockExistingOrganisation,
        settings: {
          ...mockExistingOrganisation.settings,
          email: [
            {
              provider: EmailProviders.SENDGRID,
              enabled: true,
              settings: { apiKey: 'encrypted-key', fromEmail: 'x@y.com' },
            },
          ],
        },
      };
      mockOrganisationRepository.findByID.mockResolvedValue(orgWithoutWebhookId);

      const updateRequest: EmailProvider[] = [];

      await organisationService.updateEmailSettings('1234', updateRequest);

      await new Promise(process.nextTick);

      expect(mockSendGridWebhookRegistration.disable).not.toHaveBeenCalled();
      expect(mockSendGridWebhookRegistration.deleteWebhook).not.toHaveBeenCalled();
    });
  });

  describe('retryWebhookRegistration', () => {
    it('should throw BadRequest if organisation does not exist', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue(null);

      await expect(organisationService.retryWebhookRegistration('invalid-id')).rejects.toThrow('Invalid Organisation');
    });

    it('should throw BadRequest if SendGrid is not enabled', async () => {
      mockOrganisationRepository.findByID.mockResolvedValueOnce({
        ...mockExistingOrganisation,
        settings: { email: [{ provider: EmailProviders.NODEMAILER, enabled: true, settings: {} }], push: [], slack: [], sms: [], whatsapp: [], teams: [], telegram: [] },
      });

      await expect(organisationService.retryWebhookRegistration('1234')).rejects.toThrow('SendGrid integration is not enabled');
    });

    it('should return success when webhook registration succeeds', async () => {
      const orgWithSendGrid = {
        ...mockExistingOrganisation,
        settings: {
          ...mockExistingOrganisation.settings,
          email: [{ provider: EmailProviders.SENDGRID, enabled: true, settings: { apiKey: 'encrypted-key', fromEmail: 'x@y.com' } }],
        },
      };
      mockOrganisationRepository.findByID.mockResolvedValue(orgWithSendGrid);
      mockSendGridWebhookRegistration.register.mockResolvedValue({ status: 'created', webhookId: 'wh-123' });
      mockOrganisationRepository.update.mockResolvedValueOnce({} as unknown as OrganisationInterface);

      const result = await organisationService.retryWebhookRegistration('1234');

      expect(result).toEqual({ status: 'created' });
      expect(mockSendGridWebhookRegistration.register).toHaveBeenCalled();
    });

    it('should return failed with reason when registration fails', async () => {
      const orgWithSendGrid = {
        ...mockExistingOrganisation,
        settings: {
          ...mockExistingOrganisation.settings,
          email: [{ provider: EmailProviders.SENDGRID, enabled: true, settings: { apiKey: 'encrypted-key', fromEmail: 'x@y.com' } }],
        },
      };
      mockOrganisationRepository.findByID.mockResolvedValue(orgWithSendGrid);
      mockSendGridWebhookRegistration.register.mockResolvedValue({ status: 'insufficient-permissions' });

      const result = await organisationService.retryWebhookRegistration('1234');

      expect(result.status).toBe('failed');
      expect(result.reason).toContain('permission');
    });
  });

  describe('createProviderSetting - EMAIL', () => {
    it('should encrypt nodemailer auth and save when provider is email', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue({ ...mockExistingOrganisation, settings: { email: [], push: [], slack: [], sms: [], whatsapp: [], teams: [], telegram: [] } });
      const request = {
        channelType: ChannelType.EMAIL,
        provider: EmailProviders.NODEMAILER,
        enabled: true,
        settings: {
          service: 'gmail',
          port: 587,
          secure: false,
          host: 'smtp.gmail.com',
          auth: { user: 'testuser', pass: 'testpass' },
        },
      } as unknown as CreateProviderSettingRequest;

      await organisationService.createProviderSetting('1234', request);

      expect(encryptData).toHaveBeenCalledWith('testuser');
      expect(encryptData).toHaveBeenCalledWith('testpass');
      expect(mockOrganisationRepository.update).toHaveBeenCalled();
    });

    it('should throw when organisation not found', async () => {
      mockOrganisationRepository.findByID.mockResolvedValue(null);
      const request = {
        channelType: ChannelType.EMAIL,
        provider: EmailProviders.NODEMAILER,
        enabled: true,
        settings: { auth: { user: 'u', pass: 'p' } },
      } as unknown as CreateProviderSettingRequest;

      await expect(organisationService.createProviderSetting('1234', request)).rejects.toThrow('Invalid Organisation');
    });
  });
});
