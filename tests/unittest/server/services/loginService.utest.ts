import 'reflect-metadata';
import { LoginService } from '../../../../src/server/services/Login';
import { LoginRequest } from '../../../../src/server/types/request/LoginRequest';
import { OAuth2Client } from 'google-auth-library';
import { BadRequest } from '../../../../src/server/utils/errors/BadRequest';
import { MemberService } from '../../../../src/server/services/Member';

jest.mock('google-auth-library');
jest.mock('node-fetch');

describe('LoginService', () => {
  let loginService: LoginService;
  let memberServiceMock: jest.Mocked<MemberService>;

  beforeEach(() => {
    memberServiceMock = {
      getMemberByEmailId: jest.fn(),
      addMember: jest.fn(),
    } as unknown as jest.Mocked<MemberService>;

    loginService = new LoginService(memberServiceMock);
    jest.mock('node-fetch');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loginWithGoogle', () => {
    it('should successfully log in with Google', async () => {
      const authLogin: LoginRequest = {
        code: 'mocked-auth-code',
      };

      // Mock OAuth2Client methods and response
      const mockGetToken = jest.fn().mockResolvedValueOnce({ tokens: { access_token: 'mocked-access-token' } });
      (OAuth2Client as unknown as jest.Mock).mockImplementation(() => ({
        getToken: mockGetToken,
      }));

      const memberInfo = { email: 'test@example.com', name: 'Test User' };
      const mockResponse = {
        ok: true, // Indicating a successful response
        json: jest.fn().mockResolvedValueOnce(memberInfo),
      };

      // Mock the fetch implementation using spyOn
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

      memberServiceMock.getMemberByEmailId.mockResolvedValueOnce(null);

      // Execute the method under test
      const result = await loginService.loginWithGoogle(authLogin);

      // Verify the interactions
      expect(mockGetToken).toHaveBeenCalledWith({ code: authLogin.code });
      expect(fetchMock).toHaveBeenCalledWith('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer mocked-access-token` },
      });
      expect(memberServiceMock.getMemberByEmailId).toHaveBeenCalledWith(memberInfo.email);
      expect(memberServiceMock.addMember).toHaveBeenCalledWith({
        _id: expect.any(String), // Ensure randomUUID is called for _id
        email: memberInfo.email,
        name: { first: 'Test', last: 'User' },
      });
      expect(result).toEqual({ access_token: 'mocked-access-token' });
    });

    it('should handle invalid response from Google userinfo endpoint', async () => {
      const authLogin: LoginRequest = {
        code: 'mocked-auth-code',
      };
      const mockGetToken = jest.fn().mockResolvedValueOnce({ tokens: { access_token: 'mocked-access-token' } });
      OAuth2Client.mockImplementation(() => ({
        getToken: mockGetToken,
      }));

      const mockResponse = {
        ok: false, // Indicating an unsuccessful response
        statusText: 'Unauthorized',
      };

      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

      await expect(loginService.loginWithGoogle(authLogin)).rejects.toThrow(BadRequest);

      expect(mockGetToken).toHaveBeenCalledWith({ code: authLogin.code });
      expect(fetchMock).toHaveBeenCalledWith('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer mocked-access-token` },
      });
      expect(memberServiceMock.getMemberByEmailId).not.toHaveBeenCalled();
      expect(memberServiceMock.addMember).not.toHaveBeenCalled();
    });

    it('should handle existing user', async () => {
      const authLogin: LoginRequest = {
        code: 'mocked-auth-code',
      };
      const mockGetToken = jest.fn().mockResolvedValueOnce({ tokens: { access_token: 'mocked-access-token' } });
      OAuth2Client.mockImplementation(() => ({
        getToken: mockGetToken,
      }));

      const userInfo = { email: 'test@example.com', name: 'Test User' };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValueOnce(userInfo),
      };

      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse);

      memberServiceMock.getMemberByEmailId.mockResolvedValueOnce({});

      const result = await loginService.loginWithGoogle(authLogin);

      expect(mockGetToken).toHaveBeenCalledWith({ code: authLogin.code });
      expect(fetchMock).toHaveBeenCalledWith('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer mocked-access-token` },
      });
      expect(memberServiceMock.getMemberByEmailId).toHaveBeenCalledWith(userInfo.email);
      expect(memberServiceMock.addMember).not.toHaveBeenCalled();

      expect(result).toEqual({ access_token: 'mocked-access-token' });
    });
  });
});
