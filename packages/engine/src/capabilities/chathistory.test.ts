import { describe, it, expect } from 'vitest';
import {
  formatChatHistoryLatest,
  formatChatHistoryBefore,
  formatChatHistoryAfter,
  formatChatHistoryBetween,
  formatChatHistoryAround,
} from './chathistory.js';

describe('ChatHistory Formatters', () => {
  describe('formatChatHistoryLatest', () => {
    it('should format CHATHISTORY LATEST command', () => {
      const result = formatChatHistoryLatest('#test-channel', 50);
      expect(result).toBe('CHATHISTORY LATEST #test-channel * 50');
    });

    it('should handle different channels', () => {
      const result = formatChatHistoryLatest('#general', 100);
      expect(result).toBe('CHATHISTORY LATEST #general * 100');
    });

    it('should handle different limits', () => {
      const result = formatChatHistoryLatest('#random', 25);
      expect(result).toBe('CHATHISTORY LATEST #random * 25');
    });
  });

  describe('formatChatHistoryBefore', () => {
    it('should format CHATHISTORY BEFORE command', () => {
      const result = formatChatHistoryBefore('#test-channel', '2024-01-01T00:00:00Z', 50);
      expect(result).toBe('CHATHISTORY BEFORE #test-channel timestamp=2024-01-01T00:00:00Z 50');
    });

    it('should handle Unix timestamps', () => {
      const result = formatChatHistoryBefore('#general', '1704067200', 100);
      expect(result).toBe('CHATHISTORY BEFORE #general timestamp=1704067200 100');
    });

    it('should handle different limits', () => {
      const result = formatChatHistoryBefore('#random', '2024-02-01T12:00:00Z', 10);
      expect(result).toBe('CHATHISTORY BEFORE #random timestamp=2024-02-01T12:00:00Z 10');
    });
  });

  describe('formatChatHistoryAfter', () => {
    it('should format CHATHISTORY AFTER command', () => {
      const result = formatChatHistoryAfter('#test-channel', '2024-01-01T00:00:00Z', 50);
      expect(result).toBe('CHATHISTORY AFTER #test-channel timestamp=2024-01-01T00:00:00Z 50');
    });

    it('should handle different timestamps', () => {
      const result = formatChatHistoryAfter('#general', '1704067200', 75);
      expect(result).toBe('CHATHISTORY AFTER #general timestamp=1704067200 75');
    });

    it('should handle edge case limits', () => {
      const result = formatChatHistoryAfter('#random', '2024-03-01T00:00:00Z', 1);
      expect(result).toBe('CHATHISTORY AFTER #random timestamp=2024-03-01T00:00:00Z 1');
    });
  });

  describe('formatChatHistoryBetween', () => {
    it('should format CHATHISTORY BETWEEN command', () => {
      const result = formatChatHistoryBetween(
        '#test-channel',
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
        50
      );
      expect(result).toBe(
        'CHATHISTORY BETWEEN #test-channel timestamp=2024-01-01T00:00:00Z timestamp=2024-01-02T00:00:00Z 50'
      );
    });

    it('should handle Unix timestamp ranges', () => {
      const result = formatChatHistoryBetween('#general', '1704067200', '1704153600', 100);
      expect(result).toBe(
        'CHATHISTORY BETWEEN #general timestamp=1704067200 timestamp=1704153600 100'
      );
    });

    it('should handle different channels and limits', () => {
      const result = formatChatHistoryBetween(
        '#development',
        '2024-02-01T00:00:00Z',
        '2024-02-15T23:59:59Z',
        250
      );
      expect(result).toBe(
        'CHATHISTORY BETWEEN #development timestamp=2024-02-01T00:00:00Z timestamp=2024-02-15T23:59:59Z 250'
      );
    });
  });

  describe('formatChatHistoryAround', () => {
    it('should format CHATHISTORY AROUND command with msgid', () => {
      const result = formatChatHistoryAround('#test-channel', 'msg123456', 50);
      expect(result).toBe('CHATHISTORY AROUND #test-channel msgid=msg123456 50');
    });

    it('should handle different message IDs', () => {
      const result = formatChatHistoryAround('#general', 'abc-def-ghi', 100);
      expect(result).toBe('CHATHISTORY AROUND #general msgid=abc-def-ghi 100');
    });

    it('should handle numeric message IDs', () => {
      const result = formatChatHistoryAround('#random', '9876543210', 25);
      expect(result).toBe('CHATHISTORY AROUND #random msgid=9876543210 25');
    });

    it('should handle UUID-style message IDs', () => {
      const result = formatChatHistoryAround(
        '#support',
        '550e8400-e29b-41d4-a716-446655440000',
        75
      );
      expect(result).toBe(
        'CHATHISTORY AROUND #support msgid=550e8400-e29b-41d4-a716-446655440000 75'
      );
    });
  });
});
