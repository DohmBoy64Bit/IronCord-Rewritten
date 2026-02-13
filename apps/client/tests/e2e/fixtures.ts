import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

type TestFixtures = {
  electronApp: ElectronApplication;
  mainWindow: Page;
};

export const test = base.extend<TestFixtures>({
  electronApp: async ({}, use) => {
    const appPath = path.join(__dirname, '../../src/main/index.ts');

    const app = await electron.launch({
      args: ['.', appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '1',
        GATEWAY_URL: 'http://localhost:3000',
        GATEWAY_WS_URL: 'ws://localhost:3000',
      },
    });

    await use(app);

    await app.close();
  },

  mainWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await use(window);
  },
});

export { expect } from '@playwright/test';
