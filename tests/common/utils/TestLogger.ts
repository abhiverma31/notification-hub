import { Logger } from '../../../src/shared-library/utils/logging/Logger';
import { LoggerSettings } from '../../../src/shared-library/utils/logging/LoggerSettings';

class TestLogger extends Logger {
  constructor(name?: string, settings?: LoggerSettings) {
    super('Test', name, settings);
  }
}

export const logger = new TestLogger();
