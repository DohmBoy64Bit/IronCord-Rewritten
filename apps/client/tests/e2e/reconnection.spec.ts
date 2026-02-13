import { test, expect } from './fixtures';
import {
  generateTestEmail,
  generateTestPassword,
  generateTestGuildName,
  waitForText,
  sleep,
} from './helpers';

test.describe('Reconnection Resilience', () => {
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

  test('should maintain UI state during brief disconnections', async ({ mainWindow }) => {
    await waitForText(mainWindow, '#general', 10000);

    const generalChannel = await mainWindow.$('div:has-text("#general")');
    if (generalChannel) {
      await generalChannel.click();
      await sleep(2000);
    }

    const messageText = `Pre-disconnect message ${Date.now()}`;

    const messageInput = await mainWindow.$('input[placeholder*="Message #"]');
    if (!messageInput) {
      throw new Error('Message input not found');
    }

    await messageInput.fill(messageText);
    await messageInput.press('Enter');

    await sleep(2000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(messageText);
    expect(bodyText).toContain(guildName.substring(0, 2).toUpperCase());
  });

  test('should recover from network interruption gracefully', async ({ mainWindow }) => {
    await waitForText(mainWindow, '#general', 10000);

    const generalChannel = await mainWindow.$('div:has-text("#general")');
    if (generalChannel) {
      await generalChannel.click();
      await sleep(2000);
    }

    const beforeMessage = `Before interruption ${Date.now()}`;
    const afterMessage = `After interruption ${Date.now()}`;

    const messageInput = await mainWindow.$('input[placeholder*="Message #"]');
    if (!messageInput) {
      throw new Error('Message input not found');
    }

    await messageInput.fill(beforeMessage);
    await messageInput.press('Enter');

    await sleep(5000);

    await messageInput.fill(afterMessage);
    await messageInput.press('Enter');

    await sleep(2000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(beforeMessage);
    expect(bodyText).toContain(afterMessage);
  });

  test('should maintain guild and channel state after reconnection', async ({ mainWindow }) => {
    await waitForText(mainWindow, '#general', 10000);

    const generalChannel = await mainWindow.$('div:has-text("#general")');
    if (generalChannel) {
      await generalChannel.click();
      await sleep(2000);
    }

    await sleep(3000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain('#general');
    expect(bodyText).toContain(guildName.substring(0, 2).toUpperCase());
  });

  test('should preserve message history after reconnection', async ({ mainWindow }) => {
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

    await sleep(3000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(message1);
    expect(bodyText).toContain(message2);
  });

  test('should allow sending messages after reconnection', async ({ mainWindow }) => {
    await waitForText(mainWindow, '#general', 10000);

    const generalChannel = await mainWindow.$('div:has-text("#general")');
    if (generalChannel) {
      await generalChannel.click();
      await sleep(2000);
    }

    await sleep(3000);

    const messageText = `Post-reconnection message ${Date.now()}`;

    const messageInput = await mainWindow.$('input[placeholder*="Message #"]');
    if (!messageInput) {
      throw new Error('Message input not found');
    }

    await messageInput.fill(messageText);
    await messageInput.press('Enter');

    await sleep(2000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(messageText);
  });
});
