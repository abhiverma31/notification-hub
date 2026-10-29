import { Request } from 'express';
import * as authentication from '../../../../src/server/middlewares/Authentication';
import { OrganisationService } from '../../../../src/server/services/Organisation';
import { OrganisationInterface } from '../../../../src/shared-library/models/Organisation';
import { UnauthorizedError } from '../../../../src/server/utils/errors/Unauthorized';
import { UserInterface } from '../../../../src/shared-library/models/User';
import { NHRequestUser } from '../../../../src/server/types/internal/NHRequest';
import * as keyTools from '../../../../src/server/utils/KeyTools';
import { UserService } from '../../../../src/server/services/User';
import { GoogleAuthUtil } from '../../../../src/server/utils/GoogleAuthUtil';
import { InjectionToken, container } from 'tsyringe';
import { MemberInterface } from '../../../../src/shared-library/models/Member';
import { MemberService } from '../../../../src/server/services/Member';

jest.mock('../../../../src/server/utils/GoogleAuthUtil');
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));
jest.mock('../../../../src/server/services/Organisation.ts');
jest.mock('../../../../src/server/services/Member');

describe('Admin Authentication', () => {
  beforeAll(() => {
    process.env.ADMIN_KEY = 'validAdminKey';
  });

  afterAll(() => {
    delete process.env.ADMIN_KEY;
  });

  it('should return admin user for valid admin key', async () => {
    const requestMock: Request = {
      headers: { 'x-admin-key': 'validAdminKey' },
      header: jest.fn().mockReturnValue('validAdminKey'),
    } as any;

    const result = await authentication.adminAuthentication(requestMock);
    expect(result).toEqual({ role: 'admin' });
  });

  it('should reject with ForbiddenError for missing admin key', async () => {
    const requestMock: Request = {
      headers: {},
      header: jest.fn().mockReturnValue(undefined),
    } as any;

    await expect(authentication.adminAuthentication(requestMock)).rejects.toEqual(new UnauthorizedError());
  });
});

describe('Org Owner Authentication', () => {
  it('should return org owner for valid API key and verified organization', async () => {
    const requestMock: Request = {
      headers: { 'x-org-key': 'BaseEncodedApiKey' },
      header: jest.fn().mockReturnValue('BaseEncodedApiKey'),
    } as any;
    const expectedResult = {
      organisation: {
        api_key: 'orgKey',
        api_secret_hash: 'secretHash',
        id: 'verifiedOrgId',
        name: 'SomeOrg',
      },
      role: 'org-owner',
    };
    jest.spyOn(keyTools, 'decodeFromBase64').mockReturnValue('orgKey,secretHash');
    const organisationServiceMock = OrganisationService as jest.MockedClass<typeof OrganisationService>;
    organisationServiceMock.prototype.verifySecretAndGetOrganisation.mockResolvedValue({
      id: 'verifiedOrgId',
      name: 'SomeOrg',
      api_key: 'orgKey',
      api_secret_hash: 'secretHash',
    } as OrganisationInterface);

    const result = await authentication.orgOwnerAuthentication(requestMock);
    expect(result).toEqual(expectedResult);
  });

  it('should reject with UnauthorizedError for missing API key', async () => {
    const requestMock: Request = {
      headers: {},
      header: jest.fn().mockReturnValue(''),
    } as any;
    jest.spyOn(keyTools, 'decodeFromBase64').mockReturnValue('');
    await expect(authentication.orgOwnerAuthentication(requestMock)).rejects.toEqual(new UnauthorizedError());
  });

  it('should reject with UnauthorizedError for missing or invalid parts in API key', async () => {
    const requestMock: Request = {
      headers: { 'x-org-key': 'BaseEncodedApiKey' },
      header: jest.fn().mockReturnValue('BaseEncodedApiKey'),
    } as any;
    jest.spyOn(keyTools, 'decodeFromBase64').mockReturnValue('validApiKey');
    await expect(authentication.orgOwnerAuthentication(requestMock)).rejects.toEqual(new UnauthorizedError());
  });
});

