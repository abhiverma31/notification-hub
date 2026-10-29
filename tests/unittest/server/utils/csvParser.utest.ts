import fs from 'fs';
import csv from 'csv-parser';
import { parseCsvFile } from '../../../../src/server/utils/csvParser';
import { logger } from '../../../../src/server/utils/ServerLogger';

jest.mock('fs');
jest.mock('csv-parser');
jest.mock('../../../../src/server/utils/ServerLogger');

describe('parseCsvFile', () => {
  const mockFilePath = '/path/to/mock/file.csv';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should reject if file does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    await expect(parseCsvFile(mockFilePath)).rejects.toThrow(`File not found: ${mockFilePath}`);
    expect(logger.error).toHaveBeenCalledWith('File does not exist:', mockFilePath);
  });

  it('should parse CSV file and return results', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const mockData = [
      {
        'External User ID': 'A101',
        'First Name': 'John',
        'Last Name': 'Doe',
        Email: 'john@example.com',
        'Phone Number': '1234567890',
      },
      {
        'External User ID': 'B201',
        'First Name': 'Jane',
        'Last Name': 'Smith',
        Email: 'jane@example.com',
        'Phone Number': '0987654321',
      },
    ];

    const mockStream = {
      pipe: jest.fn().mockReturnThis(),
      on: jest.fn().mockImplementation(function (event, callback) {
        if (event === 'data') {
          mockData.forEach((data) => callback(data));
        }
        if (event === 'end') {
          callback();
        }

        return this;
      }),
    };

    (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);
    (csv as jest.Mock).mockReturnValue(mockStream);

    const result = await parseCsvFile(mockFilePath);

    expect(result).toEqual([
      {
        externalUserId: 'A101',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneNumber: '1234567890',
      },
      {
        externalUserId: 'B201',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phoneNumber: '0987654321',
      },
    ]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should skip rows with missing required fields and log an error', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const mockData = [
      {
        'External User ID': 'A101',
        'First Name': 'John',
        'Last Name': 'Doe',
        Email: 'john@example.com',
        'Phone Number': '1234567890',
      },
      { 'First Name': '', 'Last Name': 'Smith', Email: 'jane@example.com', 'Phone Number': '0987654321' },
      { 'First Name': 'Alice', 'Last Name': '', Email: '', 'Phone Number': '5555555555' },
    ];

    const mockStream = {
      pipe: jest.fn().mockReturnThis(),
      on: jest.fn().mockImplementation(function (event, callback) {
        if (event === 'data') {
          mockData.forEach((data) => callback(data));
        }
        if (event === 'end') {
          callback();
        }

        return this;
      }),
    };

    (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);
    (csv as jest.Mock).mockReturnValue(mockStream);

    const result = await parseCsvFile(mockFilePath);

    expect(result).toEqual([
      {
        externalUserId: 'A101',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneNumber: '1234567890',
      },
    ]);

    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith('Error parsing CSV data:', 'Missing required fields - First Name');
    expect(logger.error).toHaveBeenCalledWith('Error parsing CSV data:', 'Missing required fields - Email');
  });

  it('should reject if an error occurs while reading the file', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const mockStream = {
      pipe: jest.fn().mockReturnThis(),
      on: jest.fn().mockImplementation(function (event, callback) {
        if (event === 'error') {
          callback(new Error('Read error'));
        }

        return this;
      }),
    };

    (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);
    (csv as jest.Mock).mockReturnValue(mockStream);

    await expect(parseCsvFile(mockFilePath)).rejects.toThrow('Read error');
    expect(logger.error).toHaveBeenCalledWith('Failed to read CSV file:', 'Read error');
  });
});
