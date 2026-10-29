import { SendGridService } from '../../../src/consumer/services/channels/SendGrid';
import { OrganisationService } from '../../../src/consumer/services/Organisation';
import { TemplateDetails } from '../../../src/shared-library/models/Template';
import { Recipient } from '../../../src/shared-library/types/Dto/Recipient';
import sgMail from '@sendgrid/mail';
import { decryptData } from '../../../src/server/utils/KeyTools';

jest.mock('@sendgrid/mail');
jest.mock('../../../src/server/utils/KeyTools');

describe('SendGridService', () => {
  let sendGridService: SendGridService;
  let mockOrganisationService: jest.Mocked<OrganisationService>;

  beforeEach(() => {
    mockOrganisationService = {
      getProviderSettings: jest.fn(),
    } as any;

    sendGridService = new SendGridService(mockOrganisationService);
    jest.clearAllMocks();
  });

  const mockTemplate: TemplateDetails = {
    subject: 'Test Subject',
    body: '<p>Test Body</p>',
  } as TemplateDetails;

  const mockRecipient: Recipient = {
    email: 'test@example.com',
  } as Recipient;

  describe('send', () => {
    it('should send email via SendGrid successfully', async () => {
      const mockSettings = {
        apiKey: 'encrypted_api_key',
        fromEmail: 'sender@example.com',
        fromName: 'Test Sender',
      };

      mockOrganisationService.getProviderSettings.mockResolvedValue(mockSettings);
      (decryptData as jest.Mock).mockReturnValue('decrypted_api_key');
      (sgMail.send as jest.Mock).mockResolvedValue([{ statusCode: 202 }]);

      await sendGridService.send(mockTemplate, 'org123', mockRecipient);

      expect(sgMail.setApiKey).toHaveBeenCalledWith('decrypted_api_key');
      expect(sgMail.send).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: {
          email: 'sender@example.com',
          name: 'Test Sender',
        },
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
        customArgs: { transactionId: '' },
      });
    });

    it('should use fromEmail as name when fromName is not provided', async () => {
      const mockSettings = {
        apiKey: 'encrypted_api_key',
        fromEmail: 'sender@example.com',
      };

      mockOrganisationService.getProviderSettings.mockResolvedValue(mockSettings);
      (decryptData as jest.Mock).mockReturnValue('decrypted_api_key');
      (sgMail.send as jest.Mock).mockResolvedValue([{ statusCode: 202 }]);

      await sendGridService.send(mockTemplate, 'org123', mockRecipient);

      expect(sgMail.send).toHaveBeenCalledWith({
        to: 'test@example.com',
        from: {
          email: 'sender@example.com',
          name: 'sender@example.com',
        },
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
        customArgs: { transactionId: '' },
      });
    });

    it('should include transactionId in customArgs when provided', async () => {
      const mockSettings = {
        apiKey: 'encrypted_api_key',
        fromEmail: 'sender@example.com',
        fromName: 'Test Sender',
      };

      mockOrganisationService.getProviderSettings.mockResolvedValue(mockSettings);
      (decryptData as jest.Mock).mockReturnValue('decrypted_api_key');
      (sgMail.send as jest.Mock).mockResolvedValue([{ statusCode: 202 }]);

      await sendGridService.send(mockTemplate, 'org123', mockRecipient, 'txn-abc-123');

      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({ customArgs: { transactionId: 'txn-abc-123' } }),
      );
    });

    it('should throw error when API key is not configured', async () => {
      mockOrganisationService.getProviderSettings.mockResolvedValue({});

      await expect(sendGridService.send(mockTemplate, 'org123', mockRecipient)).rejects.toThrow(
        'SendGrid API key is not configured',
      );
    });

    it('should retry on failure and succeed', async () => {
      const mockSettings = {
        apiKey: 'encrypted_api_key',
        fromEmail: 'sender@example.com',
      };

      mockOrganisationService.getProviderSettings.mockResolvedValue(mockSettings);
      (decryptData as jest.Mock).mockReturnValue('decrypted_api_key');
      (sgMail.send as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([{ statusCode: 202 }]);

      await sendGridService.send(mockTemplate, 'org123', mockRecipient);

      expect(sgMail.send).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const mockSettings = {
        apiKey: 'encrypted_api_key',
        fromEmail: 'sender@example.com',
      };

      mockOrganisationService.getProviderSettings.mockResolvedValue(mockSettings);
      (decryptData as jest.Mock).mockReturnValue('decrypted_api_key');
      (sgMail.send as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(sendGridService.send(mockTemplate, 'org123', mockRecipient)).rejects.toThrow(
        'SendGrid send failed after 2 attempts',
      );

      expect(sgMail.send).toHaveBeenCalledTimes(2);
    });
  });
});
