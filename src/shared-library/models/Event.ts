import { model, Schema } from 'mongoose';

export interface EventInterface {
  _id?: string;
  schema_version?: number;
  name: string;
  organisationId: string;
  templateIds: string[];
  created_at?: Date;
  updated_at?: Date;
  lastUsedAt?: Date;
}

export interface EventQuery {
  organisationId: string;
  name?: RegExp;
}

const EventSchema = new Schema<EventInterface>(
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
    organisationId: {
      type: String,
      required: true,
    },
    templateIds: {
      type: [String],
      required: true,
      default: [],
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    lastUsedAt: {
      type: Date,
      default: null,
      required: false,
    },
  },
  {
    versionKey: false,
  },
).index({ organisationId: 1, name: 1 }, { unique: true });

export const EventModel = model<EventInterface>('Event', EventSchema);
