import 'reflect-metadata';
import mongoose from 'mongoose';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';

jest.mock('mongoose', () => ({
  connection: {
    db: null,
  },
  connect: jest.fn(),
  disconnect: jest.fn(),
  set: jest.fn(),
}));

describe('DatabaseConnector', () => {
  let databaseConnector: DatabaseConnector;

  beforeEach(() => {
    databaseConnector = new DatabaseConnector();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should connect to the database', async () => {
    await databaseConnector.connect('Integration Test');
    expect(mongoose.connect).toHaveBeenCalled();
  });

  it('should disconnect from the database', async () => {
    await databaseConnector.disconnect('Integration Test');
    expect(mongoose.disconnect).toHaveBeenCalled();
  });
});
