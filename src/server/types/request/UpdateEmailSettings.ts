import { EmailProvider } from '../../../shared-library/models/submodels/OrganisationSettings';

/**
 * @example
  {
    "provider": "nodemailer",
    "enabled": true,
    "settings": {
      "auth": {
        "user": "string",
        "pass": "string"
      },
      "service": "GMAIL",
      "port": 587,
      "host": "smtp.gmail.com",
      "secure": true
    }
  }
 */
export interface UpdateEmailSettingsRequest {
  emailSettings: EmailProvider[];
}
