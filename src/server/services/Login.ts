import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { LoginRequest } from '../types/request/LoginRequest';
import { LoginResponse } from '../types/response/LoginResponse';
import { randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/ServerLogger';
import { BadRequest } from '../utils/errors/BadRequest';
import { MemberService } from './Member';

interface MemberInfo {
  email: string;
  name: string;
}

@injectable()
export class LoginService {
  constructor(@inject(MemberService) private memberService: MemberService) {}

  public async loginWithGoogle(authLogin: LoginRequest): Promise<LoginResponse> {
    const oAuth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'postmessage',
    );

    const { tokens } = await oAuth2Client.getToken({
      code: authLogin.code,
    });
    logger.info('tokens ', tokens);

    const accessToken = tokens.access_token;

    const memberInfoEndpoint = 'https://www.googleapis.com/oauth2/v3/userinfo';
    const response = await fetch(memberInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log('response ', response);
    if (!response.ok) {
      logger.error('Failed to fetch member information:', response.statusText);
      throw new BadRequest('Invalid Member');
    }

    const memberInfo: MemberInfo = (await response.json()) as MemberInfo;
    logger.info('Member Information:', memberInfo);

    const existingMember = await this.memberService.getMemberByEmailId(memberInfo.email);

    if (!existingMember) {
      const [first, last] = memberInfo.name.split(' ');
      await this.memberService.addMember({
        _id: randomUUID(),
        email: memberInfo.email,
        name: {
          first,
          last,
        },
      });
    }

    // @ts-ignore
    return tokens;
  }
}
