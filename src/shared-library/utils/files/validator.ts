export const validateCsvFile = (file: Express.Multer.File): { valid: boolean; message?: string } => {
  if (!file) {
    return { valid: false, message: 'No file uploaded. Please provide a valid CSV file.' };
  }

  if (file.mimetype !== 'text/csv' && file.mimetype !== 'application/vnd.ms-excel') {
    return { valid: false, message: 'Invalid file type. Only CSV files are allowed.' };
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, message: 'File size exceeds the maximum allowed size of 10MB.' };
  }

  return { valid: true };
};
