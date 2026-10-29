import 'reflect-metadata';

const mockSend = jest.fn();
const mockSetApiKey = jest.fn();

// Mock before any other imports
jest.mock('@sendgrid/mail', () => ({
  __esModule: true,
  default: {
    setApiKey: mockSetApiKey,
    send: mockSend,
  },
}));

jest.mock('../../../../src/server/utils/KeyTools', () => ({
  decryptData: jest.fn((data) => `decrypted_${data}`),
}));

import { EmailTestService } from '../../../../src/server/services/EmailTestService';
import { OrganisationService } from '../../../../src/server/services/Organisation';
import { BadRequest } from '../../../../src/server/utils/errors/BadRequest';
import { getError } from '../../../common/errors/NoErrorThrown';

describe('EmailTestService', () => {
  let emailTestService: EmailTestService;
  let mockOrganisationService: jest.Mocked<OrganisationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrganisationService = {
      getOrganisationById: jest.fn(),
    } as any;

    emailTestService = new EmailTestService(mockOrganisationService);
  });

  describe('sendTestEmail - validation logic', () => {
    const validEmail = 'test@example.com';
    const orgId = 'org-123';

    it('should send test email successfully', async () => {
      mockOrganisationService.getOrganisationById.mockResolvedValue({
        _id: orgId,
        name: 'Test Org',
        settings: {
          email: [
            {
              provider: 'SendGrid',
              enabled: true,
              settings: {
                apiKey: 'encrypted_key',
                fromEmail: 'sender@example.com',
                fromName: 'Test Sender',
              },
            },
          ],
        },
      } as any);

      mockSend.mockResolvedValue([{ statusCode: 202 }]);

      const result = await emailTestService.sendTestEmail(orgId, validEmail);

      expect(result.message).toContain('Test email queued successfully');
      expect(mockSetApiKey).toHaveBeenCalledWith('decrypted_encrypted_key');
      expect(mockSend).toHaveBeenCalled();
    });

    it('should reject invalid email format', async () => {
      const error = await getError(async () => emailTestService.sendTestEmail(orgId, 'invalid-email'));

      expect(error).toBeInstanceOf(BadRequest);
      expect(error.message).toBe('Invalid email format');
    });

    it('should throw when no email provider configured', async () => {
      mockOrganisationService.getOrganisationById.mockResolvedValue({
        _id: orgId,
        name: 'Test Org',
        settings: {},
      } as any);

      const error = await getError(async () => emailTestService.sendTestEmail(orgId, validEmail));

      expect(error).toBeInstanceOf(BadRequest);
      expect(error.message).toBe('No email provider configured');
    });

    it('should throw when no enabled provider', async () => {
      mockOrganisationService.getOrganisationById.mockResolvedValue({
        _id: orgId,
        name: 'Test Org',
        settings: {
          email: [{ provider: 'SendGrid', enabled: false, settings: {} }],
        },
      } as any);

      const error = await getError(async () => emailTestService.sendTestEmail(orgId, validEmail));

      expect(error).toBeInstanceOf(BadRequest);
      expect(error.message).toBe('No email provider is enabled');
    });

    it('should throw when API key is missing', async () => {
      mockOrganisationService.getOrganisationById.mockResolvedValue({
        _id: orgId,
        name: 'Test Org',
        settings: {
          email: [
            {
              provider: 'SendGrid',
              enabled: true,
              settings: { fromEmail: 'test@test.com' },
            },
          ],
        },
      } as any);

      const error = await getError(async () => emailTestService.sendTestEmail(orgId, validEmail));

      expect(error).toBeInstanceOf(BadRequest);
      expect(error.message).toBe('SendGrid API key is not configured');
    });

    it('should sanitize SendGrid error messages', async () => {
      mockOrganisationService.getOrganisationById.mockResolvedValue({
        _id: orgId,
        name: 'Test Org',
        settings: {
          email: [
            {
              provider: 'SendGrid',
              enabled: true,
              settings: { apiKey: 'key', fromEmail: 'unverified@test.com', fromName: 'Test' },
            },
          ],
        },
      } as any);

      mockSend.mockRejectedValue({
        message: 'Sender address rejected: does not contain a valid address',
      });

      const error = await getError(async () => emailTestService.sendTestEmail(orgId, validEmail));

      expect(error).toBeInstanceOf(BadRequest);
      expect(error.message).toContain('Sender email address is not verified');
    });
  });
});
