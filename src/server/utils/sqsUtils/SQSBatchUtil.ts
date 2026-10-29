import { randomUUID } from 'crypto';
import { OrganisationInterface } from '../../../shared-library/models/Organisation';
import { UserQueueDto } from '../../../shared-library/types/Dto/Notification';
import { QueueMessage } from '../../types/interfaces/QueueMessage';
import { ChannelTemplateInterface } from '../../types/interfaces/TemplateInterfaceTypes';
import { Data } from '../../../consumer/types/Interfaces/Template';
import { SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs';

export class BatchUtil {
  public static async constructBatchQueueMessage(
    data: Data,
    channels: ChannelTemplateInterface,
    organisation: OrganisationInterface,
    currentBatchRecipients?: UserQueueDto[],
  ): Promise<SendMessageBatchRequestEntry[]> {
    const entries: SendMessageBatchRequestEntry[] = [];
    if (currentBatchRecipients && currentBatchRecipients.length > 0) {
      currentBatchRecipients.forEach((recipient) => {
        entries.push(this.createMessageEntry(data, channels, organisation, recipient));
      });

      return entries;
    }
    entries.push(this.createMessageEntry(data, channels, organisation));

    return entries;
  }

  private static createMessageEntry(
    data: Data,
    channels: ChannelTemplateInterface,
    organisation: OrganisationInterface,
    recipient?: UserQueueDto,
  ): SendMessageBatchRequestEntry {
    const messageId = randomUUID();

    return this.constructMessageBodySQS(data, channels, organisation, messageId, recipient);
  }

  public static constructMessageBodySQS(
    data: Data,
    channels: ChannelTemplateInterface,
    organisation: OrganisationInterface,
    messageId: string,
    recipient?: UserQueueDto,
  ): SendMessageBatchRequestEntry {
    const messageBody: QueueMessage = {
      recipients: [recipient!],
      data,
      channels,
      organisationId: organisation._id!,
    };
    const messageIdMapValue = {
      MessageBody: JSON.stringify(messageBody),
      Id: messageId,
      MessageGroupId: randomUUID(),
      MessageDeduplicationId: randomUUID(),
    };

    return messageIdMapValue;
  }
}
