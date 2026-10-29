import { getClassAndMethod, getClasslessMethodName, getFilteredStack } from '../StackTools';
import { getHashCode } from '../ObjectHashcode';
import { ConsoleColors } from '../../constants/ConsoleColors';
import { Level } from './Level';
import { defaultLoggerSettings, LoggerSettings } from './LoggerSettings';
import dotenv from 'dotenv';

dotenv.config();

/* eslint-disable  @typescript-eslint/no-explicit-any */
export abstract class Logger {
  protected readonly appName: string;
  protected readonly context: string | undefined;
  protected readonly className: string | undefined;
  protected readonly settings: LoggerSettings;
  private readonly timings = new Map<string, number>();

  protected constructor(appName: string, context?: string, settings?: LoggerSettings) {
    this.appName = appName;
    this.settings = settings ?? defaultLoggerSettings;
    this.context = context;
    const classAndMethodName = getClassAndMethod();

    if (classAndMethodName.class === 'Object') {
      return;
    }

    this.className = classAndMethodName.class;
  }

  public info(message: any, ...args: any[]): void {
    if (this.settings.minLevel > Level.info) {
      return;
    }

    this.log('info', message, ...args);
  }

  public warn(message: any, ...args: any[]): void {
    if (this.settings.minLevel > Level.warn) {
      return;
    }

    this.log('warn', message, ...args);
  }

  public debug(message: any, ...args: any[]): void {
    if (this.settings.minLevel > Level.debug) {
      return;
    }

    this.log('debug', message, ...args);
  }

  public trace(message: any, ...args: any[]): void {
    if (this.settings.minLevel > Level.trace) {
      return;
    }

    const splitStack = getFilteredStack();
    const printStack = splitStack.slice(0, 3).join('\n');
    this.log('trace', message, ...args, `\n${printStack}`);
  }

  public error(message: any, ...args: any[]): void {
    if (this.settings.minLevel > Level.error) {
      return;
    }

    this.log('error', message, ...args);
  }

  public traceStart(params?: any, message?: string) {
    if (this.settings.minLevel > Level.trace) {
      return;
    }

    const splitStack = getFilteredStack();
    const methodName = getClassAndMethod(splitStack).method ?? getClasslessMethodName(splitStack);
    const printStack = splitStack.slice(0, 3).join('\n');
    const methodKey = this.createMethodKey(methodName, params);
    const paramsHash = getHashCode(methodKey);

    const enterMessage = `Entering ${this.formattedMethodName(methodName)}${message ? `: ${message}` : ''}`;
    const paramsMessage = params
      ? `(Params Hash ${paramsHash})\n${this.formattedTrace(printStack)}\nParams:\n${this.formattedObject(params)}`
      : '';

    this.log('trace', `${enterMessage} ${paramsMessage}`);

    this.timings.set(methodKey, performance.now());
  }

  public traceEnd(params?: any, message?: string, result?: any) {
    if (this.settings.minLevel > Level.trace) {
      return;
    }

    const endTime = performance.now();

    const splitStack = getFilteredStack();
    const methodName = getClassAndMethod(splitStack).method ?? getClasslessMethodName(splitStack);
    const printStack = splitStack.slice(0, 3).join('\n');
    const methodKey = this.createMethodKey(methodName, params);
    const startTime = this.timings.get(methodKey);
    this.timings.delete(methodKey);
    const paramsHash = getHashCode(methodKey);

    const exitMessage = `Exiting ${this.formattedMethodName(methodName)}${message ? `: ${message}` : ''}`;
    const timingMessage = startTime ? `in ${(endTime - startTime).toFixed(2)}ms` : '(no start time found)';
    const paramsMessage = params ? `(Params Hash ${paramsHash})\n${this.formattedTrace(printStack)}\n` : '';
    const resultMessage = result ? `\nResult:\n${this.formattedObject(result)}\n` : '';

    this.log('trace', `${exitMessage} ${timingMessage} ${paramsMessage}${resultMessage}`);
  }

  private createMethodKey(methodName?: string, params?: any): string {
    const paramHash = params ? JSON.stringify(params) : '';

    return `${this.className || 'Global'}.${methodName || ''}(${paramHash})`;
  }

  private formattedMethodName(methodName?: string): string {
    return `Method: ${methodName}`;
  }

  private log(level: string, message: any, ...args: any[]): void {
    if (this.settings.formattedConsoleOutput) {
      this.formattedLog(level, message, ...args);
    } else {
      this.simpleLog(level, message, ...args);
    }
  }

  private simpleLog(level: string, message: any, ...args: any[]) {
    this.outputForLevel(level)!(message, ...args);
  }

  private outputForLevel(level: string) {
    switch (level) {
      case 'info':
        return console.info;
      case 'debug':
      case 'trace':
        return console.debug;
      case 'error':
        return console.error;
      case 'warn':
        return console.warn;
    }
  }

  private formattedLog(level: string, message: any, ...args: any[]): void {
    const preMessageText = `${this.formattedTimestamp()}${this.formattedLevel(
      level,
    )}${this.formattedAppName()}${this.formattedClassName()}${this.formattedContext()}|`;

    this.outputForLevel(level)!(preMessageText, message, ...args.map((arg) => this.formattedObject(arg)));
  }

  private formattedObject(object: any): string {
    const objectString = object instanceof Object ? `${JSON.stringify(object, null, 2)}` : `  ${object}`;

    return `\n${ConsoleColors.FgCyan}${objectString}${ConsoleColors.Reset}\n`;
  }

  private formattedTimestamp(): string {
    return this.settings.printTimestamp
      ? `${ConsoleColors.FgGray}${new Date().toISOString()}${ConsoleColors.Reset} `
      : '';
  }

  private formattedAppName(): string {
    return `${ConsoleColors.FgMagenta}| ${ConsoleColors.Bright}${this.appName.padEnd(8, ' ')}${ConsoleColors.Reset} `;
  }

  private formattedClassName(): string {
    const classToPrint = this.className ? this.className : getClasslessMethodName();

    return classToPrint ? `${ConsoleColors.FgGreen}| ${classToPrint.padEnd(12, ' ')}${ConsoleColors.Reset} ` : '';
  }

  private formattedContext(): string {
    return this.context ? `${ConsoleColors.FgBlue}| Context: ${this.context}${ConsoleColors.Reset} ` : '';
  }

  private formattedTrace(trace: string): string {
    return `${ConsoleColors.FgYellow}${ConsoleColors.Dim}${trace}${ConsoleColors.Reset}`;
  }

  private formattedLevel(level: string): string {
    let colorCode: string;

    switch (level) {
      case 'error':
        colorCode = ConsoleColors.FgRed;
        break;

      case 'warn':
        colorCode = ConsoleColors.FgRed;
        break;

      case 'debug':
        colorCode = ConsoleColors.FgYellow;
        break;

      case 'trace':
        colorCode = ConsoleColors.FgGray;
        break;

      case 'info':
      default:
        colorCode = ConsoleColors.FgCyan;
        break;
    }

    return `${colorCode}| ${level.toUpperCase().padEnd(5, ' ')}${ConsoleColors.Reset} `;
  }
}
