import 'reflect-metadata';
import { AuthController } from '../../../../src/server/controllers/Login';
import { LoginService } from '../../../../src/server/services/Login';
import { HttpStatusCode } from '../../../../src/server/types/Enum/HttpStatusCode';
import { LoginRequest } from './../../../../src/server/types/request/LoginRequest';

describe('LoginController', () => {
  let authController: AuthController;
  let loginServiceMock: LoginService;

  beforeEach(() => {
    loginServiceMock = {} as LoginService;
    authController = new AuthController(loginServiceMock);
    authController.setStatus = jest.fn();
  });

  it('Should singup user successfully', async () => {
    loginServiceMock.loginWithGoogle = jest.fn().mockResolvedValue({
      access_token: 'access_token',
      refresh_token: 'refresh_token',
      scope: 'scope',
      token_type: 'token_type',
      id_token: 'id_token',
      expiry_date: 'expiry_date',
    });

    const req: LoginRequest = {
      code: 'code',
    };

    const res = await authController.login(req);

    expect(authController.setStatus).toHaveBeenCalledWith(HttpStatusCode.OK);
    expect(res).toStrictEqual({
      access_token: 'access_token',
      refresh_token: 'refresh_token',
      scope: 'scope',
      token_type: 'token_type',
      id_token: 'id_token',
      expiry_date: 'expiry_date',
    });
  });

  it('should propagate error when loginWithGoogle fails', async () => {
    loginServiceMock.loginWithGoogle = jest.fn().mockRejectedValue(new Error('Invalid Member'));

    const req: LoginRequest = { code: 'invalid-code' };

    await expect(authController.login(req)).rejects.toThrow('Invalid Member');
  });
});
