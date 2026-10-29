import { HttpError } from './HttpError';
import { HttpStatusCode } from '../../types/Enum/HttpStatusCode';

export class InternalServerError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.status = HttpStatusCode.INTERNAL_SERVER_ERROR;
  }
}
