import { Socket } from 'socket.io';
import { IRCClient } from '@ironcord/engine';
import type { IRCConfig, IRCMessageData, IRCMembers, IRCPresence, ReconnectEvent } from '@ironcord/engine';
import type { UserPresence } from '@ironcord/shared/types';
import { logger } from '@ironcord/shared';
import { config } from '../../../config/env.js';
import type { SocketData } from '../middleware/auth.js';
import type { ConnectionHandler } from './connection.js';

interface IRCConnectPayload {
  nick: string;
  password: string;
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

export class IRCBridgeHandler {
  constructor(private connectionHandler: ConnectionHandler) {}

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
  }

  private handleConnect(socket: Socket, payload: IRCConnectPayload): void {
    const socketData = socket.data as SocketData;
    
    logger.info('WS-IRC-CONNECT', {
      socketId: socket.id,
      userId: socketData.userId,
      nick: payload.nick,
      message: 'Connecting to IRC server',
    });

    const existingClient = this.connectionHandler.getIRCClient(socket.id);
    if (existingClient) {
      logger.warn('WS-IRC-CONNECT', {
        socketId: socket.id,
        message: 'IRC client already exists, disconnecting old client',
      });
      this.connectionHandler.removeIRCClient(socket.id);
    }

    const ircConfig: IRCConfig = {
      host: config.ircHost,
      port: config.ircPort,
      nick: payload.nick,
      username: payload.nick,
      realname: payload.nick,
      password: payload.password,
    };

    const ircClient = new IRCClient(ircConfig, {
      maxRetries: 5,
      initialDelay: 1000,
      maxDelay: 30000,
    });

    this.setupIRCEventForwarding(socket, ircClient);

    ircClient.connect();
    this.connectionHandler.setIRCClient(socket.id, ircClient);
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
    if (!ircClient) {
      socket.emit('irc:error', { error: 'Not connected to IRC' });
      return;
    }

    logger.info('WS-IRC-PART', {
      socketId: socket.id,
      channel: payload.channel,
    });

    ircClient.part(payload.channel);
  }

  private handleHistory(socket: Socket, payload: IRCHistoryPayload): void {
    const ircClient = this.connectionHandler.getIRCClient(socket.id);
    if (!ircClient) {
      socket.emit('irc:error', { error: 'Not connected to IRC' });
      return;
    }

    if (!ircClient.ready()) {
      socket.emit('irc:error', { error: 'IRC client not ready' });
      return;
    }

    const limit = payload.limit || 50;
    
    logger.info('WS-IRC-HISTORY', {
      socketId: socket.id,
      channel: payload.channel,
      limit,
    });

    ircClient.fetchHistory(payload.channel, limit);
  }

  private handlePresence(socket: Socket, payload: IRCPresencePayload): void {
    const ircClient = this.connectionHandler.getIRCClient(socket.id);
    if (!ircClient) {
      socket.emit('irc:error', { error: 'Not connected to IRC' });
      return;
    }

    if (!ircClient.ready()) {
      socket.emit('irc:error', { error: 'IRC client not ready' });
      return;
    }

    logger.info('WS-IRC-PRESENCE', {
      socketId: socket.id,
      status: payload.status,
    });

    ircClient.setPresence(payload.status);
  }

  private setupIRCEventForwarding(socket: Socket, ircClient: IRCClient): void {
    ircClient.on('registered', () => {
      logger.info('WS-IRC-EVENT', {
        socketId: socket.id,
        event: 'registered',
      });
      socket.emit('irc:registered');
    });

    ircClient.on('message', (data: IRCMessageData) => {
      logger.debug('WS-IRC-EVENT', {
        socketId: socket.id,
        event: 'message',
        channel: data.channel,
        author: data.author,
      });
      socket.emit('irc:message', data);
    });

    ircClient.on('history', (messages: IRCMessageData[]) => {
      logger.info('WS-IRC-EVENT', {
        socketId: socket.id,
        event: 'history',
        count: messages.length,
      });
      socket.emit('irc:history', messages);
    });

    ircClient.on('members', (data: IRCMembers) => {
      logger.debug('WS-IRC-EVENT', {
        socketId: socket.id,
        event: 'members',
        channel: data.channel,
        count: data.members.length,
      });
      socket.emit('irc:members', data);
    });

    ircClient.on('presence', (data: IRCPresence) => {
      logger.debug('WS-IRC-EVENT', {
        socketId: socket.id,
        event: 'presence',
        nick: data.nick,
        status: data.status,
      });
      socket.emit('irc:presence', data);
    });

    ircClient.on('error', (error: Error) => {
      logger.error('WS-IRC-EVENT', {
        socketId: socket.id,
        event: 'error',
        error: error.message,
        stack: error.stack,
      });
      socket.emit('irc:error', { error: error.message });
    });

    ircClient.on('close', () => {
      logger.info('WS-IRC-EVENT', {
        socketId: socket.id,
        event: 'close',
      });
      socket.emit('irc:close');
    });

    ircClient.on('reconnecting', (event: ReconnectEvent) => {
      logger.info('WS-IRC-EVENT', {
        socketId: socket.id,
        event: 'reconnecting',
        attempt: event.attempt,
        delay: event.delay,
      });
      socket.emit('irc:reconnecting', event);
    });

    ircClient.on('reconnect_failed', () => {
      logger.error('WS-IRC-EVENT', {
        socketId: socket.id,
        event: 'reconnect_failed',
      });
      socket.emit('irc:reconnect_failed');
    });
  }
}
