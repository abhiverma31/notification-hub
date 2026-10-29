import { HttpError } from './HttpError';

export class BadRequest extends HttpError {
  constructor(message: string) {
    super(message);
    this.status = 400;
  }
}

export class Conflict extends HttpError {
  constructor(message: string) {
    super(message);
    this.status = 409;
  }
}

export class NotFound extends HttpError {
  constructor(message: string) {
    super(message);
    this.status = 404;
  }
}
