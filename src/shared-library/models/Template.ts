import { model, Schema } from 'mongoose';
import { ChannelType } from '../types/Enum/ChannelType';

export interface TemplateDetails {
  [key: string]: string | object;
}

export interface EmailTemplateDetails extends TemplateDetails {
  subject: string;
  body: string;
  json: object;
}

export interface PushTemplateDetails extends Partial<TemplateDetails> {
  title: string;
  body: string;
  offerUrl?: string;
  icon?: string;
  importance?: string;
  sound?: string;
  tag?: string;
  channelId?: string;
  ttl?: string;
  apnsPriority?: string;
}

export interface onDeckTemplateDetails extends TemplateDetails {
  title: string;
  content: string;
  actionUrl: string;
}

export interface SlackTemplateDetails extends TemplateDetails {
  text: string;
  html: string;
}

export interface TeamsTemplateDetails extends TemplateDetails {
  title: string;
  content: string;
}

export interface SmsTemplateDetails extends TemplateDetails {
  body: string;
}

export interface TelegramTemplateDetails extends TemplateDetails {
  text: string;
  parseMode: string;
}

export interface TemplateInterface {
  _id?: string;
  schema_version?: number;
  name: string;
  channelType: ChannelType;
  organisationId: string;
  created_at?: Date;
  updated_at?: Date;
  templateDetails:
    | EmailTemplateDetails
    | PushTemplateDetails
    | onDeckTemplateDetails
    | SlackTemplateDetails
    | TeamsTemplateDetails
    | SmsTemplateDetails
    | TelegramTemplateDetails;
}

export interface TemplateQuery {
  organisationId: string;
  channelType?: ChannelType;
  name?: RegExp;
}

const TemplateSchema = new Schema<TemplateInterface>(
  {
    schema_version: {
      type: Number,
      required: false,
      default: 1,
    },
    name: {
      type: String,
      required: true,
    },
    channelType: {
      type: String,
      enum: Object.values(ChannelType),
      required: true,
    },
    organisationId: {
      type: String,
      required: true,
    },
    templateDetails: {
      type: Schema.Types.Mixed,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  },
).index({ organisationId: 1, channelType: 1, name: 1 }, { unique: true });

export const TemplateModel = model<TemplateInterface>('Template', TemplateSchema);
