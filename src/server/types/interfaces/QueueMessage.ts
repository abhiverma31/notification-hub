import { UserQueueDto } from '../../../shared-library/types/Dto/Notification';
import { ChannelTemplateInterface, Data } from './TemplateInterfaceTypes';

export interface QueueMessage {
  recipients: UserQueueDto[];
  data: Data;
  channels: ChannelTemplateInterface;
  organisationId: string;
}

export interface QueueMessageRequest {
  Id: string;
  MessageBody: string;
  MessageGroupId: string;
  MessageDeduplicationId: string;
}
