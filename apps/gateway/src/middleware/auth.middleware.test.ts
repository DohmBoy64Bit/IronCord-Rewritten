import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, AuthenticatedRequest } from './auth.middleware.js';
import { config } from '../config/env.js';

describe('authMiddleware', () => {
  let mockNext: NextFunction;
  let mockRes: Response;

  beforeEach(() => {
    mockNext = vi.fn() as unknown as NextFunction;
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
  });

  it('should reject request without authorization header', () => {
    const mockReq = {
      headers: {},
    } as AuthenticatedRequest;

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Missing or invalid authorization header',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with invalid authorization header format', () => {
    const mockReq = {
      headers: { authorization: 'InvalidFormat token123' },
    } as AuthenticatedRequest;

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Missing or invalid authorization header',
    });
  });

  it('should reject request with invalid JWT token', () => {
    const mockReq = {
      headers: { authorization: 'Bearer invalid_token' },
    } as AuthenticatedRequest;

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid or expired token',
    });
  });

  it('should accept valid JWT token and attach user to request', () => {
    const userId = 'user123';
    const token = jwt.sign({ userId }, config.jwtSecret);
    
    const mockReq = {
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockReq.user).toEqual({ userId });
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should reject token without userId in payload', () => {
    const token = jwt.sign({ someOtherField: 'value' }, config.jwtSecret);
    
    const mockReq = {
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;

    authMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid token payload',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
