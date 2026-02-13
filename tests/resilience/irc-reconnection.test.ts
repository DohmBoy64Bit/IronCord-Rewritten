import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { IRCClient } from '@ironcord/engine';
import type { IRCConfig, ReconnectEvent } from '@ironcord/engine';
import { execSync } from 'child_process';

const IRC_HOST = process.env.IRC_HOST || 'localhost';
const IRC_PORT = parseInt(process.env.IRC_PORT || '6668', 10);
const TEST_NICK = `resilience_${Date.now()}`;
const TEST_PASSWORD = 'test_password';

describe('IRC Reconnection Resilience', () => {
  let client: IRCClient;
  const reconnectEvents: ReconnectEvent[] = [];
  let reconnectFailed = false;
  let isConnected = false;

  beforeAll(async () => {
    await waitForIRCServer(IRC_HOST, IRC_PORT);
  });

  beforeEach(() => {
    reconnectEvents.length = 0;
    reconnectFailed = false;
    isConnected = false;
  });

  afterEach(async () => {
    if (client) {
      client.removeAllListeners();
      client.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });

  it('should auto-reconnect after IRC server restart', async () => {
    const config: IRCConfig = {
      host: IRC_HOST,
      port: IRC_PORT,
      nick: TEST_NICK,
      username: TEST_NICK,
      realname: TEST_NICK,
      password: TEST_PASSWORD,
    };

    client = new IRCClient(config, {
      maxRetries: 5,
      initialDelay: 500,
      maxDelay: 2000,
    });

    client.on('registered', () => {
      isConnected = true;
    });

    client.on('reconnecting', (event: ReconnectEvent) => {
      reconnectEvents.push(event);
    });

    client.on('reconnect_failed', () => {
      reconnectFailed = true;
    });

    client.on('close', () => {
      isConnected = false;
    });

    client.connect();
    await waitForConnection(client, 5000);
    expect(isConnected).toBe(true);

    console.log('Restarting IRC server...');
    restartIRCContainer();
    await new Promise(resolve => setTimeout(resolve, 2000));

    await waitForConnection(client, 10000);
    expect(isConnected).toBe(true);
    expect(reconnectEvents.length).toBeGreaterThan(0);
    expect(reconnectFailed).toBe(false);

    const firstEvent = reconnectEvents[0];
    expect(firstEvent).toHaveProperty('attempt');
    expect(firstEvent).toHaveProperty('delay');
    expect(firstEvent.attempt).toBeGreaterThan(0);
  }, 30000);

  it('should emit reconnecting events with exponential backoff', async () => {
    const config: IRCConfig = {
      host: IRC_HOST,
      port: IRC_PORT,
      nick: `${TEST_NICK}_exp`,
      username: TEST_NICK,
      realname: TEST_NICK,
      password: TEST_PASSWORD,
    };

    client = new IRCClient(config, {
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 1000,
    });

    client.on('registered', () => {
      isConnected = true;
    });

    client.on('reconnecting', (event: ReconnectEvent) => {
      reconnectEvents.push(event);
    });

    client.on('close', () => {
      isConnected = false;
    });

    client.connect();
    await waitForConnection(client, 5000);
    expect(isConnected).toBe(true);

    restartIRCContainer();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await waitForConnection(client, 8000);

    if (reconnectEvents.length > 1) {
      for (let i = 1; i < reconnectEvents.length; i++) {
        expect(reconnectEvents[i].delay).toBeGreaterThanOrEqual(reconnectEvents[i - 1].delay);
      }
    }
  }, 20000);

  it('should emit reconnect_failed after max retries', async () => {
    const config: IRCConfig = {
      host: IRC_HOST,
      port: 9999,
      nick: `${TEST_NICK}_fail`,
      username: TEST_NICK,
      realname: TEST_NICK,
      password: TEST_PASSWORD,
    };

    client = new IRCClient(config, {
      maxRetries: 2,
      initialDelay: 100,
      maxDelay: 200,
    });

    client.on('reconnecting', (event: ReconnectEvent) => {
      reconnectEvents.push(event);
    });

    client.on('reconnect_failed', () => {
      reconnectFailed = true;
    });

    client.connect();

    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(reconnectFailed).toBe(true);
    expect(reconnectEvents.length).toBeGreaterThanOrEqual(2);
  }, 5000);

  it('should maintain state after reconnection', async () => {
    const config: IRCConfig = {
      host: IRC_HOST,
      port: IRC_PORT,
      nick: `${TEST_NICK}_state`,
      username: TEST_NICK,
      realname: TEST_NICK,
      password: TEST_PASSWORD,
    };

    client = new IRCClient(config, {
      maxRetries: 5,
      initialDelay: 500,
      maxDelay: 2000,
    });

    const messages: string[] = [];

    client.on('registered', () => {
      isConnected = true;
    });

    client.on('message', (data) => {
      messages.push(data.message);
    });

    client.on('reconnecting', (event: ReconnectEvent) => {
      reconnectEvents.push(event);
    });

    client.on('close', () => {
      isConnected = false;
    });

    client.connect();
    await waitForConnection(client, 5000);
    expect(isConnected).toBe(true);

    const testChannel = `#test_${Date.now()}`;
    client.join(testChannel);
    await new Promise(resolve => setTimeout(resolve, 1000));

    restartIRCContainer();
    await new Promise(resolve => setTimeout(resolve, 2000));

    await waitForConnection(client, 10000);
    expect(isConnected).toBe(true);

    client.join(testChannel);
    await new Promise(resolve => setTimeout(resolve, 500));

    client.privmsg(testChannel, 'Test message after reconnect');
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(client.ready()).toBe(true);
  }, 30000);
});

function waitForConnection(client: IRCClient, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, timeout);

    const onRegistered = () => {
      clearTimeout(timer);
      client.off('registered', onRegistered);
      client.off('reconnect_failed', onFailed);
      resolve();
    };

    const onFailed = () => {
      clearTimeout(timer);
      client.off('registered', onRegistered);
      client.off('reconnect_failed', onFailed);
      reject(new Error('Reconnection failed'));
    };

    client.on('registered', onRegistered);
    client.on('reconnect_failed', onFailed);
  });
}

async function waitForIRCServer(host: string, port: number, timeout = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const testClient = new IRCClient(
        { host, port, nick: 'healthcheck', username: 'hc', realname: 'hc' },
        { maxRetries: 0 }
      );
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 2000);
        testClient.on('registered', () => {
          clearTimeout(timer);
          testClient.disconnect();
          resolve();
        });
        testClient.on('error', () => {
          clearTimeout(timer);
          reject(new Error('error'));
        });
        testClient.connect();
      });
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error('IRC server not available');
}

function restartIRCContainer(): void {
  try {
    execSync('podman restart ironcord-test-irc', { stdio: 'pipe' });
  } catch (error) {
    console.error('Failed to restart IRC container:', error);
    throw error;
  }
}
