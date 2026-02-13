import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReconnectHandler, DEFAULT_RECONNECT_OPTIONS } from './reconnect.js';
import type { ReconnectEvent } from '../types.js';

describe('ReconnectHandler', () => {
  let handler: ReconnectHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    handler = new ReconnectHandler();
  });

  afterEach(() => {
    handler.reset();
    vi.restoreAllMocks();
  });

  it('should use default options when not provided', () => {
    expect(handler).toBeDefined();
  });

  it('should emit reconnecting event on first close', () => {
    const events: ReconnectEvent[] = [];
    handler.on('reconnecting', (event: ReconnectEvent) => events.push(event));

    handler.handleClose(false);

    expect(events).toHaveLength(1);
    expect(events[0].attempt).toBe(1);
    expect(events[0].delay).toBe(DEFAULT_RECONNECT_OPTIONS.initialDelay);
  });

  it('should emit reconnect event after delay', () => {
    let reconnectCalled = false;
    handler.on('reconnect', () => {
      reconnectCalled = true;
    });

    handler.handleClose(false);
    expect(reconnectCalled).toBe(false);

    vi.advanceTimersByTime(DEFAULT_RECONNECT_OPTIONS.initialDelay);
    expect(reconnectCalled).toBe(true);
  });

  it('should use exponential backoff for delays', () => {
    const events: ReconnectEvent[] = [];
    handler.on('reconnecting', (event: ReconnectEvent) => events.push(event));

    handler.handleClose(false);
    vi.advanceTimersByTime(1000);

    handler.handleClose(false);
    vi.advanceTimersByTime(2000);

    handler.handleClose(false);

    expect(events).toHaveLength(3);
    expect(events[0].delay).toBe(1000);
    expect(events[1].delay).toBe(2000);
    expect(events[2].delay).toBe(4000);
  });

  it('should cap delay at maxDelay', () => {
    handler = new ReconnectHandler({ maxDelay: 5000 });
    const events: ReconnectEvent[] = [];
    handler.on('reconnecting', (event: ReconnectEvent) => events.push(event));

    for (let i = 0; i < 5; i++) {
      handler.handleClose(false);
      vi.advanceTimersByTime(10000);
    }

    const lastEvent = events[events.length - 1];
    expect(lastEvent.delay).toBeLessThanOrEqual(5000);
  });

  it('should emit reconnect_failed after maxRetries', () => {
    handler = new ReconnectHandler({ maxRetries: 3 });
    let failedCalled = false;
    handler.on('reconnect_failed', () => {
      failedCalled = true;
    });

    for (let i = 0; i < 3; i++) {
      handler.handleClose(false);
      vi.advanceTimersByTime(10000);
    }

    handler.handleClose(false);

    expect(failedCalled).toBe(true);
  });

  it('should not reconnect on intentional disconnect', () => {
    let reconnectingCalled = false;
    handler.on('reconnecting', () => {
      reconnectingCalled = true;
    });

    handler.markIntentional();
    handler.handleClose(false);

    expect(reconnectingCalled).toBe(false);
  });

  it('should reset attempts counter', () => {
    const events: ReconnectEvent[] = [];
    handler.on('reconnecting', (event: ReconnectEvent) => events.push(event));

    handler.handleClose(false);
    vi.advanceTimersByTime(1000);

    handler.handleClose(false);
    expect(events[events.length - 1].attempt).toBe(2);

    handler.reset();

    handler.handleClose(false);
    expect(events[events.length - 1].attempt).toBe(1);
  });

  it('should clear timer on reset', () => {
    let reconnectCalled = false;
    handler.on('reconnect', () => {
      reconnectCalled = true;
    });

    handler.handleClose(false);
    handler.reset();

    vi.advanceTimersByTime(10000);

    expect(reconnectCalled).toBe(false);
  });

  it('should clear timer on markIntentional', () => {
    let reconnectCalled = false;
    handler.on('reconnect', () => {
      reconnectCalled = true;
    });

    handler.handleClose(false);
    handler.markIntentional();

    vi.advanceTimersByTime(10000);

    expect(reconnectCalled).toBe(false);
  });

  it('should accept custom options', () => {
    handler = new ReconnectHandler({ maxRetries: 5, initialDelay: 500, maxDelay: 10000 });
    const events: ReconnectEvent[] = [];
    handler.on('reconnecting', (event: ReconnectEvent) => events.push(event));

    handler.handleClose(false);

    expect(events[0].delay).toBe(500);
  });

  it('should handle multiple rapid disconnects', () => {
    const events: ReconnectEvent[] = [];
    handler.on('reconnecting', (event: ReconnectEvent) => events.push(event));

    handler.handleClose(false);
    handler.handleClose(false);
    handler.handleClose(false);

    expect(events).toHaveLength(3);
    expect(events.map((e) => e.attempt)).toEqual([1, 2, 3]);
  });

  it('should handle hadError parameter', () => {
    let reconnectingCalled = false;
    handler.on('reconnecting', () => {
      reconnectingCalled = true;
    });

    handler.handleClose(true);

    expect(reconnectingCalled).toBe(true);
  });
});
