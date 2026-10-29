import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { s3 } from './s3Client';
import { logger } from '../../shared-library/utils/CommonLogger';

interface MultipartUpload {
  uploadId: string;
  key: string;
  parts: Array<{ ETag: string; PartNumber: number }>;
  partNumber: number;
}

const activeUploads = new Map<string, MultipartUpload>();

export function getDailyArchiveKey(collection: string, cutoffDate: Date): string {
  const year = cutoffDate.getUTCFullYear();
  const month = String(cutoffDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(cutoffDate.getUTCDate()).padStart(2, '0');
  
  const dateString = `${year}-${month}-${day}`;
  const timestamp = Date.now();
  
  // Add Lambda execution context ID for uniqueness across concurrent runs
  // Falls back to random string if not in Lambda context
  const executionId = process.env.AWS_REQUEST_ID || Math.random().toString(36).substring(7);
  
  const collectionLowerCase = collection.toLowerCase();
  const filename = `${collectionLowerCase}-${dateString}-${timestamp}-${executionId}.ndjson`;

  return `${collection}/${year}/${month}/${day}/${filename}`;
}

export async function initMultipartUpload(collection: string, cutoffDate: Date): Promise<string> {
  const key = getDailyArchiveKey(collection, cutoffDate);

  if (activeUploads.has(key)) {
    return key;
  }

  const bucketName = process.env.ARCHIVAL_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('ARCHIVAL_BUCKET_NAME environment variable is not set');
  }

  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: 'application/x-ndjson',
  });

  const response = await s3.send(command);

  activeUploads.set(key, {
    uploadId: response.UploadId!,
    key,
    parts: [],
    partNumber: 1,
  });

  logger.info(`[S3 Multipart] Initiated upload for ${key}`);

  return key;
}

export async function uploadBatchPart(key: string, records: object[]): Promise<void> {
  const upload = activeUploads.get(key);
  if (!upload) {
    throw new Error(`No active upload found for key: ${key}`);
  }

  const body = records.map((r) => JSON.stringify(r)).join('\n') + '\n';

  const command = new UploadPartCommand({
    Bucket: process.env.ARCHIVAL_BUCKET_NAME!,
    Key: key,
    UploadId: upload.uploadId,
    PartNumber: upload.partNumber,
    Body: body,
  });

  const response = await s3.send(command);

  upload.parts.push({
    ETag: response.ETag!,
    PartNumber: upload.partNumber,
  });

  upload.partNumber++;
  logger.info(`[S3 Multipart] Uploaded part ${upload.partNumber - 1} for ${key}`);
}

export async function completeMultipartUpload(key: string): Promise<void> {
  const upload = activeUploads.get(key);
  if (!upload) {
    throw new Error(`No active upload found for key: ${key}`);
  }

  const command = new CompleteMultipartUploadCommand({
    Bucket: process.env.ARCHIVAL_BUCKET_NAME!,
    Key: key,
    UploadId: upload.uploadId,
    MultipartUpload: {
      Parts: upload.parts,
    },
  });

  await s3.send(command);
  activeUploads.delete(key);
  logger.info(`[S3 Multipart] Completed upload for ${key} with ${upload.parts.length} parts`);
}

export async function abortMultipartUpload(key: string): Promise<void> {
  const upload = activeUploads.get(key);
  if (!upload) {
    return;
  }

  const command = new AbortMultipartUploadCommand({
    Bucket: process.env.ARCHIVAL_BUCKET_NAME!,
    Key: key,
    UploadId: upload.uploadId,
  });

  await s3.send(command);
  activeUploads.delete(key);
  logger.info(`[S3 Multipart] Aborted upload for ${key}`);
}
