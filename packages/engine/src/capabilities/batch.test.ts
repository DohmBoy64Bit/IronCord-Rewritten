import { describe, it, expect, beforeEach } from 'vitest';
import { BatchHandler } from './batch.js';
import type { IRCMessage, IRCMessageData } from '../types.js';

describe('BatchHandler', () => {
  let handler: BatchHandler;

  beforeEach(() => {
    handler = new BatchHandler();
  });

  it('should start a new batch with + prefix', () => {
    const message: IRCMessage = {
      command: 'BATCH',
      params: ['+batch123', 'chathistory', '#test-channel'],
      tags: {},
      raw: 'BATCH +batch123 chathistory #test-channel',
    };

    handler.handleBatch(message);
    expect(handler.hasBatch('batch123')).toBe(true);
  });

  it('should end a batch with - prefix', () => {
    const startMessage: IRCMessage = {
      command: 'BATCH',
      params: ['+batch456'],
      tags: {},
      raw: 'BATCH +batch456',
    };

    handler.handleBatch(startMessage);
    expect(handler.hasBatch('batch456')).toBe(true);

    const endMessage: IRCMessage = {
      command: 'BATCH',
      params: ['-batch456'],
      tags: {},
      raw: 'BATCH -batch456',
    };

    handler.handleBatch(endMessage);
    expect(handler.hasBatch('batch456')).toBe(false);
  });

  it('should add messages to active batch', () => {
    const startMessage: IRCMessage = {
      command: 'BATCH',
      params: ['+batch789'],
      tags: {},
      raw: 'BATCH +batch789',
    };

    handler.handleBatch(startMessage);

    const messageData: IRCMessageData = {
      id: 'msg1',
      author: 'user1',
      channel: '#test',
      content: 'Hello',
      timestamp: '2024-01-01T00:00:00Z',
    };

    handler.addMessage('batch789', messageData);
    expect(handler.hasBatch('batch789')).toBe(true);
  });

  it('should emit history event when batch completes with messages', async () => {
    const historyPromise = new Promise<IRCMessageData[]>((resolve) => {
      handler.once('history', (messages) => resolve(messages));
    });

    const startMessage: IRCMessage = {
      command: 'BATCH',
      params: ['+batchABC'],
      tags: {},
      raw: 'BATCH +batchABC',
    };

    handler.handleBatch(startMessage);

    const messageData1: IRCMessageData = {
      id: 'msg1',
      author: 'user1',
      channel: '#test',
      content: 'First message',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const messageData2: IRCMessageData = {
      id: 'msg2',
      author: 'user2',
      channel: '#test',
      content: 'Second message',
      timestamp: '2024-01-01T00:01:00Z',
    };

    handler.addMessage('batchABC', messageData1);
    handler.addMessage('batchABC', messageData2);

    const endMessage: IRCMessage = {
      command: 'BATCH',
      params: ['-batchABC'],
      tags: {},
      raw: 'BATCH -batchABC',
    };

    handler.handleBatch(endMessage);

    const history = await historyPromise;
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('First message');
    expect(history[1].content).toBe('Second message');
  });

  it('should not emit history event for empty batch', () => {
    let historyEmitted = false;
    handler.once('history', () => {
      historyEmitted = true;
    });

    const startMessage: IRCMessage = {
      command: 'BATCH',
      params: ['+batchEmpty'],
      tags: {},
      raw: 'BATCH +batchEmpty',
    };

    handler.handleBatch(startMessage);

    const endMessage: IRCMessage = {
      command: 'BATCH',
      params: ['-batchEmpty'],
      tags: {},
      raw: 'BATCH -batchEmpty',
    };

    handler.handleBatch(endMessage);

    expect(historyEmitted).toBe(false);
  });

  it('should not add message to non-existent batch', () => {
    const messageData: IRCMessageData = {
      id: 'msg1',
      author: 'user1',
      channel: '#test',
      content: 'Hello',
      timestamp: '2024-01-01T00:00:00Z',
    };

    expect(() => {
      handler.addMessage('nonexistent', messageData);
    }).not.toThrow();
  });

  it('should handle multiple concurrent batches', () => {
    const start1: IRCMessage = {
      command: 'BATCH',
      params: ['+batch1'],
      tags: {},
      raw: 'BATCH +batch1',
    };

    const start2: IRCMessage = {
      command: 'BATCH',
      params: ['+batch2'],
      tags: {},
      raw: 'BATCH +batch2',
    };

    handler.handleBatch(start1);
    handler.handleBatch(start2);

    expect(handler.hasBatch('batch1')).toBe(true);
    expect(handler.hasBatch('batch2')).toBe(true);

    const msg1: IRCMessageData = {
      id: 'msg1',
      author: 'user1',
      channel: '#test1',
      content: 'Batch 1 message',
    };

    const msg2: IRCMessageData = {
      id: 'msg2',
      author: 'user2',
      channel: '#test2',
      content: 'Batch 2 message',
    };

    handler.addMessage('batch1', msg1);
    handler.addMessage('batch2', msg2);

    const end1: IRCMessage = {
      command: 'BATCH',
      params: ['-batch1'],
      tags: {},
      raw: 'BATCH -batch1',
    };

    handler.handleBatch(end1);

    expect(handler.hasBatch('batch1')).toBe(false);
    expect(handler.hasBatch('batch2')).toBe(true);
  });

  it('should clear all batches', () => {
    const start1: IRCMessage = {
      command: 'BATCH',
      params: ['+batch1'],
      tags: {},
      raw: 'BATCH +batch1',
    };

    const start2: IRCMessage = {
      command: 'BATCH',
      params: ['+batch2'],
      tags: {},
      raw: 'BATCH +batch2',
    };

    handler.handleBatch(start1);
    handler.handleBatch(start2);

    handler.clear();

    expect(handler.hasBatch('batch1')).toBe(false);
    expect(handler.hasBatch('batch2')).toBe(false);
  });

  it('should handle batch with no params', () => {
    const message: IRCMessage = {
      command: 'BATCH',
      params: [],
      tags: {},
      raw: 'BATCH',
    };

    expect(() => {
      handler.handleBatch(message);
    }).not.toThrow();
  });
});
