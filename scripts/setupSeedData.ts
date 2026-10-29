import 'reflect-metadata';
import 'dotenv/config';
import { container } from 'tsyringe';
import { DatabaseConnector } from '../src/shared-library/connectors/DatabaseConnector';
import { insertSeedData } from './seedData/insertSeedData';
import { logger } from './utils/ScriptLogger';

export const setupSeedData = async () => {
  const db = container.resolve(DatabaseConnector);
  try {
    await db.connect('setupSeedData');
    await insertSeedData();
  } finally {
    await db.disconnect('setupSeedData');
    logger.info('Seed Data Insertion Complete!');
  }
};

(async () => await setupSeedData())();