describe('Org Low Privilege Authentication', () => {
  it('should return org-lp user for valid API key and user', async () => {
    const requestMock: Request = {
      headers: { 'x-org-lp-key': 'validApiKey', 'x-user-id': 'user@test.com' },
      header: jest.fn((name: string) => {
        if (name === 'x-org-lp-key') return 'validApiKey';
        if (name === 'x-user-id') return 'user@test.com';
        return undefined;
      }),
    } as any;

    const organisation: Partial<OrganisationInterface> = { _id: 'org-1', name: 'TestOrg' };
    const user: Partial<UserInterface> = { _id: 'user-1', email: 'user@test.com' };

    (OrganisationService.prototype.getOrganisationByApiKey as jest.Mock).mockResolvedValue(organisation);
    jest.spyOn(UserService.prototype, 'getUserByEmail').mockResolvedValue(user as UserInterface);

    const result = await authentication.orgLowPrivilegeAuthentication(requestMock);

    expect(result.role).toBe('org-lp');
    expect(result.organisation).toEqual(organisation);
    expect(result.user).toEqual(user);
  });

  it('should reject with UnauthorizedError when API key is missing', async () => {
    const requestMock: Request = {
      headers: {},
      header: jest.fn().mockReturnValue(undefined),
    } as any;

    await expect(authentication.orgLowPrivilegeAuthentication(requestMock)).rejects.toEqual(new UnauthorizedError());
  });

  it('should reject with ForbiddenError when user-id header is missing', async () => {
    const requestMock: Request = {
      headers: { 'x-org-lp-key': 'validApiKey' },
      header: jest.fn((name: string) => {
        if (name === 'x-org-lp-key') return 'validApiKey';
        return undefined;
      }),
    } as any;

    await expect(authentication.orgLowPrivilegeAuthentication(requestMock)).rejects.toBeDefined();
  });

  it('should reject with UnauthorizedError when organisation not found', async () => {
    const requestMock: Request = {
      headers: { 'x-org-lp-key': 'invalidKey', 'x-user-id': 'user@test.com' },
      header: jest.fn((name: string) => {
        if (name === 'x-org-lp-key') return 'invalidKey';
        if (name === 'x-user-id') return 'user@test.com';
        return undefined;
      }),
    } as any;

    (OrganisationService.prototype.getOrganisationByApiKey as jest.Mock).mockResolvedValue(null);

    await expect(authentication.orgLowPrivilegeAuthentication(requestMock)).rejects.toEqual(new UnauthorizedError());
  });

  it('should reject with ForbiddenError when user not found', async () => {
    const requestMock: Request = {
      headers: { 'x-org-lp-key': 'validApiKey', 'x-user-id': 'unknown@test.com' },
      header: jest.fn((name: string) => {
        if (name === 'x-org-lp-key') return 'validApiKey';
        if (name === 'x-user-id') return 'unknown@test.com';
        return undefined;
      }),
    } as any;

    const organisation: Partial<OrganisationInterface> = { _id: 'org-1' };
    (OrganisationService.prototype.getOrganisationByApiKey as jest.Mock).mockResolvedValue(organisation);
    jest.spyOn(UserService.prototype, 'getUserByEmail').mockResolvedValue(null);

    await expect(authentication.orgLowPrivilegeAuthentication(requestMock)).rejects.toBeDefined();
  });
});

describe('Org User Authentication', () => {
  it('should return org user for valid API key, verified organization, and verified HMAC', async () => {
    const requestMock: Request = {
      headers: { 'x-org-user-key': 'BaseEncodedApiKey' },
      header: jest.fn().mockReturnValue('BaseEncodedApiKey'),
    } as any;
    jest.spyOn(keyTools, 'decodeFromBase64').mockReturnValue('email,validApiKey,verifiedHmac');
    const organisation: Partial<OrganisationInterface> = {
      _id: 'verifiedOrgId',
      api_secret_hash: 'secretHash',
    };

    const user: Partial<UserInterface> = {};

    const expectedResult: NHRequestUser = {
      organisation: organisation as OrganisationInterface,
      user: user as UserInterface,
      role: 'org-user',
    };

    (OrganisationService.prototype.getOrganisationByApiKey as jest.Mock).mockResolvedValue(organisation);

    jest.spyOn(keyTools, 'verifyHMAC').mockReturnValue(true);

    const getUserByEmailMock = jest.fn();
    getUserByEmailMock.mockResolvedValue({});
    jest.spyOn(UserService.prototype, 'getUserByEmail').mockImplementation(getUserByEmailMock);

    const result = await authentication.orgUserAuthentication(requestMock);
    expect(result).toEqual(expectedResult);
  });

  it('should reject with UnauthorizedError for missing API key', async () => {
    const requestMock: Request = {
      headers: { 'x-org-user-key': 'BaseEncodedApiKeyWithMissingApi' },
      header: jest.fn().mockReturnValue('BaseEncodedApiKeyWithMissingApi'),
    } as any;
    jest.spyOn(keyTools, 'decodeFromBase64').mockReturnValue('email,verifiedHmac');
    await expect(authentication.orgUserAuthentication(requestMock)).rejects.toEqual(new UnauthorizedError());
  });

  it('should reject with UnauthorizedError for missing or invalid parts in API key', async () => {
    const requestMock: Request = {
      headers: { 'x-org-user-key': 'BaseEncodedApiKeyWithMissingEmail' },
      header: jest.fn().mockReturnValue('BaseEncodedApiKeyWithMissingEmail'),
    } as any;

    jest.spyOn(keyTools, 'decodeFromBase64').mockReturnValue('validApiKey,verifiedHmac');
    await expect(authentication.orgUserAuthentication(requestMock)).rejects.toEqual(new UnauthorizedError());
  });

  it('should reject with UnauthorizedError for HMAC verification failure', async () => {
    const requestMock: Request = {
      headers: { 'x-org-user-key': 'email,validApiKey,verifiedHmac' },
      header: jest.fn().mockReturnValue('email,validApiKey,verifiedHmac'),
    } as any;

    jest.spyOn(keyTools, 'decodeFromBase64').mockReturnValue('email,validApiKey,verifiedHmac');
    jest.spyOn(keyTools, 'verifyHMAC').mockReturnValue(false);
    await expect(authentication.orgUserAuthentication(requestMock)).rejects.toEqual(new UnauthorizedError());
  });
});

