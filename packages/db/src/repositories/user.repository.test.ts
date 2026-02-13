import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseService } from '../database.service.js';
import { UserRepository } from './user.repository.js';

describe('UserRepository', () => {
  let db: DatabaseService;
  let repo: UserRepository;

  beforeAll(async () => {
    db = new DatabaseService({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'ironcord_test',
      user: process.env.DB_USER || 'ironcord',
      password: process.env.DB_PASSWORD || 'ironcord_password',
    });
    await db.initializeSchema();
    repo = new UserRepository(db);
  });

  beforeEach(async () => {
    await db.query('DELETE FROM users');
  });

  afterAll(async () => {
    await db.close();
  });

  describe('create', () => {
    it('should create a user successfully', async () => {
      const user = await repo.create({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        irc_nick: 'testnick',
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.irc_nick).toBe('testnick');
      expect(user.id).toBeDefined();
    });

    it('should create a user with avatar', async () => {
      const user = await repo.create({
        email: 'avatar@example.com',
        password_hash: 'hashed_password',
        irc_nick: 'avatarnick',
        avatar_url: 'https://example.com/avatar.png',
      });

      expect(user.avatar_url).toBe('https://example.com/avatar.png');
    });

    it('should fail with duplicate email', async () => {
      await repo.create({
        email: 'duplicate@example.com',
        password_hash: 'hash1',
        irc_nick: 'nick1',
      });

      await expect(
        repo.create({
          email: 'duplicate@example.com',
          password_hash: 'hash2',
          irc_nick: 'nick2',
        })
      ).rejects.toThrow();
    });

    it('should fail with duplicate irc_nick', async () => {
      await repo.create({
        email: 'user1@example.com',
        password_hash: 'hash1',
        irc_nick: 'samenick',
      });

      await expect(
        repo.create({
          email: 'user2@example.com',
          password_hash: 'hash2',
          irc_nick: 'samenick',
        })
      ).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const created = await repo.create({
        email: 'find@example.com',
        password_hash: 'hash',
        irc_nick: 'findnick',
      });

      const found = await repo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.email).toBe('find@example.com');
    });

    it('should return null for non-existent id', async () => {
      const found = await repo.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      await repo.create({
        email: 'findemail@example.com',
        password_hash: 'hash',
        irc_nick: 'emailnick',
      });

      const found = await repo.findByEmail('findemail@example.com');
      expect(found).toBeDefined();
      expect(found?.irc_nick).toBe('emailnick');
    });

    it('should return null for non-existent email', async () => {
      const found = await repo.findByEmail('nonexistent@example.com');
      expect(found).toBeNull();
    });
  });

  describe('findByIrcNick', () => {
    it('should find user by irc_nick', async () => {
      await repo.create({
        email: 'nicksearch@example.com',
        password_hash: 'hash',
        irc_nick: 'searchnick',
      });

      const found = await repo.findByIrcNick('searchnick');
      expect(found).toBeDefined();
      expect(found?.email).toBe('nicksearch@example.com');
    });

    it('should return null for non-existent nick', async () => {
      const found = await repo.findByIrcNick('nonexistentnick');
      expect(found).toBeNull();
    });
  });

  describe('findPasswordHash', () => {
    it('should return password hash for valid email', async () => {
      await repo.create({
        email: 'password@example.com',
        password_hash: 'secret_hash',
        irc_nick: 'passnick',
      });

      const hash = await repo.findPasswordHash('password@example.com');
      expect(hash).toBe('secret_hash');
    });

    it('should return null for non-existent email', async () => {
      const hash = await repo.findPasswordHash('nohash@example.com');
      expect(hash).toBeNull();
    });
  });

  describe('updateAvatar', () => {
    it('should update avatar successfully', async () => {
      const user = await repo.create({
        email: 'avatar@example.com',
        password_hash: 'hash',
        irc_nick: 'avnick',
      });

      const updated = await repo.updateAvatar(user.id, 'https://new-avatar.com/img.png');
      expect(updated?.avatar_url).toBe('https://new-avatar.com/img.png');
    });

    it('should return null for non-existent user', async () => {
      const updated = await repo.updateAvatar('00000000-0000-0000-0000-000000000000', 'url');
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      const user = await repo.create({
        email: 'delete@example.com',
        password_hash: 'hash',
        irc_nick: 'delnick',
      });

      const deleted = await repo.delete(user.id);
      expect(deleted).toBe(true);

      const found = await repo.findById(user.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent user', async () => {
      const deleted = await repo.delete('00000000-0000-0000-0000-000000000000');
      expect(deleted).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for existing email', async () => {
      await repo.create({
        email: 'exists@example.com',
        password_hash: 'hash',
        irc_nick: 'existsnick',
      });

      const exists = await repo.exists('exists@example.com');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent email', async () => {
      const exists = await repo.exists('notexists@example.com');
      expect(exists).toBe(false);
    });
  });
});
