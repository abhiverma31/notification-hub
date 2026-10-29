import { Request, Response, NextFunction } from 'express';
import twilio from 'twilio';
import { container } from 'tsyringe';
import { OrganisationService } from '../../consumer/services/Organisation';
import { ChannelType } from '../../shared-library/types/Enum/ChannelType';
import { decryptData } from '../utils/KeyTools';
import { SmsSettings, WhatsappSettings } from '../../shared-library/models/submodels/OrganisationSettings';
import { logger } from '../utils/ServerLogger';

type TwilioChannelSettings = WhatsappSettings | SmsSettings;

export function twilioWebhookAuthFor(channel: ChannelType) {
  return async function twilioWebhookAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const organisationId = req.query.organisationId as string;
    const twilioSignature = req.headers['x-twilio-signature'] as string;

    if (!organisationId || !twilioSignature) {
      res.status(401).json({ message: 'Unauthorized' });

      return;
    }

    try {
      const orgService = container.resolve(OrganisationService);
      const settings = (await orgService.getProviderSettings(organisationId, channel)) as TwilioChannelSettings;

      if (!settings) {
        res.status(401).json({ message: 'Unauthorized' });

        return;
      }

      const authToken = decryptData(settings.auth.authToken);
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('x-forwarded-host') || req.get('host');
      const url = `${protocol}://${host}${req.originalUrl}`;
      const isValid = twilio.validateRequest(authToken, twilioSignature, url, req.body);

      if (!isValid) {
        logger.info('Twilio webhook signature validation failed', { organisationId, channel });
        res.status(403).json({ message: 'Forbidden' });

        return;
      }

      next();
    } catch (error) {
      logger.error('Twilio webhook auth error', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
}

// Convenience exports for direct use
export const twilioWebhookAuth = twilioWebhookAuthFor(ChannelType.WHATSAPP);
export const twilioSmsWebhookAuth = twilioWebhookAuthFor(ChannelType.SMS);
