import request from 'supertest';
import { logger } from './utils/ScriptLogger';

let ready = false;

export const waitTillReady = async (): Promise<void> => {
  logger.info('Waiting for server to start...');

  let attemptCount = 0;

  while (attemptCount <= 90) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      await request('http://localhost:4000').get('/');
      ready = true;
      break;
    } catch (error) {
      if ((error as Error).message !== 'ECONNREFUSED: Connection refused') {
        logger.error(error);
        process.exit(2);
      }

      logger.info(`Waiting: ${attemptCount}s`);
      attemptCount++;
    }
  }

  if (ready) {
    logger.info('Server is up and running!');
  } else {
    logger.error('Server did not start in time!');
    process.exit(1);
  }
};

(async () => await waitTillReady())();
