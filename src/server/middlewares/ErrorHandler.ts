import { NextFunction, Request, Response } from 'express';
import { ValidateError } from 'tsoa';
import { HttpError } from '../utils/errors/HttpError';
import { HttpStatusCode } from '../types/Enum/HttpStatusCode';
import { logger } from '../utils/ServerLogger';

export default function errorHandler(err: any, req: Request, res: Response, next: NextFunction): Response {
  if (res.headersSent) {
    next(err);
  }

  if (err instanceof ValidateError) {
    logger.info(`Validation Error at ${req.path}`, err.fields);

    return res.status(422).json({
      message: 'Validation Failed',
      details: err?.fields,
    });
  }

  if (err instanceof HttpError) {
    logger.info(`Expected Error at ${req.path}`, err);

    return res.status(err.status).json({
      message: err.message,
    });
  }

  if (err.type === 'entity.too.large') {
    logger.info(`Payload too large at ${req.path}`);

    return res.status(413).json({
      message: 'Payload too large',
    });
  }

  if (err.type === 'entity.parse.failed') {
    logger.info(`Malformed request body at ${req.path}`);

    return res.status(400).json({
      message: 'Malformed request body',
    });
  }

  logger.error(`Unexpected Error at ${req.path}`, err);

  return res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json({
    message: 'An error occurred on the server',
  });
}
