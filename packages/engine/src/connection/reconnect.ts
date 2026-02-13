import { EventEmitter } from 'events';
import type { ReconnectOptions, ReconnectEvent } from '../types.js';

export const DEFAULT_RECONNECT_OPTIONS: ReconnectOptions = {
  maxRetries: 10,
  initialDelay: 1000,
  maxDelay: 30000,
};

export interface ReconnectHandlerEvents {
  reconnect: () => void;
  reconnecting: (event: ReconnectEvent) => void;
  reconnect_failed: () => void;
}

export class ReconnectHandler extends EventEmitter {
  private options: ReconnectOptions;
  private attempts: number = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect: boolean = false;

  constructor(options: Partial<ReconnectOptions> = {}) {
    super();
    this.options = { ...DEFAULT_RECONNECT_OPTIONS, ...options };
  }

  public handleClose(hadError: boolean): void {
    if (this.intentionalDisconnect) {
      return;
    }

    if (this.attempts >= this.options.maxRetries) {
      console.error(`IRC: Max reconnection attempts (${this.options.maxRetries}) reached`);
      this.emit('reconnect_failed');
      return;
    }

    const delay = Math.min(
      this.options.initialDelay * Math.pow(2, this.attempts),
      this.options.maxDelay
    );
    this.attempts++;

    console.log(`IRC: Reconnecting in ${delay}ms (attempt ${this.attempts}/${this.options.maxRetries})`);
    this.emit('reconnecting', { attempt: this.attempts, delay });

    this.timer = setTimeout(() => {
      this.emit('reconnect');
    }, delay);
  }

  public reset(): void {
    this.attempts = 0;
    this.intentionalDisconnect = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public markIntentional(): void {
    this.intentionalDisconnect = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
