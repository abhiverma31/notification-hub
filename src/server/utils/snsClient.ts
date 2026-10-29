import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const sns = new SNSClient({ region: process.env.AWS_REGION });

export const publishAlert = async (subject: string, message: string): Promise<void> => {
  if (!process.env.ALERTS_TOPIC_ARN) {
    console.log(`[SNS SKIPPED] ${subject}: ${message}`);
    return;
  }

  await sns.send(
    new PublishCommand({
      TopicArn: process.env.ALERTS_TOPIC_ARN!,
      Subject: subject,
      Message: message,
    }),
  );
};
