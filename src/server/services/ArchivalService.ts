import {
  initMultipartUpload,
  uploadBatchPart,
  completeMultipartUpload,
} from '../utils/s3MultipartArchival';
import { s3 } from '../utils/s3Client';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../../shared-library/utils/CommonLogger';

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '1000', 10);
const ARCHIVAL_THRESHOLD_DAYS = parseInt(process.env.ARCHIVAL_THRESHOLD_DAYS ?? '395', 10); // 13 months default

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Verify S3 upload succeeded by checking file exists and has reasonable size
 * @param s3Key - The S3 key to verify
 * @param expectedRecordCount - Number of records that should be in the file
 * @returns true if verification passed, false otherwise
 */
async function verifyS3Upload(s3Key: string, expectedRecordCount: number): Promise<boolean> {
  try {
    const bucketName = process.env.ARCHIVAL_BUCKET_NAME;
    if (!bucketName) {
      logger.error('[S3 Verification] ARCHIVAL_BUCKET_NAME not set, skipping verification');
      return false;
    }

    logger.info(`[S3 Verification] Starting verification`, {
      bucket: bucketName,
      key: s3Key,
      expectedRecordCount,
    });

    // Check if file exists
    const headCommand = new HeadObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    const response = await s3.send(headCommand);
    const actualSize = response.ContentLength || 0;

    logger.info(`[S3 Verification] File exists: ${s3Key}, Size: ${actualSize} bytes`);

    // Verify file size is reasonable
    // Each NDJSON record is approximately 200-300 bytes on average
    // We'll use a generous range: 50 bytes (min) to 5000 bytes (max) per record
    const minExpectedSize = expectedRecordCount * 50; // Conservative minimum
    const maxExpectedSize = expectedRecordCount * 5000; // Generous maximum

    if (actualSize < minExpectedSize) {
      logger.error(`[S3 Verification] File too small: ${actualSize} bytes for ${expectedRecordCount} records (expected minimum: ${minExpectedSize})`, {
        s3Key,
        actualSize,
        expectedRecordCount,
        minExpectedSize,
      });
      return false;
    }

    if (actualSize > maxExpectedSize) {
      logger.warn(`[S3 Verification] File larger than expected: ${actualSize} bytes for ${expectedRecordCount} records (expected maximum: ${maxExpectedSize})`, {
        s3Key,
        actualSize,
        expectedRecordCount,
        maxExpectedSize,
        note: 'This is unusual but not necessarily an error - proceeding with caution',
      });
    }

    logger.info(`[S3 Verification] ✅ Passed - File exists with reasonable size`, {
      s3Key,
      actualSize,
      expectedRecordCount,
      bytesPerRecord: Math.floor(actualSize / expectedRecordCount),
    });

    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFound') {
      logger.error(`[S3 Verification] ❌ File not found in S3: ${s3Key}`);
    } else {
      logger.error(`[S3 Verification] ❌ Verification failed`, {
        s3Key,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: (error as any)?.Code,
        errorDetails: (error as any)?.['$metadata'],
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
    }
    return false;
  }
}

export function getCutoffDate(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ARCHIVAL_THRESHOLD_DAYS);
  
  // Set to end of day (23:59:59.999) to archive the entire day
  cutoff.setHours(23, 59, 59, 999);

  return cutoff;
}

interface ArchivableRecord {
  _id?: string;
  createdAt?: Date | string;
  source_creation_timestamp?: Date | string; // For Notification collection
}

