import 'reflect-metadata';
import { Request } from 'express';
import { UnauthorizedError } from '../utils/errors/Unauthorized';
import { ForbiddenError } from '../utils/errors/Forbidden';
import { OrganisationService } from '../services/Organisation';
import { decodeFromBase64, verifyHMAC } from '../utils/KeyTools';
import { UserService } from '../services/User';
import * as dotenv from 'dotenv';
import { container } from 'tsyringe';
import { NHRequestUser } from '../types/internal/NHRequest';
import { logger } from '../utils/ServerLogger';
import { GoogleAuthUtil } from '../utils/GoogleAuthUtil';
import { MemberService } from '../services/Member';
dotenv.config();

export enum AuthSchemes {
  admin = 'admin',
  orgOwner = 'org-owner',
  orgLp = 'org-lp',
  orgUser = 'org-user',
  frontendToken = 'frontend-token',
}

export enum AuthHeaders {
  admin = 'x-admin-key',
  orgOwner = 'x-org-key',
  orgLp = 'x-org-lp-key',
  orgUser = 'x-org-user-key',
  userId = 'x-user-id',
  frontendToken = 'Authorization',
}

function logMessageMissingHeader(header: AuthHeaders) {
  logger.info(`Auth Header '${header.toUpperCase()}' is not present in Headers`);
}

function logMessageAuthenticated(authenticatedUser: NHRequestUser) {
  logger.info(`Authenticated!`, authenticatedUser);
}

export function adminAuthentication(request: Request): Promise<NHRequestUser> {
  const adminKey = request.header(AuthHeaders.admin);

  logger.info('Checking authentication with Admin Key', { adminKey });

  if (!adminKey) {
    logMessageMissingHeader(AuthHeaders.admin);

    return Promise.reject(new UnauthorizedError());
  }
  const adminKeyEnv = process.env.ADMIN_KEY as string;

  if (adminKey !== adminKeyEnv) {
    return Promise.reject(new ForbiddenError());
  }

  const resolvedUser: NHRequestUser = { role: AuthSchemes.admin };

  logMessageAuthenticated(resolvedUser);

  return Promise.resolve(resolvedUser);
}

export async function orgOwnerAuthentication(request: Request): Promise<NHRequestUser> {
  const encodedOrgKey = request.header(AuthHeaders.orgOwner);

  logger.info('Checking authentication with Org Owner Key', { encodedOrgKey });

  if (!encodedOrgKey) {
    logMessageMissingHeader(AuthHeaders.orgOwner);

    return Promise.reject(new UnauthorizedError());
  }
  const orgKey = decodeFromBase64(encodedOrgKey as string)?.split(',');
  if (orgKey.length !== 2) {
    return Promise.reject(new UnauthorizedError());
  }
  const apiKey = orgKey[0];
  const apiSecret = orgKey[1];

  const orgService = container.resolve(OrganisationService);
  const organisation = await orgService.verifySecretAndGetOrganisation(apiKey, apiSecret);

  const resolvedUser: NHRequestUser = { role: AuthSchemes.orgOwner, organisation: organisation };

  logMessageAuthenticated(resolvedUser);

  return Promise.resolve(resolvedUser);
}

export async function orgLowPrivilegeAuthentication(request: Request): Promise<NHRequestUser> {
  const apiKey = request.header(AuthHeaders.orgLp);
  const userId = request.header(AuthHeaders.userId);

  logger.info('Checking authentication with Org Low Privilege Key', { apiKey, userId });

  if (!apiKey) {
    logMessageMissingHeader(AuthHeaders.orgLp);

    return Promise.reject(new UnauthorizedError());
  }

  if (!userId) {
    logMessageMissingHeader(AuthHeaders.userId);

    return Promise.reject(new ForbiddenError());
  }

  const orgService = container.resolve(OrganisationService);
  const organisation = await orgService.getOrganisationByApiKey(apiKey);

  if (!organisation) {
    logger.info('Organisation Not Found');

    return Promise.reject(new UnauthorizedError());
  }

  const userService = container.resolve(UserService);

  const user = await userService.getUserByEmail(organisation!._id!, userId);

  if (!user) {
    logger.info('User Not Found');

    return Promise.reject(new ForbiddenError());
  }

  const resolvedUser: NHRequestUser = { role: AuthSchemes.orgLp, organisation: organisation, user: user! };

  logMessageAuthenticated(resolvedUser);

  return Promise.resolve(resolvedUser);
}

