import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { IRCClient } from '../irc-client';
import { dbService } from '../services/db.service';
import { logger } from '../logger';
import { gatewayEvents } from '../events';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'ironcord_secret_key_change_me' : undefined);

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set');
}

export class WebSocketServer {
  private io: SocketServer;
  private userIRCConnections: Map<string, IRCClient> = new Map();
  private ircRegisteredSockets: Set<string> = new Set();

  private normalizeChannel(channel: string): string {
    return channel.startsWith('#') ? channel : `#${channel}`;
  }

  constructor(server: HttpServer) {
    // Listen for internal immediate-join events (from API)
    gatewayEvents.on('irc:immediate-join', (payload: { userId: string; channel: string }) => {
      logger.info('WS-INTERNAL', { event: 'irc:immediate-join', ...payload });

      // Find all sockets for this user (usually just one)
      const sockets = Array.from(this.io.sockets.sockets.values()).filter(
        (s) => (s as any).userId === payload.userId
      );

      if (sockets.length === 0) {
        logger.warn('WS-INTERNAL', {
          event: 'irc:immediate-join',
          reason: 'no_active_socket_for_user',
          userId: payload.userId,
          channel: payload.channel
        });
        return;
      }

      for (const socket of sockets) {
        const client = this.userIRCConnections.get(socket.id);
        const isRegistered = this.ircRegisteredSockets.has(socket.id);

        if (!client || !isRegistered) {
          logger.warn('WS-INTERNAL', {
            event: 'irc:immediate-join',
            reason: 'irc_client_not_ready',
            socketId: socket.id,
            hasClient: !!client,
            isRegistered
          });
          continue;
        }

        const channelName = this.normalizeChannel(payload.channel);
        logger.info('WS-INTERNAL', {
          action: 'joining_channel',
          socketId: socket.id,
          channel: channelName
        });
        client.join(channelName);

        // Optional: Fetch history immediately
        setTimeout(() => client.fetchHistory(channelName, 50), 500);
      }
    });

    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? process.env.CLIENT_ORIGIN
          : '*', // Allow all in dev, but restrict in prod
      },
    });

    // Authenticate socket connections
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      logger.info('WS-AUTH', {
        socketId: socket.id,
        hasToken: !!token,
      });

      if (!token) {
        logger.warn('WS-AUTH', {
          socketId: socket.id,
          reason: 'missing_token',
        });
        return next(new Error('Authentication required'));
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET!) as any;
        (socket as any).userId = decoded.userId;
        logger.info('WS-AUTH', {
          socketId: socket.id,
          userId: decoded.userId,
        });
        next();
      } catch (err) {
        logger.error('WS-AUTH', {
          socketId: socket.id,
          error: (err as Error).message,
        });
        next(new Error('Invalid or expired token'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;
      logger.info('WS-CONNECT', { socketId: socket.id, userId });

      socket.on('irc:connect', (payload: { config: any }) => {
        logger.info('WS-IRC-CONNECT', {
          socketId: socket.id,
          userId,
          config: payload.config,
        });
        this.connectToIRC(socket, userId, payload.config);
      });

      socket.on('irc:message', (payload: { channel?: string; message?: string }) => {
        const client = this.userIRCConnections.get(socket.id);

        if (!payload?.channel || !payload?.message) {
          logger.warn('WS-IRC-MESSAGE', {
            socketId: socket.id,
            reason: 'malformed_payload',
            payload,
          });
          return;
        }

        const normalizedChannel = this.normalizeChannel(payload.channel);

        logger.debug('WS-IRC-MESSAGE', {
          socketId: socket.id,
          userId,
          requestedChannel: payload.channel,
          normalizedChannel,
          message: payload.message,
        });

        if (!client) {
          logger.warn('WS-IRC-MESSAGE', {
            socketId: socket.id,
            reason: 'no_irc_client',
          });
          socket.emit('irc:error', 'No active IRC connection');
          return;
        }

        if (!this.ircRegisteredSockets.has(socket.id)) {
          logger.warn('WS-IRC-MESSAGE', {
            socketId: socket.id,
            reason: 'irc_not_registered',
          });
          socket.emit('irc:error', 'IRC session not ready');
          return;
        }

        logger.info('WS-IRC-PRIVMSG', {
          socketId: socket.id,
          channel: normalizedChannel,
          message: payload.message,
        });
        client.privmsg(normalizedChannel, payload.message);
      });

      socket.on('irc:presence', (payload: { status: 'online' | 'idle' | 'dnd' | 'invisible' }) => {
        const client = this.userIRCConnections.get(socket.id);
        if (client) {
          client.setPresence(payload.status);
          logger.info('WS-IRC-PRESENCE', {
            socketId: socket.id,
            userId,
            status: payload.status,
          });
        }
      });

      socket.on('disconnect', () => {
        logger.info('WS-DISCONNECT', { socketId: socket.id, userId });
        this.ircRegisteredSockets.delete(socket.id);
        const client = this.userIRCConnections.get(socket.id);
        if (client) {
          client.disconnect();
          this.userIRCConnections.delete(socket.id);
        }
      });
    });
  }

  private async connectToIRC(socket: Socket, userId: string, config: any) {
    const client = new IRCClient(config);

    client.on('registered', async () => {
      this.ircRegisteredSockets.add(socket.id);
      console.log('[IRC->WS] IRC registration complete', { socketId: socket.id, userId });
      socket.emit('irc:registered');

      // Auto-join user's channels
      try {
        const result = await dbService.query(
          `SELECT c.irc_channel_name FROM channels c
           JOIN guilds g ON c.guild_id = g.id
           JOIN guild_members gm ON g.id = gm.guild_id
           WHERE gm.user_id = $1`,
          [userId]
        );

        for (const row of result.rows) {
          const normalizedChannel = this.normalizeChannel(row.irc_channel_name);
          client.join(normalizedChannel);
          // Fetch recent history for each channel
          setTimeout(() => {
            client.fetchHistory(normalizedChannel, 50);
          }, 500);
        }
      } catch (err) {
        console.error('Error auto-joining channels:', err);
        socket.emit('irc:error', 'Failed to auto-join some channels');
      }
    });

    client.on('history', (messages) => {
      socket.emit('irc:history', messages);
    });

    client.on('reconnecting', (info) => {
      socket.emit('irc:reconnecting', info);
    });

    client.on('message', (msg) => {
      socket.emit('irc:message', msg);
    });

    client.on('members', (data) => {
      socket.emit('irc:members', data);
    });

    client.on('error', (err) => {
      socket.emit('irc:error', err.message);
    });

    client.on('presence', (data) => {
      socket.emit('irc:presence', data);
    });

    client.connect();
    this.userIRCConnections.set(socket.id, client);

    client.on('close', () => {
      this.ircRegisteredSockets.delete(socket.id);
      socket.emit('irc:disconnected');
    });

    client.on('reconnect_failed', () => {
      socket.emit('irc:error', 'Connection failed after max retries');
    });
  }
}
