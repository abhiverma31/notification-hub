import {
  EmailTemplateDetails,
  PushTemplateDetails,
  SlackTemplateDetails,
  SmsTemplateDetails,
  TeamsTemplateDetails,
  TelegramTemplateDetails,
  TemplateDetails,
  onDeckTemplateDetails,
} from '../../shared-library/models/Template';
import { ChannelType } from '../../shared-library/types/Enum/ChannelType';
import { BadRequest } from './errors/BadRequest';

export const validateTemplateDetails = (
  channel: ChannelType,
  templateDetails:
    | SlackTemplateDetails
    | onDeckTemplateDetails
    | PushTemplateDetails
    | EmailTemplateDetails
    | TeamsTemplateDetails
    | SmsTemplateDetails
    | TelegramTemplateDetails,
) => {
  switch (channel) {
    case ChannelType.EMAIL:
      if (isEmailTemplateDetails(templateDetails as EmailTemplateDetails)) return true;
      break;
    case ChannelType.PUSH:
      if (isPushTemplateDetails(templateDetails as PushTemplateDetails)) return true;
      break;
    case ChannelType.ONDECK:
      if (isonDeckTemplateDetails(templateDetails as onDeckTemplateDetails)) return true;
      break;
    case ChannelType.SLACK:
      if (isSlackTemplateDetails(templateDetails as SlackTemplateDetails)) return true;
      break;
    case ChannelType.TEAMS:
      if (isTeamsTemplateDetails(templateDetails as TeamsTemplateDetails)) return true;
      break;
    case ChannelType.SMS:
      if (isSmsTemplateDetails(templateDetails as SmsTemplateDetails)) return true;
      break;
    case ChannelType.TELEGRAM:
      if (isTelegramTemplateDetails(templateDetails as TelegramTemplateDetails)) return true;
      break;
    default:
      throw new BadRequest('Invalid channel type');
  }
  throw new BadRequest('Invalid template details for the specified channel');
};

function isTelegramTemplateDetails(details: TelegramTemplateDetails): details is TelegramTemplateDetails {
  return 'text' in details;
}

function isTeamsTemplateDetails(details: TeamsTemplateDetails): details is TeamsTemplateDetails {
  return 'title' in details && 'content' in details;
}

const isEmailTemplateDetails = (details: TemplateDetails): details is EmailTemplateDetails => {
  return 'subject' in details && 'body' in details && 'json' in details;
};

const isPushTemplateDetails = (details: any): details is PushTemplateDetails => {
  return 'title' in details && 'body' in details;
};

const isonDeckTemplateDetails = (details: TemplateDetails): details is onDeckTemplateDetails => {
  return 'title' in details && 'content' in details && 'actionUrl' in details;
};

const isSlackTemplateDetails = (details: TemplateDetails): details is SlackTemplateDetails => {
  return 'text' in details && 'html' in details;
};

const isSmsTemplateDetails = (details: TemplateDetails): details is SmsTemplateDetails => {
  return 'body' in details;
};
