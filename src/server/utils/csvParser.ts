import fs from 'fs';
import csv from 'csv-parser';
import { logger } from '../utils/ServerLogger';
import { ParsedUser } from '../types/interfaces/csvParserTypes';

export const parseCsvFile = (filePath: string): Promise<ParsedUser[]> => {
  return new Promise((resolve, reject) => {
    const results: ParsedUser[] = [];

    if (!fs.existsSync(filePath)) {
      logger.error('File does not exist:', filePath);

      return reject(new Error(`File not found: ${filePath}`));
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        try {
          if (!data['Email']) {
            throw new Error('Missing required fields - Email');
          }
          if (!data['First Name']) {
            throw new Error('Missing required fields - First Name');
          }
          results.push({
            externalUserId: data['External User ID'],
            firstName: data['First Name'],
            lastName: data['Last Name'],
            email: data['Email'],
            phoneNumber: data['Phone Number'],
            telegramChatId: data['Telegram Chat ID'],
          });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          logger.error('Error parsing CSV data:', errorMessage);
        }
      })
      .on('end', () => resolve(results))
      .on('error', (err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Failed to read CSV file:', errorMessage);
        reject(err);
      });
  });
};
