import { test, expect } from './fixtures';
import {
  generateTestEmail,
  generateTestPassword,
  generateTestGuildName,
  waitForText,
  sleep,
} from './helpers';

test.describe('Message Send/Receive', () => {
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

    await waitForText(mainWindow, '#general', 10000);

    const generalChannel = await mainWindow.$('div:has-text("#general")');
    if (generalChannel) {
      await generalChannel.click();
      await sleep(1000);
    }
  });

  test('should send a message successfully', async ({ mainWindow }) => {
    const messageText = `Test message ${Date.now()}`;

    const messageInput = await mainWindow.$('input[placeholder*="Message #"]');
    if (!messageInput) {
      throw new Error('Message input not found');
    }

    await messageInput.fill(messageText);
    await messageInput.press('Enter');

    await sleep(2000);

    await waitForText(mainWindow, messageText, 10000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(messageText);
  });

  test('should display sent messages in chat', async ({ mainWindow }) => {
    const message1 = `First message ${Date.now()}`;
    const message2 = `Second message ${Date.now()}`;

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

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(message1);
    expect(bodyText).toContain(message2);
  });

  test('should clear input after sending message', async ({ mainWindow }) => {
    const messageText = `Test message ${Date.now()}`;

    const messageInput = await mainWindow.$('input[placeholder*="Message #"]');
    if (!messageInput) {
      throw new Error('Message input not found');
    }

    await messageInput.fill(messageText);
    await messageInput.press('Enter');

    await sleep(1000);

    const inputValue = await messageInput.inputValue();
    expect(inputValue).toBe('');
  });

  test('should not send empty messages', async ({ mainWindow }) => {
    const messageInput = await mainWindow.$('input[placeholder*="Message #"]');
    if (!messageInput) {
      throw new Error('Message input not found');
    }

    await messageInput.fill('   ');
    await messageInput.press('Enter');

    await sleep(1000);

    const inputValue = await messageInput.inputValue();
    expect(inputValue.trim()).toBe('');
  });

  test('should display message author nickname', async ({ mainWindow }) => {
    const messageText = `Test message ${Date.now()}`;

    const messageInput = await mainWindow.$('input[placeholder*="Message #"]');
    if (!messageInput) {
      throw new Error('Message input not found');
    }

    await messageInput.fill(messageText);
    await messageInput.press('Enter');

    await sleep(2000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(testNickname);
  });

  test('should search messages in channel', async ({ mainWindow }) => {
    const uniqueWord = `unique_${Date.now()}`;
    const message1 = `This is a test message with ${uniqueWord}`;
    const message2 = `Another message without the word`;

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

    const searchInput = await mainWindow.$('input[placeholder="Search"]');
    if (!searchInput) {
      throw new Error('Search input not found');
    }

    await searchInput.fill(uniqueWord);
    await sleep(1000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(message1);
  });
});
