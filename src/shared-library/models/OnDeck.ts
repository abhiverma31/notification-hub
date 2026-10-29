import { model, Schema } from 'mongoose';

export interface OnDeckNotification {
  _id?: string;
  schema_version?: number;
  recipient_id: string;
  source_creation_timestamp: Date;

  title: string | undefined;
  content: string;
  actionUrl: string;

  read_at?: Date;
  viewed_at?: Date;
  archived_at?: Date;
}

const OnDeckNotificationSchema = new Schema<OnDeckNotification>(
  {
    schema_version: {
      type: Number,
      required: false,
      default: 1,
    },
    recipient_id: {
      type: String,
      required: true,
    },
    source_creation_timestamp: {
      type: Date,
      required: true,
    },

    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: false,
    },
    actionUrl: {
      type: String,
      required: false,
    },

    read_at: {
      type: Date,
      required: false,
    },
    viewed_at: {
      type: Date,
      required: false,
    },
    archived_at: {
      type: Date,
      required: false,
    },
  },
  {
    versionKey: false,
  },
).index({ recipient_id: 1, source_creation_timestamp: -1, is_archived: -1 });

export const OnDeckNotificationModel = model<OnDeckNotification>('Notification', OnDeckNotificationSchema);
