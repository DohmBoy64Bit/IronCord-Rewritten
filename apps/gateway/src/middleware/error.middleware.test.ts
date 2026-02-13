import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorMiddleware, notFoundMiddleware, HttpError } from './error.middleware.js';

describe('errorMiddleware', () => {
  const mockReq = {
    path: '/test',
    method: 'GET',
    ip: '127.0.0.1',
  } as Request;

  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;

  const mockNext = vi.fn() as unknown as NextFunction;

  it('should handle error with status code', () => {
    const error: HttpError = new Error('Test error');
    error.status = 400;

    errorMiddleware(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Test error',
    });
  });

  it('should handle error with statusCode property', () => {
    const error: HttpError = new Error('Test error');
    error.statusCode = 403;

    errorMiddleware(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
  });

  it('should default to 500 status code', () => {
    const error: HttpError = new Error('Test error');

    errorMiddleware(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it('should use default message for errors without message', () => {
    const error = {} as HttpError;

    errorMiddleware(error, mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error',
    });
  });
});

describe('notFoundMiddleware', () => {
  const mockReq = {} as Request;
  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
  const mockNext = vi.fn() as unknown as NextFunction;

  it('should return 404 with error message', () => {
    notFoundMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Route not found',
    });
  });
});
