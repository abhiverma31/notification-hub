import { model, Schema } from 'mongoose';

export interface OnDeckConnection {
  _id?: string;
  schema_version?: number;
  source_creation_timestamp: Date;
  recipient_id: string;
  connection_id: string;
}

const OnDeckConnectionSchema = new Schema<OnDeckConnection>(
  {
    schema_version: {
      type: Number,
      required: false,
      default: 1,
    },
    source_creation_timestamp: {
      type: Date,
      required: true,
    },
    recipient_id: {
      type: String,
      required: true,
    },
    connection_id: {
      type: String,
      required: true,
    },
  },
  {
    versionKey: false,
  },
).index({ recipient_id: 1, source_creation_timestamp: -1 });

export const OnDeckConnectionModel = model<OnDeckConnection>('OnDeckConnection', OnDeckConnectionSchema);
