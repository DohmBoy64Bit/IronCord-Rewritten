import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseService } from './database.service.js';

describe('DatabaseService', () => {
  let db: DatabaseService;

  beforeAll(async () => {
    db = new DatabaseService({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'ironcord_test',
      user: process.env.DB_USER || 'ironcord',
      password: process.env.DB_PASSWORD || 'ironcord_password',
    });
  });

  afterAll(async () => {
    await db.close();
  });

  describe('schema initialization', () => {
    it('should initialize schema successfully', async () => {
      await expect(db.initializeSchema()).resolves.not.toThrow();
    });

    it('should create users table', async () => {
      const result = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        )`
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it('should create guilds table', async () => {
      const result = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'guilds'
        )`
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it('should create channels table', async () => {
      const result = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'channels'
        )`
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it('should create guild_members table', async () => {
      const result = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'guild_members'
        )`
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it('should create index on users.irc_nick', async () => {
      const result = await db.query(
        `SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE indexname = 'idx_users_irc_nick'
        )`
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it('should create index on channels.irc_channel_name', async () => {
      const result = await db.query(
        `SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE indexname = 'idx_channels_irc_channel_name'
        )`
      );
      expect(result.rows[0].exists).toBe(true);
    });
  });

  describe('query method', () => {
    it('should execute SELECT queries', async () => {
      const result = await db.query('SELECT 1 as value');
      expect(result.rows[0].value).toBe(1);
    });

    it('should support parameterized queries', async () => {
      const result = await db.query('SELECT $1::int as value', [42]);
      expect(result.rows[0].value).toBe(42);
    });
  });

  describe('transaction method', () => {
    it('should commit successful transactions', async () => {
      const result = await db.transaction(async (client) => {
        await client.query('CREATE TEMP TABLE test_commit (id INT)');
        await client.query('INSERT INTO test_commit VALUES (1)');
        return 'success';
      });
      expect(result).toBe('success');
    });

    it('should rollback failed transactions', async () => {
      const email = `rollback-test-${Date.now()}@test.com`;
      
      await expect(
        db.transaction(async (client) => {
          await client.query(
            'INSERT INTO users (email, password_hash, irc_nick) VALUES ($1, $2, $3)',
            [email, 'hash', `nick${Date.now()}`]
          );
          throw new Error('Force rollback');
        })
      ).rejects.toThrow('Force rollback');

      const check = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      expect(check.rows.length).toBe(0);
    });
  });
});