export async function archiveCollection<T extends ArchivableRecord>(
  collectionName: string,
  findForArchival: (cutoffDate: Date, lastId: string | null, limit: number, lastCreatedAt?: Date) => Promise<T[]>,
  deleteByIds: (ids: string[]) => Promise<void>,
  batchSize = BATCH_SIZE,
): Promise<{ archived: number; deleted: number }> {
  const cutoffDate = getCutoffDate();

  logger.info(
    `[Archival] ${collectionName}: Archival threshold is ${ARCHIVAL_THRESHOLD_DAYS} days (${(ARCHIVAL_THRESHOLD_DAYS / 30).toFixed(1)} months)`,
  );
  logger.info(`[Archival] ${collectionName}: Cutoff date is ${cutoffDate.toISOString()} - data older than this will be archived`);

  let lastId: string | null = null;
  let lastCreatedAt: Date | undefined = undefined;
  const failedDeletions: string[] = [];
  const dateGroups = new Map<string, T[]>();

  try {
    // Step 1: Fetch all records and group by date
    logger.info(`[Archival] ${collectionName}: Starting to fetch records with cutoff ${cutoffDate.toISOString()}`);
    
    let totalFetched = 0;
    let batchCount = 0;
    
    while (true) {
      const batch = await findForArchival(cutoffDate, lastId, batchSize, lastCreatedAt);
      batchCount++;
      totalFetched += batch.length;

      logger.info(`[Archival] ${collectionName}: Fetched batch ${batchCount} of ${batch.length} records (total so far: ${totalFetched}, lastId: ${lastId || 'null'})`);

      if (batch.length === 0) {
        break;
      }

      // Group records by their createdAt date
      let recordsGroupedThisBatch = 0;
      for (const record of batch) {
        // Support both createdAt and source_creation_timestamp
        const timestamp = record.createdAt || record.source_creation_timestamp;
        const createdAt = timestamp ? new Date(timestamp) : new Date();
        const year = createdAt.getUTCFullYear();
        const month = String(createdAt.getUTCMonth() + 1).padStart(2, '0');
        const day = String(createdAt.getUTCDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;

        if (!dateGroups.has(dateKey)) {
          dateGroups.set(dateKey, []);
          logger.info(`[Archival] ${collectionName}: New date group created: ${dateKey}`);
        }
        dateGroups.get(dateKey)!.push(record);
        recordsGroupedThisBatch++;
      }

      // Log progress every 100 batches
      if (batchCount % 100 === 0) {
        const totalInGroups = Array.from(dateGroups.values()).reduce((sum, arr) => sum + arr.length, 0);
        logger.info(`[Archival] ${collectionName}: Progress - Batches: ${batchCount}, Fetched: ${totalFetched}, In Groups: ${totalInGroups}`);
      }

      // Track both lastId and lastCreatedAt for compound cursor pagination
      const lastRecord = batch[batch.length - 1];
      lastId = lastRecord._id!.toString();
      const lastTimestamp = lastRecord.createdAt || lastRecord.source_creation_timestamp;
      lastCreatedAt = lastTimestamp ? new Date(lastTimestamp) : undefined;

      if (batch.length < batchSize) break;
      await sleep(100);
    }

    const totalInGroups = Array.from(dateGroups.values()).reduce((sum, arr) => sum + arr.length, 0);
    logger.info(`[Archival] ${collectionName}: Finished fetching - Batches: ${batchCount}, Total Fetched: ${totalFetched}, Total in Groups: ${totalInGroups}, Date Groups: ${dateGroups.size}`);

    if (dateGroups.size === 0) {
      logger.info(`[Archival] ${collectionName}: No records found older than ${cutoffDate.toISOString()}`);
      return { archived: 0, deleted: 0 };
    }

    logger.info(`[Archival] ${collectionName}: Found data across ${dateGroups.size} different dates, processing...`);

    // Step 2: Upload each date group to its own file
    let totalArchived = 0;
    let totalDeleted = 0;

    for (const [dateKey, records] of Array.from(dateGroups.entries()).sort()) {
      const [year, month, day] = dateKey.split('-');
      const dateForPath = new Date(`${year}-${month}-${day}T00:00:00Z`);

      logger.info(`[Archival] ${collectionName}: Archiving ${records.length} records for date ${dateKey}`);

      const s3Key = await initMultipartUpload(collectionName, dateForPath);
      await uploadBatchPart(s3Key, records);
      await completeMultipartUpload(s3Key);

      // SAFETY CHECK: Verify S3 upload before deleting from MongoDB
      logger.info(`[Archival] ${collectionName}: Verifying S3 upload for ${dateKey}...`);
      const isVerified = await verifyS3Upload(s3Key, records.length);

      if (!isVerified) {
        logger.error(`[Archival] ${collectionName}: ❌ S3 verification FAILED for ${dateKey} - SKIPPING DELETION`, {
          s3Key,
          dateKey,
          recordCount: records.length,
          safety: 'Data preserved in MongoDB - no data loss',
        });
        const ids = records.map((r) => r._id!.toString());
        failedDeletions.push(...ids);
        totalArchived += records.length; // Count as archived (in S3) but not deleted
        continue; // Skip deletion for this batch
      }

      logger.info(`[Archival] ${collectionName}: ✅ S3 verification PASSED for ${dateKey} - proceeding with deletion`);

      const ids = records.map((r) => r._id!.toString());

      try {
        await deleteByIds(ids);
        totalDeleted += ids.length;
        totalArchived += records.length;
        logger.info(`[Archival] ${collectionName}: Completed ${dateKey} - archived: ${records.length}, deleted: ${ids.length}`);
      } catch (deleteError) {
        const message = deleteError instanceof Error ? deleteError.message : String(deleteError);
        logger.error(`[Archival] ${collectionName}: Deletion failed for date ${dateKey}`, {
          error: message,
          batchSize: ids.length,
          date: dateKey,
        });
        failedDeletions.push(...ids);
        totalArchived += records.length;
      }

      await sleep(100);
    }

    if (failedDeletions.length > 0) {
      logger.error(`[Archival] ${collectionName}: Completed with deletion failures`, {
        totalArchived,
        totalDeleted,
        failedCount: failedDeletions.length,
        failureRate: `${((failedDeletions.length / totalArchived) * 100).toFixed(2)}%`,
        note: 'Documents archived in S3 but remain in MongoDB. May cause duplicates on next run.',
      });
    }

    logger.info(
      `[Archival] ${collectionName}: Summary - Archived: ${totalArchived} across ${dateGroups.size} dates, Deleted: ${totalDeleted}, Failed: ${failedDeletions.length}`,
    );

    return { archived: totalArchived, deleted: totalDeleted };
  } catch (error) {
    logger.error(`[Archival] ${collectionName}: Archival failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
