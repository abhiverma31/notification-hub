import 'reflect-metadata';
import mongoose from 'mongoose';
import { DatabaseConnector } from '../shared-library/connectors/DatabaseConnector';
import { OnDeckRepository } from '../shared-library/repositories/OnDeck';
import { archiveCollection } from './services/ArchivalService';
import { publishAlert } from './utils/snsClient';
import { logger } from '../shared-library/utils/CommonLogger';

export const handler = async (): Promise<void> => {
  const db = new DatabaseConnector();
  await db.connect('NotificationArchivalJob');

  const onDeckRepo = new OnDeckRepository();

  try {
    logger.info('[Archival] Notification job started');

    const result = await archiveCollection(
      'Notification',
      onDeckRepo.findForArchival.bind(onDeckRepo),
      onDeckRepo.deleteByIds.bind(onDeckRepo),
    );

    logger.info('[Archival] Notification job completed', result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Archival] Notification job failed', { error: message });

    await publishAlert(
      `[${process.env.NODE_ENV}] Notification Archival Job Failed`,
      `The Notification archival job failed:\n\n${message}\n\nCheck CloudWatch logs for the notificationArchivalJob Lambda.`,
    );

    throw error;
  } finally {
    await mongoose.disconnect();
  }
};
