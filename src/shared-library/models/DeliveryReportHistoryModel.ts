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
export interface DeliveryReportHistoryInterface {
  _id?: string;
  schema_version?: number;
  transactionId: string;
  user_id: string | null;
  organisation_id?: string | null;
  status: DeliveryReportStatus;
  channel: ChannelType;
  error?: object;
  source?: string;
  createdAt?: Date;
}

const DeliveryReportHistorySchema = new Schema<DeliveryReportHistoryInterface>(
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
    source: {
      type: String,
      required: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expires: '240d' }, // 8 months (240 days) TTL - safety net after archival
    },
  },
  {
    versionKey: false,
  },
)
  .index({ transactionId: 1, createdAt: 1 })
  .index({ organisation_id: 1, createdAt: -1, status: 1, channel: 1 })
  .index({ createdAt: 1, _id: 1 }); // For efficient archival queries

export const DeliveryReportHistoryModel = model<DeliveryReportHistoryInterface>(
  'DeliveryReportHistory',
  DeliveryReportHistorySchema,
);
