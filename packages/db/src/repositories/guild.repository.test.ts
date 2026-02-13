import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseService } from '../database.service.js';
import { GuildRepository } from './guild.repository.js';
import { UserRepository } from './user.repository.js';
import { MemberRepository } from './member.repository.js';

describe('GuildRepository', () => {
  let db: DatabaseService;
  let repo: GuildRepository;
  let userRepo: UserRepository;
  let memberRepo: MemberRepository;
  let testUserId: string;

  beforeAll(async () => {
    db = new DatabaseService({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'ironcord_test',
      user: process.env.DB_USER || 'ironcord',
      password: process.env.DB_PASSWORD || 'ironcord_password',
    });
    await db.initializeSchema();
    repo = new GuildRepository(db);
    userRepo = new UserRepository(db);
    memberRepo = new MemberRepository(db);
  });

  beforeEach(async () => {
    await db.query('DELETE FROM guilds');
    await db.query('DELETE FROM users');

    const user = await userRepo.create({
      email: `test-${Date.now()}@example.com`,
      password_hash: 'hash',
      irc_nick: `testnick${Date.now()}`,
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await db.close();
  });

  describe('create', () => {
    it('should create a guild successfully', async () => {
      const guild = await repo.create({
        name: 'Test Guild',
        owner_id: testUserId,
        irc_namespace_prefix: '&test-',
      });

      expect(guild).toBeDefined();
      expect(guild.name).toBe('Test Guild');
      expect(guild.owner_id).toBe(testUserId);
      expect(guild.irc_namespace_prefix).toBe('&test-');
    });

    it('should fail with duplicate namespace prefix', async () => {
      await repo.create({
        name: 'Guild 1',
        owner_id: testUserId,
        irc_namespace_prefix: '&duplicate-',
      });

      await expect(
        repo.create({
          name: 'Guild 2',
          owner_id: testUserId,
          irc_namespace_prefix: '&duplicate-',
        })
      ).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find guild by id', async () => {
      const created = await repo.create({
        name: 'Find Guild',
        owner_id: testUserId,
        irc_namespace_prefix: '&find-',
      });

      const found = await repo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Find Guild');
    });

    it('should return null for non-existent id', async () => {
      const found = await repo.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('findByOwnerId', () => {
    it('should find all guilds owned by user', async () => {
      await repo.create({
        name: 'Guild 1',
        owner_id: testUserId,
        irc_namespace_prefix: '&g1-',
      });
      await repo.create({
        name: 'Guild 2',
        owner_id: testUserId,
        irc_namespace_prefix: '&g2-',
      });

      const guilds = await repo.findByOwnerId(testUserId);
      expect(guilds).toHaveLength(2);
      expect(guilds.map(g => g.name)).toContain('Guild 1');
      expect(guilds.map(g => g.name)).toContain('Guild 2');
    });

    it('should return empty array for user with no guilds', async () => {
      const guilds = await repo.findByOwnerId('00000000-0000-0000-0000-000000000000');
      expect(guilds).toHaveLength(0);
    });
  });

  describe('findByUserId', () => {
    it('should find guilds where user is a member', async () => {
      const guild = await repo.create({
        name: 'Member Guild',
        owner_id: testUserId,
        irc_namespace_prefix: '&member-',
      });

      await memberRepo.add({
        guild_id: guild.id,
        user_id: testUserId,
      });

      const guilds = await repo.findByUserId(testUserId);
      expect(guilds).toHaveLength(1);
      expect(guilds[0].name).toBe('Member Guild');
    });

    it('should return empty array for non-member', async () => {
      const guilds = await repo.findByUserId('00000000-0000-0000-0000-000000000000');
      expect(guilds).toHaveLength(0);
    });
  });

  describe('findByNamespacePrefix', () => {
    it('should find guild by namespace prefix', async () => {
      await repo.create({
        name: 'Namespace Guild',
        owner_id: testUserId,
        irc_namespace_prefix: '&namespace-',
      });

      const found = await repo.findByNamespacePrefix('&namespace-');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Namespace Guild');
    });

    it('should return null for non-existent prefix', async () => {
      const found = await repo.findByNamespacePrefix('&nonexistent-');
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update guild name', async () => {
      const guild = await repo.create({
        name: 'Old Name',
        owner_id: testUserId,
        irc_namespace_prefix: '&update-',
      });

      const updated = await repo.update(guild.id, 'New Name');
      expect(updated?.name).toBe('New Name');
    });

    it('should return null for non-existent guild', async () => {
      const updated = await repo.update('00000000-0000-0000-0000-000000000000', 'Name');
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete guild successfully', async () => {
      const guild = await repo.create({
        name: 'Delete Guild',
        owner_id: testUserId,
        irc_namespace_prefix: '&delete-',
      });

      const deleted = await repo.delete(guild.id);
      expect(deleted).toBe(true);

      const found = await repo.findById(guild.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent guild', async () => {
      const deleted = await repo.delete('00000000-0000-0000-0000-000000000000');
      expect(deleted).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for existing guild', async () => {
      const guild = await repo.create({
        name: 'Exists Guild',
        owner_id: testUserId,
        irc_namespace_prefix: '&exists-',
      });

      const exists = await repo.exists(guild.id);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent guild', async () => {
      const exists = await repo.exists('00000000-0000-0000-0000-000000000000');
      expect(exists).toBe(false);
    });
  });
});
