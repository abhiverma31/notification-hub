import { archiveCollection, getCutoffDate } from '../../../../src/server/services/ArchivalService';

jest.mock('../../../../src/server/utils/s3MultipartArchival', () => ({
  initMultipartUpload: jest.fn(),
  uploadBatchPart: jest.fn(),
  completeMultipartUpload: jest.fn(),
  abortMultipartUpload: jest.fn(),
}));

jest.mock('../../../../src/server/utils/s3Client', () => ({
  s3: {
    send: jest.fn().mockResolvedValue({
      ContentLength: 500, // Mock file size for verification (reasonable for 1-10 records)
    }),
  },
}));

jest.mock('../../../../src/shared-library/utils/CommonLogger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { initMultipartUpload, uploadBatchPart, completeMultipartUpload, abortMultipartUpload } from '../../../../src/server/utils/s3MultipartArchival';

const makeRecord = (id: string, createdAt: Date) => ({ _id: id, createdAt, data: 'x' });

describe('ArchivalService', () => {
  let findForArchival: jest.Mock;
  let deleteByIds: jest.Mock;

  beforeEach(() => {
    process.env.ARCHIVAL_BUCKET_NAME = 'test-bucket';
    jest.clearAllMocks();
    findForArchival = jest.fn();
    deleteByIds = jest.fn().mockResolvedValue(undefined);
    (initMultipartUpload as jest.Mock).mockResolvedValue('Test/2025/07/31/archive.ndjson');
    (uploadBatchPart as jest.Mock).mockResolvedValue(undefined);
    (completeMultipartUpload as jest.Mock).mockResolvedValue(undefined);
    (abortMultipartUpload as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getCutoffDate', () => {
    it('returns a date 395 days in the past by default', () => {
      const expected = new Date();
      expected.setDate(expected.getDate() - 395);
      const result = getCutoffDate();
      expect(result.toDateString()).toBe(expected.toDateString());
    });

    it('sets cutoff time to end of day (23:59:59.999) to archive full 24 hours', () => {
      const result = getCutoffDate();
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });

    it('always sets time to 23:59:59.999 ensuring full day archival', () => {
      const cutoff = getCutoffDate();
      
      // Verify end-of-day time components
      expect(cutoff.getHours()).toBe(23);
      expect(cutoff.getMinutes()).toBe(59);
      expect(cutoff.getSeconds()).toBe(59);
      expect(cutoff.getMilliseconds()).toBe(999);
    });
  });

  describe('archiveCollection', () => {
    it('groups records by their createdAt date and creates separate files', async () => {
      const date1 = new Date('2024-05-15T10:00:00Z');
      const date2 = new Date('2024-05-16T14:30:00Z');
      const batch = [makeRecord('1', date1), makeRecord('2', date2), makeRecord('3', date1)];
      findForArchival.mockResolvedValueOnce(batch).mockResolvedValueOnce([]);

      const result = await archiveCollection('Test', findForArchival, deleteByIds);

      // Should create 2 separate uploads, one for each date
      expect(initMultipartUpload).toHaveBeenCalledTimes(2);
      expect(initMultipartUpload).toHaveBeenCalledWith('Test', new Date('2024-05-15T00:00:00Z'));
      expect(initMultipartUpload).toHaveBeenCalledWith('Test', new Date('2024-05-16T00:00:00Z'));
      
      expect(uploadBatchPart).toHaveBeenCalledTimes(2);
      expect(completeMultipartUpload).toHaveBeenCalledTimes(2);
      
      expect(deleteByIds).toHaveBeenCalledTimes(2);
      expect(deleteByIds).toHaveBeenCalledWith(['1', '3']); // date1 group
      expect(deleteByIds).toHaveBeenCalledWith(['2']); // date2 group
      
      expect(result).toEqual({ archived: 3, deleted: 3 });
    });

    it('uploads records from same date in single file', async () => {
      const sameDate = new Date('2024-06-01T12:00:00Z');
      const batch = [makeRecord('1', sameDate), makeRecord('2', sameDate)];
      findForArchival.mockResolvedValueOnce(batch).mockResolvedValueOnce([]);

      await archiveCollection('Test', findForArchival, deleteByIds);

      expect(initMultipartUpload).toHaveBeenCalledTimes(1);
      expect(initMultipartUpload).toHaveBeenCalledWith('Test', new Date('2024-06-01T00:00:00Z'));
      expect(uploadBatchPart).toHaveBeenCalledWith('Test/2025/07/31/archive.ndjson', [
        makeRecord('1', sameDate),
        makeRecord('2', sameDate),
      ]);
    });

    it('does not upload or delete when no data found', async () => {
      findForArchival.mockResolvedValueOnce([]);

      const result = await archiveCollection('Test', findForArchival, deleteByIds);

      expect(initMultipartUpload).not.toHaveBeenCalled();
      expect(uploadBatchPart).not.toHaveBeenCalled();
      expect(deleteByIds).not.toHaveBeenCalled();
      expect(completeMultipartUpload).not.toHaveBeenCalled();
      expect(result).toEqual({ archived: 0, deleted: 0 });
    });

    it('fetches all records across multiple batches before grouping', async () => {
      const date1 = new Date('2024-05-15T10:00:00Z');
      const date2 = new Date('2024-05-16T14:30:00Z');
      const batch1 = [makeRecord('1', date1), makeRecord('2', date2)];
      const batch2 = [makeRecord('3', date1), makeRecord('4', date1)];
      findForArchival
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);

      await archiveCollection('Test', findForArchival, deleteByIds, 2);

      expect(findForArchival).toHaveBeenCalledTimes(3);
      expect(findForArchival).toHaveBeenNthCalledWith(1, expect.any(Date), null, 2, undefined);
      expect(findForArchival).toHaveBeenNthCalledWith(2, expect.any(Date), '2', 2, expect.any(Date));
      expect(findForArchival).toHaveBeenNthCalledWith(3, expect.any(Date), '4', 2, expect.any(Date));
      
      // Should still group correctly
      expect(deleteByIds).toHaveBeenCalledWith(['1', '3', '4']); // date1 group from both batches
      expect(deleteByIds).toHaveBeenCalledWith(['2']); // date2 group
    });

    it('continues archival when deletion fails for one date group', async () => {
      const date1 = new Date('2024-05-15T10:00:00Z');
      const date2 = new Date('2024-05-16T14:30:00Z');
      const batch = [makeRecord('1', date1), makeRecord('2', date2)];
      findForArchival.mockResolvedValueOnce(batch).mockResolvedValueOnce([]);
      
      deleteByIds
        .mockRejectedValueOnce(new Error('Delete failed for date1'))
        .mockResolvedValueOnce(undefined);

      const result = await archiveCollection('Test', findForArchival, deleteByIds);

      // Both should be archived, but only one deleted
      expect(result).toEqual({ archived: 2, deleted: 1 });
      expect(uploadBatchPart).toHaveBeenCalledTimes(2);
      expect(completeMultipartUpload).toHaveBeenCalledTimes(2);
    });

    it('handles records with missing createdAt by using current date', async () => {
      const recordWithoutDate = { _id: '1', data: 'x' };
      findForArchival.mockResolvedValueOnce([recordWithoutDate]).mockResolvedValueOnce([]);

      await archiveCollection('Test', findForArchival, deleteByIds);

      const today = new Date();
      const year = today.getUTCFullYear();
      const month = String(today.getUTCMonth() + 1).padStart(2, '0');
      const day = String(today.getUTCDate()).padStart(2, '0');
      
      expect(initMultipartUpload).toHaveBeenCalledWith('Test', new Date(`${year}-${month}-${day}T00:00:00Z`));
      expect(deleteByIds).toHaveBeenCalledWith(['1']);
    });

    it('processes date groups in chronological order', async () => {
      const date1 = new Date('2024-05-20T10:00:00Z');
      const date2 = new Date('2024-05-18T14:30:00Z');
      const date3 = new Date('2024-05-19T08:00:00Z');
      const batch = [makeRecord('1', date1), makeRecord('2', date2), makeRecord('3', date3)];
      findForArchival.mockResolvedValueOnce(batch).mockResolvedValueOnce([]);

      await archiveCollection('Test', findForArchival, deleteByIds);

      const calls = (initMultipartUpload as jest.Mock).mock.calls;
      expect(calls[0][1]).toEqual(new Date('2024-05-18T00:00:00Z'));
      expect(calls[1][1]).toEqual(new Date('2024-05-19T00:00:00Z'));
      expect(calls[2][1]).toEqual(new Date('2024-05-20T00:00:00Z'));
    });

    it('throws error if upload fails and does not proceed with deletion', async () => {
      const date1 = new Date('2024-05-15T10:00:00Z');
      const batch = [makeRecord('1', date1)];
      findForArchival.mockResolvedValueOnce(batch).mockResolvedValueOnce([]);
      (uploadBatchPart as jest.Mock).mockRejectedValueOnce(new Error('S3 upload failed'));

      await expect(archiveCollection('Test', findForArchival, deleteByIds)).rejects.toThrow('S3 upload failed');
      
      expect(deleteByIds).not.toHaveBeenCalled();
    });
  });
});
