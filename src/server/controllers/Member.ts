import { injectable } from 'tsyringe';
import { Route, Response, Security, Get, Request } from 'tsoa';
import { Controller, Hidden } from '@tsoa/runtime';
import { NHRequest } from '../types/internal/NHRequest';
import { AuthSchemes } from '../middlewares/Authentication';
import { GetMemberResponse } from '../types/response/GetMemberResponse';

@injectable()
@Security(AuthSchemes.admin)
@Security('frontend-token')
@Route('api/members')
export class MembersController extends Controller {
  /**
   * Provides LoggedIn user details who is registered as org owner in the Notification Hub system. This Api is called directly from frontend app.
   * @summary Provides LoggedIn user details.
   */
  @Get('details')
  @Response<GetMemberResponse>('200', 'OK')
  @Hidden()
  public async getMember(@Request() request: NHRequest) {
    return {
      member: {
        name: request.user.member?.name,
      },
      organisation: {
        name: request.user.organisation?.name,
        id: request.user.organisation?._id,
      },
    };
  }
}
