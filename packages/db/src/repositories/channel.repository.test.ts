import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseService } from '../database.service.js';
import { ChannelRepository } from './channel.repository.js';
import { GuildRepository } from './guild.repository.js';
import { UserRepository } from './user.repository.js';

describe('ChannelRepository', () => {
  let db: DatabaseService;
  let repo: ChannelRepository;
  let guildRepo: GuildRepository;
  let userRepo: UserRepository;
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
    repo = new ChannelRepository(db);
    guildRepo = new GuildRepository(db);
    userRepo = new UserRepository(db);
  });

  beforeEach(async () => {
    await db.query('DELETE FROM channels');
    await db.query('DELETE FROM guilds');
    await db.query('DELETE FROM users');

    const user = await userRepo.create({
      email: `test-${Date.now()}@example.com`,
      password_hash: 'hash',
      irc_nick: `testnick${Date.now()}`,
    });

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

  describe('create', () => {
    it('should create a channel successfully', async () => {
      const channel = await repo.create({
        guild_id: testGuildId,
        name: 'general',
        irc_channel_name: '&test-general',
      });

      expect(channel).toBeDefined();
      expect(channel.name).toBe('general');
      expect(channel.irc_channel_name).toBe('&test-general');
      expect(channel.guild_id).toBe(testGuildId);
    });

    it('should create a channel with topic', async () => {
      const channel = await repo.create({
        guild_id: testGuildId,
        name: 'announcements',
        irc_channel_name: '&test-announcements',
        topic: 'Important updates',
      });

      expect(channel.topic).toBe('Important updates');
    });

    it('should fail with duplicate channel name in same guild', async () => {
      await repo.create({
        guild_id: testGuildId,
        name: 'duplicate',
        irc_channel_name: '&test-duplicate1',
      });

      await expect(
        repo.create({
          guild_id: testGuildId,
          name: 'duplicate',
          irc_channel_name: '&test-duplicate2',
        })
      ).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find channel by id', async () => {
      const created = await repo.create({
        guild_id: testGuildId,
        name: 'find-channel',
        irc_channel_name: '&test-find',
      });

      const found = await repo.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe('find-channel');
    });

    it('should return null for non-existent id', async () => {
      const found = await repo.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('findByGuildId', () => {
    it('should find all channels in a guild', async () => {
      await repo.create({
        guild_id: testGuildId,
        name: 'general',
        irc_channel_name: '&test-general',
      });
      await repo.create({
        guild_id: testGuildId,
        name: 'random',
        irc_channel_name: '&test-random',
      });

      const channels = await repo.findByGuildId(testGuildId);
      expect(channels).toHaveLength(2);
      expect(channels.map(c => c.name)).toContain('general');
      expect(channels.map(c => c.name)).toContain('random');
    });

    it('should return empty array for guild with no channels', async () => {
      const channels = await repo.findByGuildId('00000000-0000-0000-0000-000000000000');
      expect(channels).toHaveLength(0);
    });

    it('should order channels by creation time', async () => {
      await repo.create({
        guild_id: testGuildId,
        name: 'first',
        irc_channel_name: '&test-first',
      });
      await new Promise(resolve => setTimeout(resolve, 10));
      await repo.create({
        guild_id: testGuildId,
        name: 'second',
        irc_channel_name: '&test-second',
      });

      const channels = await repo.findByGuildId(testGuildId);
      expect(channels[0].name).toBe('first');
      expect(channels[1].name).toBe('second');
    });
  });

  describe('findByIrcChannelName', () => {
    it('should find channel by IRC channel name', async () => {
      await repo.create({
        guild_id: testGuildId,
        name: 'irc-search',
        irc_channel_name: '&test-ircsearch',
      });

      const found = await repo.findByIrcChannelName('&test-ircsearch');
      expect(found).toBeDefined();
      expect(found?.name).toBe('irc-search');
    });

    it('should return null for non-existent IRC channel name', async () => {
      const found = await repo.findByIrcChannelName('&nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('updateTopic', () => {
    it('should update channel topic', async () => {
      const channel = await repo.create({
        guild_id: testGuildId,
        name: 'topic-channel',
        irc_channel_name: '&test-topic',
      });

      const updated = await repo.updateTopic(channel.id, 'New topic here');
      expect(updated?.topic).toBe('New topic here');
    });

    it('should return null for non-existent channel', async () => {
      const updated = await repo.updateTopic('00000000-0000-0000-0000-000000000000', 'Topic');
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete channel successfully', async () => {
      const channel = await repo.create({
        guild_id: testGuildId,
        name: 'delete-channel',
        irc_channel_name: '&test-delete',
      });

      const deleted = await repo.delete(channel.id);
      expect(deleted).toBe(true);

      const found = await repo.findById(channel.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent channel', async () => {
      const deleted = await repo.delete('00000000-0000-0000-0000-000000000000');
      expect(deleted).toBe(false);
    });
  });

  describe('deleteByGuildId', () => {
    it('should delete all channels in a guild', async () => {
      await repo.create({
        guild_id: testGuildId,
        name: 'channel1',
        irc_channel_name: '&test-channel1',
      });
      await repo.create({
        guild_id: testGuildId,
        name: 'channel2',
        irc_channel_name: '&test-channel2',
      });

      const count = await repo.deleteByGuildId(testGuildId);
      expect(count).toBe(2);

      const channels = await repo.findByGuildId(testGuildId);
      expect(channels).toHaveLength(0);
    });

    it('should return 0 for guild with no channels', async () => {
      const count = await repo.deleteByGuildId('00000000-0000-0000-0000-000000000000');
      expect(count).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true for existing channel', async () => {
      const channel = await repo.create({
        guild_id: testGuildId,
        name: 'exists-channel',
        irc_channel_name: '&test-exists',
      });

      const exists = await repo.exists(channel.id);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent channel', async () => {
      const exists = await repo.exists('00000000-0000-0000-0000-000000000000');
      expect(exists).toBe(false);
    });
  });

  describe('cascade delete', () => {
    it('should delete channels when guild is deleted', async () => {
      const channel = await repo.create({
        guild_id: testGuildId,
        name: 'cascade-channel',
        irc_channel_name: '&test-cascade',
      });

      await guildRepo.delete(testGuildId);

      const found = await repo.findById(channel.id);
      expect(found).toBeNull();
    });
  });
});
