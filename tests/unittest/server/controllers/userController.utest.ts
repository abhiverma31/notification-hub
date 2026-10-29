import 'reflect-metadata';
import { UserController } from '../../../../src/server/controllers/User';
import { UserService } from '../../../../src/server/services/User';
import UserRepository from '../../../../src/shared-library/repositories/User';
import { CreateDeviceTokenRequest } from '../../../../src/server/types/request/CreateDeviceToken';
import { NHRequest } from '../../../../src/server/types/internal/NHRequest';
import { UserInterface } from '../../../../src/shared-library/models/User';
import { handleCsvFileUpload } from '../../../../src/shared-library/utils/files/handler';
import fs from 'fs/promises';
import { logger } from '../../../../src/server/utils/ServerLogger';

jest.mock('../../../../src/shared-library/repositories/User');
jest.mock('../../../../src/shared-library/utils/files/handler');
jest.mock('fs/promises');
jest.mock('../../../../src/server/utils/ServerLogger');

describe('UserController', () => {
  let userController: UserController;
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService({} as unknown as UserRepository);
    userController = new UserController(userService);
    userController.setStatus = jest.fn();
    userService.registerDevice = jest.fn().mockResolvedValue({
      organisationId: 'mocked-id',
      emailId: 'mocked-email',
      fcmTokenJson: 'mocked-fcm-token',
    });
  });

  it('should register a new device successfully', async () => {
    userService.registerDevice = jest.fn().mockResolvedValue({
      organisationId: 'mocked-id',
      emailId: 'mocked-email',
      fcmTokenJson: 'mocked-fcm-token',
    });
    const mockRequest = {
      user: {
        organisation: {
          _id: '65700801832930b3803258fb',
        },
      },
    } as NHRequest;
    const fcmTokenJson: CreateDeviceTokenRequest = {
      fcmToken: 'test-fcm-token',
    };

    await userController.registerDevice(mockRequest, 'mocked-email', fcmTokenJson);

    expect(userService.registerDevice).toHaveBeenCalledWith(
      mockRequest.user.organisation?._id,
      'mocked-email',
      fcmTokenJson,
    );
  });

  it('should return 200 when user is successfully created', async () => {
    const mockUser = {
      email: 'test-email',
      name: {
        first: 'test-first',
        last: 'test-last',
      },
    };
    userService.createUser = jest.fn().mockResolvedValue(mockUser);
    const mockRequest = {
      user: {
        organisation: {
          _id: '65700801832930b3803258fb',
        },
      },
    } as NHRequest;
    await userController.User(mockRequest, mockUser);
    expect(userService.createUser).toHaveBeenCalledWith(mockRequest.user.organisation?._id, mockUser);
    expect(userController.setStatus).toHaveBeenCalledWith(200);
  });

  it('should return 200 when user is successfully updated', async () => {
    const mockUser = {
      email: 'test-email',
      name: {
        first: 'test-first',
        last: 'test-last',
      },
    };
    userService.updateUser = jest.fn().mockResolvedValue(mockUser);
    const mockRequest = {
      user: {
        organisation: {
          _id: '65700801832930b3803258fb',
        },
      },
    } as NHRequest;
    await userController.updateUser(mockRequest, 'test-email', mockUser);
    expect(userService.updateUser).toHaveBeenCalledWith(mockRequest.user.organisation?._id, 'test-email', mockUser);
    expect(userController.setStatus).toHaveBeenCalledWith(200);
  });

  describe('getUserList controller', () => {
    const request = {
      user: {
        organisation: {
          _id: '66fa658183835074c9ef20cf',
        },
      },
    } as NHRequest;

    it('should return array of users', async () => {
      const expectedUserList = [
        {
          _id: '66fa658183835074c9ef20cf::test@test.com',
          schema_version: 1,
          email: 'test@test.com',
          name: {
            first: 'First',
            last: 'Last',
          },
          last_updated_by: 'notification-engine',
          fcm_device_tokens: [],
          created_at: new Date('2024-09-30T08:46:57.530Z'),
          updated_at: new Date('2024-09-30T08:46:57.530Z'),
        },
        {
          _id: '66fa658183835074c9ef20cf::try@test.com',
          schema_version: 1,
          email: 'try@test.com',
          name: {
            first: 'Test',
            last: 'Name',
          },
          last_updated_by: 'notification-engine',
          fcm_device_tokens: [],
          created_at: new Date('2024-09-30T08:46:57.530Z'),
          updated_at: new Date('2024-09-30T08:46:57.530Z'),
        },
      ];
      userService.getUserList = jest.fn().mockResolvedValue(expectedUserList);
      const result = await userController.getUserList(request, 0, 10);
      expect(result).toEqual(expectedUserList);
      expect(result).toHaveLength(2);
    });

    it('should return empty array of users when users not found', async () => {
      const expectedUserList: UserInterface[] = [];
      userService.getUserList = jest.fn().mockResolvedValue(expectedUserList);
      const result = await userController.getUserList(request, 0, 10);
      expect(result).toEqual(expectedUserList);
      expect(result).toHaveLength(0);
    });
  });

  describe('createUsersFromCsvController', () => {
    let mockRequest: NHRequest;
    const organisationId = '65700801832930b3803258fb';

    beforeEach(() => {
      mockRequest = {
        user: {
          organisation: {
            _id: organisationId,
          },
        },
      } as NHRequest;

      userService.createUsersFromCsv = jest.fn();
    });

    it('should successfully create users from CSV file and return correct success', async () => {
      const tempFilePath = '/path/to/temp/file.csv';

      const mockFile = {
        originalname: 'users.csv',
        buffer: Buffer.from('some csv content'),
      } as Express.Multer.File;

      (handleCsvFileUpload as jest.Mock).mockReturnValue({ tempFilePath, error: null });

      const successCount = 10;

      userService.createUsersFromCsv = jest.fn().mockResolvedValue({ successCount });
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await userController.createUsersFromCsvController(mockRequest, mockFile);

      expect(handleCsvFileUpload).toHaveBeenCalledWith(mockFile);
      expect(userService.createUsersFromCsv).toHaveBeenCalledWith(tempFilePath, organisationId);
      expect(result).toEqual({
        message: 'Users created successfully',
        successCount,
      });
      expect(userController.setStatus).not.toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalledWith(tempFilePath);
    });

    it('should return 400 if CSV upload fails', async () => {
      const mockFile = {
        originalname: 'users.csv',
        buffer: Buffer.from('some csv content'),
      } as Express.Multer.File;

      (handleCsvFileUpload as jest.Mock).mockReturnValue({ tempFilePath: null, error: 'Invalid file format' });

      const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();

      const result = await userController.createUsersFromCsvController(mockRequest, mockFile);

      expect(handleCsvFileUpload).toHaveBeenCalledWith(mockFile);
      expect(userService.createUsersFromCsv).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Invalid file format' });
      expect(userController.setStatus).toHaveBeenCalledWith(400);
      expect(loggerErrorSpy).toHaveBeenCalledWith('CSV upload failed: %s', 'Invalid file format');
    });

    it('should return 500 if userService.createUsersFromCsv throws an error', async () => {
      const tempFilePath = '/path/to/temp/file.csv';

      const mockFile = {
        originalname: 'users.csv',
        buffer: Buffer.from('some csv content'),
      } as Express.Multer.File;

      (handleCsvFileUpload as jest.Mock).mockReturnValue({ tempFilePath, error: null });
      const errorMessage = 'Service error';
      userService.createUsersFromCsv = jest.fn().mockRejectedValue(new Error(errorMessage));
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation();

      const result = await userController.createUsersFromCsvController(mockRequest, mockFile);

      expect(handleCsvFileUpload).toHaveBeenCalledWith(mockFile);
      expect(userService.createUsersFromCsv).toHaveBeenCalledWith(tempFilePath, organisationId);
      expect(result).toEqual({ message: 'Failed to create users', details: errorMessage });
      expect(userController.setStatus).toHaveBeenCalledWith(500);
      expect(loggerErrorSpy).toHaveBeenCalledWith('Error while creating users from CSV:', errorMessage);
      expect(fs.unlink).toHaveBeenCalledWith(tempFilePath);
    });
  });
});
