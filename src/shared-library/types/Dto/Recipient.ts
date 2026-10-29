import { ChannelType } from '../Enum/ChannelType';
import { UserName } from '../../models/User';
import { PushProviders } from '../../../server/types/Enum/PushProviders';

export interface Recipient {
  userId: string;
  email: string;
  name?: UserName;
  fcmToken?: string[];
  channel: ChannelType;
  phone_number?: string;
  telegramChatId?: string;
  pushProviders?: PushProviders[];
  pusherChannel?: string[];
  pusherEvent?: string;
  beamsInterest?: string[];
}
