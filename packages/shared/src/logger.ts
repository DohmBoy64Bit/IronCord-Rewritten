import * as fs from 'node:fs';
import * as path from 'node:path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_FILE =
  process.env.IRONCORD_LOG_FILE ||
  path.join(process.cwd(), 'ironcord.log');

function writeLine(line: string): void {
  const ts = new Date().toISOString();
  fs.appendFile(LOG_FILE, `[${ts}] ${line}\n`, () => {});
}

export function log(level: LogLevel, tag: string, data: unknown = {}): void {
  const payload =
    typeof data === 'string' ? { message: data } : data || {};
  const line = `[${level.toUpperCase()}] [${tag}] ${JSON.stringify(payload)}`;
  writeLine(line);

  const consoleLevel = level === 'debug' ? 'log' : level;
  const consoleFn = console[consoleLevel];
  if (consoleFn) {
    consoleFn(line);
  }
}

export const logger = {
  debug: (tag: string, data?: unknown) => log('debug', tag, data),
  info: (tag: string, data?: unknown) => log('info', tag, data),
  warn: (tag: string, data?: unknown) => log('warn', tag, data),
  error: (tag: string, data?: unknown) => log('error', tag, data),
};
