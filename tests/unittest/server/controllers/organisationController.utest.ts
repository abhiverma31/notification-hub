import 'reflect-metadata';
import { OrganisationController } from '../../../../src/server/controllers/Organisation';
import { OrganisationRepository } from '../../../../src/shared-library/repositories/Organisation';
import { OrganisationService } from '../../../../src/server/services/Organisation';
import { NotificationService } from '../../../../src/server/services/Notification';
import {
  CreateOrganisationRequest,
  CreateProviderSettingRequest,
} from '../../../../src/server/types/request/CreateOrganisation';
import { HttpStatusCode } from '../../../../src/server/types/Enum/HttpStatusCode';
import {
  EmailProvider,
  PushProvider,
  SlackProvider,
  SmsProvider,
  WhatsappProvider,
} from '../../../../src/shared-library/models/submodels/OrganisationSettings';
import { PushProviders } from '../../../../src/server/types/Enum/PushProviders';
import { EmailProviders } from '../../../../src/server/types/Enum/EmailProviders';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { NHRequestUser, NHRequest } from '../../../../src/server/types/internal/NHRequest';
import { OrganisationInterface } from '../../../../src/shared-library/models/Organisation';
import { FirebaseService } from '../../../../src/server/services/FireBase';
import { BadRequest, Conflict } from '../../../../src/server/utils/errors/BadRequest';
import { MemberInterface } from '../../../../src/shared-library/models/Member';
import { MemberRepository } from '../../../../src/shared-library/repositories/Member';
import { SlackProviders } from '../../../../src/server/types/Enum/SlackProvider';
import { SmsProviders } from '../../../../src/server/types/Enum/SmsProviders';
import { WhatsappProviders } from '../../../../src/server/types/Enum/WhatsappProviders';

