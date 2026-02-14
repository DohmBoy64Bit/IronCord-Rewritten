import { Socket } from 'socket.io';
import { IRCClient } from '@ironcord/engine';
import type { IRCConfig } from '@ironcord/engine';
import type { UserPresence } from '@ironcord/shared/types';
import { logger } from '@ironcord/shared';
import { config } from '../../../config/env.js';
import type { SocketData } from '../middleware/auth.js';
import type { ConnectionHandler } from './connection.js';
import { UserRepository } from '@ironcord/db';
import type { DatabaseService } from '@ironcord/db';
import { passwordCache } from '../../../services/password-cache.js';
import { IRCEventForwarder } from './irc-event-forwarder.js';

interface IRCConnectPayload {
  userId: string;
}

interface IRCMessagePayload {
  target: string;
  message: string;
}

interface IRCJoinPayload {
  channel: string;
}

interface IRCPartPayload {
  channel: string;
}

interface IRCHistoryPayload {
  channel: string;
  limit?: number;
}

interface IRCPresencePayload {
  status: UserPresence;
}

interface IRCTypingPayload {
  target: string;
  status: 'active' | 'paused' | 'done';
}

export class IRCBridgeHandler {
  constructor(
    private connectionHandler: ConnectionHandler,
    private db: DatabaseService
  ) { }

  public setupHandlers(socket: Socket): void {
    socket.on('irc:connect', (payload: IRCConnectPayload) => {
      this.handleConnect(socket, payload);
    });

    socket.on('irc:message', (payload: IRCMessagePayload) => {
      this.handleMessage(socket, payload);
    });

    socket.on('irc:join', (payload: IRCJoinPayload) => {
      this.handleJoin(socket, payload);
    });

    socket.on('irc:part', (payload: IRCPartPayload) => {
      this.handlePart(socket, payload);
    });

    socket.on('irc:history', (payload: IRCHistoryPayload) => {
      this.handleHistory(socket, payload);
    });

    socket.on('irc:presence', (payload: IRCPresencePayload) => {
      this.handlePresence(socket, payload);
    });

    socket.on('irc:typing', (payload: IRCTypingPayload) => {
      this.handleTyping(socket, payload);
    });

    socket.on('irc:react', (payload: { target: string; msgId: string; reaction: string }) => {
      this.handleReaction(socket, payload);
    });
  }

  private async handleConnect(socket: Socket, _payload: IRCConnectPayload): Promise<void> {
    const socketData = socket.data as SocketData;

    logger.info('WS-IRC-CONNECT', {
      socketId: socket.id,
      userId: socketData.userId,
      message: 'Connecting to IRC server',
    });

    try {
      const userRepo = new UserRepository(this.db);
      const user = await userRepo.findById(socketData.userId);

      if (!user) {
        logger.error('WS-IRC-CONNECT', {
          socketId: socket.id,
          userId: socketData.userId,
          error: 'User not found',
        });
        socket.emit('irc:error', { error: 'User not found' });
        return;
      }

      const existingClient = this.connectionHandler.getIRCClient(socket.id);
      if (existingClient) {
        logger.warn('WS-IRC-CONNECT', {
          socketId: socket.id,
          message: 'IRC client already exists, disconnecting old client',
        });
        this.connectionHandler.removeIRCClient(socket.id);
      }

      const password = passwordCache.pop(socketData.userId);

      const ircConfig: IRCConfig = {
        host: config.ircHost,
        port: config.ircPort,
        nick: user.irc_nick,
        username: user.irc_nick,
        realname: user.irc_nick,
        password,
        email: user.email,
      };

      const ircClient = new IRCClient(ircConfig, {
        maxRetries: 5,
        initialDelay: 1000,
        maxDelay: 30000,
      });

      this.setupIRCEventForwarding(socket, ircClient);

      ircClient.connect();
      this.connectionHandler.setIRCClient(socket.id, ircClient);
    } catch (error) {
      logger.error('WS-IRC-CONNECT', {
        socketId: socket.id,
        error: error instanceof Error ? error.message : String(error),
      });
      socket.emit('irc:error', { error: 'Failed to connect to IRC' });
    }
  }

  private handleMessage(socket: Socket, payload: IRCMessagePayload): void {
    const ircClient = this.connectionHandler.getIRCClient(socket.id);
    if (!ircClient) {
      socket.emit('irc:error', { error: 'Not connected to IRC' });
      return;
    }

    if (!ircClient.ready()) {
      socket.emit('irc:error', { error: 'IRC client not ready' });
      return;
    }

    logger.debug('WS-IRC-MESSAGE', {
      socketId: socket.id,
      target: payload.target,
      message: payload.message.substring(0, 50),
    });

    ircClient.privmsg(payload.target, payload.message);
  }

  private handleJoin(socket: Socket, payload: IRCJoinPayload): void {
    const ircClient = this.connectionHandler.getIRCClient(socket.id);
    if (!ircClient) {
      socket.emit('irc:error', { error: 'Not connected to IRC' });
      return;
    }

    if (!ircClient.ready()) {
      socket.emit('irc:error', { error: 'IRC client not ready' });
      return;
    }

    logger.info('WS-IRC-JOIN', {
      socketId: socket.id,
      channel: payload.channel,
    });

    ircClient.join(payload.channel);
  }

  private handlePart(socket: Socket, payload: IRCPartPayload): void {
    const ircClient = this.connectionHandler.getIRCClient(socket.id);
    if (ircClient) {
      ircClient.part(payload.channel);
    }
  }

  private handleHistory(socket: Socket, payload: IRCHistoryPayload): void {
    const ircClient = this.connectionHandler.getIRCClient(socket.id);
    if (ircClient && ircClient.ready()) {
      ircClient.fetchHistory(payload.channel, payload.limit || 50);
    }
  }

  private handlePresence(socket: Socket, payload: IRCPresencePayload): void {
    const ircClient = this.connectionHandler.getIRCClient(socket.id);
    if (ircClient && ircClient.ready()) {
      ircClient.setPresence(payload.status as any);
    }
  }

  private handleTyping(socket: Socket, payload: IRCTypingPayload): void {
    const ircClient = this.connectionHandler.getIRCClient(socket.id);
    if (ircClient && ircClient.ready()) {
      ircClient.typing(payload.target, payload.status);
    }
  }

  private handleReaction(socket: Socket, payload: { target: string; msgId: string; reaction: string }): void {
    const ircClient = this.connectionHandler.getIRCClient(socket.id);
    if (ircClient && ircClient.ready()) {
      ircClient.react(payload.target, payload.msgId, payload.reaction);
    }
  }

  private setupIRCEventForwarding(socket: Socket, ircClient: IRCClient): void {
    IRCEventForwarder.setup(socket, ircClient, () => {
      this.autojoinChannels(socket, ircClient);
    });
  }

  private async autojoinChannels(socket: Socket, ircClient: IRCClient): Promise<void> {
    const socketData = socket.data as SocketData;
    try {
      const result = await this.db.query<{ irc_channel_name: string }>(
        `SELECT c.irc_channel_name FROM channels c
         JOIN guilds g ON c.guild_id = g.id
         JOIN guild_members gm ON g.id = gm.guild_id
         WHERE gm.user_id = $1`,
        [socketData.userId]
      );

      for (const row of result.rows) {
        ircClient.join(row.irc_channel_name);
        setTimeout(() => {
          if (ircClient.ready()) {
            ircClient.fetchHistory(row.irc_channel_name, 50);
          }
        }, 1000);
      }
    } catch (error) {
      logger.error('WS-IRC-AUTOJOIN', {
        socketId: socket.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
