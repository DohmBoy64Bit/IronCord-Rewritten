import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { DatabaseService } from '@ironcord/db';
import { createServer } from '../../server.js';

describe('Auth API', () => {
  let app: Express;
  let db: DatabaseService;

  beforeAll(async () => {
    db = new DatabaseService({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433', 10),
      database: process.env.DB_NAME || 'ironcord_test',
      user: process.env.DB_USER || 'ironcord_test',
      password: process.env.DB_PASSWORD || 'ironcord_test_password',
    });
    await db.connect();
    await db.initializeSchema();

    const serverSetup = createServer();
    app = serverSetup.app;
    app.locals.db = db;
  });

  beforeEach(async () => {
    await db.query('DELETE FROM users');
  });

  afterAll(async () => {
    await db.disconnect();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.irc_nick).toBe('test');
      expect(response.body.token).toBeDefined();
      expect(response.body.user.password_hash).toBeUndefined();
    });

    it('should register with custom IRC nick', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'custom@example.com',
          password: 'password123',
          irc_nick: 'customnick',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user.irc_nick).toBe('customnick');
    });

    it('should reject registration without email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should reject registration without password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email format');
    });

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Password must be at least 8 characters');
    });

    it('should reject duplicate email', async () => {
      await request(app)
        .post('/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
        });

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password456',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email already registered');
    });

    it('should hash password with bcrypt', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'hash@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);

      const result = await db.query(
        'SELECT password_hash FROM users WHERE email = $1',
        ['hash@example.com']
      );
      const hash = result.rows[0].password_hash;
      expect(hash).toBeDefined();
      expect(hash).not.toBe('password123');
      expect(hash.startsWith('$2a$10$') || hash.startsWith('$2b$10$')).toBe(true);
    });

    it('should generate valid JWT token', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'jwt@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.split('.')).toHaveLength(3);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/auth/register')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('login@example.com');
      expect(response.body.token).toBeDefined();
      expect(response.body.user.password_hash).toBeUndefined();
    });

    it('should reject login without email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should reject login without password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should generate valid JWT token on login', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.split('.')).toHaveLength(3);
    });
  });

  describe('Integration: Register and Login flow', () => {
    it('should allow user to register and then login', async () => {
      const registerResponse = await request(app)
        .post('/auth/register')
        .send({
          email: 'flow@example.com',
          password: 'flowpassword123',
        });

      expect(registerResponse.status).toBe(201);
      const registerToken = registerResponse.body.token;

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'flow@example.com',
          password: 'flowpassword123',
        });

      expect(loginResponse.status).toBe(200);
      const loginToken = loginResponse.body.token;

      expect(registerToken).toBeDefined();
      expect(loginToken).toBeDefined();
      expect(registerResponse.body.user.id).toBe(loginResponse.body.user.id);
    });
  });
});
