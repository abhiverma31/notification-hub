import 'reflect-metadata';
import { OrganisationService } from '../../../../../src/consumer/services/Organisation';
import { WhatsappService } from '../../../../../src/consumer/services/channels/Whatsapp';
import { TemplateDetails } from '../../../../../src/shared-library/models/Template';
import { WhatsappSettings } from '../../../../../src/shared-library/models/submodels/OrganisationSettings';
import { Recipient } from '../../../../../src/shared-library/types/Dto/Recipient';
import { ChannelType } from '../../../../../src/shared-library/types/Enum/ChannelType';
import { decryptData } from '../../../../../src/server/utils/KeyTools';
import twilio from 'twilio';

jest.mock('axios');
jest.mock('twilio');
jest.mock('../../../../../src/server/utils/KeyTools', () => ({
  decryptData: jest.fn(),
}));

describe('WhatsappService', () => {
  const organisationId = 'test-organisation-id';
  const hydratedTemplate: TemplateDetails = {
    body: 'hello, this is a message from future you!',
  };
  const recipient: Recipient = {
    userId: 'user_id',
    channel: ChannelType.WHATSAPP,
    email: 'random@technogise.com',
    name: { first: 'Random', last: 'Name' },
    phone_number: '+9167676767',
  };
  const whatsappSettings: WhatsappSettings = {
    whatsappNumber: '+911234567890',
    auth: {
      accountSid: 'mockAccountSid',
      authToken: 'mockAuthToken',
    },
  };

  const mockOrganisationService = {
    getProviderSettings: jest.fn(),
  } as unknown as jest.Mocked<OrganisationService>;

  const whatsappService = new WhatsappService(mockOrganisationService);

  mockOrganisationService.getProviderSettings.mockResolvedValue(whatsappSettings);

  (decryptData as jest.Mock).mockImplementation((data) => {
    if (data === 'encryptedAccountSid') return 'decryptedAccountSid';
    if (data === 'encryptedAuthToken') return 'decryptedAuthToken';
    return data;
  });

  const mockTwilioClient = {
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'messageSid' }),
    },
  };
  (twilio as unknown as jest.Mock).mockReturnValue(mockTwilioClient);

  it('should send a Whatsapp message through the provider settings', async () => {
    mockOrganisationService.getProviderSettings.mockResolvedValue(whatsappSettings);
    await whatsappService.send(hydratedTemplate, organisationId, recipient);

    expect(mockOrganisationService.getProviderSettings).toHaveBeenCalledWith(organisationId, ChannelType.WHATSAPP);

    expect(decryptData).toHaveBeenCalledWith(whatsappSettings.auth.accountSid);
    expect(decryptData).toHaveBeenCalledWith(whatsappSettings.auth.authToken);

    expect(twilio).toHaveBeenCalledWith('mockAccountSid', 'mockAuthToken');
    expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
      body: hydratedTemplate.body,
      from: `whatsapp:${whatsappSettings.whatsappNumber}`,
      to: `whatsapp:${recipient.phone_number}`,
    });
  });

  it('should include statusCallback URL when messageId is provided', async () => {
    mockOrganisationService.getProviderSettings.mockResolvedValue(whatsappSettings);
    process.env.SERVER_URL = 'https://api.test.easynotify.ai';

    await whatsappService.send(hydratedTemplate, organisationId, recipient, 'txn-abc-123');

    expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
      body: hydratedTemplate.body,
      from: `whatsapp:${whatsappSettings.whatsappNumber}`,
      to: `whatsapp:${recipient.phone_number}`,
      statusCallback: 'https://api.test.easynotify.ai/api/webhooks/twilio/whatsapp?transactionId=txn-abc-123&organisationId=test-organisation-id',
    });

    delete process.env.SERVER_URL;
  });

  it('should throw an error when SERVER_URL is not set', async () => {
    mockOrganisationService.getProviderSettings.mockResolvedValue(whatsappSettings);
    delete process.env.SERVER_URL;

    await expect(whatsappService.send(hydratedTemplate, organisationId, recipient, 'txn-xyz')).rejects.toThrow(
      'SERVER_URL environment variable is not configured',
    );
  });

  it('should throw an error if Whatsapp settings are not provided', async () => {
    mockOrganisationService.getProviderSettings.mockResolvedValue(undefined);
    await expect(whatsappService.send(hydratedTemplate, organisationId, recipient)).rejects.toThrow(
      'Whatsapp settings are not provided!',
    );
  });
});
