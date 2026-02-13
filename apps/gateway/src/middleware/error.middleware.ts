import { Request, Response, NextFunction } from 'express';
import { logger } from '@ironcord/shared';

export interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

export function errorMiddleware(
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  logger.error('HTTP_ERROR', {
    status,
    message,
    path: req.path,
    method: req.method,
    ip: req.ip,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(status).json({
    success: false,
    error: message,
  });
}

export function notFoundMiddleware(
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
}
