import { injectable, inject } from 'tsyringe';
import { OrganisationService } from './Organisation';
import { decryptData } from '../utils/KeyTools';
import { BadRequest } from '../utils/errors/BadRequest';
import { ServerLogger } from '../utils/ServerLogger';

@injectable()
export class EmailTestService {
  private readonly logger = new ServerLogger();

  constructor(@inject(OrganisationService) private organisationService: OrganisationService) {}

  public async sendTestEmail(orgId: string, email: string): Promise<{ message: string }> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequest('Invalid email format');
    }

    const orgDetails = await this.organisationService.getOrganisationById(orgId);

    if (!orgDetails?.settings?.email || orgDetails.settings.email.length === 0) {
      throw new BadRequest('No email provider configured');
    }

    const enabledProvider = orgDetails.settings.email.find((p) => p.enabled);
    if (!enabledProvider) {
      throw new BadRequest('No email provider is enabled');
    }

    // Send test email directly through SendGrid SDK to catch validation errors
    const sgMail = (await import('@sendgrid/mail')).default;
    const sendGridSettings = enabledProvider.settings as any;

    if (!sendGridSettings?.apiKey) {
      throw new BadRequest('SendGrid API key is not configured');
    }

    const apiKey = decryptData(sendGridSettings.apiKey);
    sgMail.setApiKey(apiKey);

    const msg = {
      to: email,
      from: {
        email: sendGridSettings.fromEmail,
        name: sendGridSettings.fromName || sendGridSettings.fromEmail,
      },
      subject: '🔔 Test Email from Notification Hub',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2196F3;">🔔 Email Integration Test</h2>
            <p>This is a test email from your <strong>${this.escapeHtml(enabledProvider.provider)}</strong> integration.</p>
            <p><strong>If you received this email, your integration is working correctly!</strong></p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              Provider: ${this.escapeHtml(enabledProvider.provider)}<br>
              Organization: ${this.escapeHtml(orgDetails.name)}
            </p>
          </body>
        </html>
      `,
    };

    try {
      await sgMail.send(msg);

      return {
        message: `Test email queued successfully. If you receive the email at ${email}, your ${enabledProvider.provider} integration is working correctly.`,
      };
    } catch (error: any) {
      // Log the actual error server-side for debugging
      this.logger.error('Failed to send test email', {
        orgId,
        email,
        error: error.message,
        stack: error.stack,
        response: error.response?.body,
      });

      // Return sanitized error messages to client
      if (
        error.message?.includes('does not contain a valid address') ||
        error.message?.includes('Sender address rejected')
      ) {
        throw new BadRequest(
          'Sender email address is not verified. Please verify the sender email in your email provider account.',
        );
      } else if (error.message?.includes('API key') || error.message?.includes('Unauthorized')) {
        throw new BadRequest('Email provider authentication failed. Please check your configuration.');
      } else {
        // Generic error message - don't leak internal details
        throw new BadRequest('Failed to send test email. Please check your email provider configuration.');
      }
    }
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}
