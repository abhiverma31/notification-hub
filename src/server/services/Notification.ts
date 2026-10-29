import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { QueueMessage } from '../types/interfaces/QueueMessage';
import { UserDto, UserQueueDto } from '../../shared-library/types/Dto/Notification';
import {
  SQS,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
  SendMessageBatchResult,
} from '@aws-sdk/client-sqs';
import { GetQueueUrl } from '../utils/GetQueueUrl';
import { OrganisationInterface } from '../../shared-library/models/Organisation';
import { ChannelTemplateInterface, Data } from '../types/interfaces/TemplateInterfaceTypes';
import { SendNotificationResponse } from '../types/response/SendNotification';
import { ServerLogger } from '../utils/ServerLogger';
import { SQSClient } from '../utils/sqsUtils/SQSClient';
import { BatchUtil } from '../utils/sqsUtils/SQSBatchUtil';
import { Recipient } from '../utils/sqsUtils/RecipientList';
import { ChannelTemplateValidator } from '../utils/channelValidation';
import { getChannelNames } from '../../shared-library/utils/ChannelUtil';
import { EventInterface } from '../../shared-library/models/Event';
import { EventRepository } from '../../shared-library/repositories/Event';
import { TemplateRepository } from '../../shared-library/repositories/Template';
import { NotFound } from '../utils/errors/BadRequest';
import { ChannelType } from '../../shared-library/types/Enum/ChannelType';

const MAX_BATCH_SIZE = 10;

@injectable()
export class NotificationService {
  private readonly logger = new ServerLogger();

  constructor(
    @inject(EventRepository) private eventRepository: EventRepository,
    @inject(TemplateRepository) private templateRepository: TemplateRepository,
  ) {}

  public async sendNotification(
    recipients: UserDto[],
    data: Data,
    organisation: OrganisationInterface,
    channels: ChannelTemplateInterface,
  ): Promise<SendNotificationResponse> {
    this.logger.trace('Server > NotificationService > sendNotification', { recipients, data, organisation, channels });

    this.logger.info(`Got notification request to send for OrgId ${organisation._id}`);
    ChannelTemplateValidator.validateChannelTemplate(channels);
    let responses: SendNotificationResponse = {} as SendNotificationResponse;
    responses.transactions = [];

    const recipientList = Recipient.separateChannelsAndAddUserId(recipients, channels);
    const allBatches = await this.createBatches(recipientList, data, channels, organisation);
    responses = await this.sendBatches(allBatches, responses);
    this.logger.info('Sent notification to SQS', responses);

    return responses;
  }

  public async sendNotificationByEvent(
    recipients: UserDto[],
    data: Data,
    organisation: OrganisationInterface,
    eventName?: string,
    eventId?: string,
    extraChannelOptions?: ChannelTemplateInterface,
  ): Promise<SendNotificationResponse> {
    this.logger.trace('Server > NotificationService > sendNotificationByEventName', {
      recipients,
      data,
      organisation,
      eventName,
      eventId,
    });
    this.logger.info(
      `Got notification request to send for OrgId ${organisation._id} using eventName ${eventName} and eventId ${eventId}`,
    );

    const event = eventName
      ? await this.eventRepository.findEventByName(eventName, organisation._id!)
      : await this.eventRepository.findEventById(eventId!, organisation._id!);
    if (!event) {
      throw new NotFound(`Event with name '${eventName}' not found for organisation ${organisation._id}`);
    }
    await this.eventRepository.updateLastUsedAt(event._id!, organisation._id!);

    const channels = await this.getChannelsFromEvent(event);

    // Merge extra channel options (e.g. pusherChannel, pusherEvent, beamsInterest, providers)
    if (extraChannelOptions) {
      for (const channelType of Object.keys(extraChannelOptions)) {
        if (channels[channelType]) {
          channels[channelType] = { ...channels[channelType], ...extraChannelOptions[channelType] };
        }
      }
    }

    return this.sendNotification(recipients, data, organisation, channels);
  }

  private async getChannelsFromEvent(event: EventInterface): Promise<ChannelTemplateInterface> {
    // Fetch templates by event.templateIds and build channels object
    const templates = await Promise.all(
      event.templateIds.map((id) => this.templateRepository.findTemplateById(id, event.organisationId)),
    );
    const channels: ChannelTemplateInterface = {};
    for (const template of templates) {
      if (template && template.channelType) {
        channels[template.channelType] = { templateId: template._id };
      }
    }

    return channels;
  }

