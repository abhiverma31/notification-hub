import {
  EmailTemplateDetails,
  PushTemplateDetails,
  SlackTemplateDetails,
  SmsTemplateDetails,
  TeamsTemplateDetails,
  TelegramTemplateDetails,
  onDeckTemplateDetails,
} from '../../../shared-library/models/Template';
import { ChannelType } from '../../../shared-library/types/Enum/ChannelType';

/**
 * @example
 * {
 *  "name": "Email Template with placeholder",
 *  "channelType": "EMAIL",
 *  "templateDetails": {
 *  "subject": "Hello {{recipient.name.first}}",
 *  "body": "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Promotional Email</title></head><body style='font-family: Arial, sans-serif;'><table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%'><tr><td style='padding: 20px 0; text-align: center;'><h1>Special Offer!</h1></td></tr><tr><td><p>Hello {{recipient.name.first}},</p><p>We're excited to share a special offer with you!</p><p>Click the link below to claim your offer:</p><p><a href='{{data.offerUrl}}'>Claim Your Offer</a></p><p>Thank you for choosing us!</p></td></tr></table></body></html>",
 *  "json": {}
 * }
 * }
 */
export interface CreateTemplateRequest {
  name: string;
  channelType: ChannelType;
  templateDetails:
    | onDeckTemplateDetails
    | EmailTemplateDetails
    | PushTemplateDetails
    | SlackTemplateDetails
    | TeamsTemplateDetails
    | SmsTemplateDetails
    | TelegramTemplateDetails;
}
