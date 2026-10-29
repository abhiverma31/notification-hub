import { Logger } from '../../shared-library/utils/logging/Logger';
import { LoggerSettings } from '../../shared-library/utils/logging/LoggerSettings';

export class ServerLogger extends Logger {
  constructor(name?: string, settings?: LoggerSettings) {
    super('Server', name, settings);
  }
}

export const logger = new ServerLogger();