  private async createBatches(
    recipientList: UserQueueDto[],
    data: Data,
    channels: ChannelTemplateInterface,
    organisation: OrganisationInterface,
  ): Promise<SendMessageBatchRequestEntry[][]> {
    const allBatches: SendMessageBatchRequestEntry[][] = [];
    const channelNames = getChannelNames(channels);

    if (recipientList.length !== 0) {
      for (let i = 0; i < recipientList.length; i += MAX_BATCH_SIZE) {
        const currentBatchRecipients = recipientList.slice(i, i + MAX_BATCH_SIZE);
        this.logger.info('Creating batches for the recipientsList', currentBatchRecipients);
        const batchEntries = await BatchUtil.constructBatchQueueMessage(
          data,
          channels,
          organisation,
          currentBatchRecipients,
        );
        allBatches.push(batchEntries);

        return allBatches;
      }
    }
    if ([ChannelType.SLACK, ChannelType.TEAMS, ChannelType.TELEGRAM].some((type) => channelNames.includes(type))) {
      const batchEntries = await BatchUtil.constructBatchQueueMessage(data, channels, organisation);
      allBatches.push(batchEntries);
    }

    return allBatches;
  }

  private async sendBatches(
    allBatches: SendMessageBatchRequestEntry[][],
    responses: SendNotificationResponse,
  ): Promise<SendNotificationResponse> {
    const sendingPromises: Promise<void>[] = [];
    const sqs = SQSClient.getSqsClient();
    const queueUrl = GetQueueUrl(`NotificationEngineQueue.fifo`);

    for (const batch of allBatches) {
      const sendMessageCommand = new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: batch,
      });
      sendingPromises.push(
        (async () => {
          const sqsResponse = await this.sendToSQSWithRetry(sqs, sendMessageCommand);
          const successResponseStatus = sqsResponse!.Successful;
          const failedResponseStatus = sqsResponse!.Failed;

          successResponseStatus!.forEach((response) => {
            if (response!.Id === undefined || response!.MessageId === undefined) {
              throw new Error('MessageId is undefined in SQS response, send notification failed');
            } else {
              const value = batch.find((entry) => entry.Id === response!.Id);
              if (value && value.MessageBody) {
                const messageBodyJson: QueueMessage = JSON.parse(value.MessageBody);
                if (messageBodyJson.recipients.every((recipient) => recipient === null)) {
                  if (getChannelNames(messageBodyJson.channels).includes(ChannelType.SLACK)) {
                    responses.transactions.push({
                      id: response!.MessageId,
                      channel: ChannelType.SLACK,
                    });
                  }
                  if (getChannelNames(messageBodyJson.channels).includes(ChannelType.TEAMS)) {
                    responses.transactions.push({
                      id: response!.MessageId,
                      channel: ChannelType.TEAMS,
                    });
                  }
                  if (getChannelNames(messageBodyJson.channels).includes(ChannelType.TELEGRAM)) {
                    responses.transactions.push({
                      id: response!.MessageId,
                      channel: ChannelType.TELEGRAM,
                    });
                  }
                } else {
                  responses.transactions.push({
                    id: response!.MessageId,
                    recipient: messageBodyJson.recipients[0].email,
                    channel: messageBodyJson.recipients[0].channel,
                  });
                }
              }
            }
          });
          if (failedResponseStatus) {
            failedResponseStatus!.forEach((response) => {
              if (response!.Id === undefined) {
                throw new Error('Response Id is undefined in SQS response, send notification failed');
              } else {
                const value = batch.find((entry) => entry.Id === response!.Id);
                if (value && value.MessageBody) {
                  const messageBodyJson: QueueMessage = JSON.parse(value.MessageBody);
                  responses.transactions.push({
                    id: response!.Id,
                    recipient: messageBodyJson.recipients[0].email,
                    channel: messageBodyJson.recipients[0].channel,
                    error: response.Message,
                  });
                }
              }
            });
          }
        })(),
      );
    }
    await Promise.all(sendingPromises);

    return responses;
  }

  private async sendToSQSWithRetry(
    sqs: SQS,
    sendMessageCommand: SendMessageBatchCommand,
  ): Promise<SendMessageBatchResult | void> {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const sqsResponse = await sqs.send(sendMessageCommand);

        return sqsResponse;
      } catch (error: any) {
        this.logger.error('Error sending notification to SQS:', error.message);
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    for (const value of sendMessageCommand.input.Entries!) {
      this.logger.error('Map Values from batchMessageMap= ' + value.MessageBody);
      throw new Error('Maximum number of retries exceeded for the SQS queue for messages');
    }
  }
}