export async function orgUserAuthentication(request: Request): Promise<NHRequestUser> {
  const encodedUserKey = request.header(AuthHeaders.orgUser);

  logger.info('Checking authentication with Org User Key', { encodedUserKey });

  if (!encodedUserKey) {
    logMessageMissingHeader(AuthHeaders.orgUser);

    return Promise.reject(new UnauthorizedError());
  }
  const userKey = decodeFromBase64(encodedUserKey as string).split(',');

  if (userKey.length !== 3) {
    logger.info('Org User Key Components incomplete', { userKey });

    return Promise.reject(new UnauthorizedError());
  }

  const emailId = userKey[0];
  const apiKey = userKey[1];
  const hmac = userKey[2];

  const orgService = container.resolve(OrganisationService);
  const organisation = await orgService.getOrganisationByApiKey(apiKey);

  if (!organisation) {
    logger.info('Organisation Not Found');

    return Promise.reject(new UnauthorizedError());
  }

  if (!verifyHMAC(hmac, organisation!.api_secret_hash, emailId)) {
    logger.info('Secret could not be verified');

    return Promise.reject(new UnauthorizedError());
  }

  const userService = container.resolve(UserService);
  const user = await userService.getUserByEmail(organisation._id!.toString()!, emailId);

  if (!user) {
    logger.info('User Not Found');

    return Promise.reject(new ForbiddenError());
  }

  const resolvedUser: NHRequestUser = { role: AuthSchemes.orgUser, organisation: organisation, user: user };

  logMessageAuthenticated(resolvedUser);

  return Promise.resolve(resolvedUser);
}

export async function frontendTokenAuthentication(request: Request): Promise<NHRequestUser> {
  const authorizationHeader = request.header('Authorization');
  logger.info('Checking authentication with Bearer Token', { authorizationHeader });
  if (request.originalUrl !== '/auth/google/') {
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      logMessageMissingHeader(AuthHeaders.frontendToken);

      return Promise.reject(new UnauthorizedError());
    }
    const token = authorizationHeader.split(' ')[1];

    if (!token) {
      return Promise.reject({ message: 'Access token is missing' });
    }
    const payload = await GoogleAuthUtil.verifyToken(token);
    const email = payload.email;
    if (!email) {
      return Promise.reject({ message: 'Invalid Access Token' });
    }

    const memberService = container.resolve(MemberService);
    const member = await memberService.getMemberByEmailId(email);
    let organisation;

    if (member!.organisation_id) {
      const orgService = container.resolve(OrganisationService);
      organisation = await orgService.getOrganisationById(member!.organisation_id[0]);
    }

    const resolvedUser: NHRequestUser = {
      role: AuthSchemes.frontendToken,
      member: member!,
      organisation: organisation!,
    };

    logger.info('Authenticated user', resolvedUser);

    return Promise.resolve(resolvedUser);
  }

  return Promise.resolve({ role: AuthSchemes.frontendToken });
}

export async function expressAuthentication(
  request: Request,
  securityName: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  scopes?: string[],
): Promise<NHRequestUser> {
  logger.info('Security Scheme', securityName);

  switch (securityName) {
    case AuthSchemes.frontendToken:
      return frontendTokenAuthentication(request);
    case AuthSchemes.admin:
      return adminAuthentication(request);
    case AuthSchemes.orgOwner:
      return orgOwnerAuthentication(request);
    case AuthSchemes.orgLp:
      return orgLowPrivilegeAuthentication(request);
    case AuthSchemes.orgUser:
      return orgUserAuthentication(request);
    default:
      return Promise.reject({ status: 501, message: 'Unknown authorization strategy used' });
  }
}
