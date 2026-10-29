import { model, Schema } from 'mongoose';
import { OrganisationSettingsInterface } from './submodels/OrganisationSettings';

/**
 * @example
 * {
 *   "id": "6694f5677d0b7b78b8e87233"
 * }
 */

export interface OrganisationInterface {
  _id?: string;
  schema_version?: number;
  name: string;
  api_key: string;
  api_secret_hash: string;
  x_org_key?: string;
  is_archived?: boolean;
  archived_at?: Date;
  settings?: OrganisationSettingsInterface;
}

const OrganisationSchema = new Schema<OrganisationInterface>(
  {
    schema_version: {
      type: Number,
      required: false,
      default: 1,
    },
    name: {
      type: String,
      required: true,
      unique: true,
    },
    api_key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    api_secret_hash: {
      type: String,
      required: true,
    },
    x_org_key: {
      type: String,
      required: false,
    },
    is_archived: {
      type: Boolean,
      default: false,
    },
    archived_at: {
      type: Date,
    },
    settings: {
      email: [],
      push: [],
      slack: [],
      sms: [],
      whatsapp: [],
      teams: [],
      telegram: [],
    },
  },
  {
    versionKey: false,
  },
);

export const OrganisationModel = model<OrganisationInterface>('Organisation', OrganisationSchema);
