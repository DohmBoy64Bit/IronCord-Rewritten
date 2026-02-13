import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatUsername,
  formatNickname,
  formatTimestamp,
} from '../src/utils/formatters';

describe('formatters', () => {
  describe('formatDate', () => {
    it('should format date string to ISO string', () => {
      const dateStr = '2024-01-15T10:30:00.000Z';
      expect(formatDate(dateStr)).toBe(dateStr);
    });

    it('should format Date object to ISO string', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      expect(formatDate(date)).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  describe('formatUsername', () => {
    it('should trim and lowercase username', () => {
      expect(formatUsername('  User123  ')).toBe('user123');
      expect(formatUsername('USER')).toBe('user');
      expect(formatUsername('User Name')).toBe('user name');
    });
  });

  describe('formatNickname', () => {
    it('should extract and format nickname from email', () => {
      expect(formatNickname('user123@example.com')).toBe('user123');
      expect(formatNickname('john.doe@example.com')).toBe('johndoe');
      expect(formatNickname('user_name@example.com')).toBe('username');
    });

    it('should handle emails with special characters', () => {
      const result = formatNickname('user+tag@example.com');
      expect(result).toBe('usertag');
    });

    it('should limit nickname to 32 characters', () => {
      const longEmail = 'a'.repeat(50) + '@example.com';
      const result = formatNickname(longEmail);
      expect(result.length).toBeLessThanOrEqual(32);
    });

    it('should generate random nickname for invalid input', () => {
      const result1 = formatNickname('123@example.com');
      expect(result1).toMatch(/^user[a-z0-9]{6}$/);
      
      const result2 = formatNickname('@example.com');
      expect(result2).toMatch(/^user[a-z0-9]{6}$/);
    });
  });

  describe('formatTimestamp', () => {
    it('should return current timestamp if no input provided', () => {
      const result = formatTimestamp();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should format provided timestamp', () => {
      const timestamp = '2024-01-15T10:30:00.000Z';
      expect(formatTimestamp(timestamp)).toBe(timestamp);
    });
  });
});
