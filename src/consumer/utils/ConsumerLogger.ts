import { Logger } from '../../shared-library/utils/logging/Logger';
import { LoggerSettings } from '../../shared-library/utils/logging/LoggerSettings';

export class ConsumerLogger extends Logger {
  constructor(name?: string, settings?: LoggerSettings) {
    super('Consumer', name, settings);
  }
}

export const logger = new ConsumerLogger();
