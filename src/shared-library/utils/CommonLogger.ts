import { Logger } from './logging/Logger';
import { LoggerSettings } from './logging/LoggerSettings';

export class CommonLogger extends Logger {
  constructor(name?: string, settings?: LoggerSettings) {
    super('Common', name, settings);
  }
}

export const logger = new CommonLogger();
