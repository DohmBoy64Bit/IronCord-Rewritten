import { test, expect } from './fixtures';
import {
  generateTestEmail,
  generateTestPassword,
  waitForText,
  sleep,
} from './helpers';

test.describe('Authentication Flow', () => {
  let testEmail: string;
  let testPassword: string;
  let testNickname: string;

  test.beforeEach(() => {
    testEmail = generateTestEmail();
    testPassword = generateTestPassword();
    testNickname = `test_${Date.now()}`;
  });

  test('should register a new user successfully', async ({ mainWindow }) => {
    await waitForText(mainWindow, 'Create an account', 10000);

    await mainWindow.fill('#reg-email', testEmail);
    await mainWindow.fill('#reg-nick', testNickname);
    await mainWindow.fill('#reg-password', testPassword);

    await mainWindow.click('button[type="submit"]');

    await sleep(2000);

    const errorElement = await mainWindow.$('div:has-text("error")');
    if (errorElement) {
      const errorText = await errorElement.textContent();
      console.log('Registration error:', errorText);
    }

    await waitForText(mainWindow, testNickname, 15000);

    expect(await mainWindow.textContent('body')).toContain(testNickname);
  });

  test('should login an existing user successfully', async ({ mainWindow }) => {
    await waitForText(mainWindow, 'Create an account', 10000);

    await mainWindow.fill('#reg-email', testEmail);
    await mainWindow.fill('#reg-nick', testNickname);
    await mainWindow.fill('#reg-password', testPassword);
    await mainWindow.click('button[type="submit"]');

    await sleep(2000);

    await waitForText(mainWindow, testNickname, 15000);

    const logoutButton = await mainWindow.$('button:has-text("Logout")');
    if (logoutButton) {
      await logoutButton.click();
      await sleep(1000);
    }

    const loginLink = await mainWindow.$('button:has-text("Login")');
    if (loginLink) {
      await loginLink.click();
      await sleep(500);
    }

    await waitForText(mainWindow, 'Welcome back', 10000);

    await mainWindow.fill('#email', testEmail);
    await mainWindow.fill('#password', testPassword);
    await mainWindow.click('button[type="submit"]');

    await sleep(2000);

    await waitForText(mainWindow, testNickname, 15000);

    expect(await mainWindow.textContent('body')).toContain(testNickname);
  });

  test('should show error for invalid credentials', async ({ mainWindow }) => {
    await waitForText(mainWindow, 'Create an account', 10000);

    const loginLink = await mainWindow.$('button:has-text("Login")');
    if (loginLink) {
      await loginLink.click();
      await sleep(500);
    }

    await waitForText(mainWindow, 'Welcome back', 10000);

    await mainWindow.fill('#email', 'invalid@test.com');
    await mainWindow.fill('#password', 'wrongpassword');
    await mainWindow.click('button[type="submit"]');

    await sleep(2000);

    const bodyText = await mainWindow.textContent('body');
    expect(bodyText?.toLowerCase()).toMatch(/error|invalid|failed/);
  });

  test('should validate required fields on registration', async ({ mainWindow }) => {
    await waitForText(mainWindow, 'Create an account', 10000);

    await mainWindow.click('button[type="submit"]');

    await sleep(500);

    const emailInput = await mainWindow.$('#reg-email');
    const isValid = await emailInput?.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('should validate required fields on login', async ({ mainWindow }) => {
    await waitForText(mainWindow, 'Create an account', 10000);

    const loginLink = await mainWindow.$('button:has-text("Login")');
    if (loginLink) {
      await loginLink.click();
      await sleep(500);
    }

    await waitForText(mainWindow, 'Welcome back', 10000);

    await mainWindow.click('button[type="submit"]');

    await sleep(500);

    const emailInput = await mainWindow.$('#email');
    const isValid = await emailInput?.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });
});