describe('Frontend Authentication', () => {
  let request;
  let verifyTokenSpy;
  let mockMemberRepository;

  beforeEach(() => {
    request = {
      header: jest.fn(),
      originalUrl: '',
    };
    verifyTokenSpy = jest.spyOn(GoogleAuthUtil, 'verifyToken');
    mockMemberRepository = {
      findMemberByEmailId: jest.fn(),
    };
    jest.spyOn(container, 'resolve').mockReturnValue(mockMemberRepository);
  });

  afterEach(() => {
    verifyTokenSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('should return 403 if token is expired', async () => {
    const token = 'validToken';
    const requestMock: Request = {
      headers: { authorization: `Bearer ${token}` },
      header: jest.fn().mockReturnValue(`Bearer ${token}`),
    } as any;
    verifyTokenSpy.mockRejectedValue({ message: 'Access token has expired' });
    await expect(authentication.frontendTokenAuthentication(requestMock)).rejects.toEqual({
      message: 'Access token has expired',
    });
  });

  it('should return 403 if token is invalid', async () => {
    const token = 'invalidToken';
    const requestMock: Request = {
      headers: { authorization: `Bearer ${token}` },
      header: jest.fn().mockReturnValue(`Bearer ${token}`),
    } as any;
    verifyTokenSpy.mockResolvedValueOnce(new UnauthorizedError('Invalid access token'));
    await expect(authentication.frontendTokenAuthentication(requestMock)).rejects.toEqual({
      message: 'Invalid Access Token',
    });
  });

  it('should pass if token is valid', async () => {
    const token = 'validToken';
    const requestMock: Request = {
      headers: { authorization: `Bearer ${token}` },
      header: jest.fn().mockReturnValue(`Bearer ${token}`),
    } as any;
    verifyTokenSpy.mockResolvedValueOnce({
      email: 'sandhya@technogise.com',
      email_verified: true,
      name: 'Sandhya Hathwar',
      given_name: 'Sandhya',
      family_name: 'Hathwar',
    });
    const member: MemberInterface = {
      _id: 'mock-member-id',
      email: 'test@technogise.com',
      organisation_id: ['mock-organisation-id'],
    };
    const mockMemberService = {
      getMemberByEmailId: jest.fn().mockResolvedValue(member),
    };
    const mockOrganisationService = {
      getOrganisationById: jest.fn().mockResolvedValue({
        id: 'verifiedOrgId',
        name: 'SomeOrg',
        api_key: 'orgKey',
        api_secret_hash: 'secretHash',
      } as OrganisationInterface),
    };

    (container.resolve as jest.Mock).mockImplementation((service: InjectionToken<any>) => {
      if (service === MemberService) return mockMemberService;
      if (service === OrganisationService) return mockOrganisationService;

      return null;
    });

    const result = await authentication.frontendTokenAuthentication(requestMock);

    expect(result.role).toBe('frontend-token');
    expect(result.member).toEqual(member);
  });

  it('should reject with UnauthorizedError when Authorization header is missing', async () => {
    const requestMock: Request = {
      headers: {},
      header: jest.fn().mockReturnValue(undefined),
      originalUrl: '/some-url',
    } as any;

    await expect(authentication.frontendTokenAuthentication(requestMock)).rejects.toEqual(new UnauthorizedError());
  });

  it('should resolve with frontend-token role for /auth/google/ without token', async () => {
    const requestMock: Request = {
      headers: {},
      header: jest.fn().mockReturnValue(undefined),
      originalUrl: '/auth/google/',
    } as any;

    const result = await authentication.frontendTokenAuthentication(requestMock);

    expect(result).toEqual({ role: 'frontend-token' });
  });
});

describe('expressAuthentication', () => {
  it('should route to adminAuthentication for admin scheme', async () => {
    process.env.ADMIN_KEY = 'validAdminKey';
    const requestMock: Request = {
      headers: { 'x-admin-key': 'validAdminKey' },
      header: jest.fn().mockReturnValue('validAdminKey'),
    } as any;

    const result = await authentication.expressAuthentication(requestMock, 'admin');

    expect(result.role).toBe('admin');
  });

  it('should reject with 501 for unknown security scheme', async () => {
    const requestMock: Request = {
      headers: {},
      header: jest.fn().mockReturnValue(undefined),
    } as any;

    await expect(authentication.expressAuthentication(requestMock, 'unknown-scheme'))
      .rejects.toEqual({ status: 501, message: 'Unknown authorization strategy used' });
  });
});
