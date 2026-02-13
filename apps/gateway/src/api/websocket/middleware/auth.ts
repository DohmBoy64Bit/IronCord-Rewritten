import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../../config/env.js';
import { logger } from '@ironcord/shared';

export interface SocketData {
  userId: string;
  email: string;
}

export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const token = socket.handshake.auth.token;

  if (!token) {
    logger.warn('WS-AUTH', {
      socketId: socket.id,
      message: 'No token provided',
    });
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    
    if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded && 'email' in decoded) {
      socket.data = {
        userId: (decoded as { userId: string }).userId,
        email: (decoded as { email: string }).email,
      } as SocketData;
      
      logger.info('WS-AUTH', {
        socketId: socket.id,
        userId: socket.data.userId,
        message: 'Socket authenticated',
      });
      
      next();
    } else {
      logger.warn('WS-AUTH', {
        socketId: socket.id,
        message: 'Invalid token payload',
      });
      return next(new Error('Authentication error: Invalid token payload'));
    }
  } catch (err) {
    logger.warn('WS-AUTH', {
      socketId: socket.id,
      error: err instanceof Error ? err.message : String(err),
      message: 'Token verification failed',
    });
    return next(new Error('Authentication error: Invalid or expired token'));
  }
}
