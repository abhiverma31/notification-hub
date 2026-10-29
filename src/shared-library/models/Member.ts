import { Schema, model } from 'mongoose';
import { UserName, UserNameSchema } from './User';

export interface MemberInterface {
  _id: string;
  schema_version?: number;
  email: string;
  organisation_id?: string[];
  name?: UserName;
}

export interface AddMemberInterface {
  _id: string;
  email: string;
  name: UserName;
}

export const MemberSchema = new Schema<MemberInterface>(
  {
    _id: String,

    schema_version: {
      type: Number,
      required: false,
      default: 1,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    organisation_id: {
      type: [String],
      required: true,
    },
    name: {
      type: UserNameSchema,
      required: false,
    },
  },
  {
    versionKey: false,
  },
);

export const MemberModel = model<MemberInterface>('Member', MemberSchema);
