import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export interface AuthenticatedRequest extends Request {
  user?: { userId: string };
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing token',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded) {
      req.user = { userId: (decoded as { userId: string }).userId };
      next();
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid token payload',
      });
    }
  } catch (err) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}
