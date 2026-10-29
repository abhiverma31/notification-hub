import { saveToTemporaryFile } from './saver';
import { validateCsvFile } from './validator';

export const handleCsvFileUpload = (file: Express.Multer.File): { tempFilePath: string; error?: string } => {
  const validation = validateCsvFile(file);
  if (!validation.valid) {
    return { tempFilePath: '', error: validation.message };
  }

  const tempFilePath = saveToTemporaryFile(file.buffer, file.originalname);

  return { tempFilePath };
};
