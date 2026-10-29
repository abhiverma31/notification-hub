import { Logger } from '../../src/shared-library/utils/logging/Logger';
import { LoggerSettings } from '../../src/shared-library/utils/logging/LoggerSettings';

export class ScriptLogger extends Logger {
  constructor(name?: string, settings?: LoggerSettings) {
    super('Script', name, settings);
  }
}

export const logger = new ScriptLogger();
