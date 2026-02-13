import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { validateBody, validators } from './validation.middleware.js';

describe('validateBody', () => {
  let mockNext: NextFunction;
  let mockRes: Response;

  beforeEach(() => {
    mockNext = vi.fn() as unknown as NextFunction;
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
  });

  it('should pass validation with valid fields', () => {
    const schema = {
      email: validators.email,
      password: validators.string,
    };

    const mockReq = {
      body: {
        email: 'test@example.com',
        password: 'password123',
      },
    } as Request;

    const middleware = validateBody(schema);
    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should reject validation with invalid fields', () => {
    const schema = {
      email: validators.email,
      password: validators.required,
    };

    const mockReq = {
      body: {
        email: 'not-an-email',
        password: '',
      },
    } as Request;

    const middleware = validateBody(schema);
    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe('validators', () => {
  describe('required', () => {
    it('should accept non-empty values', () => {
      expect(validators.required('value')).toBe(true);
      expect(validators.required(123)).toBe(true);
      expect(validators.required({})).toBe(true);
    });

    it('should reject empty values', () => {
      expect(validators.required('')).toBe(false);
      expect(validators.required(null)).toBe(false);
      expect(validators.required(undefined)).toBe(false);
    });
  });

  describe('string', () => {
    it('should accept non-empty strings', () => {
      expect(validators.string('hello')).toBe(true);
    });

    it('should reject empty or whitespace strings', () => {
      expect(validators.string('')).toBe(false);
      expect(validators.string('   ')).toBe(false);
      expect(validators.string(123)).toBe(false);
    });
  });

  describe('email', () => {
    it('should accept valid email addresses', () => {
      expect(validators.email('test@example.com')).toBe(true);
      expect(validators.email('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validators.email('not-an-email')).toBe(false);
      expect(validators.email('missing@domain')).toBe(false);
      expect(validators.email('@domain.com')).toBe(false);
      expect(validators.email(123)).toBe(false);
    });
  });

  describe('minLength', () => {
    it('should accept strings meeting minimum length', () => {
      const validator = validators.minLength(5);
      expect(validator('hello')).toBe(true);
      expect(validator('hello world')).toBe(true);
    });

    it('should reject strings below minimum length', () => {
      const validator = validators.minLength(5);
      expect(validator('hi')).toBe(false);
      expect(validator('')).toBe(false);
    });
  });

  describe('maxLength', () => {
    it('should accept strings within maximum length', () => {
      const validator = validators.maxLength(10);
      expect(validator('hello')).toBe(true);
      expect(validator('hello worl')).toBe(true);
    });

    it('should reject strings exceeding maximum length', () => {
      const validator = validators.maxLength(10);
      expect(validator('hello world!')).toBe(false);
    });
  });
});
