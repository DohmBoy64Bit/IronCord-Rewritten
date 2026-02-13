import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
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
