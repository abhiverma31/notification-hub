import 'reflect-metadata';
import { SQSEvent, SQSRecord, SQSBatchResponse } from 'aws-lambda';
import { container } from 'tsyringe';
import { DatabaseConnector } from '../shared-library/connectors/DatabaseConnector';
import { DeliveryReportService } from './services/DeliveryReport';
import { QueueMessage } from '../shared-library/types/Interfaces/QueueMessage';
import { NotificationService } from './services/Notification';
import { logger } from './utils/ConsumerLogger';
import { DeliveryReportStatus } from '../shared-library/types/DeliveryReportStatus';
import { ChannelType } from '../shared-library/types/Enum/ChannelType';
import { UserQueueDto } from '../shared-library/types/Dto/Notification';
import { getChannelNames } from '../shared-library/utils/ChannelUtil';
import adaptToUserInterface from '../shared-library/models/adapters/User';

class TransactionResult {
  constructor(
    public transactionId: string,
    public success: boolean,
  ) {}
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  logger.trace('> Consumer:notificationEngineHandler', event);
  logger.info(`Received No of Records in Queue`, event.Records.length);
  logger.info(`Received queue record as:`, event);

  const messages: SQSRecord[] = event.Records;

  let db: DatabaseConnector;
  let deliveryReportService: DeliveryReportService;

  try {
    db = container.resolve(DatabaseConnector);
    deliveryReportService = container.resolve(DeliveryReportService);
    await db.connect('Consumer');
  } catch (error) {
    return {
      batchItemFailures: messages.map((e) => ({
        itemIdentifier: e.messageId,
      })),
    };
  }

  const transactionResults = await Promise.all(
    messages.map(async (record): Promise<TransactionResult> => {
      const transactionId = record.messageId;
      const queueMsg: QueueMessage = JSON.parse(record.body);
      const channelNames = getChannelNames(queueMsg.channels);
      let channel;
      let receivedUserId: string | null = null;
      const organisationId: string | undefined = queueMsg.organisationId;

      if (queueMsg.recipients.every((recipient: UserQueueDto) => recipient === null)) {
        if (channelNames.includes('slack')) {
          channel = ChannelType.SLACK;
        } else if (channelNames.includes('teams')) {
          channel = ChannelType.TEAMS;
        } else if (channelNames.includes('telegram')) {
          channel = ChannelType.TELEGRAM;
        }
      } else channel = queueMsg.recipients[0].channel;
      try {
        const notificationService = container.resolve(NotificationService);

        await deliveryReportService.saveReport(
          transactionId,
          'N/A',
          channel,
          DeliveryReportStatus.INITIATED,
          undefined,
          organisationId,
        );

        const { userId, errorObj } = await notificationService.sendNotification(queueMsg, transactionId);
        receivedUserId = userId;

        if (!receivedUserId && queueMsg.recipients.length > 0 && queueMsg.recipients[0]) {
          const user = adaptToUserInterface(queueMsg.recipients[0], queueMsg.organisationId);
          const userFound = await notificationService.retryFetchingUserId(user);
          receivedUserId = userFound && userFound.user_id;
        }

        if (errorObj) throw errorObj;

        if (receivedUserId) {
          await deliveryReportService.updateUserId(transactionId, receivedUserId);
        }

        logger.info('Notification sent successfully!', {
          transactionId: transactionId,
          userId: receivedUserId,
          channel: channel,
          status: DeliveryReportStatus.SENT,
        });

        await deliveryReportService.updateReportStatus(transactionId, DeliveryReportStatus.SENT);

        return { transactionId: transactionId, success: true };
      } catch (error) {
        const serializedError = { message: error instanceof Error ? error.message : String(error) };

        if (receivedUserId) {
          await deliveryReportService.updateUserId(transactionId, receivedUserId);
        }

        await deliveryReportService.updateReportStatus(
          transactionId as string,
          DeliveryReportStatus.ERRORED,
          serializedError,
        );

        logger.error('Send notification failed', {
          transactionId: transactionId,
          userId: receivedUserId || 'N/A',
          channel: channel,
          status: DeliveryReportStatus.ERRORED,
          error: error,
        });

        return { transactionId: transactionId, success: false };
      }
    }),
  );

  return {
    batchItemFailures: transactionResults
      .filter((e) => !e.success)
      .map((e) => ({
        itemIdentifier: e.transactionId,
      })),
  };
};
