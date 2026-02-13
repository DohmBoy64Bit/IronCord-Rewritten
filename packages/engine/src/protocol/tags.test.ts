import { describe, it, expect } from 'vitest';
import {
  extractMessageData,
  hasBatchTag,
  getBatchTag,
  getMessageId,
  getTimestamp,
  getAccount,
} from './tags.js';

describe('IRC Tags Utilities', () => {
  describe('extractMessageData', () => {
    it('should extract message data with all tags', () => {
      const tags = {
        msgid: 'abc123',
        time: '2024-01-01T00:00:00Z',
        account: 'testuser',
      };

      const result = extractMessageData(tags, 'user!user@host', '#channel', 'Hello world');

      expect(result).toEqual({
        id: 'abc123',
        author: 'user',
        channel: '#channel',
        content: 'Hello world',
        account: 'testuser',
        timestamp: '2024-01-01T00:00:00Z',
      });
    });

    it('should generate UUID when msgid is missing', () => {
      const tags = {};
      const result = extractMessageData(tags, 'user!user@host', '#channel', 'Test');

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should extract author from prefix', () => {
      const tags = { msgid: 'msg1' };
      const result = extractMessageData(tags, 'alice!alice@example.com', '#test', 'Hi');

      expect(result.author).toBe('alice');
    });

    it('should handle null prefix', () => {
      const tags = { msgid: 'msg2' };
      const result = extractMessageData(tags, null, '#test', 'Server message');

      expect(result.author).toBe('');
    });

    it('should handle prefix without username/host', () => {
      const tags = { msgid: 'msg3' };
      const result = extractMessageData(tags, 'servername', '#test', 'Notice');

      expect(result.author).toBe('servername');
    });

    it('should handle missing optional tags', () => {
      const tags = { msgid: 'msg4' };
      const result = extractMessageData(tags, 'bob!bob@host', '#general', 'Message');

      expect(result.account).toBeUndefined();
      expect(result.timestamp).toBeUndefined();
    });

    it('should preserve all tag values', () => {
      const tags = {
        msgid: 'unique123',
        time: '2024-02-15T12:30:00.000Z',
        account: 'registered_user',
      };

      const result = extractMessageData(tags, 'user!user@host', '#dev', 'Code review');

      expect(result.id).toBe('unique123');
      expect(result.timestamp).toBe('2024-02-15T12:30:00.000Z');
      expect(result.account).toBe('registered_user');
    });
  });

  describe('hasBatchTag', () => {
    it('should return true when batch tag exists', () => {
      const tags = { batch: 'batch123' };
      expect(hasBatchTag(tags)).toBe(true);
    });

    it('should return false when batch tag is missing', () => {
      const tags = { msgid: 'msg1' };
      expect(hasBatchTag(tags)).toBe(false);
    });

    it('should return true even if batch value is empty string', () => {
      const tags = { batch: '' };
      expect(hasBatchTag(tags)).toBe(true);
    });

    it('should return false for empty tags object', () => {
      const tags = {};
      expect(hasBatchTag(tags)).toBe(false);
    });
  });

  describe('getBatchTag', () => {
    it('should return batch ID when present', () => {
      const tags = { batch: 'batch456' };
      expect(getBatchTag(tags)).toBe('batch456');
    });

    it('should return undefined when batch tag is missing', () => {
      const tags = { msgid: 'msg2' };
      expect(getBatchTag(tags)).toBeUndefined();
    });

    it('should return empty string if batch value is empty', () => {
      const tags = { batch: '' };
      expect(getBatchTag(tags)).toBe('');
    });

    it('should handle complex batch IDs', () => {
      const tags = { batch: 'batch-abc-123-def' };
      expect(getBatchTag(tags)).toBe('batch-abc-123-def');
    });
  });

  describe('getMessageId', () => {
    it('should return msgid when present', () => {
      const tags = { msgid: 'msg789' };
      expect(getMessageId(tags)).toBe('msg789');
    });

    it('should generate UUID when msgid is missing', () => {
      const tags = {};
      const result = getMessageId(tags);

      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should return different UUIDs for multiple calls', () => {
      const tags = {};
      const id1 = getMessageId(tags);
      const id2 = getMessageId(tags);

      expect(id1).not.toBe(id2);
    });

    it('should handle complex msgid values', () => {
      const tags = { msgid: 'uuid-550e8400-e29b-41d4-a716-446655440000' };
      expect(getMessageId(tags)).toBe('uuid-550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('getTimestamp', () => {
    it('should return timestamp when present', () => {
      const tags = { time: '2024-01-15T10:30:00Z' };
      expect(getTimestamp(tags)).toBe('2024-01-15T10:30:00Z');
    });

    it('should return undefined when timestamp is missing', () => {
      const tags = { msgid: 'msg3' };
      expect(getTimestamp(tags)).toBeUndefined();
    });

    it('should handle ISO 8601 timestamps with milliseconds', () => {
      const tags = { time: '2024-02-20T14:25:30.123Z' };
      expect(getTimestamp(tags)).toBe('2024-02-20T14:25:30.123Z');
    });

    it('should handle Unix timestamp format', () => {
      const tags = { time: '1704067200' };
      expect(getTimestamp(tags)).toBe('1704067200');
    });
  });

  describe('getAccount', () => {
    it('should return account when present', () => {
      const tags = { account: 'registered_user' };
      expect(getAccount(tags)).toBe('registered_user');
    });

    it('should return undefined when account is missing', () => {
      const tags = { msgid: 'msg4' };
      expect(getAccount(tags)).toBeUndefined();
    });

    it('should return empty string if account value is empty', () => {
      const tags = { account: '' };
      expect(getAccount(tags)).toBe('');
    });

    it('should handle account names with special characters', () => {
      const tags = { account: 'user-123_test' };
      expect(getAccount(tags)).toBe('user-123_test');
    });
  });
});
