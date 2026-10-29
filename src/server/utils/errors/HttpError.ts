export class HttpError extends Error {
  status: number;
  details: unknown | undefined;

  constructor(message: string, details?: unknown) {
    super(message);
    this.status = 400;
    this.details = details;
  }
}
