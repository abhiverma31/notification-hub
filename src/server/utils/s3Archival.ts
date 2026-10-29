import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from './s3Client';

export const uploadNdjson = async (records: object[], collection: string): Promise<void> => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const key = `${collection}/${year}/${month}/archive_${timestamp}.ndjson`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.ARCHIVAL_BUCKET_NAME!,
      Key: key,
      Body: records.map((r) => JSON.stringify(r)).join('\n'),
      ContentType: 'application/x-ndjson',
    }),
  );
};
