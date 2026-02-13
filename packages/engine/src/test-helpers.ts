import { IRCClient } from './irc-client.js';
import type { IRCConfig } from './types.js';

export interface TestIRCConfig {
  host?: string;
  port?: number;
  nick?: string;
  username?: string;
  realname?: string;
  password?: string;
}

export function createTestIRCClient(overrides: TestIRCConfig = {}): IRCClient {
  const config: IRCConfig = {
    host: process.env.IRC_HOST || 'localhost',
    port: parseInt(process.env.IRC_PORT || '6667', 10),
    nick: overrides.nick || `test_${Math.random().toString(36).substring(7)}`,
    username: overrides.username || 'testuser',
    realname: overrides.realname || 'Test User',
    password: overrides.password,
  };

  return new IRCClient(config, { maxRetries: 2, initialDelay: 500 });
}

export function waitForEvent<T>(
  client: IRCClient,
  eventName: string,
  timeout: number = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    client.once(eventName, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

export async function connectAndWaitForReady(
  client: IRCClient,
  timeout: number = 10000
): Promise<void> {
  client.connect();
  await waitForEvent(client, 'registered', timeout);
}
