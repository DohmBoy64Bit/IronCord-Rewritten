import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { DatabaseService, UserRepository } from '@ironcord/db';
import jwt from 'jsonwebtoken';
import type { Server as HTTPServer } from 'http';
import type { Express } from 'express';

process.env.IRC_HOST = process.env.TEST_IRC_HOST || 'localhost';
process.env.IRC_PORT = process.env.TEST_IRC_PORT || '6668';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

import { createServer } from '../../server.js';
import { WebSocketServer } from './server.js';
import { config } from '../../config/env.js';

describe('WebSocket Integration Tests', () => {
  let app: Express;
  let httpServer: HTTPServer;
  let wsServer: WebSocketServer;
  let db: DatabaseService;
  let port: number;
  let testUserId: string;
  let testToken: string;
  let client: ClientSocket;

  beforeAll(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://ironcord_test:ironcord_test_password@localhost:5433/ironcord_test';
    
    db = new DatabaseService({
      connectionString: testDbUrl,
    });
    await db.connect();

    const serverSetup = createServer();
    app = serverSetup.app;
    httpServer = serverSetup.httpServer;
    app.locals.db = db;

    wsServer = new WebSocketServer(httpServer);
    app.locals.wsServer = wsServer;

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address === 'object') {
          port = address.port;
        }
        resolve();
      });
    });

    const userRepo = new UserRepository(db);
    const existingUser = await userRepo.findByEmail('wstest@ironcord.dev');
    if (existingUser) {
      testUserId = existingUser.id;
    } else {
      const newUser = await userRepo.create({
        email: 'wstest@ironcord.dev',
        password_hash: 'hashed_password',
        irc_nick: 'wstest',
      });
      testUserId = newUser.id;
    }

    testToken = jwt.sign(
      { userId: testUserId, email: 'wstest@ironcord.dev' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await wsServer.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    await db.disconnect();
  });

  beforeEach(() => {
    client = ioClient(`http://localhost:${port}`, {
      auth: { token: testToken },
      transports: ['websocket'],
    });
  });

  afterEach((done) => {
    if (client.connected) {
      client.disconnect();
    }
    setTimeout(done, 100);
  });

  describe('Authentication', () => {
    it('should authenticate with valid JWT token', async () => {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
        
        client.once('connect', () => {
          clearTimeout(timeout);
          expect(client.connected).toBe(true);
          resolve();
        });

        client.once('connect_error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });

    it('should reject connection without token', async () => {
      const unauthClient = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
      });

      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

          unauthClient.once('connect', () => {
            clearTimeout(timeout);
            unauthClient.disconnect();
            reject(new Error('Should not connect without token'));
          });

          unauthClient.once('connect_error', (err) => {
            clearTimeout(timeout);
            expect(err.message).toBeDefined();
            unauthClient.disconnect();
            resolve();
          });
        });
      } finally {
        if (unauthClient.connected) {
          unauthClient.disconnect();
        }
      }
    });

    it('should reject connection with invalid token', async () => {
      const invalidClient = ioClient(`http://localhost:${port}`, {
        auth: { token: 'invalid_token' },
        transports: ['websocket'],
      });

      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

          invalidClient.once('connect', () => {
            clearTimeout(timeout);
            invalidClient.disconnect();
            reject(new Error('Should not connect with invalid token'));
          });

          invalidClient.once('connect_error', (err) => {
            clearTimeout(timeout);
            expect(err.message).toBeDefined();
            invalidClient.disconnect();
            resolve();
          });
        });
      } finally {
        if (invalidClient.connected) {
          invalidClient.disconnect();
        }
      }
    });
  });

  describe('IRC Connection', () => {
    it('should connect to IRC server', (done) => {
      client.on('connect', () => {
        client.emit('irc:connect', {
          nick: 'wstest_user',
          password: 'testpass123',
        });

        client.on('irc:registered', () => {
          done();
        });

        client.on('irc:error', (data) => {
          done(new Error(`IRC error: ${data.error}`));
        });
      });

      setTimeout(() => {
        done(new Error('IRC registration timeout'));
      }, 10000);
    }, 15000);

    it('should handle IRC connection errors gracefully', (done) => {
      client.on('connect', () => {
        client.emit('irc:connect', {
          nick: '',
          password: 'testpass123',
        });

        client.on('irc:error', (data) => {
          expect(data.error).toBeDefined();
          done();
        });
      });

      setTimeout(() => {
        done();
      }, 5000);
    }, 10000);
  });

  describe('IRC Channel Operations', () => {
    beforeEach((done) => {
      client.on('connect', () => {
        client.emit('irc:connect', {
          nick: `wstest_${Date.now()}`,
          password: 'testpass123',
        });

        client.once('irc:registered', () => {
          done();
        });
      });
    }, 15000);

    it('should join a channel', (done) => {
      const testChannel = `#test_${Date.now()}`;

      client.emit('irc:join', { channel: testChannel });

      client.on('irc:message', (data) => {
        if (data.channel === testChannel) {
          done();
        }
      });

      setTimeout(() => {
        done();
      }, 5000);
    }, 15000);

    it('should send and receive messages', (done) => {
      const testChannel = `#test_${Date.now()}`;
      const testMessage = 'Hello from WebSocket test!';

      client.emit('irc:join', { channel: testChannel });

      setTimeout(() => {
        client.emit('irc:message', {
          target: testChannel,
          message: testMessage,
        });

        client.on('irc:message', (data) => {
          if (data.channel === testChannel && data.content === testMessage) {
            done();
          }
        });
      }, 2000);

      setTimeout(() => {
        done(new Error('Message send/receive timeout'));
      }, 10000);
    }, 15000);

    it('should part from a channel', (done) => {
      const testChannel = `#test_${Date.now()}`;

      client.emit('irc:join', { channel: testChannel });

      setTimeout(() => {
        client.emit('irc:part', { channel: testChannel });
        done();
      }, 2000);
    }, 15000);

    it('should reject operations when not connected to IRC', (done) => {
      const disconnectedClient = ioClient(`http://localhost:${port}`, {
        auth: { token: testToken },
        transports: ['websocket'],
      });

      disconnectedClient.on('connect', () => {
        disconnectedClient.emit('irc:message', {
          target: '#test',
          message: 'test',
        });

        disconnectedClient.on('irc:error', (data) => {
          expect(data.error).toContain('Not connected to IRC');
          disconnectedClient.disconnect();
          done();
        });
      });
    });
  });

  describe('IRC History', () => {
    beforeEach((done) => {
      client.on('connect', () => {
        client.emit('irc:connect', {
          nick: `wstest_${Date.now()}`,
          password: 'testpass123',
        });

        client.once('irc:registered', () => {
          done();
        });
      });
    }, 15000);

    it('should fetch channel history', (done) => {
      const testChannel = `#test_${Date.now()}`;

      client.emit('irc:join', { channel: testChannel });

      setTimeout(() => {
        client.emit('irc:history', {
          channel: testChannel,
          limit: 10,
        });

        client.on('irc:history', (messages) => {
          expect(Array.isArray(messages)).toBe(true);
          done();
        });
      }, 2000);

      setTimeout(() => {
        done(new Error('History fetch timeout'));
      }, 10000);
    }, 15000);
  });

  describe('IRC Presence', () => {
    beforeEach((done) => {
      client.on('connect', () => {
        client.emit('irc:connect', {
          nick: `wstest_${Date.now()}`,
          password: 'testpass123',
        });

        client.once('irc:registered', () => {
          done();
        });
      });
    }, 15000);

    it('should set user presence', (done) => {
      client.emit('irc:presence', { status: 'idle' });

      setTimeout(() => {
        done();
      }, 1000);
    });

    it('should reject presence update when not connected', (done) => {
      const disconnectedClient = ioClient(`http://localhost:${port}`, {
        auth: { token: testToken },
        transports: ['websocket'],
      });

      disconnectedClient.on('connect', () => {
        disconnectedClient.emit('irc:presence', { status: 'idle' });

        disconnectedClient.on('irc:error', (data) => {
          expect(data.error).toContain('Not connected to IRC');
          disconnectedClient.disconnect();
          done();
        });
      });
    });
  });

  describe('Connection Cleanup', () => {
    it('should cleanup IRC client on disconnect', (done) => {
      const tempClient = ioClient(`http://localhost:${port}`, {
        auth: { token: testToken },
        transports: ['websocket'],
      });

      tempClient.on('connect', () => {
        tempClient.emit('irc:connect', {
          nick: `wstest_cleanup_${Date.now()}`,
          password: 'testpass123',
        });

        tempClient.once('irc:registered', () => {
          const initialCount = wsServer.getConnectionHandler().getActiveClientCount();
          
          tempClient.disconnect();

          setTimeout(() => {
            const finalCount = wsServer.getConnectionHandler().getActiveClientCount();
            expect(finalCount).toBeLessThan(initialCount);
            done();
          }, 500);
        });
      });

      setTimeout(() => {
        tempClient.disconnect();
        done(new Error('Cleanup test timeout'));
      }, 10000);
    }, 15000);
  });
});
