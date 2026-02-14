import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '@ironcord/shared';
import { UserRepository } from '@ironcord/db';
import { logger } from '@ironcord/shared';
import { config } from '../../config/env.js';
import { passwordCache } from '../../services/password-cache.js';

interface RegisterRequest {
  email: string;
  password: string;
  irc_nick?: string;
}

interface RegisterResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

function generateIrcNick(email: string): string {
  const username = email.split('@')[0] || 'user';
  return username.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 16);
}

export async function registerHandler(
  req: Request,
  res: Response<RegisterResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, irc_nick } = req.body as RegisterRequest;

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

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
      return;
    }

    logger.info('AUTH-REGISTER', {
      phase: 'attempt',
      email,
      ip: req.ip,
    });

    const userRepo = new UserRepository(req.app.locals.db);

    const exists = await userRepo.exists(email);
    if (exists) {
      logger.warn('AUTH-REGISTER', {
        phase: 'failed',
        reason: 'email_exists',
        email,
        ip: req.ip,
      });
      res.status(409).json({
        success: false,
        error: 'Email already registered',
      });
      return;
    }

    const finalIrcNick = irc_nick || generateIrcNick(email);

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await userRepo.create({
      email,
      password_hash: passwordHash,
      irc_nick: finalIrcNick,
    });

    // Cache plaintext password temporarily for SASL/IRC registration bridge
    passwordCache.set(user.id, password);

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    logger.info('AUTH-REGISTER', {
      phase: 'success',
      userId: user.id,
      email: user.email,
      irc_nick: user.irc_nick,
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      user,
      token,
    });
  } catch (error) {
    logger.error('AUTH-REGISTER', {
      phase: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
    });
    next(error);
  }
}