describe('OrganisationController', () => {
  let organisationController: OrganisationController;
  let service: OrganisationService;

  beforeEach(() => {
    service = new OrganisationService(
      {} as unknown as OrganisationRepository,
      {} as unknown as FirebaseService,
      {} as unknown as MemberRepository,
    );
    organisationController = new OrganisationController(service);
    organisationController.setStatus = jest.fn();
  });

  it('should register a new organisation successfully', async () => {
    const member: MemberInterface = { _id: 'mocked-id', email: 'mocked-email' };
    const user: NHRequestUser = { member: member, role: 'admin' };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };
    service.createOrganisation = jest.fn().mockResolvedValue({
      id: 'mocked-id',
      api_key: 'mocked-api-key',
      api_secret_hash: 'mocked-api-secret',
    });

    const req: CreateOrganisationRequest = {
      name: 'Test Organisation',
    };

    const res = await organisationController.create(req, request as NHRequest);

    expect(organisationController.setStatus).toHaveBeenCalledWith(HttpStatusCode.CREATED);
    expect(res).toStrictEqual({
      id: 'mocked-id',
      api_key: 'mocked-api-key',
      api_secret_hash: 'mocked-api-secret',
    });
  });

  it('should handle 409 conflict when organisation already exists', async () => {
    const member: MemberInterface = { _id: 'mocked-id', email: 'mocked-email' };
    const user: NHRequestUser = { member: member, role: 'admin' };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };
    const conflictErrorMessage = 'Organisation already exists';
    jest.spyOn(service, 'createOrganisation').mockRejectedValueOnce(new Conflict(conflictErrorMessage));

    const req: CreateOrganisationRequest = {
      name: 'Existing Organisation',
    };

    try {
      await organisationController.create(req, request as NHRequest);
    } catch (error) {
      expect(error).toBeInstanceOf(Conflict);
      expect(error.message).toBe(conflictErrorMessage);
    }
  });

  it('should get organisation details successfully', async () => {
    const organisationDetails: OrganisationInterface = {
      _id: 'orgId',
      name: 'Test Organisation',
      api_key: 'apiKey',
      api_secret_hash: 'apiSecretHash',
    };

    const user: NHRequestUser = { organisation: organisationDetails, role: 'admin' };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };

    service.getSettings = jest.fn().mockResolvedValue(organisationDetails);

    service.getOrganisationDetailsById = jest.fn().mockResolvedValue(organisationDetails);

    const res = await organisationController.getOrganisation(request as NHRequest);

    expect(service.getOrganisationDetailsById).toHaveBeenCalledWith({
      _id: 'orgId',
      api_key: 'apiKey',
      api_secret_hash: 'apiSecretHash',
      name: 'Test Organisation',
    });
    expect(res).toStrictEqual(organisationDetails);
  });

  it('should get settings for an organisation', async () => {
    const settings = {
      email: [],
      push: [],
    };

    service.getSettings = jest.fn().mockResolvedValue(settings);

    const res = await organisationController.getSettings('1234');

    expect(service.getSettings).toHaveBeenCalledWith('1234');
    expect(res).toStrictEqual(settings);
  });

  it('should be able to update email settings for an organisation', async () => {
    const settings: EmailProvider[] = [
      {
        provider: EmailProviders.NODEMAILER,
        enabled: true,
        settings: {
          user: 'user',
          password: 'pwd',
        },
      },
    ];

    service.updateEmailSettings = jest.fn();

    const res = await organisationController.updateEmailSettings('1234', settings);

    expect(service.updateEmailSettings).toHaveBeenCalledWith('1234', settings);
    expect(res).toEqual({ webhookRegistration: undefined });
  });

  it('should be able to update push settings for an organisation', async () => {
    const settings: PushProvider[] = [
      {
        provider: PushProviders.FIREBASE,
        enabled: true,
        settings: {
          projectId: '',
          privateKey: '',
          firebaseClientEmail: '',
        },
      },
    ];

    service.updatePushSettings = jest.fn();

    const res = await organisationController.updatePushSettings('1234', settings);

    expect(service.updatePushSettings).toHaveBeenCalledWith('1234', settings);
    expect(res).toBeUndefined();
  });

  it('should be able to update slack settings for an organisation', async () => {
    const settings: SlackProvider[] = [
      {
        provider: SlackProviders.SLACK,
        enabled: true,
        settings: {
          oAuthToken: 'slack-oauth-token-placeholder',
          slack_channel: 'general',
          bot_name: 'zomato',
          icon_url: 'https://cld-sample-4.jpg',
          icon_emoji: ':shallow_pan_of_food:',
          always_online: false,
        },
      },
    ];

    service.updateSlackSettings = jest.fn();

    const res = await organisationController.updateSlackSettings('1234', settings);

    expect(service.updateSlackSettings).toHaveBeenCalledWith('1234', settings);
    expect(res).toBeUndefined();
  });

  it('should be able to update teams settings for an organisation', async () => {
    const settings = [
      {
        provider: 'TEAMS',
        enabled: true,
        settings: {
          webhook: 'https://teams-webhook-url',
        },
      },
    ];

    service.updateTeamsSettings = jest.fn();

    const res = await organisationController.updateTeamsSettings('1234', settings);

    expect(service.updateTeamsSettings).toHaveBeenCalledWith('1234', settings);
    expect(res).toBeUndefined();
  });

  it('should create provider settings for an organisation - Push', async () => {
    const settings: CreateProviderSettingRequest = {
      channelType: ChannelType.PUSH,

      provider: PushProviders.FIREBASE,
      enabled: true,
      settings: {
        projectId: '',
        privateKey: '',
        firebaseClientEmail: '',
      },
    };

    service.createProviderSetting = jest.fn();
    const org: Partial<OrganisationInterface> = { _id: '1234' };
    const user: Partial<NHRequestUser> = { organisation: org as OrganisationInterface };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };
    const res = await organisationController.createProviderSetting(request as NHRequest, settings);

    expect(service.createProviderSetting).toHaveBeenCalledWith(request.user?.organisation?._id, settings);
    expect(res).toBeUndefined();
  });

  it('should create provider settings for an organisation - Slack', async () => {
    const settings: CreateProviderSettingRequest = {
      channelType: ChannelType.SLACK,

      provider: SlackProviders.SLACK,
      enabled: true,
      settings: {
        webhook: 'test-webhook',
      },
    };

    service.createProviderSetting = jest.fn();
    const org: Partial<OrganisationInterface> = { _id: '1234' };
    const user: Partial<NHRequestUser> = { organisation: org as OrganisationInterface };
    const request: Partial<NHRequest> = { user: user as NHRequestUser };
    const res = await organisationController.createProviderSetting(request as NHRequest, settings);

    expect(service.createProviderSetting).toHaveBeenCalledWith(request.user?.organisation?._id, settings);
    expect(res).toBeUndefined();
  });
});

