import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '@ironcord/db';
import { UserRepository } from '@ironcord/db';
import { execSync } from 'child_process';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  database: process.env.DB_NAME || 'ironcord_test',
  user: process.env.DB_USER || 'ironcord_test',
  password: process.env.DB_PASSWORD || 'ironcord_test_password',
};

describe('Database Reconnection Resilience', () => {
  let dbService: DatabaseService;
  let userRepo: UserRepository;

  beforeAll(async () => {
    await waitForDatabase(DB_CONFIG);
  });

  beforeEach(async () => {
    dbService = new DatabaseService(DB_CONFIG);
    await dbService.initializeSchema();
    userRepo = new UserRepository(dbService);
  });

  afterEach(async () => {
    if (dbService) {
      try {
        await dbService.close();
      } catch (error) {
        console.error('Error closing database:', error);
      }
    }
  });

  it('should handle database restart gracefully', async () => {
    const testUser = {
      email: `test_${Date.now()}@example.com`,
      password_hash: 'hashed_password',
      irc_nick: `test_${Date.now()}`,
    };

    const user = await userRepo.createUser(
      testUser.email,
      testUser.password_hash,
      testUser.irc_nick
    );
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();

    const userId = user.id;

    console.log('Restarting database container...');
    restartDatabaseContainer();
    await new Promise(resolve => setTimeout(resolve, 3000));

    await waitForDatabase(DB_CONFIG);

    dbService = new DatabaseService(DB_CONFIG);
    userRepo = new UserRepository(dbService);

    const retrievedUser = await userRepo.getUserById(userId);
    expect(retrievedUser).toBeDefined();
    expect(retrievedUser?.id).toBe(userId);
    expect(retrievedUser?.email).toBe(testUser.email);
    expect(retrievedUser?.irc_nick).toBe(testUser.irc_nick);
  }, 20000);

  it('should maintain data integrity across restart', async () => {
    const users = await Promise.all([
      userRepo.createUser(`user1_${Date.now()}@test.com`, 'hash1', `nick1_${Date.now()}`),
      userRepo.createUser(`user2_${Date.now()}@test.com`, 'hash2', `nick2_${Date.now()}`),
      userRepo.createUser(`user3_${Date.now()}@test.com`, 'hash3', `nick3_${Date.now()}`),
    ]);

    const userIds = users.map(u => u.id);

    console.log('Restarting database container...');
    restartDatabaseContainer();
    await new Promise(resolve => setTimeout(resolve, 3000));

    await waitForDatabase(DB_CONFIG);

    dbService = new DatabaseService(DB_CONFIG);
    userRepo = new UserRepository(dbService);

    for (const userId of userIds) {
      const user = await userRepo.getUserById(userId);
      expect(user).toBeDefined();
      expect(user?.id).toBe(userId);
    }

    const allUsers = await dbService.query('SELECT COUNT(*) as count FROM users WHERE id = ANY($1)', [userIds]);
    expect(parseInt(allUsers.rows[0].count)).toBe(userIds.length);
  }, 30000);

  it('should handle connection pool exhaustion', async () => {
    const operations = [];
    for (let i = 0; i < 50; i++) {
      operations.push(
        userRepo.createUser(
          `concurrent_${i}_${Date.now()}@test.com`,
          `hash_${i}`,
          `nick_${i}_${Date.now()}`
        )
      );
    }

    const results = await Promise.all(operations);
    expect(results.length).toBe(50);
    results.forEach(user => {
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
    });
  }, 15000);

  it('should handle database connection errors gracefully', async () => {
    const invalidDbService = new DatabaseService({
      host: DB_CONFIG.host,
      port: 9999,
      database: DB_CONFIG.database,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
    });

    const invalidUserRepo = new UserRepository(invalidDbService);

    await expect(
      invalidUserRepo.createUser('test@test.com', 'hash', 'nick')
    ).rejects.toThrow();

    await invalidDbService.close();
  }, 10000);

  it('should maintain transaction integrity across failures', async () => {
    const email = `transaction_${Date.now()}@test.com`;
    const nick = `trans_${Date.now()}`;

    try {
      await dbService.transaction(async (client) => {
        await client.query(
          'INSERT INTO users (email, password_hash, irc_nick) VALUES ($1, $2, $3)',
          [email, 'hash', nick]
        );

        throw new Error('Simulated failure');
      });
    } catch (error) {
      expect((error as Error).message).toBe('Simulated failure');
    }

    const result = await dbService.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    expect(result.rows.length).toBe(0);
  }, 10000);

  it('should recover from temporary connection loss', async () => {
    const user = await userRepo.createUser(
      `recovery_${Date.now()}@test.com`,
      'hash',
      `recovery_${Date.now()}`
    );
    expect(user).toBeDefined();

    console.log('Pausing database container...');
    pauseDatabaseContainer();
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Unpausing database container...');
    unpauseDatabaseContainer();
    await new Promise(resolve => setTimeout(resolve, 2000));

    const retrievedUser = await userRepo.getUserById(user.id);
    expect(retrievedUser).toBeDefined();
    expect(retrievedUser?.id).toBe(user.id);
  }, 20000);
});

async function waitForDatabase(config: typeof DB_CONFIG, timeout = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const testDb = new DatabaseService(config);
      await testDb.query('SELECT 1');
      await testDb.close();
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error('Database not available');
}

function restartDatabaseContainer(): void {
  try {
    execSync('podman restart ironcord-test-db', { stdio: 'pipe' });
  } catch (error) {
    console.error('Failed to restart database container:', error);
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
