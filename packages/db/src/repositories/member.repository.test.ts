import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseService } from '../database.service.js';
import { MemberRepository } from './member.repository.js';
import { GuildRepository } from './guild.repository.js';
import { UserRepository } from './user.repository.js';

describe('MemberRepository', () => {
  let db: DatabaseService;
  let repo: MemberRepository;
  let guildRepo: GuildRepository;
  let userRepo: UserRepository;
  let testUserId: string;
  let testGuildId: string;

  beforeAll(async () => {
    db = new DatabaseService({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'ironcord_test',
      user: process.env.DB_USER || 'ironcord',
      password: process.env.DB_PASSWORD || 'ironcord_password',
    });
    await db.initializeSchema();
    repo = new MemberRepository(db);
    guildRepo = new GuildRepository(db);
    userRepo = new UserRepository(db);
  });

  beforeEach(async () => {
    await db.query('DELETE FROM guild_members');
    await db.query('DELETE FROM guilds');
    await db.query('DELETE FROM users');

    const user = await userRepo.create({
      email: `test-${Date.now()}@example.com`,
      password_hash: 'hash',
      irc_nick: `testnick${Date.now()}`,
    });
    testUserId = user.id;

    const guild = await guildRepo.create({
      name: 'Test Guild',
      owner_id: user.id,
      irc_namespace_prefix: `&test${Date.now()}-`,
    });
    testGuildId = guild.id;
  });

  afterAll(async () => {
    await db.close();
  });

  describe('add', () => {
    it('should add member to guild successfully', async () => {
      await repo.add({
        guild_id: testGuildId,
        user_id: testUserId,
      });

      const isMember = await repo.isMember(testGuildId, testUserId);
      expect(isMember).toBe(true);
    });

    it('should handle duplicate add gracefully', async () => {
      await repo.add({
        guild_id: testGuildId,
        user_id: testUserId,
      });

      await expect(
        repo.add({
          guild_id: testGuildId,
          user_id: testUserId,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('remove', () => {
    it('should remove member from guild', async () => {
      await repo.add({
        guild_id: testGuildId,
        user_id: testUserId,
      });

      const removed = await repo.remove(testGuildId, testUserId);
      expect(removed).toBe(true);

      const isMember = await repo.isMember(testGuildId, testUserId);
      expect(isMember).toBe(false);
    });

    it('should return false when removing non-member', async () => {
      const removed = await repo.remove(testGuildId, testUserId);
      expect(removed).toBe(false);
    });
  });

  describe('findByGuildId', () => {
    it('should find all members of a guild', async () => {
      const user2 = await userRepo.create({
        email: `test2-${Date.now()}@example.com`,
        password_hash: 'hash2',
        irc_nick: `testnick2${Date.now()}`,
      });

      await repo.add({ guild_id: testGuildId, user_id: testUserId });
      await repo.add({ guild_id: testGuildId, user_id: user2.id });

      const members = await repo.findByGuildId(testGuildId);
      expect(members).toHaveLength(2);
      expect(members.map(m => m.id)).toContain(testUserId);
      expect(members.map(m => m.id)).toContain(user2.id);
    });

    it('should return empty array for guild with no members', async () => {
      const members = await repo.findByGuildId('00000000-0000-0000-0000-000000000000');
      expect(members).toHaveLength(0);
    });

    it('should order members by join time', async () => {
      const user2 = await userRepo.create({
        email: `order-${Date.now()}@example.com`,
        password_hash: 'hash',
        irc_nick: `ordernick${Date.now()}`,
      });

      await repo.add({ guild_id: testGuildId, user_id: testUserId });
      await new Promise(resolve => setTimeout(resolve, 10));
      await repo.add({ guild_id: testGuildId, user_id: user2.id });

      const members = await repo.findByGuildId(testGuildId);
      expect(members[0].id).toBe(testUserId);
      expect(members[1].id).toBe(user2.id);
    });
  });

  describe('findByUserId', () => {
    it('should find all guilds a user is member of', async () => {
      const guild2 = await guildRepo.create({
        name: 'Guild 2',
        owner_id: testUserId,
        irc_namespace_prefix: `&test2${Date.now()}-`,
      });

      await repo.add({ guild_id: testGuildId, user_id: testUserId });
      await repo.add({ guild_id: guild2.id, user_id: testUserId });

      const guildIds = await repo.findByUserId(testUserId);
      expect(guildIds).toHaveLength(2);
      expect(guildIds).toContain(testGuildId);
      expect(guildIds).toContain(guild2.id);
    });

    it('should return empty array for user with no memberships', async () => {
      const guildIds = await repo.findByUserId('00000000-0000-0000-0000-000000000000');
      expect(guildIds).toHaveLength(0);
    });
  });

  describe('isMember', () => {
    it('should return true for existing membership', async () => {
      await repo.add({
        guild_id: testGuildId,
        user_id: testUserId,
      });

      const isMember = await repo.isMember(testGuildId, testUserId);
      expect(isMember).toBe(true);
    });

    it('should return false for non-member', async () => {
      const isMember = await repo.isMember(testGuildId, '00000000-0000-0000-0000-000000000000');
      expect(isMember).toBe(false);
    });
  });

  describe('getMemberCount', () => {
    it('should return correct member count', async () => {
      const user2 = await userRepo.create({
        email: `count-${Date.now()}@example.com`,
        password_hash: 'hash',
        irc_nick: `countnick${Date.now()}`,
      });

      await repo.add({ guild_id: testGuildId, user_id: testUserId });
      await repo.add({ guild_id: testGuildId, user_id: user2.id });

      const count = await repo.getMemberCount(testGuildId);
      expect(count).toBe(2);
    });

    it('should return 0 for guild with no members', async () => {
      const count = await repo.getMemberCount('00000000-0000-0000-0000-000000000000');
      expect(count).toBe(0);
    });
  });

  describe('removeAllFromGuild', () => {
    it('should remove all members from guild', async () => {
      const user2 = await userRepo.create({
        email: `removeall-${Date.now()}@example.com`,
        password_hash: 'hash',
        irc_nick: `removeallnick${Date.now()}`,
      });

      await repo.add({ guild_id: testGuildId, user_id: testUserId });
      await repo.add({ guild_id: testGuildId, user_id: user2.id });

      const count = await repo.removeAllFromGuild(testGuildId);
      expect(count).toBe(2);

      const members = await repo.findByGuildId(testGuildId);
      expect(members).toHaveLength(0);
    });

    it('should return 0 for guild with no members', async () => {
      const count = await repo.removeAllFromGuild('00000000-0000-0000-0000-000000000000');
      expect(count).toBe(0);
    });
  });

  describe('cascade delete', () => {
    it('should delete memberships when guild is deleted', async () => {
      await repo.add({ guild_id: testGuildId, user_id: testUserId });

      await guildRepo.delete(testGuildId);

      const isMember = await repo.isMember(testGuildId, testUserId);
      expect(isMember).toBe(false);
    });

    it('should delete memberships when user is deleted', async () => {
      await repo.add({ guild_id: testGuildId, user_id: testUserId });

      await userRepo.delete(testUserId);

      const members = await repo.findByGuildId(testGuildId);
      expect(members.map(m => m.id)).not.toContain(testUserId);
    });
  });
});
