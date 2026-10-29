import { injectable } from 'tsyringe';
import axios from 'axios';
import { GupshupSmsSettings } from '../../../shared-library/models/submodels/OrganisationSettings';
import { ConsumerLogger } from '../../utils/ConsumerLogger';

const GUPSHUP_API_URL = process.env.GUPSHUP_API_URL || 'https://enterprise.smsgupshup.com/GatewayAPI/rest';

@injectable()
export class GupshupSmsService {
  private readonly logger = new ConsumerLogger();

  public async send(message: string, recipientNumber: string, settings: GupshupSmsSettings): Promise<void> {
    this.logger.traceStart({ recipientNumber }, 'Sending SMS via Gupshup');

    if (process.env.GUPSHUP_SMS_ENABLED === 'false') {
      this.logger.info('Gupshup SMS disabled, skipping send', { recipientNumber, message });

      return;
    }

    const params = new URLSearchParams({
      userid: settings.userid,
      password: settings.password,
      send_to: recipientNumber,
      msg: message,
      method: 'SendMessage',
      msg_type: 'text',
      format: 'text',
      auth_scheme: 'plain',
      v: '1.1',
      send_from: settings.mask,
      ...(settings.principalEntityId && { principalEntityId: settings.principalEntityId }),
      ...(settings.dltTemplateId && { dltTemplateId: settings.dltTemplateId }),
    });

    const response = await axios.post(GUPSHUP_API_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const responseData = response.data;

    if (typeof responseData === 'string' && responseData.startsWith('error')) {
      throw new Error(`Gupshup SMS failed: ${responseData}`);
    }

    this.logger.traceEnd({ recipientNumber }, 'SMS sent via Gupshup', responseData);
  }
}
