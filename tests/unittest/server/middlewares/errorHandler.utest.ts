import { ValidateError } from 'tsoa';
import errorHandler from '../../../../src/server/middlewares/ErrorHandler';
import { HttpError } from '../../../../src/server/utils/errors/HttpError';
import { HttpStatusCode } from '../../../../src/server/types/Enum/HttpStatusCode';

describe('errorHandler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = { path: '/test' };
    mockResponse = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it('should handle validation errors with 422', () => {
    const err = new ValidateError({ field: { message: 'required', value: null } }, '');
    errorHandler(err, mockRequest as Request, mockResponse as Response, nextFunction);
    expect(mockResponse.status).toHaveBeenCalledWith(422);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Validation Failed', details: err.fields }),
    );
  });

  it('should handle HttpError with its status code', () => {
    const err = new HttpError('Bad request');
    errorHandler(err, mockRequest as Request, mockResponse as Response, nextFunction);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Bad request' });
  });

  it('should call next when headers already sent', () => {
    mockResponse.headersSent = true;
    const err = new Error('some error');
    errorHandler(err, mockRequest as Request, mockResponse as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalledWith(err);
  });

  it('should return 413 for entity.too.large errors', () => {
    const err = { type: 'entity.too.large', message: 'request entity too large' };
    errorHandler(err, mockRequest as Request, mockResponse as Response, nextFunction);
    expect(mockResponse.status).toHaveBeenCalledWith(413);
    expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Payload too large' });
  });

  it('should return 400 for entity.parse.failed errors', () => {
    const err = { type: 'entity.parse.failed', message: 'Unexpected token' };
    errorHandler(err, mockRequest as Request, mockResponse as Response, nextFunction);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Malformed request body' });
  });

  it('should return 500 with generic message for unhandled errors', () => {
    const err = new Error('unexpected failure');
    errorHandler(err, mockRequest as Request, mockResponse as Response, nextFunction);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({ message: 'An error occurred on the server' });
  });
});
