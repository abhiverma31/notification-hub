import jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';
import { UnauthorizedError } from './errors/Unauthorized';

export class GoogleAuthUtil {
  public static async verifyToken(token: string) {
    let payload: JwtPayload | null;

    try {
      payload = jwt.decode(token) as JwtPayload;
      if (!payload) {
        throw new Error('Invalid access token');
      }
    } catch (error) {
      throw new Error('Invalid access token');
    }

    if (payload.iat === undefined) {
      throw new Error('Invalid access token: missing issued time (iat)');
    }

    const issuedTime = payload.iat * 1000;

    const maxValidUntil = issuedTime + 7 * 24 * 60 * 60 * 1000;

    if (Date.now() >= maxValidUntil) {
      throw new UnauthorizedError('Invalid access token');
    }

    return payload;
  }
}
