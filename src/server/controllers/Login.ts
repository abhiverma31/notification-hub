import { inject, injectable } from 'tsyringe';
import { HttpStatusCode } from '../types/Enum/HttpStatusCode';
import { LoginService } from '../services/Login';
import { Body, Post, Route, SuccessResponse } from 'tsoa';
import { Controller, Hidden } from '@tsoa/runtime';
import { LoginResponse } from '../types/response/LoginResponse';
import { LoginRequest } from '../types/request/LoginRequest';

@injectable()
@Route('auth')
export class AuthController extends Controller {
  constructor(
    @inject(LoginService)
    private loginService: LoginService,
  ) {
    super();
  }

  /**
   * Login with Google from Frontend. this Api is also called directly from frontend using bearer token.
   * @summary Login with Google
   * @param {LoginRequest} loginRequest - The request body containing Google Access Token.
   */
  @Post('google')
  @SuccessResponse<LoginResponse>('200', 'LoggedIn')
  @Hidden()
  public async login(@Body() loginRequest: LoginRequest): Promise<LoginResponse> {
    const response: LoginResponse = await this.loginService.loginWithGoogle(loginRequest);
    this.setStatus(HttpStatusCode.OK);

    return response;
  }
}
