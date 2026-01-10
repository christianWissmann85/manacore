/**
 * Enhanced Logger - manages console and file logging with levels and structured output
 */

import { OutputLevel } from '../types';
import type { LogWriter } from './LogWriter';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

export class Logger {
  private static instance: Logger;
  private consoleLevel: LogLevel = LogLevel.INFO;
  private logWriter: LogWriter | null = null;
  private structured: boolean = false;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Configure the logger
   */
  configure(options: {
    outputLevel?: OutputLevel;
    logWriter?: LogWriter;
    structured?: boolean;
  }): void {
    if (options.outputLevel !== undefined) {
      // Map OutputLevel to LogLevel
      switch (options.outputLevel) {
        case OutputLevel.QUIET:
          this.consoleLevel = LogLevel.ERROR;
          break;
        case OutputLevel.MINIMAL:
          this.consoleLevel = LogLevel.WARN;
          break;
        case OutputLevel.NORMAL:
          this.consoleLevel = LogLevel.INFO;
          break;
        case OutputLevel.VERBOSE:
          this.consoleLevel = LogLevel.DEBUG;
          break;
      }
    }

    if (options.logWriter) {
      this.logWriter = options.logWriter;
    }

    if (options.structured !== undefined) {
      this.structured = options.structured;
    }
  }

  /**
   * Log a message
   */
  private log(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      data,
    };

    // Console output
    if (level >= this.consoleLevel) {
      if (this.structured) {
        console.log(JSON.stringify(entry));
      } else {
        const prefix = `[${entry.level}]`;
        console.log(`${prefix} ${message}`, data ? data : '');
      }
    }

    // File output (always log to file if writer exists)
    if (this.logWriter) {
      const line = this.structured
        ? JSON.stringify(entry)
        : `[${entry.timestamp}] [${entry.level}] ${message} ${data ? JSON.stringify(data) : ''}`;
      this.logWriter.writeLine(line);
    }
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }
}

export const logger = Logger.getInstance();
