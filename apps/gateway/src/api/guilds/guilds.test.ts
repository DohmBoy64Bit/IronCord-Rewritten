import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createServer } from '../../server.js';
import { DatabaseService } from '@ironcord/db';
import type { Express } from 'express';

const JWT_SECRET = 'test-secret-key-for-testing-only';

describe('Guild API', () => {
  let app: Express;
  let db: DatabaseService;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Initialize database
    db = new DatabaseService({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433', 10),
      database: process.env.DB_NAME || 'ironcord_test',
      user: process.env.DB_USER || 'ironcord_test',
      password: process.env.DB_PASSWORD || 'ironcord_test_password',
    });
    await db.connect();
    await db.initializeSchema();

    // Clean up any existing test user
    await db.query("DELETE FROM users WHERE email = 'guildtest@example.com'");

    // Create app
    const serverSetup = createServer();
    app = serverSetup.app;
    app.locals.db = db;

    // Register test user via API
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        email: 'guildtest@example.com',
        password: 'TestPassword123!',
        irc_nick: 'guildtester',
      });

    userId = registerResponse.body.user.id;
    authToken = registerResponse.body.token;
  });

  afterEach(async () => {
    // Clean up only guilds created during tests, not the user
    await db.query('DELETE FROM channels WHERE guild_id IN (SELECT id FROM guilds WHERE owner_id = $1)', [userId]);
    await db.query('DELETE FROM guild_members WHERE guild_id IN (SELECT id FROM guilds WHERE owner_id = $1)', [userId]);
    await db.query('DELETE FROM guilds WHERE owner_id = $1', [userId]);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('POST /guilds', () => {
    it('should create a new guild successfully', async () => {
      const response = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Guild' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.guild).toMatchObject({
        id: expect.any(String),
        name: 'Test Guild',
        owner_id: userId,
        irc_namespace_prefix: expect.any(String),
      });
    });

    it('should reject guild creation without authentication', async () => {
      await request(app)
        .post('/guilds')
        .send({ name: 'Test Guild' })
        .expect(401);
    });

    it('should reject guild creation without name', async () => {
      await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should reject guild creation with empty name', async () => {
      await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' })
        .expect(400);
    });

    it('should reject guild creation with name too long', async () => {
      await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'a'.repeat(101) })
        .expect(400);
    });

    it('should create default #general channel', async () => {
      const response = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Guild' })
        .expect(201);

      const guildId = response.body.guild.id;

      // Verify default channel was created via database query
      const result = await db.query(
        'SELECT * FROM channels WHERE guild_id = $1',
        [guildId]
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('general');
      expect(result.rows[0].irc_channel_name).toContain('-general');
    });

    it('should add owner as guild member', async () => {
      const response = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Guild' })
        .expect(201);

      const guildId = response.body.guild.id;

      // Verify owner is a member
      const result = await db.query(
        'SELECT * FROM guild_members WHERE guild_id = $1 AND user_id = $2',
        [guildId, userId]
      );
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('GET /guilds/mine', () => {
    it('should return empty array when user has no guilds', async () => {
      const response = await request(app)
        .get('/guilds/mine')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.guilds).toEqual([]);
    });

    it('should return user guilds with channels', async () => {
      // Create a guild first
      const createResponse = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'My Test Guild' })
        .expect(201);

      const guildId = createResponse.body.guild.id;

      // Get guilds
      const response = await request(app)
        .get('/guilds/mine')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.guilds).toHaveLength(1);
      expect(response.body.guilds[0]).toMatchObject({
        id: guildId,
        name: 'My Test Guild',
        owner_id: userId,
        channels: expect.arrayContaining([
          expect.objectContaining({
            name: 'general',
          }),
        ]),
      });
    });

    it('should reject request without authentication', async () => {
      await request(app).get('/guilds/mine').expect(401);
    });

    it('should return multiple guilds if user is member of many', async () => {
      // Create two guilds
      await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Guild One' })
        .expect(201);

      await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Guild Two' })
        .expect(201);

      // Get guilds
      const response = await request(app)
        .get('/guilds/mine')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.guilds).toHaveLength(2);
      expect(response.body.guilds.map((g: any) => g.name)).toContain('Guild One');
      expect(response.body.guilds.map((g: any) => g.name)).toContain('Guild Two');
    });
  });

  describe('GET /guilds/:id/channels', () => {
    it('should return channels for a guild', async () => {
      // Create guild
      const createResponse = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Guild' })
        .expect(201);

      const guildId = createResponse.body.guild.id;

      // Get channels
      const response = await request(app)
        .get(`/guilds/${guildId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.channels).toHaveLength(1);
      expect(response.body.channels[0]).toMatchObject({
        name: 'general',
        guild_id: guildId,
      });
    });

    it('should reject request without authentication', async () => {
      await request(app).get('/guilds/fake-id/channels').expect(401);
    });

    it('should return 404 for non-existent guild', async () => {
      const fakeGuildId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .get(`/guilds/${fakeGuildId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return empty array for guild with no channels', async () => {
      // Create guild via API
      const createResponse = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Empty Guild' })
        .expect(201);

      const guildId = createResponse.body.guild.id;

      // Delete default channel
      await db.query('DELETE FROM channels WHERE guild_id = $1', [guildId]);

      // Get channels
      const response = await request(app)
        .get(`/guilds/${guildId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.channels).toEqual([]);
    });
  });

  describe('POST /guilds/:id/channels', () => {
    it('should create a new channel in a guild', async () => {
      // Create guild
      const createResponse = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Guild' })
        .expect(201);

      const guildId = createResponse.body.guild.id;

      // Create channel
      const response = await request(app)
        .post(`/guilds/${guildId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'announcements' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.channel).toMatchObject({
        id: expect.any(String),
        guild_id: guildId,
        name: 'announcements',
      });
      expect(response.body.channel.irc_channel_name).toContain('-announcements');
    });

    it('should reject channel creation without authentication', async () => {
      await request(app)
        .post('/guilds/fake-id/channels')
        .send({ name: 'test' })
        .expect(401);
    });

    it('should reject channel creation without name', async () => {
      // Create guild
      const createResponse = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Guild' })
        .expect(201);

      const guildId = createResponse.body.guild.id;

      await request(app)
        .post(`/guilds/${guildId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should reject channel creation with empty name', async () => {
      // Create guild
      const createResponse = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Guild' })
        .expect(201);

      const guildId = createResponse.body.guild.id;

      await request(app)
        .post(`/guilds/${guildId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' })
        .expect(400);
    });

    it('should reject channel creation with name too long', async () => {
      // Create guild
      const createResponse = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Guild' })
        .expect(201);

      const guildId = createResponse.body.guild.id;

      await request(app)
        .post(`/guilds/${guildId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'a'.repeat(101) })
        .expect(400);
    });

    it('should return 404 for non-existent guild', async () => {
      const fakeGuildId = '00000000-0000-0000-0000-000000000000';
      await request(app)
        .post(`/guilds/${fakeGuildId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'test' })
        .expect(404);
    });

    it('should reject duplicate channel name in same guild', async () => {
      // Create guild
      const createResponse = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Guild' })
        .expect(201);

      const guildId = createResponse.body.guild.id;

      // Create first channel
      await request(app)
        .post(`/guilds/${guildId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'duplicate' })
        .expect(201);

      // Try to create duplicate
      await request(app)
        .post(`/guilds/${guildId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'duplicate' })
        .expect(409);
    });
  });

  describe('Integration: Full guild workflow', () => {
    it('should support create guild → list guilds → create channel → list channels', async () => {
      // 1. Create guild
      const createGuildResponse = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Workflow Guild' })
        .expect(201);

      const guildId = createGuildResponse.body.guild.id;

      // 2. List guilds
      const listGuildsResponse = await request(app)
        .get('/guilds/mine')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listGuildsResponse.body.success).toBe(true);
      expect(listGuildsResponse.body.guilds).toHaveLength(1);
      expect(listGuildsResponse.body.guilds[0].name).toBe('Workflow Guild');

      // 3. Create channel
      const createChannelResponse = await request(app)
        .post(`/guilds/${guildId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'dev' })
        .expect(201);

      expect(createChannelResponse.body.success).toBe(true);
      expect(createChannelResponse.body.channel.name).toBe('dev');

      // 4. List channels
      const listChannelsResponse = await request(app)
        .get(`/guilds/${guildId}/channels`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listChannelsResponse.body.success).toBe(true);
      expect(listChannelsResponse.body.channels).toHaveLength(2); // general + dev
      expect(listChannelsResponse.body.channels.map((c: any) => c.name)).toContain('general');
      expect(listChannelsResponse.body.channels.map((c: any) => c.name)).toContain('dev');
    });
  });
});
