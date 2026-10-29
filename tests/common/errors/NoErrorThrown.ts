import { logger } from '../utils/TestLogger';

export class NoErrorThrownError extends Error {}

export const getError = async <TError>(call: () => unknown): Promise<TError | NoErrorThrownError> => {
  try {
    await call();

    return new NoErrorThrownError();
  } catch (error: unknown) {
    logger.error(error);

    return error as TError;
  }
};
