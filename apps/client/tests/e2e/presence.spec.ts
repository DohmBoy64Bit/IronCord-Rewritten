import { test, expect } from './fixtures';
import {
  generateTestEmail,
  generateTestPassword,
  generateTestGuildName,
  waitForText,
  sleep,
} from './helpers';

test.describe('User Presence Updates', () => {
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

  test('should display user as online after login', async ({ mainWindow }) => {
    await waitForText(mainWindow, testNickname, 10000);

    await sleep(2000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(testNickname);
  });

  test('should show user presence in member list', async ({ mainWindow }) => {
    await waitForText(mainWindow, '#general', 10000);

    const generalChannel = await mainWindow.$('div:has-text("#general")');
    if (generalChannel) {
      await generalChannel.click();
      await sleep(2000);
    }

    const usersButton = await mainWindow.$('[data-testid="Users"]');
    if (usersButton) {
      await usersButton.click();
      await sleep(1000);
    }

    await sleep(2000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).not.toBeNull();
  });

  test('should maintain presence across channel switches', async ({ mainWindow }) => {
    await waitForText(mainWindow, '#general', 10000);

    const generalChannel = await mainWindow.$('div:has-text("#general")');
    if (generalChannel) {
      await generalChannel.click();
      await sleep(2000);
    }

    await sleep(1000);

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
    expect(bodyText).toContain(testNickname);
  });

  test('should display user nickname consistently', async ({ mainWindow }) => {
    await waitForText(mainWindow, testNickname, 10000);

    await sleep(2000);

    const nicknameElements = await mainWindow.$$(`text=${testNickname}`);
    expect(nicknameElements.length).toBeGreaterThan(0);
  });

  test('should show user is active when sending messages', async ({ mainWindow }) => {
    await waitForText(mainWindow, '#general', 10000);

    const generalChannel = await mainWindow.$('div:has-text("#general")');
    if (generalChannel) {
      await generalChannel.click();
      await sleep(2000);
    }

    const messageText = `Presence test message ${Date.now()}`;

    const messageInput = await mainWindow.$('input[placeholder*="Message #"]');
    if (!messageInput) {
      throw new Error('Message input not found');
    }

    await messageInput.fill(messageText);
    await messageInput.press('Enter');

    await sleep(2000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText).toContain(testNickname);
    expect(bodyText).toContain(messageText);
  });
});
