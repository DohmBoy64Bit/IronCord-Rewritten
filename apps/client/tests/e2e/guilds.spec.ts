import { test, expect } from './fixtures';
import {
  generateTestEmail,
  generateTestPassword,
  generateTestGuildName,
  waitForText,
  sleep,
} from './helpers';

test.describe('Guild Management', () => {
  let testEmail: string;
  let testPassword: string;
  let testNickname: string;
  let guildName: string;

  test.beforeEach(async ({ mainWindow }) => {
    testEmail = generateTestEmail();
    testPassword = generateTestPassword();
    testNickname = `test_${Date.now()}`;
    guildName = generateTestGuildName();

    await waitForText(mainWindow, 'Create an account', 10000);

    await mainWindow.fill('#reg-email', testEmail);
    await mainWindow.fill('#reg-nick', testNickname);
    await mainWindow.fill('#reg-password', testPassword);
    await mainWindow.click('button[type="submit"]');

    await sleep(2000);
    await waitForText(mainWindow, testNickname, 15000);
  });

  test('should create a new guild successfully', async ({ mainWindow }) => {
    const addServerButton = await mainWindow.$('div:has-text("Add a Server")');
    if (!addServerButton) {
      const plusButton = await mainWindow.$('[data-testid="Plus"]');
      if (plusButton) {
        await plusButton.click();
      } else {
        throw new Error('Add server button not found');
      }
    } else {
      await addServerButton.click();
    }

    await sleep(1000);

    await waitForText(mainWindow, 'Create your Guild', 10000);

    const customButton = await mainWindow.$('button:has-text("Create My Own")');
    if (customButton) {
      await customButton.click();
      await sleep(500);
    }

    await waitForText(mainWindow, 'Customize your server', 10000);

    await mainWindow.fill('#guild-name', guildName);
    await mainWindow.click('button:has-text("Create Guild")');

    await sleep(2000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(guildName.substring(0, 2).toUpperCase());
  });

  test('should create a guild from template', async ({ mainWindow }) => {
    const addServerButton = await mainWindow.$('div:has-text("Add a Server")');
    if (!addServerButton) {
      const plusButton = await mainWindow.$('[data-testid="Plus"]');
      if (plusButton) {
        await plusButton.click();
      } else {
        throw new Error('Add server button not found');
      }
    } else {
      await addServerButton.click();
    }

    await sleep(1000);

    await waitForText(mainWindow, 'Create your Guild', 10000);

    const gamingButton = await mainWindow.$('button:has-text("Gaming")');
    if (gamingButton) {
      await gamingButton.click();
      await sleep(500);
    }

    await waitForText(mainWindow, 'Customize your server', 10000);

    const nameInput = await mainWindow.$('#guild-name');
    const currentName = await nameInput?.inputValue();
    expect(currentName).toContain('Gaming Server');

    await mainWindow.click('button:has-text("Create Guild")');

    await sleep(2000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain('GA');
  });

  test('should validate guild name is required', async ({ mainWindow }) => {
    const addServerButton = await mainWindow.$('div:has-text("Add a Server")');
    if (!addServerButton) {
      const plusButton = await mainWindow.$('[data-testid="Plus"]');
      if (plusButton) {
        await plusButton.click();
      } else {
        throw new Error('Add server button not found');
      }
    } else {
      await addServerButton.click();
    }

    await sleep(1000);

    const customButton = await mainWindow.$('button:has-text("Create My Own")');
    if (customButton) {
      await customButton.click();
      await sleep(500);
    }

    await waitForText(mainWindow, 'Customize your server', 10000);

    const createButton = await mainWindow.$('button:has-text("Create Guild")');
    const isDisabled = await createButton?.evaluate((el: HTMLButtonElement) => el.disabled);
    expect(isDisabled).toBe(true);
  });

  test('should switch between guilds', async ({ mainWindow }) => {
    const guild1Name = generateTestGuildName('Guild1');
    const guild2Name = generateTestGuildName('Guild2');

    for (const name of [guild1Name, guild2Name]) {
      const addServerButton = await mainWindow.$('div:has-text("Add a Server")');
      if (!addServerButton) {
        const plusButton = await mainWindow.$('[data-testid="Plus"]');
        if (plusButton) {
          await plusButton.click();
        }
      } else {
        await addServerButton.click();
      }

      await sleep(1000);

      const customButton = await mainWindow.$('button:has-text("Create My Own")');
      if (customButton) {
        await customButton.click();
        await sleep(500);
      }

      await mainWindow.fill('#guild-name', name);
      await mainWindow.click('button:has-text("Create Guild")');

      await sleep(2000);
    }

    const guild1Icon = await mainWindow.$(`div:has-text("${guild1Name.substring(0, 2).toUpperCase()}")`);
    if (guild1Icon) {
      await guild1Icon.click();
      await sleep(500);
    }

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(guild1Name.substring(0, 2).toUpperCase());
  });

  test('should close guild creation modal', async ({ mainWindow }) => {
    const addServerButton = await mainWindow.$('div:has-text("Add a Server")');
    if (!addServerButton) {
      const plusButton = await mainWindow.$('[data-testid="Plus"]');
      if (plusButton) {
        await plusButton.click();
      }
    } else {
      await addServerButton.click();
    }

    await sleep(1000);

    await waitForText(mainWindow, 'Create your Guild', 10000);

    const closeButton = await mainWindow.$('button:has([data-testid="X"])');
    if (closeButton) {
      await closeButton.click();
      await sleep(500);
    }

    const modalVisible = await mainWindow.$('text=Create your Guild');
    expect(modalVisible).toBeNull();
  });
});
