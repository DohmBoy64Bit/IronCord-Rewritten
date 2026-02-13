import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js';
import { logger } from '@ironcord/shared';

export function createServer(): Express {
  const app = express();

  app.use(cors({
    origin: config.nodeEnv === 'production' ? config.clientOrigin : '*',
    credentials: true,
  }));

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  logger.info('SERVER', { message: 'Express server configured' });

  return app;
}
