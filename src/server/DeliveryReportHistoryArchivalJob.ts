import 'reflect-metadata';
import mongoose from 'mongoose';
import { DatabaseConnector } from '../shared-library/connectors/DatabaseConnector';
import { DeliveryReportHistoryRepository } from '../shared-library/repositories/DeliveryReportHistory';
import { archiveCollection } from './services/ArchivalService';
import { publishAlert } from './utils/snsClient';
import { logger } from '../shared-library/utils/CommonLogger';

export const handler = async (): Promise<void> => {
  const db = new DatabaseConnector();
  await db.connect('DeliveryReportHistoryArchivalJob');

  const deliveryReportHistoryRepo = new DeliveryReportHistoryRepository();

  try {
    logger.info('[Archival] DeliveryReportHistory job started');

    const result = await archiveCollection(
      'DeliveryReportHistory',
      deliveryReportHistoryRepo.findForArchival.bind(deliveryReportHistoryRepo),
      deliveryReportHistoryRepo.deleteByIds.bind(deliveryReportHistoryRepo),
    );

    logger.info('[Archival] DeliveryReportHistory job completed', result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Archival] DeliveryReportHistory job failed', { error: message });

    await publishAlert(
      `[${process.env.NODE_ENV}] DeliveryReportHistory Archival Job Failed`,
      `The DeliveryReportHistory archival job failed:\n\n${message}\n\nCheck CloudWatch logs for the deliveryReportHistoryArchivalJob Lambda.`,
    );

    throw error;
  } finally {
    await mongoose.disconnect();
  }
};
