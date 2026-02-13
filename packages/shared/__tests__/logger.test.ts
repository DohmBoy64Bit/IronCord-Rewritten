import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';

vi.mock('node:fs', () => ({
  appendFile: vi.fn((path, data, callback) => callback()),
}));

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should export logger with debug, info, warn, error methods', async () => {
    const { logger } = await import('../src/logger');
    expect(logger.debug).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
  });

  it('should log debug messages', async () => {
    const { logger } = await import('../src/logger');
    logger.debug('TEST-TAG', { message: 'test debug' });
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(fs.appendFile).toHaveBeenCalled();
  });

  it('should log info messages', async () => {
    const { logger } = await import('../src/logger');
    logger.info('TEST-TAG', { message: 'test info' });
    expect(consoleInfoSpy).toHaveBeenCalled();
    expect(fs.appendFile).toHaveBeenCalled();
  });

  it('should log warn messages', async () => {
    const { logger } = await import('../src/logger');
    logger.warn('TEST-TAG', { message: 'test warn' });
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(fs.appendFile).toHaveBeenCalled();
  });

  it('should log error messages', async () => {
    const { logger } = await import('../src/logger');
    logger.error('TEST-TAG', { message: 'test error' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(fs.appendFile).toHaveBeenCalled();
  });

  it('should handle string data', async () => {
    const { logger } = await import('../src/logger');
    logger.info('TEST-TAG', 'simple string message');
    expect(consoleInfoSpy).toHaveBeenCalled();
    const call = consoleInfoSpy.mock.calls[0]?.[0] as string;
    expect(call).toContain('simple string message');
  });

  it('should handle object data', async () => {
    const { logger } = await import('../src/logger');
    logger.info('TEST-TAG', { foo: 'bar', baz: 123 });
    expect(consoleInfoSpy).toHaveBeenCalled();
    const call = consoleInfoSpy.mock.calls[0]?.[0] as string;
    expect(call).toContain('foo');
    expect(call).toContain('bar');
  });
});
