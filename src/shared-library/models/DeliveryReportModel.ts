import { model, Schema } from 'mongoose';
import { DeliveryReportStatus } from '../types/DeliveryReportStatus';
import { ChannelType } from '../types/Enum/ChannelType';

/**
 * @example
 * {
 *    "_id": "66951b8ed05eb9f47ef8c58d",
 *    "transactionId": "2ffc94b0-a2aa-4cb8-ad19-de3b1b0d7823",
 *    "user_id": "07dd9137-4e8c-4e9c-a746-d63588a16a71",
 *    "organisation_id": "org-123",
 *    "status": "sent",
 *    "channel": "onDeck",
 *    "createdAt": "2024-07-15T12:52:30.341Z"
 * }
 */
export interface DeliveryReportInterface {
  _id?: string;
  user_id: string | null;
  organisation_id?: string | null;
  schema_version?: number;
  transactionId: string;
  status: DeliveryReportStatus;
  channel: ChannelType;
  error?: object;
  createdAt?: Date;
}

const DeliveryReportSchema = new Schema<DeliveryReportInterface>(
  {
    schema_version: {
      type: Number,
      required: false,
      default: 1,
    },
    transactionId: {
      type: String,
      required: true,
      index: 1,
    },
    user_id: {
      type: String,
      required: true,
    },
    organisation_id: {
      type: String,
      required: false,
      index: 1,
    },
    status: {
      type: String,
      enum: Object.values(DeliveryReportStatus),
      required: true,
    },
    channel: {
      type: String,
      enum: Object.values(ChannelType),
      required: true,
    },
    error: {
      type: Object,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: '180d',
    },
  },
  {
    versionKey: false,
  },
);

DeliveryReportSchema.index({ organisation_id: 1, createdAt: -1, status: 1, channel: 1 });

export const DeliveryReportModel = model<DeliveryReportInterface>('DeliveryReport', DeliveryReportSchema);
