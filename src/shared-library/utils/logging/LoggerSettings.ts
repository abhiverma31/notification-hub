import { Level } from './Level';
import { isLocalOrTest } from '../EnvironmentHelper';

export interface LoggerSettings {
  printTimestamp: boolean;
  minLevel: Level;
  formattedConsoleOutput: boolean;
}

export const defaultLoggerSettings: LoggerSettings = {
  printTimestamp: isLocalOrTest,
  minLevel: getLevel(),
  formattedConsoleOutput: isLocalOrTest,
};

function getLevel(): Level {
  let levelString = process.env.LOG_LEVEL;

  if (!levelString) {
    return Level.trace;
  }

  levelString = levelString.toUpperCase();

  switch (levelString) {
    case 'TRACE':
      return Level.trace;
    case 'DEBUG':
      return Level.debug;
    case 'WARN':
      return Level.warn;
    case 'ERROR':
      return Level.error;
    case 'INFO':
    default:
      return Level.info;
  }
}
