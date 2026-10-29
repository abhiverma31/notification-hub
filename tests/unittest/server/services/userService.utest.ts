import 'reflect-metadata';
import { UserService } from '../../../../src/server/services/User';
import { CreateDeviceTokenRequest } from '../../../../src/server/types/request/CreateDeviceToken';
import { UserInterface } from '../../../../src/shared-library/models/User';
import UserRepository from '../../../../src/shared-library/repositories/User';
import { CreateUser } from '../../../../src/server/types/request/CreateUser';
import { parseCsvFile } from '../../../../src/server/utils/csvParser';
import { BadRequest } from '../../../../src/server/utils/errors/BadRequest';

jest.mock('../../../../src/shared-library/repositories/User');
jest.mock('../../../../src/server/utils/csvParser');

describe('UserService', () => {
  let userService: UserService;
  let userRepositoryMock: jest.Mocked<UserRepository>;
  const defaultUserId = '3c25d554-8c45-42f8-9c52-270b5e8341ed';

  beforeEach(() => {
    userRepositoryMock = new UserRepository() as jest.Mocked<UserRepository>;
    userService = new UserService(userRepositoryMock);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserByEmail', () => {
    it('should return user when provided email exists', async () => {
      const existingUser: UserInterface = {
        _id: 'testOrg::user@technogise.com',
        user_id: defaultUserId,
        email: 'user@technogise.com',
        last_updated_by: 'notification-engine',
      };
      userRepositoryMock.findByOrgIdEmailId.mockResolvedValueOnce(existingUser);

      const result = await userService.getUserByEmail('testOrg', 'user@technogise.com');

      expect(result).toEqual(existingUser);
      expect(userRepositoryMock.findByOrgIdEmailId).toHaveBeenCalledWith('testOrg', 'user@technogise.com');
    });
  });

  describe('registerDevice', () => {
    it('should return existing user when provided email exists and FCM token is already associated', async () => {
      const existingUser: UserInterface = {
        _id: 'testOrg::user@technogise.com',
        user_id: defaultUserId,
        email: 'user@technogise.com',
        last_updated_by: 'notification-engine',
        fcm_device_tokens: [
          {
            token: 'existingToken',
          },
        ],
      };
      userRepositoryMock.findByOrgIdEmailId.mockResolvedValueOnce(existingUser);
      const fcmTokenJson: CreateDeviceTokenRequest = { fcmToken: 'existingToken' };

      const result = await userService.registerDevice('testOrg', 'user@example.com', fcmTokenJson);

      expect(result).toEqual(existingUser);
      expect(userRepositoryMock.updateFcmToken).not.toHaveBeenCalled();
      expect(userRepositoryMock.upsert).not.toHaveBeenCalled();
    });

    it('should update FCM token for existing user when provided email exists but FCM token is new', async () => {
      const existingUser: UserInterface = {
        _id: 'testOrg::user@technogise.com',
        user_id: defaultUserId,
        email: 'user@technogise.com',
        last_updated_by: 'notification-engine',
        fcm_device_tokens: [
          {
            token: 'existingToken',
          },
        ],
      };
      const updatedUser: UserInterface = {
        _id: 'testOrg::user@technogise.com',
        user_id: defaultUserId,
        email: 'user@technogise.com',
        last_updated_by: 'notification-engine',
        fcm_device_tokens: [
          {
            token: 'existingToken',
          },
          {
            token: 'newToken',
          },
        ],
      };
      userRepositoryMock.findByOrgIdEmailId.mockResolvedValueOnce(existingUser);
      userRepositoryMock.updateFcmToken.mockResolvedValueOnce(updatedUser);
      const fcmTokenJson: CreateDeviceTokenRequest = { fcmToken: 'newToken' };

      const result = await userService.registerDevice('testOrg', 'user@technogise.com', fcmTokenJson);

      expect(result).toEqual(updatedUser);
      expect(userRepositoryMock.updateFcmToken).toHaveBeenCalledWith('testOrg', 'user@technogise.com', {
        token: 'newToken',
      });
    });

    it('should create new user when provided email does not exist', async () => {
      const newUser: UserInterface = {
        _id: 'testOrg::user@technogise.com',
        user_id: defaultUserId,
        email: 'user@technogise.com',
        fcm_device_tokens: [{ token: 'newToken' }],
      };
      userRepositoryMock.findByOrgIdEmailId.mockResolvedValueOnce(null);
      userRepositoryMock.upsert.mockResolvedValueOnce(newUser);
      const fcmTokenJson: CreateDeviceTokenRequest = { fcmToken: 'newToken' };

      const result = await userService.registerDevice('testOrg', 'user@example.com', fcmTokenJson);

      expect(result).toEqual(newUser);
      expect(userRepositoryMock.updateFcmToken).not.toHaveBeenCalled();
      expect(userRepositoryMock.upsert).toHaveBeenCalledWith({
        email: 'user@example.com',
        _id: 'testOrg::user@example.com',
        user_id: expect.any(String),
        fcm_device_tokens: [{ token: 'newToken' }],
      });
    });
  });

  describe('upsertUser', () => {
    it('should upsert user when provided email does not exist', async () => {
      const newUser: UserInterface = {
        _id: 'testOrg::user@technogise.com',
        user_id: defaultUserId,
        email: 'user@technogise.com',
      };
      userRepositoryMock.upsert.mockResolvedValueOnce(newUser);
      const user: CreateUser = {
        email: 'user@technogise.com',
        name: {
          first: 'John',
          last: 'Doe',
        },
      };

      const result = await userService.createUser('testOrg', user);

      expect(result).toEqual(newUser);
      expect(userRepositoryMock.upsert).toHaveBeenCalledWith({
        email: 'user@technogise.com',
        _id: 'testOrg::user@technogise.com',
        user_id: expect.any(String),
        name: {
          first: 'John',
          last: 'Doe',
        },
      });
    });

    it('should upsert user when provided email exist', async () => {
      const newUser: UserInterface = {
        _id: 'testOrg::user@technogise.com',
        user_id: defaultUserId,
        email: 'user@technogise.com',
      };
      userRepositoryMock.upsert.mockResolvedValueOnce(newUser);
      const user: CreateUser = {
        name: {
          first: 'John',
          last: 'Doe',
        },
      };

      const result = await userService.updateUser('testOrg', 'user@technogise.com', user);

      expect(result).toEqual(newUser);
      expect(userRepositoryMock.upsert).toHaveBeenCalledWith({
        email: 'user@technogise.com',
        _id: 'testOrg::user@technogise.com',
        user_id: expect.any(String),
        name: {
          first: 'John',
          last: 'Doe',
        },
      });
    });

    describe('fetch user list', () => {
      it('should return a list of all users', async () => {
        const orgId = '66fa658183835074c9ef20cf';
        const userList: UserInterface[] = [
          {
            _id: '66fa658183835074c9ef20cf::test@test.com',
            user_id: defaultUserId,
            schema_version: 3,
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
            user_id: defaultUserId,
            schema_version: 3,
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
        (UserRepository.prototype.getUserList as jest.Mock).mockResolvedValue(userList);

        const result = await userService.getUserList(orgId, 0, 10, 'email', 'asc');

        expect(UserRepository.prototype.getUserList).toHaveBeenCalledWith(orgId, 0, 10, 'email', 'asc');
        expect(result?.userList).toEqual(userList);
        expect(result?.userList).toHaveLength(2);
      });

      it('should return empty list if no users available', async () => {
        const orgId = '66fa658183835074c9ef20cf';
        const userList: UserInterface[] = [];
        (UserRepository.prototype.getUserList as jest.Mock).mockResolvedValue(userList);

        const result = await userService.getUserList(orgId, 0, 10);

        expect(UserRepository.prototype.getUserList).toHaveBeenCalledWith(orgId, 0, 10, 'updated_at', 'desc');
        expect(result?.userList).toEqual(userList);
        expect(result?.userList).toHaveLength(0);
      });

      it('should return a list of paginated users', async () => {
        const orgId = '66fa658183835074c9ef20cf';
        const expectedUserList: UserInterface[] = [
          {
            _id: '66fa658183835074c9ef20cf::test@test.com',
            user_id: defaultUserId,
            schema_version: 3,
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
            user_id: defaultUserId,
            schema_version: 3,
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

        (UserRepository.prototype.getUserList as jest.Mock).mockResolvedValue(expectedUserList);
        (UserRepository.prototype.countUsersByOrgId as jest.Mock).mockResolvedValue(2);

        const result = await userService.getUserList(orgId, 0, 2);

        expect(UserRepository.prototype.getUserList).toHaveBeenCalledWith(orgId, 0, 2, 'updated_at', 'desc');
        expect(result?.userList).toEqual(expectedUserList);
        expect(result?.userList).toHaveLength(2);
        expect(result?.pagination?.itemsPerPage).toEqual(2);
        expect(result?.pagination?.totalUsers).toEqual(2);
        expect(result?.pagination?.totalPages).toEqual(1);
      });
    });
  });

  describe('createUsersFromCsv', () => {
    it('should parse CSV file, create users, and return correct success', async () => {
      const mockUsers = [
        { email: 'user1@example.com', firstName: 'John', lastName: 'Doe', phoneNumber: '1234567890' },
        { email: 'user2@example.com', firstName: 'Jane', lastName: 'Doe', phoneNumber: '0987654321' },
      ];

      const parseCsvFileMock = parseCsvFile as jest.MockedFunction<typeof parseCsvFile>;
      parseCsvFileMock.mockResolvedValueOnce(mockUsers);

      const createUserSpy = jest.spyOn(userService, 'createUser');
      createUserSpy.mockResolvedValueOnce({} as any);
      createUserSpy.mockRejectedValueOnce(new Error('Failed to create user'));

      const loggerErrorSpy = jest.spyOn(userService['logger'], 'error').mockImplementation();

      const filePath = '/path/to/file.csv';
      const organisationId = 'testOrg';

      const result = await userService.createUsersFromCsv(filePath, organisationId);

      expect(parseCsvFileMock).toHaveBeenCalledWith(filePath);
      expect(createUserSpy).toHaveBeenCalledTimes(mockUsers.length);
      expect(loggerErrorSpy).toHaveBeenCalledWith(`Failed to create user: ${mockUsers[1].email}`, expect.any(Error));

      expect(result).toEqual({ successCount: 1 });
    });

    it('should throw BadRequest when parseCsvFile fails', async () => {
      const parseCsvFileMock = parseCsvFile as jest.MockedFunction<typeof parseCsvFile>;
      parseCsvFileMock.mockRejectedValueOnce(new Error('Failed to parse CSV'));

      const filePath = '/path/to/file.csv';
      const organisationId = 'testOrg';

      await expect(userService.createUsersFromCsv(filePath, organisationId)).rejects.toThrow(BadRequest);

      expect(parseCsvFileMock).toHaveBeenCalledWith(filePath);
    });

    it('should log error when createUser fails for a user', async () => {
      const mockUsers = [
        { email: 'user1@example.com', firstName: 'John', lastName: 'Doe', phoneNumber: '1234567890' },
        { email: 'user2@example.com', firstName: 'Jane', lastName: 'Doe', phoneNumber: '0987654321' },
      ];

      const parseCsvFileMock = parseCsvFile as jest.MockedFunction<typeof parseCsvFile>;
      parseCsvFileMock.mockResolvedValueOnce(mockUsers);

      const createUserSpy = jest.spyOn(userService, 'createUser');
      createUserSpy.mockResolvedValueOnce({} as any);
      createUserSpy.mockRejectedValueOnce(new Error('Failed to create user'));

      const loggerErrorSpy = jest.spyOn(userService['logger'], 'error').mockImplementation();

      const filePath = '/path/to/file.csv';
      const organisationId = 'testOrg';

      await userService.createUsersFromCsv(filePath, organisationId);

      expect(createUserSpy).toHaveBeenCalledTimes(mockUsers.length);
      expect(loggerErrorSpy).toHaveBeenCalledWith(`Failed to create user: ${mockUsers[1].email}`, expect.any(Error));
    });

    it('should return zero counts when no users are parsed from CSV', async () => {
      const parseCsvFileMock = parseCsvFile as jest.MockedFunction<typeof parseCsvFile>;
      parseCsvFileMock.mockResolvedValueOnce([]);

      const createUserSpy = jest.spyOn(userService, 'createUser');

      const filePath = '/path/to/empty.csv';
      const organisationId = 'testOrg';

      const result = await userService.createUsersFromCsv(filePath, organisationId);

      expect(parseCsvFileMock).toHaveBeenCalledWith(filePath);
      expect(createUserSpy).not.toHaveBeenCalled();

      expect(result).toEqual({ successCount: 0 });
    });
  });
});
