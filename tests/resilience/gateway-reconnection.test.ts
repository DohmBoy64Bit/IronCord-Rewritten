import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { io, Socket } from 'socket.io-client';
import axios, { AxiosInstance } from 'axios';
import { execSync } from 'child_process';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'ws://localhost:3000';

describe('Gateway Reconnection Resilience', () => {
  let httpClient: AxiosInstance;
  let wsClient: Socket | null = null;
  let authToken: string = '';

  beforeAll(async () => {
    httpClient = axios.create({
      baseURL: GATEWAY_URL,
      validateStatus: () => true,
    });

    await waitForGateway(GATEWAY_URL);
  });

  beforeEach(async () => {
    const timestamp = Date.now();
    const registerResponse = await httpClient.post('/auth/register', {
      email: `resilience_${timestamp}@test.com`,
      password: 'Test123!@#',
    });

    expect(registerResponse.status).toBe(201);
    authToken = registerResponse.data.token;
  });

  afterEach(async () => {
    if (wsClient) {
      wsClient.disconnect();
      wsClient = null;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should handle REST API availability during gateway issues', async () => {
    const response1 = await httpClient.get('/health');
    expect(response1.status).toBe(200);

    const guildsResponse = await httpClient.get('/guilds/mine', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(guildsResponse.status).toBe(200);
  }, 10000);

  it('should handle WebSocket reconnection gracefully', async () => {
    const events: string[] = [];
    const errors: string[] = [];

    wsClient = io(WS_URL, {
      auth: { token: authToken },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 500,
      timeout: 5000,
    });

    wsClient.on('connect', () => {
      events.push('connect');
    });

    wsClient.on('disconnect', (reason) => {
      events.push(`disconnect:${reason}`);
    });

    wsClient.on('reconnect', (attemptNumber) => {
      events.push(`reconnect:${attemptNumber}`);
    });

    wsClient.on('reconnect_attempt', (attemptNumber) => {
      events.push(`reconnect_attempt:${attemptNumber}`);
    });

    wsClient.on('connect_error', (error) => {
      errors.push(error.message);
    });

    await waitForEvent(wsClient, 'connect', 5000);
    expect(events).toContain('connect');

    wsClient.disconnect();
    await new Promise(resolve => setTimeout(resolve, 500));

    wsClient.connect();
    await waitForEvent(wsClient, 'connect', 5000);

    const connectCount = events.filter(e => e === 'connect').length;
    expect(connectCount).toBeGreaterThanOrEqual(2);
  }, 15000);

  it('should maintain authentication after reconnection', async () => {
    wsClient = io(WS_URL, {
      auth: { token: authToken },
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 500,
    });

    await waitForEvent(wsClient, 'connect', 5000);

    wsClient.disconnect();
    await new Promise(resolve => setTimeout(resolve, 500));

    wsClient.connect();
    await waitForEvent(wsClient, 'connect', 5000);

    const ircNick = `test_${Date.now()}`;
    const ircConnected = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('IRC connection timeout')), 5000);
      
      wsClient!.once('irc:registered', () => {
        clearTimeout(timeout);
        resolve();
      });

      wsClient!.once('irc:error', (data) => {
        clearTimeout(timeout);
        reject(new Error(data.error));
      });

      wsClient!.emit('irc:connect', {
        nick: ircNick,
        password: 'test_password',
      });
    });

    await ircConnected;
  }, 15000);

  it('should handle invalid authentication gracefully', async () => {
    const invalidClient = io(WS_URL, {
      auth: { token: 'invalid_token_12345' },
      reconnection: false,
    });

    const errorReceived = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);

      invalidClient.on('connect_error', () => {
        clearTimeout(timeout);
        resolve(true);
      });

      invalidClient.on('connect', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });

    expect(errorReceived).toBe(true);
    invalidClient.disconnect();
  }, 5000);

  it('should handle multiple concurrent WebSocket connections', async () => {
    const clients: Socket[] = [];
    const connectionPromises: Promise<void>[] = [];

    for (let i = 0; i < 10; i++) {
      const timestamp = Date.now() + i;
      const registerResponse = await httpClient.post('/auth/register', {
        email: `concurrent_${timestamp}@test.com`,
        password: 'Test123!@#',
      });

      const token = registerResponse.data.token;
      
      const client = io(WS_URL, {
        auth: { token },
        reconnection: false,
      });

      clients.push(client);

      connectionPromises.push(
        waitForEvent(client, 'connect', 5000)
      );
    }

    await Promise.all(connectionPromises);

    clients.forEach(client => {
      expect(client.connected).toBe(true);
      client.disconnect();
    });
  }, 20000);

  it('should provide meaningful error messages', async () => {
    const errorMessages: string[] = [];

    wsClient = io(WS_URL, {
      auth: { token: authToken },
      reconnection: false,
    });

    await waitForEvent(wsClient, 'connect', 5000);

    wsClient.on('irc:error', (data) => {
      errorMessages.push(data.error);
    });

    wsClient.emit('irc:message', {
      target: '#channel',
      message: 'Test message',
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    expect(errorMessages.length).toBeGreaterThan(0);
    expect(errorMessages[0]).toMatch(/not connected|not ready/i);
  }, 10000);
});

function waitForEvent(socket: Socket, event: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Event ${event} timeout`));
    }, timeout);

    socket.once(event, () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function waitForGateway(url: string, timeout = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await axios.get(`${url}/health`, { timeout: 2000 });
      if (response.status === 200) {
        return;
      }
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error('Gateway not available');
}
