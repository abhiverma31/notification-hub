import 'reflect-metadata';
import { EmailService } from '../../../../../src/consumer/services/channels/Email';
import { OrganisationService } from '../../../../../src/consumer/services/Organisation';
import { SendGridService } from '../../../../../src/consumer/services/channels/SendGrid';
import { OrganisationRepository } from '../../../../../src/shared-library/repositories/Organisation';
import { TemplateDetails } from '../../../../../src/shared-library/models/Template';
import { Recipient } from '../../../../../src/shared-library/types/Dto/Recipient';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');
jest.mock('../../../../../src/server/utils/KeyTools', () => ({
  decryptData: jest.fn((val) => `decrypted_${val}`),
}));

describe('EmailService', () => {
  let emailService: EmailService;
  let mockOrgService: jest.Mocked<OrganisationService>;
  let mockSendGridService: jest.Mocked<SendGridService>;
  let mockOrgRepo: jest.Mocked<OrganisationRepository>;
  let mockSendMail: jest.Mock;

  const mockTemplate = { subject: 'Hello', body: '<p>World</p>' } as TemplateDetails;
  const mockRecipient = { email: 'user@test.com' } as Recipient;
  const orgId = 'org-123';

  beforeEach(() => {
    mockOrgService = { getProviderSettings: jest.fn() } as any;
    mockSendGridService = { send: jest.fn() } as any;
    mockOrgRepo = { findByID: jest.fn() } as any;
    mockSendMail = jest.fn().mockResolvedValue({});
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: mockSendMail });
    emailService = new EmailService(mockOrgService, mockSendGridService, mockOrgRepo);
  });

  it('should route to SendGrid when SENDGRID provider is enabled', async () => {
    mockOrgRepo.findByID.mockResolvedValue({
      settings: { email: [{ provider: 'SENDGRID', enabled: true, settings: {} }] },
    } as any);

    await emailService.send(mockTemplate, orgId, mockRecipient);

    expect(mockSendGridService.send).toHaveBeenCalled();
  });

  it('should route to Nodemailer when GMAIL provider is enabled', async () => {
    mockOrgRepo.findByID.mockResolvedValue({
      settings: {
        email: [{
          provider: 'GMAIL', enabled: true,
          settings: { host: 'smtp.gmail.com', port: 587, auth: { user: 'u', pass: 'p' } },
        }],
      },
    } as any);

    await emailService.send(mockTemplate, orgId, mockRecipient);

    expect(nodemailer.createTransport).toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalled();
  });

  it('should throw when no email provider is enabled', async () => {
    mockOrgRepo.findByID.mockResolvedValue({
      settings: { email: [{ provider: 'SENDGRID', enabled: false, settings: {} }] },
    } as any);

    await expect(emailService.send(mockTemplate, orgId, mockRecipient))
      .rejects.toThrow('No email provider is enabled');
  });

  it('should throw for unsupported provider', async () => {
    mockOrgRepo.findByID.mockResolvedValue({
      settings: { email: [{ provider: 'UNKNOWN', enabled: true, settings: {} }] },
    } as any);

    await expect(emailService.send(mockTemplate, orgId, mockRecipient))
      .rejects.toThrow('Unsupported email provider: UNKNOWN');
  });

  it('should fall back to legacy getProviderSettings when no email array exists', async () => {
    mockOrgRepo.findByID.mockResolvedValue({ settings: {} } as any);
    mockOrgService.getProviderSettings.mockResolvedValue({
      host: 'smtp.test.com', port: 587, auth: { user: 'u', pass: 'p' },
    } as any);

    await emailService.send(mockTemplate, orgId, mockRecipient);

    expect(mockOrgService.getProviderSettings).toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalled();
  });

  it('should throw when legacy email settings are not provided', async () => {
    mockOrgRepo.findByID.mockResolvedValue({ settings: {} } as any);
    mockOrgService.getProviderSettings.mockResolvedValue(null as any);

    await expect(emailService.send(mockTemplate, orgId, mockRecipient))
      .rejects.toThrow('Email settings are not provided!');
  });
});
