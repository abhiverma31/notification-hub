import { localEnv, testEnv } from '../../../shared-library/constants/EnvironmentConstants';
import { SQS } from '@aws-sdk/client-sqs';

interface SQSConfig {
  region: string | undefined;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  endpoint?: string;
}

export class SQSClient {
  public static getSqsClient() {
    if (
      process.env.NODE_ENV?.toUpperCase() === testEnv.toUpperCase() ||
      process.env.NODE_ENV?.toUpperCase() === localEnv.toUpperCase()
    ) {
      const sqsConfig: SQSConfig = {
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test',
        },
      };
      sqsConfig.endpoint = process.env.SQS_OFFLINE_URL;

      return new SQS(sqsConfig);
    }

    return new SQS();
  }
}
