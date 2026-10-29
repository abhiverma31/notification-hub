/* eslint-disable no-console */
import 'reflect-metadata';

import mongoose, { ConnectOptions } from 'mongoose';
import { injectable } from 'tsyringe';
import { testEnv } from '../constants/EnvironmentConstants';
import { CommonLogger } from '../utils/CommonLogger';
import { isLocalOrTest } from '../utils/EnvironmentHelper';

let db: typeof mongoose | null = null;

@injectable()
export class DatabaseConnector {
  public async disconnect(connectionContext: string) {
    const logger = new CommonLogger(connectionContext);
    logger.info('Closing DB Connection');
    await mongoose.disconnect();
    logger.info('DB Disconnected!');
  }

  public async clearTestDatabase() {
    const logger = new CommonLogger('Test');

    logger.debug('Clearing DB for Test');

    if (process.env.NODE_ENV?.toUpperCase() !== testEnv.toUpperCase()) {
      logger.error('Clear DB command used outside of test environment!');
      process.exit(3);
    }

    const collections = db!.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }

    logger.debug('DB Cleared!');
  }

  public async connect(connectionContext: string) {
    const logger = new CommonLogger(connectionContext);

    if (db) {
      logger.info('Reusing DB Connection');

      return;
    }

    logger.info('Creating DB Connection');

    const dbName = `notification-${process.env.NODE_ENV?.toLowerCase()}`;

    const options: ConnectOptions = {
      dbName: dbName,
      autoIndex: isLocalOrTest,
      enableUtf8Validation: false,
      serverSelectionTimeoutMS: 2500,
      waitQueueTimeoutMS: 2000,
      maxIdleTimeMS: 60000,
      maxConnecting: 3,
      readPreference: isLocalOrTest ? 'primary' : 'secondaryPreferred',
      maxStalenessSeconds: isLocalOrTest ? undefined : 90,
      maxPoolSize: 3,
    };

    const mongoString = process.env.MONGO_CONNECTION_URL!;
    db = await mongoose.connect(mongoString, options);
    mongoose.set({ debug: false });
    logger.info('DB Connected!');
  }
}
