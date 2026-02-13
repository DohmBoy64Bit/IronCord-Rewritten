import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'ironcord',
      DB_USER: 'ironcord',
      DB_PASSWORD: 'dev_password_123',
      IRC_HOST: 'localhost',
      IRC_PORT: '6667',
      TEST_IRC_HOST: 'localhost',
      TEST_IRC_PORT: '6667',
    },
    // Run tests sequentially to avoid database race conditions
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Increase timeout for integration tests
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
