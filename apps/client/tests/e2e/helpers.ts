import type { Page } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  nickname?: string;
  token?: string;
  userId?: number;
}

export interface TestGuild {
  id?: number;
  name: string;
  ircNamespace?: string;
  ownerId?: number;
}

export interface TestChannel {
  id?: number;
  name: string;
  ircChannelName?: string;
  guildId?: number;
}

export async function waitForElement(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<void> {
  await page.waitForSelector(selector, { timeout });
}

export async function waitForText(
  page: Page,
  text: string,
  timeout = 5000
): Promise<void> {
  await page.waitForFunction(
    (searchText) => document.body.textContent?.includes(searchText),
    text,
    { timeout }
  );
}

export async function fillInput(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  await page.fill(selector, value);
}

export async function clickButton(
  page: Page,
  selector: string
): Promise<void> {
  await page.click(selector);
}

export function generateTestEmail(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}_${timestamp}_${random}@ironcord.test`;
}

export function generateTestPassword(): string {
  return `Test${Date.now()}!`;
}

export function generateTestGuildName(prefix = 'TestGuild'): string {
  const timestamp = Date.now();
  return `${prefix}_${timestamp}`;
}

export function generateTestChannelName(prefix = 'test-channel'): string {
  const timestamp = Date.now();
  return `${prefix}-${timestamp}`;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForNetworkIdle(page: Page, timeout = 3000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

export async function getLocalStorage(page: Page, key: string): Promise<string | null> {
  return await page.evaluate((storageKey) => {
    return localStorage.getItem(storageKey);
  }, key);
}

export async function setLocalStorage(
  page: Page,
  key: string,
  value: string
): Promise<void> {
  await page.evaluate(
    ({ storageKey, storageValue }) => {
      localStorage.setItem(storageKey, storageValue);
    },
    { storageKey: key, storageValue: value }
  );
}

export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
  });
}
