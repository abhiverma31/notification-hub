import "reflect-metadata";
import { OrganisationRepository } from "../../../../src/shared-library/repositories/Organisation";
import { OrganisationService } from "../../../../src/consumer/services/Organisation";
import { ChannelType } from "../../../../src/shared-library/types/Enum/ChannelType";
import { SmsProviders } from "../../../../src/server/types/Enum/SmsProviders";

jest.mock("../../../../src/shared-library/repositories/Organisation");
jest.mock("../../../../src/consumer/utils/ConsumerLogger.ts");

describe('OrganisationService', () => {
  let organisationService: OrganisationService;
  let mockFindByID: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindByID = jest.fn();
    (OrganisationRepository as any).mockImplementation(() => {
      return { findByID: mockFindByID };
    });
    organisationService = new OrganisationService(new OrganisationRepository());
  });

  it('should return provider settings for enabled channel', async () => {
    const orgDetails = {
      settings: {
        email: [
          { enabled: true, settings: { host: 'smtp.example.com' } },
          { enabled: false, settings: { host: 'smtp2.example.com' } }
        ],
        push: [], slack: [], sms: [], whatsapp: []
      }
    };
    mockFindByID.mockResolvedValue(orgDetails);
    const result = await organisationService.getProviderSettings('org1', ChannelType.EMAIL);
    expect(result).toEqual({ host: 'smtp.example.com' });
  });

  it('should return undefined if organisation not found', async () => {
    mockFindByID.mockResolvedValue(undefined);
    const result = await organisationService.getProviderSettings('org1', ChannelType.EMAIL);
    expect(result).toBeUndefined();
  });

  it('should return undefined if organisation settings not found', async () => {
    mockFindByID.mockResolvedValue({});
    const result = await organisationService.getProviderSettings('org1', ChannelType.EMAIL);
    expect(result).toBeUndefined();
  });

  it('should return undefined if no enabled provider settings for channel', async () => {
    const orgDetails = {
      settings: {
        email: [
          { enabled: false, settings: { host: 'smtp.example.com' } }
        ],
        push: [], slack: [], sms: [], whatsapp: []
      }
    };
    mockFindByID.mockResolvedValue(orgDetails);
    const result = await organisationService.getProviderSettings('org1', ChannelType.EMAIL);
    expect(result).toBeUndefined();
  });

  it('should return undefined for unsupported channel', async () => {
    const orgDetails = {
      settings: {
        email: [], push: [], slack: [], sms: [], whatsapp: []
      }
    };
    mockFindByID.mockResolvedValue(orgDetails);
    const result = await organisationService.getProviderSettings('org1', 999 as unknown as ChannelType);
    expect(result).toBeUndefined();
  });

  it('should return provider settings for PUSH channel', async () => {
    const orgDetails = {
      settings: {
        push: [{ enabled: true, settings: { projectId: 'test-project' } }],
        email: [], slack: [], sms: [], whatsapp: [], teams: []
      }
    };
    mockFindByID.mockResolvedValue(orgDetails);
    const result = await organisationService.getProviderSettings('org1', ChannelType.PUSH);
    expect(result).toEqual({ projectId: 'test-project' });
  });

  it('should return provider settings for SLACK channel', async () => {
    const orgDetails = {
      settings: {
        slack: [{ enabled: true, settings: { webhookUrl: 'https://slack.com/webhook' } }],
        email: [], push: [], sms: [], whatsapp: [], teams: []
      }
    };
    mockFindByID.mockResolvedValue(orgDetails);
    const result = await organisationService.getProviderSettings('org1', ChannelType.SLACK);
    expect(result).toEqual({ webhookUrl: 'https://slack.com/webhook' });
  });

  it('should return provider settings for SMS channel', async () => {
    const orgDetails = {
      settings: {
        sms: [{ enabled: true, settings: { accountSid: 'test-sid' } }],
        email: [], push: [], slack: [], whatsapp: [], teams: []
      }
    };
    mockFindByID.mockResolvedValue(orgDetails);
    const result = await organisationService.getProviderSettings('org1', ChannelType.SMS);
    expect(result).toEqual({ accountSid: 'test-sid' });
  });

  it('should return provider settings for WHATSAPP channel', async () => {
    const orgDetails = {
      settings: {
        whatsapp: [{ enabled: true, settings: { accountSid: 'test-sid' } }],
        email: [], push: [], slack: [], sms: [], teams: []
      }
    };
    mockFindByID.mockResolvedValue(orgDetails);
    const result = await organisationService.getProviderSettings('org1', ChannelType.WHATSAPP);
    expect(result).toEqual({ accountSid: 'test-sid' });
  });

  it('should return provider settings for TEAMS channel', async () => {
    const orgDetails = {
      settings: {
        teams: [{ enabled: true, settings: { webhookUrl: 'https://teams.com/webhook' } }],
        email: [], push: [], slack: [], sms: [], whatsapp: []
      }
    };
    mockFindByID.mockResolvedValue(orgDetails);
    const result = await organisationService.getProviderSettings('org1', ChannelType.TEAMS);
    expect(result).toEqual({ webhookUrl: 'https://teams.com/webhook' });

  });

  describe('getSmsProviderConfig', () => {
    it('should return provider and settings for enabled Gupshup SMS', async () => {
      const orgDetails = {
        settings: {
          sms: [{ provider: SmsProviders.GUPSHUP, enabled: true, settings: { userid: 'user1', password: 'pass1', mask: 'SENDER' } }],
          email: [], push: [], slack: [], whatsapp: [], teams: []
        }
      };
      mockFindByID.mockResolvedValue(orgDetails);
      const result = await organisationService.getSmsProviderConfig('org1');
      expect(result).toEqual({ provider: SmsProviders.GUPSHUP, settings: { userid: 'user1', password: 'pass1', mask: 'SENDER' } });
    });

    it('should return provider and settings for enabled Twilio SMS', async () => {
      const orgDetails = {
        settings: {
          sms: [{ provider: SmsProviders.TWILIO, enabled: true, settings: { smsNumber: '+123', auth: { accountSid: 'sid', authToken: 'token' } } }],
          email: [], push: [], slack: [], whatsapp: [], teams: []
        }
      };
      mockFindByID.mockResolvedValue(orgDetails);
      const result = await organisationService.getSmsProviderConfig('org1');
      expect(result).toEqual({ provider: SmsProviders.TWILIO, settings: { smsNumber: '+123', auth: { accountSid: 'sid', authToken: 'token' } } });
    });

    it('should return undefined if no settings exist', async () => {
      mockFindByID.mockResolvedValue({});
      const result = await organisationService.getSmsProviderConfig('org1');
      expect(result).toBeUndefined();
    });

    it('should return undefined if no SMS provider is enabled', async () => {
      const orgDetails = {
        settings: {
          sms: [{ provider: SmsProviders.GUPSHUP, enabled: false, settings: { userid: 'user1', password: 'pass1', mask: 'SENDER' } }],
          email: [], push: [], slack: [], whatsapp: [], teams: []
        }
      };
      mockFindByID.mockResolvedValue(orgDetails);
      const result = await organisationService.getSmsProviderConfig('org1');
      expect(result).toBeUndefined();
    });
  });
});
