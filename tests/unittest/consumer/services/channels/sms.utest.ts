import 'reflect-metadata';
import { OrganisationService } from '../../../../../src/consumer/services/Organisation';
import { SmsService } from '../../../../../src/consumer/services/channels/Sms';
import { TemplateDetails } from '../../../../../src/shared-library/models/Template';
import { Recipient } from '../../../../../src/shared-library/types/Dto/Recipient';
import { ChannelType } from '../../../../../src/shared-library/types/Enum/ChannelType';
import { decryptData } from '../../../../../src/server/utils/KeyTools';
import { SmsProviders } from '../../../../../src/server/types/Enum/SmsProviders';
import { GupshupSmsService } from '../../../../../src/consumer/services/integrations/GupshupSmsService';
import twilio from 'twilio';

jest.mock('axios');
jest.mock('twilio');
jest.mock('../../../../../src/server/utils/KeyTools', () => ({
  decryptData: jest.fn((data) => `decrypted_${data}`),
}));

describe('SMSService', () => {
  const organisationId = 'test-organisation-id';
  const hydratedTemplate: TemplateDetails = {
    body: 'hello, this is a test message',
  };
  const recipient: Recipient = {
    userId: 'user_id',
    channel: ChannelType.SMS,
    email: 'random@technogise.com',
    name: { first: 'Random', last: 'Name' },
    phone_number: '+9167676767',
  };

  const mockOrganisationService = {
    getSmsProviderConfig: jest.fn(),
    getProviderSettings: jest.fn(),
  } as unknown as jest.Mocked<OrganisationService>;

  const mockGupshupSmsService = {
    send: jest.fn(),
  } as unknown as jest.Mocked<GupshupSmsService>;

  const smsService = new SmsService(mockOrganisationService, mockGupshupSmsService);

  beforeEach(() => {
    jest.clearAllMocks();
    (decryptData as jest.Mock).mockImplementation((data) => `decrypted_${data}`);
  });

  describe('Twilio routing', () => {
    const twilioConfig = {
      provider: SmsProviders.TWILIO,
      settings: {
        smsNumber: '+1234567890',
        auth: { accountSid: 'encryptedSid', authToken: 'encryptedToken' },
      },
    };

    const mockTwilioClient = {
      messages: { create: jest.fn().mockResolvedValue({ sid: 'messageSid' }) },
    };

    beforeEach(() => {
      mockOrganisationService.getSmsProviderConfig.mockResolvedValue(twilioConfig);
      (twilio as unknown as jest.Mock).mockReturnValue(mockTwilioClient);
    });

    it('should send SMS via Twilio when provider is twilio', async () => {
      await smsService.send(hydratedTemplate, organisationId, recipient);

      expect(decryptData).toHaveBeenCalledWith('encryptedSid');
      expect(decryptData).toHaveBeenCalledWith('encryptedToken');
      expect(twilio).toHaveBeenCalledWith('decrypted_encryptedSid', 'decrypted_encryptedToken');
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: hydratedTemplate.body,
        from: '+1234567890',
        to: '+9167676767',
      });
    });

    it('should not call GupshupSmsService when provider is twilio', async () => {
      await smsService.send(hydratedTemplate, organisationId, recipient);
      expect(mockGupshupSmsService.send).not.toHaveBeenCalled();
    });

    it('should include statusCallback URL when messageId is provided', async () => {
      process.env.SERVER_URL = 'https://api.test.easynotify.ai';

      await smsService.send(hydratedTemplate, organisationId, recipient, 'txn-sms-123');

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: hydratedTemplate.body,
        from: '+1234567890',
        to: '+9167676767',
        statusCallback: 'https://api.test.easynotify.ai/api/webhooks/twilio/sms?transactionId=txn-sms-123&organisationId=test-organisation-id',
      });

      delete process.env.SERVER_URL;
    });
  });

  describe('Gupshup routing', () => {
    const gupshupConfig = {
      provider: SmsProviders.GUPSHUP,
      settings: {
        userid: 'gupshup_user',
        password: 'encryptedPassword',
        mask: 'SENDER',
      },
    };

    beforeEach(() => {
      mockOrganisationService.getSmsProviderConfig.mockResolvedValue(gupshupConfig);
    });

    it('should send SMS via Gupshup when provider is gupshup', async () => {
      await smsService.send(hydratedTemplate, organisationId, recipient);

      expect(decryptData).toHaveBeenCalledWith('encryptedPassword');
      expect(mockGupshupSmsService.send).toHaveBeenCalledWith(
        'hello, this is a test message',
        '+9167676767',
        { userid: 'gupshup_user', password: 'decrypted_encryptedPassword', mask: 'SENDER' },
      );
    });

    it('should not call Twilio when provider is gupshup', async () => {
      await smsService.send(hydratedTemplate, organisationId, recipient);
      expect(twilio).not.toHaveBeenCalled();
    });
  });

  describe('no provider configured', () => {
    it('should throw when no SMS provider config is found', async () => {
      mockOrganisationService.getSmsProviderConfig.mockResolvedValue(undefined);
      await expect(smsService.send(hydratedTemplate, organisationId, recipient)).rejects.toThrow(
        'SMS settings are not provided!',
      );
    });
  });
});
