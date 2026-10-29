import { UrgencyLevel, EmailLength, SalesIntensity } from '../Enum/AITemplateEnum';

export interface AITemplateBase {
  templateName: string;
  purpose: string;
  additionalInstructions?: string;
}

export interface AIEmailTemplateDto extends AITemplateBase {
  marketing?: string;
  urgency?: UrgencyLevel;
  emailLength?: EmailLength;
  salesIntensity?: SalesIntensity;
}
export interface AIOnDeckTemplateDto extends AITemplateBase {
  actionUrl?: string;
}

export interface AIPushTemplateDto extends AITemplateBase {}

export interface AISlackTemplateDto extends AITemplateBase {
  audience?: string;
  mentions?: string;
  urgency?: UrgencyLevel;
}

export interface AITeamsTemplateDto extends AITemplateBase {
  audience?: string;
  mentions?: string;
  urgency?: string;
}
