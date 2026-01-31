import { config } from './config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function getTimestamp(): string {
  return new Date().toISOString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

class Logger {
  private minLevel: number;
  private prefix: string;

  constructor(prefix: string = 'BRIDGE') {
    this.prefix = prefix;
    this.minLevel = LOG_LEVELS[config.logLevel] || LOG_LEVELS.info;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.minLevel;
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = getTimestamp();
    const levelColor = {
      debug: COLORS.dim,
      info: COLORS.green,
      warn: COLORS.yellow,
      error: COLORS.red,
    }[level];

    let formatted = `${COLORS.dim}${timestamp}${COLORS.reset} ${levelColor}[${level.toUpperCase().padEnd(5)}]${COLORS.reset} ${COLORS.cyan}[${this.prefix}]${COLORS.reset} ${message}`;

    if (meta && Object.keys(meta).length > 0) {
      const metaStr = Object.entries(meta)
        .map(([k, v]) => {
          if (k === 'bytes' && typeof v === 'number') {
            return `${k}=${formatBytes(v)}`;
          }
          if (k === 'duration' && typeof v === 'number') {
            return `${k}=${formatDuration(v)}`;
          }
          if (typeof v === 'object') {
            return `${k}=${JSON.stringify(v)}`;
          }
          return `${k}=${v}`;
        })
        .join(' ');
      formatted += ` ${COLORS.dim}${metaStr}${COLORS.reset}`;
    }

    return formatted;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  call(callId: string, message: string, meta?: Record<string, unknown>): void {
    this.info(`[${callId.slice(0, 8)}] ${message}`, meta);
  }

  callDebug(callId: string, message: string, meta?: Record<string, unknown>): void {
    this.debug(`[${callId.slice(0, 8)}] ${message}`, meta);
  }

  callError(callId: string, message: string, meta?: Record<string, unknown>): void {
    this.error(`[${callId.slice(0, 8)}] ${message}`, meta);
  }

  audio(callId: string, direction: 'in' | 'out', bytes: number): void {
    this.debug(`[${callId.slice(0, 8)}] Audio ${direction}`, { bytes });
  }

  child(prefix: string): Logger {
    return new Logger(`${this.prefix}:${prefix}`);
  }
}

export const logger = new Logger();
export { formatBytes, formatDuration };
