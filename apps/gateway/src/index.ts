import { createServer } from './server.js';
import { config } from './config/env.js';
import { logger } from '@ironcord/shared';
import { DatabaseService } from '@ironcord/db';

async function startServer(): Promise<void> {
  try {
    const db = new DatabaseService({
      connectionString: config.databaseUrl,
    });

    await db.connect();
    logger.info('DATABASE', { message: 'Database connected' });

    const app = createServer();
    app.locals.db = db;

    const server = app.listen(config.port, () => {
      logger.info('GATEWAY_START', {
        port: config.port,
        nodeEnv: config.nodeEnv,
        message: `Gateway listening on port ${config.port}`,
      });
    });

    const shutdown = async () => {
      logger.info('GATEWAY_SHUTDOWN', { message: 'Shutting down gracefully' });
      server.close(async () => {
        await db.disconnect();
        logger.info('GATEWAY_SHUTDOWN', { message: 'Server closed' });
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    logger.error('GATEWAY_START', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  }
}

startServer();
