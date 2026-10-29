import { handler } from '../../../src/server/NotificationArchivalJob';

jest.mock('../../../src/shared-library/connectors/DatabaseConnector');
jest.mock('../../../src/shared-library/repositories/OnDeck');
jest.mock('../../../src/server/services/ArchivalService');
jest.mock('../../../src/server/utils/snsClient');
jest.mock('../../../src/shared-library/utils/CommonLogger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import mongoose from 'mongoose';
import { DatabaseConnector } from '../../../src/shared-library/connectors/DatabaseConnector';
import { OnDeckRepository } from '../../../src/shared-library/repositories/OnDeck';
import { archiveCollection } from '../../../src/server/services/ArchivalService';
import { publishAlert } from '../../../src/server/utils/snsClient';
import { logger } from '../../../src/shared-library/utils/CommonLogger';

jest.spyOn(mongoose, 'disconnect').mockResolvedValue();

describe('NotificationArchivalJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (DatabaseConnector.prototype.connect as jest.Mock).mockResolvedValue(undefined);
    (archiveCollection as jest.Mock).mockResolvedValue({ archived: 100, deleted: 100 });
  });

  it('archives Notification collection successfully', async () => {
    await handler();

    expect(DatabaseConnector.prototype.connect).toHaveBeenCalledWith('NotificationArchivalJob');
    expect(archiveCollection).toHaveBeenCalledWith(
      'Notification',
      expect.any(Function),
      expect.any(Function),
    );
    expect(logger.info).toHaveBeenCalledWith('[Archival] Notification job started');
    expect(logger.info).toHaveBeenCalledWith('[Archival] Notification job completed', { archived: 100, deleted: 100 });
    expect(mongoose.disconnect).toHaveBeenCalled();
    expect(publishAlert).not.toHaveBeenCalled();
  });

  it('publishes alert and rethrows on failure', async () => {
    const error = new Error('Archive failed');
    (archiveCollection as jest.Mock).mockRejectedValue(error);

    await expect(handler()).rejects.toThrow('Archive failed');

    expect(logger.error).toHaveBeenCalledWith('[Archival] Notification job failed', { error: 'Archive failed' });
    expect(publishAlert).toHaveBeenCalledWith(
      expect.stringContaining('Notification Archival Job Failed'),
      expect.stringContaining('Archive failed'),
    );
    expect(mongoose.disconnect).toHaveBeenCalled();
  });

  it('disconnects database even when error occurs', async () => {
    (archiveCollection as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(handler()).rejects.toThrow('DB error');

    expect(mongoose.disconnect).toHaveBeenCalled();
  });
});
