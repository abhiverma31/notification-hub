import { HttpError } from './HttpError';

export class ValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.status = 422;
  }
}
