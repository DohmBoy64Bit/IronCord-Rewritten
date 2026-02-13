import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { io, Socket } from 'socket.io-client';
import axios, { AxiosInstance } from 'axios';
import { DatabaseService, UserRepository, GuildRepository } from '@ironcord/db';
import { execSync } from 'child_process';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'ws://localhost:3000';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'ironcord_test',
  user: process.env.DB_USER || 'ironcord_test',
  password: process.env.DB_PASSWORD || 'ironcord_test_password',
};

describe('System-Wide Resilience', () => {
  let httpClient: AxiosInstance;
  let dbService: DatabaseService;
  let userRepo: UserRepository;
  let guildRepo: GuildRepository;
  let wsClient: Socket | null = null;

  beforeAll(async () => {
    httpClient = axios.create({
      baseURL: GATEWAY_URL,
      validateStatus: () => true,
    });

    await waitForServices();
  });

  beforeEach(async () => {
    dbService = new DatabaseService(DB_CONFIG);
    await dbService.initializeSchema();
    userRepo = new UserRepository(dbService);
    guildRepo = new GuildRepository(dbService);
  });

  afterEach(async () => {
    if (wsClient) {
      wsClient.disconnect();
      wsClient = null;
    }
    if (dbService) {
      await dbService.close();
    }
  });

  it('should recover from complete system restart', async () => {
    const timestamp = Date.now();
    const email = `system_${timestamp}@test.com`;
    const password = 'Test123!@#';

    const registerResponse = await httpClient.post('/auth/register', {
      email,
      password,
    });
    expect(registerResponse.status).toBe(201);

    const userId = registerResponse.data.user.id;
    const authToken = registerResponse.data.token;

    const guildResponse = await httpClient.post(
      '/guilds',
      { name: `TestGuild_${timestamp}` },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    expect(guildResponse.status).toBe(201);
    const guildId = guildResponse.data.id;

    console.log('Restarting all services...');
    restartAllServices();
    await new Promise(resolve => setTimeout(resolve, 8000));

    await waitForServices();

    const loginResponse = await httpClient.post('/auth/login', {
      email,
      password,
    });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.data.user.id).toBe(userId);

    const newToken = loginResponse.data.token;

    const guildsResponse = await httpClient.get('/guilds/mine', {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    expect(guildsResponse.status).toBe(200);
    
    const foundGuild = guildsResponse.data.find((g: any) => g.id === guildId);
    expect(foundGuild).toBeDefined();
    expect(foundGuild.name).toBe(`TestGuild_${timestamp}`);
  }, 45000);

  it('should handle cascading failures gracefully', async () => {
    const timestamp = Date.now();
    const registerResponse = await httpClient.post('/auth/register', {
      email: `cascade_${timestamp}@test.com`,
      password: 'Test123!@#',
    });
    expect(registerResponse.status).toBe(201);

    const authToken = registerResponse.data.token;

    console.log('Restarting IRC server...');
    restartIRCContainer();
    await new Promise(resolve => setTimeout(resolve, 3000));

    const healthResponse = await httpClient.get('/health');
    expect(healthResponse.status).toBe(200);

    const guildsResponse = await httpClient.get('/guilds/mine', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(guildsResponse.status).toBe(200);

    await waitForIRCServer();

    wsClient = io(WS_URL, {
      auth: { token: authToken },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    await waitForEvent(wsClient, 'connect', 5000);
    expect(wsClient.connected).toBe(true);
  }, 30000);

  it('should preserve data integrity during failures', async () => {
    const users = await Promise.all([
      createTestUser(httpClient, 'user1'),
      createTestUser(httpClient, 'user2'),
      createTestUser(httpClient, 'user3'),
    ]);

    const guilds = await Promise.all([
      createTestGuild(httpClient, users[0].token, 'Guild1'),
      createTestGuild(httpClient, users[1].token, 'Guild2'),
      createTestGuild(httpClient, users[2].token, 'Guild3'),
    ]);

    console.log('Restarting database...');
    restartDatabaseContainer();
    await new Promise(resolve => setTimeout(resolve, 5000));

    await waitForDatabase();

    dbService = new DatabaseService(DB_CONFIG);
    userRepo = new UserRepository(dbService);
    guildRepo = new GuildRepository(dbService);

    for (const user of users) {
      const dbUser = await userRepo.getUserById(user.userId);
      expect(dbUser).toBeDefined();
      expect(dbUser?.id).toBe(user.userId);
    }

    for (const guild of guilds) {
      const dbGuild = await guildRepo.getGuildById(guild.guildId);
      expect(dbGuild).toBeDefined();
      expect(dbGuild?.id).toBe(guild.guildId);
    }
  }, 40000);

  it('should handle network partitions gracefully', async () => {
    const timestamp = Date.now();
    const registerResponse = await httpClient.post('/auth/register', {
      email: `partition_${timestamp}@test.com`,
      password: 'Test123!@#',
    });
    expect(registerResponse.status).toBe(201);

    const authToken = registerResponse.data.token;

    console.log('Pausing database container...');
    pauseDatabaseContainer();
    await new Promise(resolve => setTimeout(resolve, 2000));

    const failedResponse = await httpClient.get('/guilds/mine', {
      headers: { Authorization: `Bearer ${authToken}` },
      timeout: 5000,
    });
    expect([500, 503]).toContain(failedResponse.status);

    console.log('Unpausing database container...');
    unpauseDatabaseContainer();
    await new Promise(resolve => setTimeout(resolve, 2000));

    await waitForDatabase();

    const successResponse = await httpClient.get('/guilds/mine', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(successResponse.status).toBe(200);
  }, 25000);

  it('should provide clear error messages during failures', async () => {
    const timestamp = Date.now();
    const registerResponse = await httpClient.post('/auth/register', {
      email: `errors_${timestamp}@test.com`,
      password: 'Test123!@#',
    });
    const authToken = registerResponse.data.token;

    wsClient = io(WS_URL, {
      auth: { token: authToken },
      reconnection: false,
    });

    await waitForEvent(wsClient, 'connect', 5000);

    const errors: string[] = [];
    wsClient.on('irc:error', (data) => {
      errors.push(data.error);
    });

    wsClient.emit('irc:message', {
      target: '#nonexistent',
      message: 'Test',
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('not connected') || e.includes('not ready'))).toBe(true);
  }, 10000);
});

async function createTestUser(client: AxiosInstance, prefix: string) {
  const timestamp = Date.now();
  const response = await client.post('/auth/register', {
    email: `${prefix}_${timestamp}@test.com`,
    password: 'Test123!@#',
  });
  return {
    userId: response.data.user.id,
    token: response.data.token,
  };
}

async function createTestGuild(client: AxiosInstance, token: string, name: string) {
  const timestamp = Date.now();
  const response = await client.post(
    '/guilds',
    { name: `${name}_${timestamp}` },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return {
    guildId: response.data.id,
  };
}

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

async function waitForServices(timeout = 20000): Promise<void> {
  await Promise.all([
    waitForGateway(timeout),
    waitForDatabase(timeout),
    waitForIRCServer(timeout),
  ]);
}

async function waitForGateway(timeout = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await axios.get(`${GATEWAY_URL}/health`, { timeout: 2000 });
      if (response.status === 200) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error('Gateway not available');
}

async function waitForDatabase(timeout = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const testDb = new DatabaseService(DB_CONFIG);
      await testDb.query('SELECT 1');
      await testDb.close();
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error('Database not available');
}

async function waitForIRCServer(timeout = 15000): Promise<void> {
  const start = Date.now();
  const IRC_HOST = process.env.IRC_HOST || 'localhost';
  const IRC_PORT = parseInt(process.env.IRC_PORT || '6668', 10);

  while (Date.now() - start < timeout) {
    try {
      const { IRCClient } = await import('@ironcord/engine');
      const testClient = new IRCClient(
        { host: IRC_HOST, port: IRC_PORT, nick: 'healthcheck', username: 'hc', realname: 'hc' },
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

function restartAllServices(): void {
  try {
    execSync('podman restart ironcord-test-db ironcord-test-irc', { stdio: 'pipe' });
  } catch (error) {
    console.error('Failed to restart services:', error);
    throw error;
  }
}

function restartDatabaseContainer(): void {
  try {
    execSync('podman restart ironcord-test-db', { stdio: 'pipe' });
  } catch (error) {
    console.error('Failed to restart database container:', error);
    throw error;
  }
}

function restartIRCContainer(): void {
  try {
    execSync('podman restart ironcord-test-irc', { stdio: 'pipe' });
  } catch (error) {
    console.error('Failed to restart IRC container:', error);
    throw error;
  }
}

function pauseDatabaseContainer(): void {
  try {
    execSync('podman pause ironcord-test-db', { stdio: 'pipe' });
  } catch (error) {
    console.error('Failed to pause database container:', error);
    throw error;
  }
}

function unpauseDatabaseContainer(): void {
  try {
    execSync('podman unpause ironcord-test-db', { stdio: 'pipe' });
  } catch (error) {
    console.error('Failed to unpause database container:', error);
    throw error;
  }
}
