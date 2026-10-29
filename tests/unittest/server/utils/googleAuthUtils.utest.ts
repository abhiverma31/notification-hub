import { GoogleAuthUtil } from '../../../../src/server/utils/GoogleAuthUtil';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken', () => ({
  decode: jest.fn(),
}));

describe('GoogleAuthUtil', () => {
  const validToken = 'valid.token.here';
  const issuedTime = Math.floor(Date.now() / 1000);
  const payload = {
    iat: issuedTime,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return payload for a valid token', async () => {
    (jwt.decode as jest.Mock).mockReturnValue(payload);

    const result = await GoogleAuthUtil.verifyToken(validToken);

    expect(result).toEqual(payload);
    expect(jwt.decode).toHaveBeenCalledWith(validToken);
  });

  it('should throw an error if the token is invalid', async () => {
    (jwt.decode as jest.Mock).mockReturnValue(null);

    await expect(GoogleAuthUtil.verifyToken(validToken)).rejects.toThrow('Invalid access token');
  });

  it('should throw an error if the token is missing issued time (iat)', async () => {
    (jwt.decode as jest.Mock).mockReturnValue({});

    await expect(GoogleAuthUtil.verifyToken(validToken)).rejects.toThrow(
      'Invalid access token: missing issued time (iat)',
    );
  });

  it('should throw an error if the access token has expired', async () => {
    const expiredPayload = {
      iat: Math.floor(Date.now() / 1000) - 8 * 24 * 60 * 60,
    };
    (jwt.decode as jest.Mock).mockReturnValue(expiredPayload);

    await expect(GoogleAuthUtil.verifyToken(validToken)).rejects.toThrow('Invalid access token');
  });

  it('should not throw an error for a token that is still valid', async () => {
    const validPayload = {
      iat: Math.floor(Date.now() / 1000) - 6 * 24 * 60 * 60,
    };
    (jwt.decode as jest.Mock).mockReturnValue(validPayload);

    const result = await GoogleAuthUtil.verifyToken(validToken);

    expect(result).toEqual(validPayload);
  });
});