jest.mock('multer', () => {
  const multer = jest.fn(() => {
    return {
      single: jest.fn(() => (req: any, res: any, cb: any) => cb(null)),
    };
  });

  (multer as any).memoryStorage = jest.fn(() => {
    return {};
  });

  return multer;
});

describe('OrganisationController - uploadFirebaseConfig', () => {
  let organisationController: OrganisationController;
  let organisationService: OrganisationService;
  let firebaseService: FirebaseService;

  beforeEach(() => {
    firebaseService = {} as FirebaseService;
    organisationService = new OrganisationService(
      {} as unknown as OrganisationRepository,
      {} as unknown as FirebaseService,
      {} as unknown as MemberRepository,
    );
    organisationController = new OrganisationController(organisationService);
    organisationController.setStatus = jest.fn();
  });

  it('should upload and save Firebase config successfully', async () => {
    const req: Partial<NHRequest> = {
      file: {
        buffer: Buffer.from(
          JSON.stringify({
            project_id: 'projectId',
            private_key: 'privateKey',
            client_email: 'clientEmail',
          }),
        ),
      },
      user: {
        organisation: {
          _id: 'orgId',
          name: 'Org Name',
          api_key: 'apiKey',
          api_secret_hash: 'apiSecretHash',
        } as OrganisationInterface,
      },
    };

    organisationService.createProviderSetting = jest.fn().mockResolvedValue(undefined);

    await organisationController.uploadFirebaseConfig(req as NHRequest);

    expect(organisationService.createProviderSetting).toHaveBeenCalledWith('orgId', {
      channelType: 'push',
      provider: 'firebase',
      enabled: true,
      settings: {
        firebaseClientEmail: 'clientEmail',
        privateKey: 'privateKey',
        projectId: 'projectId',
      },
    });
    expect(organisationController.setStatus).toHaveBeenCalledWith(201);
  });

  it('should handle missing required fields in Firebase config', async () => {
    const req: Partial<NHRequest> = {
      file: {
        buffer: Buffer.from(
          JSON.stringify({
            project_id: 'projectId',
            private_key: 'privateKey',
          }),
        ),
      },
      user: {
        organisation: {
          _id: 'orgId',
          name: 'Org Name',
          api_key: 'apiKey',
          api_secret_hash: 'apiSecretHash',
        } as OrganisationInterface,
      },
    };

    try {
      await organisationController.uploadFirebaseConfig(req as NHRequest);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequest);
      expect(error.message).toBe('Missing required fields in the Firebase config file');
    }
    expect(organisationController.setStatus).toHaveBeenCalledWith(400);
  });

  it('should handle JSON parsing error', async () => {
    const req: Partial<NHRequest> = {
      file: {
        buffer: Buffer.from('invalid json'),
      },
      user: {
        organisation: {
          _id: 'orgId',
          name: 'Org Name',
          api_key: 'apiKey',
          api_secret_hash: 'apiSecretHash',
        } as OrganisationInterface,
      },
    };

    try {
      await organisationController.uploadFirebaseConfig(req as NHRequest);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Failed to parse and save the Firebase Configuration');
    }
    expect(organisationController.setStatus).toHaveBeenCalledWith(500);
  });

  describe('OrganisationController - updateSmsAndWhatsappConfiguration', () => {
    let organisationController: OrganisationController;
    let service: OrganisationService;

    beforeEach(() => {
      service = new OrganisationService(
        {} as unknown as OrganisationRepository,
        {} as unknown as FirebaseService,
        {} as unknown as MemberRepository,
      );
      organisationController = new OrganisationController(service);
      organisationController.setStatus = jest.fn();
    });

    it('should update SMS and WhatsApp settings successfully', async () => {
      const smsSettings: SmsProvider[] = [
        {
          provider: SmsProviders.TWILIO,
          enabled: true,
          settings: {
            smsNumber: '1234567890',
            auth: {
              accountSid: 'mockAccountSid',
              authToken: 'mockAuthToken',
            },
          },
        },
      ];

      const whatsappSettings: WhatsappProvider[] = [
        {
          provider: WhatsappProviders.TWILIO,
          enabled: true,
          settings: {
            whatsappNumber: '0987654321',
            auth: {
              accountSid: 'mockAccountSid',
              authToken: 'mockAuthToken',
            },
          },
        },
      ];

      const requestBody = { sms: smsSettings, whatsapp: whatsappSettings };
      const organisationId = 'mocked-org-id';

      service.updateSmsProviderSettings = jest.fn();
      service.updateWhatsappProviderSettings = jest.fn();

      await organisationController.updateSmsAndWhatsappConfiguration(organisationId, requestBody);

      expect(service.updateSmsProviderSettings).toHaveBeenCalledWith(organisationId, smsSettings);
      expect(service.updateWhatsappProviderSettings).toHaveBeenCalledWith(organisationId, whatsappSettings);
    });

    it('should throw an error if SMS settings are invalid', async () => {
      const smsSettings: SmsProvider[] = [
        {
          provider: SmsProviders.TWILIO,
          enabled: true,
          settings: {
            smsNumber: '',
            auth: {
              accountSid: 'mockAccountSid',
              authToken: 'mockAuthToken',
            },
          },
        },
      ];

      const whatsappSettings: WhatsappProvider[] = [
        {
          provider: WhatsappProviders.TWILIO,
          enabled: true,
          settings: {
            whatsappNumber: '0987654321',
            auth: {
              accountSid: 'mockAccountSid',
              authToken: 'mockAuthToken',
            },
          },
        },
      ];

      const requestBody = { sms: smsSettings, whatsapp: whatsappSettings };
      const organisationId = 'mocked-org-id';

      await expect(
        organisationController.updateSmsAndWhatsappConfiguration(organisationId, requestBody),
      ).rejects.toThrow('Invalid smsNumber in SMS settings');
    });

    it('should throw an error if WhatsApp settings are invalid', async () => {
      const smsSettings: SmsProvider[] = [
        {
          provider: SmsProviders.TWILIO,
          enabled: true,
          settings: {
            smsNumber: '1234567890',
            auth: {
              accountSid: 'mockAccountSid',
              authToken: 'mockAuthToken',
            },
          },
        },
      ];

      const whatsappSettings: WhatsappProvider[] = [
        {
          provider: WhatsappProviders.TWILIO,
          enabled: true,
          settings: {
            whatsappNumber: '',
            auth: {
              accountSid: 'mockAccountSid',
              authToken: 'mockAuthToken',
            },
          },
        },
      ];

      const requestBody = { sms: smsSettings, whatsapp: whatsappSettings };
      const organisationId = 'mocked-org-id';

      await expect(
        organisationController.updateSmsAndWhatsappConfiguration(organisationId, requestBody),
      ).rejects.toThrow('Invalid whatsappNumber in WhatsApp settings');
    });

    it('should throw an error if Twilio settings are missing', async () => {
      const smsSettings: SmsProvider[] = [
        {
          provider: SmsProviders.TWILIO,
          enabled: true,
          settings: {
            smsNumber: '1234567890',
            auth: {
              accountSid: '',
              authToken: '',
            },
          },
        },
      ];

      const whatsappSettings: WhatsappProvider[] = [
        {
          provider: WhatsappProviders.TWILIO,
          enabled: true,
          settings: {
            whatsappNumber: '0987654321',
            auth: {
              accountSid: '',
              authToken: '',
            },
          },
        },
      ];

      const requestBody = { sms: smsSettings, whatsapp: whatsappSettings };
      const organisationId = 'mocked-org-id';

      await expect(
        organisationController.updateSmsAndWhatsappConfiguration(organisationId, requestBody),
      ).rejects.toThrow('Invalid Twilio settings in SMS settings');
    });

    it('should update SMS settings successfully', async () => {
      const smsSettings: SmsProvider[] = [
        {
          provider: SmsProviders.TWILIO,
          enabled: true,
          settings: {
            smsNumber: '1234567890',
            auth: {
              accountSid: 'mockAccountSid',
              authToken: 'mockAuthToken',
            },
          },
        },
      ];

      const organisationId = 'mocked-org-id';

      service.updateSmsProviderSettings = jest.fn();

      await organisationController.updateSmsProviderConfiguration(organisationId, smsSettings);

      expect(service.updateSmsProviderSettings).toHaveBeenCalledWith(organisationId, smsSettings);
    });

    it('should update WhatsApp settings successfully', async () => {
      const whatsappSettings: WhatsappProvider[] = [
        {
          provider: WhatsappProviders.TWILIO,
          enabled: true,
          settings: {
            whatsappNumber: '0987654321',
            auth: {
              accountSid: 'mockAccountSid',
              authToken: 'mockAuthToken',
            },
          },
        },
      ];

      const organisationId = 'mocked-org-id';

      service.updateWhatsappProviderSettings = jest.fn();

      await organisationController.updateWhatsappProviderConfiguration(organisationId, whatsappSettings);

      expect(service.updateWhatsappProviderSettings).toHaveBeenCalledWith(organisationId, whatsappSettings);
    });
  });

  describe('testEmail', () => {
    let controller: OrganisationController;
    let mockOrgService: jest.Mocked<OrganisationService>;
    let mockNotificationService: jest.Mocked<NotificationService>;
    let mockEmailTestService: any;
    let mockApnsTestService: any;

    beforeEach(() => {
      mockOrgService = {
        getOrganisationById: jest.fn(),
      } as any;
      mockNotificationService = {
        sendNotification: jest.fn().mockResolvedValue({ transactions: [] }),
      } as any;
      mockEmailTestService = {
        sendTestEmail: jest.fn(),
      };
      mockApnsTestService = {
        testApnsNotification: jest.fn(),
      };
      controller = new OrganisationController(
        mockOrgService,
        mockNotificationService,
        mockEmailTestService,
        mockApnsTestService,
      );
      controller.setStatus = jest.fn();
    });

    it('should send test email successfully', async () => {
      mockEmailTestService.sendTestEmail.mockResolvedValue({ 
        message: 'Test email queued successfully. If you receive the email at test@example.com, your sendgrid integration is working correctly.' 
      });

      const result = await controller.testEmail('org1', { email: 'test@example.com' });

      expect(result.message).toContain('Test email queued successfully');
      expect(mockEmailTestService.sendTestEmail).toHaveBeenCalledWith('org1', 'test@example.com');
    });

    it('should throw on invalid email format', async () => {
      mockEmailTestService.sendTestEmail.mockRejectedValue(new BadRequest('Invalid email format'));
      await expect(controller.testEmail('org1', { email: 'invalid' })).rejects.toThrow('Invalid email format');
    });

    it('should throw when no email provider configured', async () => {
      mockEmailTestService.sendTestEmail.mockRejectedValue(new BadRequest('No email provider configured'));
      await expect(controller.testEmail('org1', { email: 'test@example.com' })).rejects.toThrow('No email provider configured');
    });
  });

  describe('retryWebhookRegistration', () => {
    it('should return webhook registration result', async () => {
      organisationService.retryWebhookRegistration = jest.fn().mockResolvedValue({ status: 'created' });

      const res = await organisationController.retryWebhookRegistration('1234');

      expect(organisationService.retryWebhookRegistration).toHaveBeenCalledWith('1234');
      expect(res).toEqual({ webhookRegistration: { status: 'created' } });
    });

    it('should propagate error when SendGrid is not enabled', async () => {
      organisationService.retryWebhookRegistration = jest.fn().mockRejectedValue(new BadRequest('SendGrid integration is not enabled'));

      await expect(organisationController.retryWebhookRegistration('1234')).rejects.toThrow('SendGrid integration is not enabled');
    });
  });
});
