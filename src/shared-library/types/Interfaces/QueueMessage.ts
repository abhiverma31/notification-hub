import { Recipient } from '../Dto/Recipient';
import { Data, TemplateDetailsInterface } from '../../../consumer/types/Interfaces/Template';
import { ChannelType } from '../Enum/ChannelType';

export interface QueueMessage {
  recipients: Recipient[];
  data: Data;
  channels: Partial<{ [key in ChannelType]: TemplateOptions }>;
  organisationId: string;
}

export interface TemplateOptions {
  templateId?: string;
  template?: TemplateDetailsInterface;
}
