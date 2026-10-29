import { model, Schema } from 'mongoose';

export interface UserName {
  first: string;
  last?: string | undefined;
}

export interface UserExcludeChannelPreferences {
  sms: boolean;
  whatsapp: boolean;
  email: boolean;
  onDeck: boolean;
  push: boolean;
}

export interface FcmDeviceToken {
  token: string;
  created_at?: Date;
}

export abstract class UserId {
  private static readonly idSeparator = '::';

  static build(organisationId: string, emailId: string): string {
    return `${organisationId}${UserId.idSeparator}${emailId}`;
  }

  static extractEmailId(id: string): string {
    return id.split(UserId.idSeparator)[1];
  }

  static extractOrganisationId(id: string): string {
    return id.split(UserId.idSeparator)[0];
  }
}

export interface UserInterface {
  _id: string;
  user_id: string;
  external_user_id?: string;
  schema_version?: number;
  email: string;
  name?: UserName;
  phone_number?: string;
  fcm_device_tokens?: FcmDeviceToken[];
  telegram_chat_id?: string;
  exclude_channels?: UserExcludeChannelPreferences;
  created_at?: Date;
  updated_at?: Date;
  last_notified_at?: Date | undefined;
  last_updated_by?: 'migration' | 'notification-engine' | 'organisation';
}

export const UserNameSchema = new Schema<UserName>(
  {
    first: {
      type: String,
      required: true,
    },
    last: {
      type: String,
      required: false,
    },
  },
  { _id: false },
);

const UserNotificationPreferencesSchema = new Schema<UserExcludeChannelPreferences>(
  {
    sms: {
      type: Boolean,
      default: false,
    },
    whatsapp: {
      type: Boolean,
      default: false,
    },
    email: {
      type: Boolean,
      default: false,
    },
    onDeck: {
      type: Boolean,
      default: false,
    },
    push: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const FcmDeviceTokenSchema = new Schema<FcmDeviceToken>(
  {
    token: {
      type: String,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

export const UserSchema = new Schema<UserInterface>(
  {
    _id: String,
    user_id: String,
    external_user_id: {
      type: String,
      required: false,
    },
    schema_version: {
      type: Number,
      required: false,
      default: 1,
    },
    email: {
      type: String,
      required: true,
    },
    name: {
      type: UserNameSchema,
      required: false,
    },
    phone_number: {
      type: String,
      required: false,
    },
    telegram_chat_id: {
      type: String,
      required: false,
    },
    fcm_device_tokens: {
      type: [FcmDeviceTokenSchema],
      required: false,
      default: [],
    },
    exclude_channels: {
      type: UserNotificationPreferencesSchema,
      required: false,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    last_notified_at: {
      type: Date,
      required: false,
    },
    last_updated_by: {
      type: String,
      required: true,
      default: 'notification-engine',
      enum: ['migration', 'notification-engine', 'organisation'],
    },
  },
  {
    versionKey: false,
  },
);

export const UserModel = model<UserInterface>('User', UserSchema);
