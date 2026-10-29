import { localEnv, testEnv } from '../../shared-library/constants/EnvironmentConstants';

export const GetQueueUrl = (queueName: string) => {
  if (
    process.env.NODE_ENV?.toUpperCase() === testEnv.toUpperCase() ||
    process.env.NODE_ENV?.toUpperCase() === localEnv.toUpperCase()
  ) {
    return `${process.env.SQS_OFFLINE_URL}/queue/${queueName}`;
  }

  return `https://sqs.${process.env.AWS_REGION}.amazonaws.com/${process.env.ACCOUNT_ID}/${queueName.replace('.fifo', `-${process.env.NODE_ENV}`)}.fifo`;
};
