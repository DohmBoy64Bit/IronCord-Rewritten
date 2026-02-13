import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbService } from '../services/db.service';
import { logger } from '../logger';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ironcord_secret_key_change_me';

// Register
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, irc_nick, ircNick } = req.body;
  const finalIrcNick = irc_nick || ircNick;

  if (!email || !password || !finalIrcNick) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  try {
    logger.info('AUTH-REGISTER', {
      phase: 'attempt',
      email,
      irc_nick: finalIrcNick,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await dbService.query(
      'INSERT INTO users (email, password_hash, irc_nick) VALUES ($1, $2, $3) RETURNING id, email, irc_nick',
      [email, passwordHash, finalIrcNick]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

    logger.info('AUTH-REGISTER', {
      phase: 'success',
      userId: user.id,
      email: user.email,
      irc_nick: user.irc_nick,
      ip: req.ip,
    });

    res.status(201).json({ success: true, user, token });
  } catch (err: any) {
    logger.error('AUTH-REGISTER', {
      phase: 'error',
      email,
      irc_nick: finalIrcNick,
      ip: req.ip,
      error: err?.message,
    });
    res.status(500).json({ success: false, error: 'Failed to register user' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    logger.info('AUTH-LOGIN', {
      phase: 'attempt',
      email,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const result = await dbService.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      logger.warn('AUTH-LOGIN', {
        phase: 'failed',
        reason: 'bad_credentials',
        email,
        ip: req.ip,
      });
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
    const { password_hash, ...userWithoutPassword } = user;

    logger.info('AUTH-LOGIN', {
      phase: 'success',
      userId: user.id,
      email: user.email,
      irc_nick: user.irc_nick,
      ip: req.ip,
    });

    res.json({ success: true, user: userWithoutPassword, token });
  } catch (err: any) {
    logger.error('AUTH-LOGIN', {
      phase: 'error',
      email,
      ip: req.ip,
      error: err?.message,
    });
    res.status(500).json({ success: false, error: 'Failed to login' });
  }
});

export default router;
