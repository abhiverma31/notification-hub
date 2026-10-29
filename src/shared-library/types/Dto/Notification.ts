import { ChannelType } from '../Enum/ChannelType';
import { UserName } from '../../models/User';
import { PushProviders } from '../../../server/types/Enum/PushProviders';

export interface ChannelDTO {
  email: TemplateIdDTO;
  push: TemplateIdDTO;
  onDeck: TemplateIdDTO;
}

export interface TemplateIdDTO {
  templateId: string;
}

export interface UserData {
  email: string;
  name?: UserName;
  fcmToken?: string[];
  phone_number?: string;
  telegramChatId?: string;
}

export interface UserDto extends UserData {
  channels: ChannelType[];
}

export interface UserQueueDto extends UserData {
  userId: string;
  channel: ChannelType;
  pushProviders?: PushProviders[];
  pusherChannel?: string[];
  pusherEvent?: string;
  beamsInterest?: string[];
}
