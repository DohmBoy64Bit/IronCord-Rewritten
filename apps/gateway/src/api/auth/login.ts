import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '@ironcord/shared';
import { UserRepository } from '@ironcord/db';
import { logger } from '@ironcord/shared';
import { config } from '../../config/env.js';
import { passwordCache } from '../../services/password-cache.js';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export async function loginHandler(
  req: Request,
  res: Response<LoginResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body as LoginRequest;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
      return;
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid email or password format',
      });
      return;
    }

    logger.info('AUTH-LOGIN', {
      phase: 'attempt',
      email,
      ip: req.ip,
    });

    const userRepo = new UserRepository(req.app.locals.db);

    const user = await userRepo.findByEmail(email);
    if (!user) {
      logger.warn('AUTH-LOGIN', {
        phase: 'failed',
        reason: 'user_not_found',
        email,
        ip: req.ip,
      });
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    const passwordHash = await userRepo.findPasswordHash(email);
    if (!passwordHash) {
      logger.warn('AUTH-LOGIN', {
        phase: 'failed',
        reason: 'no_password_hash',
        email,
        ip: req.ip,
      });
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    const isValid = await bcrypt.compare(password, passwordHash);
    if (!isValid) {
      logger.warn('AUTH-LOGIN', {
        phase: 'failed',
        reason: 'invalid_password',
        email,
        ip: req.ip,
      });
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Cache plaintext password temporarily for SASL/IRC registration bridge
    passwordCache.set(user.id, password);

    logger.info('AUTH-LOGIN', {
      phase: 'success',
      userId: user.id,
      email: user.email,
      irc_nick: user.irc_nick,
      ip: req.ip,
    });

    res.json({
      success: true,
      user,
      token,
    });
  } catch (error) {
    logger.error('AUTH-LOGIN', {
      phase: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
    });
    next(error);
  }
}
