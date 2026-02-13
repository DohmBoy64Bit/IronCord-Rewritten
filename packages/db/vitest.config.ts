import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DB_HOST: 'localhost',
      DB_PORT: '5433',
      DB_NAME: 'ironcord_test',
      DB_USER: 'ironcord_test',
      DB_PASSWORD: 'ironcord_test_password',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'dist/**',
        '**/*.test.ts',
        '**/*.config.ts',
        'migrations/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    testTimeout: 30000,
    fileParallelism: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
