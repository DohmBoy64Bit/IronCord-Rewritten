import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidPassword,
  isValidNickname,
  validateEmail,
  validatePassword,
  validateNickname,
} from '../src/utils/validators';

describe('validators', () => {
  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@invalid.com')).toBe(false);
      expect(isValidEmail('invalid@domain')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    it('should return true for valid passwords', () => {
      expect(isValidPassword('password123')).toBe(true);
      expect(isValidPassword('123456')).toBe(true);
      expect(isValidPassword('a'.repeat(100))).toBe(true);
    });

    it('should return false for invalid passwords', () => {
      expect(isValidPassword('12345')).toBe(false);
      expect(isValidPassword('')).toBe(false);
      expect(isValidPassword('abc')).toBe(false);
    });
  });

  describe('isValidNickname', () => {
    it('should return true for valid nicknames', () => {
      expect(isValidNickname('user123')).toBe(true);
      expect(isValidNickname('user_name')).toBe(true);
      expect(isValidNickname('user-name')).toBe(true);
      expect(isValidNickname('a')).toBe(true);
      expect(isValidNickname('A1234567890_-test')).toBe(true);
    });

    it('should return false for invalid nicknames', () => {
      expect(isValidNickname('1user')).toBe(false);
      expect(isValidNickname('_user')).toBe(false);
      expect(isValidNickname('-user')).toBe(false);
      expect(isValidNickname('')).toBe(false);
      expect(isValidNickname('user@name')).toBe(false);
      expect(isValidNickname('user name')).toBe(false);
      expect(isValidNickname('a'.repeat(33))).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should return valid: true for valid emails', () => {
      expect(validateEmail('test@example.com')).toEqual({ valid: true });
    });

    it('should return error for empty email', () => {
      expect(validateEmail('')).toEqual({ valid: false, error: 'Email is required' });
      expect(validateEmail('   ')).toEqual({ valid: false, error: 'Email is required' });
    });

    it('should return error for invalid format', () => {
      expect(validateEmail('invalid')).toEqual({ valid: false, error: 'Invalid email format' });
    });
  });

  describe('validatePassword', () => {
    it('should return valid: true for valid passwords', () => {
      expect(validatePassword('password123')).toEqual({ valid: true });
    });

    it('should return error for empty password', () => {
      expect(validatePassword('')).toEqual({ valid: false, error: 'Password is required' });
    });

    it('should return error for short password', () => {
      expect(validatePassword('12345')).toEqual({ 
        valid: false, 
        error: 'Password must be at least 6 characters long' 
      });
    });
  });

  describe('validateNickname', () => {
    it('should return valid: true for valid nicknames', () => {
      expect(validateNickname('user123')).toEqual({ valid: true });
    });

    it('should return error for empty nickname', () => {
      expect(validateNickname('')).toEqual({ valid: false, error: 'Nickname is required' });
      expect(validateNickname('   ')).toEqual({ valid: false, error: 'Nickname is required' });
    });

    it('should return error for invalid format', () => {
      const result = validateNickname('1user');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must start with a letter');
    });
  });
});
