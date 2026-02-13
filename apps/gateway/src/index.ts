import { createServer } from './server.js';
import { config } from './config/env.js';
import { logger } from '@ironcord/shared';

async function startServer(): Promise<void> {
  try {
    const app = createServer();

    app.listen(config.port, () => {
      logger.info('GATEWAY_START', {
        port: config.port,
        nodeEnv: config.nodeEnv,
        message: `Gateway listening on port ${config.port}`,
      });
    });
  } catch (err) {
    logger.error('GATEWAY_START', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  }
}

startServer();
