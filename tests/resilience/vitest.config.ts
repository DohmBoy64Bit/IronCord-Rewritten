import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    isolate: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      NODE_ENV: 'test',
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_PORT: process.env.DB_PORT || '5433',
      DB_NAME: process.env.DB_NAME || 'ironcord_test',
      DB_USER: process.env.DB_USER || 'ironcord_test',
      DB_PASSWORD: process.env.DB_PASSWORD || 'ironcord_test_password',
      IRC_HOST: process.env.IRC_HOST || 'localhost',
      IRC_PORT: process.env.IRC_PORT || '6668',
      GATEWAY_URL: process.env.GATEWAY_URL || 'http://localhost:3000',
      WS_URL: process.env.WS_URL || 'ws://localhost:3000',
    },
  },
});
