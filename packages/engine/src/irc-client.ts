import { EventEmitter } from 'events';
import { logger } from '@ironcord/shared/logger';
import type { IRCConfig, ReconnectOptions, IRCMessage, IRCMessageData } from './types.js';
import { SocketWrapper } from './connection/socket.js';
import { ReconnectHandler } from './connection/reconnect.js';
import { SASLHandler } from './capabilities/sasl.js';
import { BatchHandler } from './capabilities/batch.js';
import { formatChatHistoryLatest } from './capabilities/chathistory.js';
import { formatNick, formatUser, formatJoin, formatPart, formatPrivmsg, formatAway, formatTyping, formatReaction } from './protocol/formatter.js';
import { MessageHandlers } from './protocol/handlers.js';

export class IRCClient extends EventEmitter {
  private config: IRCConfig;
  private socket: SocketWrapper;
  private reconnectHandler: ReconnectHandler;
  private saslHandler: SASLHandler;
  private batchHandler: BatchHandler;
  private messageHandlers: MessageHandlers;
  private isRegistered: boolean = false;

  constructor(config: IRCConfig, reconnectOptions?: Partial<ReconnectOptions>) {
    super();
    this.config = config;
    this.socket = new SocketWrapper(config.host, config.port);
    this.reconnectHandler = new ReconnectHandler(reconnectOptions);
    this.saslHandler = new SASLHandler(config.nick, config.password, config.email);
    this.batchHandler = new BatchHandler();
    this.messageHandlers = new MessageHandlers(
      this,
      (data: string) => this.send(data),
      this.saslHandler,
      this.batchHandler,
      { nick: config.nick, password: config.password }
    );

    this.setupSocketHandlers();
    this.setupReconnectHandlers();
    this.setupSASLHandlers();
    this.setupBatchHandlers();
  }

  private setupSocketHandlers(): void {
    this.socket.on('connected', () => {
      logger.info('IRC-TCP', {
        event: 'connected',
        host: this.config.host,
        port: this.config.port,
      });

      this.reconnectHandler.reset();
      this.send('CAP LS 302');
      this.send(formatNick(this.config.nick));
      const username = this.config.username || this.config.nick;
      const realname = this.config.realname || this.config.nick;
      this.send(formatUser(username, realname));
    });

    this.socket.on('message', (message: IRCMessage) => {
      this.handleMessage(message);
    });

    this.socket.on('error', (err: Error) => {
      logger.error('IRC-TCP', {
        event: 'error',
        message: err.message,
        stack: err.stack,
      });
      this.emit('error', err);
    });

    this.socket.on('close', (hadError: boolean) => {
      logger.info('IRC-TCP', {
        event: 'closed',
        hadError,
        host: this.config.host,
        port: this.config.port,
      });
      this.emit('close');
      this.isRegistered = false;
      this.reconnectHandler.handleClose(hadError);
    });
  }

  private setupReconnectHandlers(): void {
    this.reconnectHandler.on('reconnect', () => {
      this.connect();
    });

    this.reconnectHandler.on('reconnecting', (event) => {
      this.emit('reconnecting', event);
    });

    this.reconnectHandler.on('reconnect_failed', () => {
      this.emit('reconnect_failed');
    });
  }

  private setupSASLHandlers(): void {
    this.saslHandler.on('send', (data: string) => {
      this.send(data);
    });

    this.saslHandler.on('success', () => {
      logger.info('IRC-SASL', { event: 'success' });
    });

    this.saslHandler.on('failure', (error: Error) => {
      logger.error('IRC-SASL', { event: 'failed', error: error.message });
      this.emit('error', error);
    });

    this.saslHandler.on('registered', () => {
      logger.info('IRC-SASL', { event: 'registered_or_logged_in' });
      this.isRegistered = true;
    });
  }

  private setupBatchHandlers(): void {
    this.batchHandler.on('history', (messages: IRCMessageData[]) => {
      this.emit('history', messages);
    });
  }

  private send(data: string): void {
    logger.debug('IRC-SEND', { data });
    this.socket.send(data);
  }

  private handleMessage(message: IRCMessage): void {
    logger.debug('IRC-RECV', { line: message.raw });

    if (message.command === '001') {
      this.isRegistered = true;
    }

    this.messageHandlers.handleMessage(message);
  }

  public connect(): void {
    this.isRegistered = false;
    logger.info('IRC-CONNECT', {
      host: this.config.host,
      port: this.config.port,
      nick: this.config.nick,
      username: this.config.username,
      realname: this.config.realname,
      hasPassword: !!this.config.password,
    });
    this.socket.connect();
  }

  public join(channel: string): void {
    this.send(formatJoin(channel));
  }

  public part(channel: string): void {
    this.send(formatPart(channel));
  }

  public privmsg(target: string, message: string): void {
    this.send(formatPrivmsg(target, message));
  }

  public typing(target: string, status: 'active' | 'paused' | 'done'): void {
    if (this.socket.isConnected()) {
      this.send(formatTyping(target, status));
    }
  }

  public react(target: string, msgId: string, reaction: string): void {
    if (this.socket.isConnected()) {
      this.send(formatReaction(target, msgId, reaction));
    }
  }

  public fetchHistory(channel: string, limit: number = 50): void {
    this.send(formatChatHistoryLatest(channel, limit));
  }

  public setPresence(status: 'online' | 'idle' | 'dnd' | 'invisible'): void {
    if (this.socket.isConnected()) {
      if (status === 'online') {
        this.send(formatAway());
      } else if (status === 'idle') {
        this.send(formatAway('Idle'));
      } else if (status === 'dnd') {
        this.send(formatAway('Do Not Disturb'));
      } else if (status === 'invisible') {
        this.send(formatAway('Invisible'));
      }
    }
  }

  public ready(): boolean {
    return this.isRegistered;
  }

  public disconnect(): void {
    this.reconnectHandler.markIntentional();
    this.socket.disconnect();
  }
}
