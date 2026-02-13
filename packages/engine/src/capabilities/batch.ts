import { EventEmitter } from 'events';
import type { IRCMessage, IRCMessageData } from '../types.js';

export interface BatchHandlerEvents {
  history: (messages: IRCMessageData[]) => void;
}

export class BatchHandler extends EventEmitter {
  private batches: Map<string, IRCMessageData[]> = new Map();

  public handleBatch(message: IRCMessage): void {
    const batchRef = message.params[0];
    if (!batchRef) return;

    if (batchRef.startsWith('+')) {
      const batchId = batchRef.substring(1);
      this.batches.set(batchId, []);
    } else if (batchRef.startsWith('-')) {
      const batchId = batchRef.substring(1);
      const messages = this.batches.get(batchId);

      if (messages && messages.length > 0) {
        this.emit('history', messages);
      }

      this.batches.delete(batchId);
    }
  }

  public addMessage(batchId: string, message: IRCMessageData): void {
    const batch = this.batches.get(batchId);
    if (batch) {
      batch.push(message);
    }
  }

  public hasBatch(batchId: string): boolean {
    return this.batches.has(batchId);
  }

  public clear(): void {
    this.batches.clear();
  }
}
