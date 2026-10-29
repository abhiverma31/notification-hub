import { HttpError } from './HttpError';

export class UnauthorizedError extends HttpError {
  constructor(message?: string | undefined) {
    super(message ?? 'Invalid Authentication');
    this.status = 401;
  }
}
