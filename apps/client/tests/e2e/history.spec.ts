import { test, expect } from './fixtures';
import {
  generateTestEmail,
  generateTestPassword,
  generateTestGuildName,
  waitForText,
  sleep,
} from './helpers';

test.describe('Message History Retrieval', () => {
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

    await mainWindow.fill('#guild-name', guildName);
    await mainWindow.click('button:has-text("Create Guild")');

    await sleep(2000);
  });

  test('should load message history when joining a channel', async ({ mainWindow }) => {
    await waitForText(mainWindow, '#general', 10000);

    const generalChannel = await mainWindow.$('div:has-text("#general")');
    if (generalChannel) {
      await generalChannel.click();
      await sleep(2000);
    }

    const message1 = `History message 1 ${Date.now()}`;
    const message2 = `History message 2 ${Date.now()}`;

    const messageInput = await mainWindow.$('input[placeholder*="Message #"]');
    if (!messageInput) {
      throw new Error('Message input not found');
    }

    await messageInput.fill(message1);
    await messageInput.press('Enter');
    await sleep(1000);

    await messageInput.fill(message2);
    await messageInput.press('Enter');
    await sleep(2000);

    const guildIcon = await mainWindow.$('div:has-text("Direct Messages")');
    if (guildIcon) {
      await guildIcon.click();
      await sleep(1000);
    }

    const guildIconBack = await mainWindow.$(`div:has-text("${guildName.substring(0, 2).toUpperCase()}")`);
    if (guildIconBack) {
      await guildIconBack.click();
      await sleep(1000);
    }

    const generalChannelAgain = await mainWindow.$('div:has-text("#general")');
    if (generalChannelAgain) {
      await generalChannelAgain.click();
      await sleep(2000);
    }

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(message1);
    expect(bodyText).toContain(message2);
  });

  test('should display welcome message for new channels', async ({ mainWindow }) => {
    await waitForText(mainWindow, '#general', 10000);

    const generalChannel = await mainWindow.$('div:has-text("#general")');
    if (generalChannel) {
      await generalChannel.click();
      await sleep(2000);
    }

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain('Welcome to #general');
  });

  test('should preserve message order from history', async ({ mainWindow }) => {
    await waitForText(mainWindow, '#general', 10000);

    const generalChannel = await mainWindow.$('div:has-text("#general")');
    if (generalChannel) {
      await generalChannel.click();
      await sleep(2000);
    }

    const messages = [
      `Message 1 ${Date.now()}`,
      `Message 2 ${Date.now()}`,
      `Message 3 ${Date.now()}`,
    ];

    const messageInput = await mainWindow.$('input[placeholder*="Message #"]');
    if (!messageInput) {
      throw new Error('Message input not found');
    }

    for (const msg of messages) {
      await messageInput.fill(msg);
      await messageInput.press('Enter');
      await sleep(500);
    }

    await sleep(2000);

    const bodyText = await mainWindow.textContent('body');
    const idx1 = bodyText?.indexOf(messages[0]) ?? -1;
    const idx2 = bodyText?.indexOf(messages[1]) ?? -1;
    const idx3 = bodyText?.indexOf(messages[2]) ?? -1;

    expect(idx1).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx3);
  });

  test('should load history with timestamps', async ({ mainWindow }) => {
    await waitForText(mainWindow, '#general', 10000);

    const generalChannel = await mainWindow.$('div:has-text("#general")');
    if (generalChannel) {
      await generalChannel.click();
      await sleep(2000);
    }

    const messageText = `Timestamped message ${Date.now()}`;

    const messageInput = await mainWindow.$('input[placeholder*="Message #"]');
    if (!messageInput) {
      throw new Error('Message input not found');
    }

    await messageInput.fill(messageText);
    await messageInput.press('Enter');
    await sleep(2000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toMatch(/Today at \d{2}:\d{2}/);
  });
});
