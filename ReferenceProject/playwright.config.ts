import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 60000,
    use: {
        headless: false,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        launchOptions: {
            slowMo: 1000,
        },
    },
    workers: 1, // Electron tests usually need to run sequentially
});


