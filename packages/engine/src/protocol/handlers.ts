import { EventEmitter } from 'events';
import { logger } from '@ironcord/shared/logger';
import type { IRCMessage, IRCMembers, IRCPresence, IRCTyping } from '../types.js';
import { extractNickFromPrefix } from './parser.js';
import { extractMessageData, getBatchTag } from './tags.js';
import { formatPong, formatCapabilityRequest, formatCapabilityEnd } from './formatter.js';
import type { SASLHandler } from '../capabilities/sasl.js';
import type { BatchHandler } from '../capabilities/batch.js';

export class MessageHandlers {
  private channelMembers: Map<string, Set<string>> = new Map();

  constructor(
    private emitter: EventEmitter,
    private sender: (data: string) => void,
    private saslHandler: SASLHandler,
    private batchHandler: BatchHandler,
    private config: { nick: string; password?: string }
  ) { }

  public handleMessage(message: IRCMessage): void {
    switch (message.command) {
      case 'PING':
        this.handlePing(message);
        break;
      case 'ERROR':
        this.handleError(message);
        break;
      case 'CAP':
        this.handleCapability(message);
        break;
      case 'AUTHENTICATE':
        this.saslHandler.handleAuthenticate(message);
        break;
      case '001':
        this.handleWelcome();
        break;
      case '353':
        this.handleNameReply(message);
        break;
      case 'JOIN':
        this.handleJoin(message);
        break;
      case 'PART':
        this.handlePart(message);
        break;
      case 'QUIT':
        this.handleQuit(message);
        break;
      case 'KICK':
        this.handleKick(message);
        break;
      case 'NICK':
        this.handleNickChange(message);
        break;
      case 'AWAY':
        this.handleAway(message);
        break;
      case 'BATCH':
        this.batchHandler.handleBatch(message);
        break;
      case 'PRIVMSG':
        this.handlePrivmsg(message);
        break;
      case 'TAGMSG':
        this.handleTagMsg(message);
        break;
      default:
        if (/^\d{3}$/.test(message.command)) {
          this.handleNumeric(message);
        }
    }
  }

  private handlePing(message: IRCMessage): void {
    const server = message.params[0];
    if (server) {
      this.sender(formatPong(server));
    }
  }

  private handleError(message: IRCMessage): void {
    const errorMsg = message.params.join(' ');
    logger.error('IRC-PROTO', {
      event: 'ERROR',
      message: errorMsg || message.raw,
    });
    this.emitter.emit('error', new Error(errorMsg || 'IRC ERROR from server'));
  }

  private handleCapability(message: IRCMessage): void {
    const subcommand = message.params[1];
    if (!subcommand) return;

    if (subcommand === 'LS') {
      const capsParam = message.params[message.params.length - 1];
      if (!capsParam) return;

      const caps = capsParam.split(' ');
      const availableCapNames = caps.map((c: string) => c.split('=')[0]);
      const requestedCaps = [];

      if (availableCapNames.includes('sasl') && this.config.password) requestedCaps.push('sasl');
      if (availableCapNames.includes('echo-message')) requestedCaps.push('echo-message');
      if (availableCapNames.includes('server-time')) requestedCaps.push('server-time');
      if (availableCapNames.includes('message-tags')) requestedCaps.push('message-tags');
      if (availableCapNames.includes('batch')) requestedCaps.push('batch');
      if (availableCapNames.includes('account-tag')) requestedCaps.push('account-tag');
      if (availableCapNames.includes('away-notify')) requestedCaps.push('away-notify');

      if (availableCapNames.includes('draft/chathistory') || availableCapNames.includes('chathistory')) {
        requestedCaps.push(availableCapNames.includes('draft/chathistory') ? 'draft/chathistory' : 'chathistory');
      }

      if (requestedCaps.length > 0) {
        this.sender(formatCapabilityRequest(requestedCaps));
      } else if (message.params[1] !== '*' && message.params[2] !== '*') {
        this.sender(formatCapabilityEnd());
      }
    } else if (subcommand === 'ACK') {
      const ackedCapsParam = message.params[message.params.length - 1];
      if (!ackedCapsParam) return;

      const ackedCaps = ackedCapsParam.split(' ');
      this.saslHandler.handleCapabilityAck(ackedCaps);
    }
  }

  private handleWelcome(): void {
    logger.info('IRC-STATE', { event: 'welcome' });
    this.emitter.emit('registered');
  }

  private handleNumeric(message: IRCMessage): void {
    this.saslHandler.handleNumeric(message);

    if (message.command.startsWith('4') || message.command.startsWith('5')) {
      logger.error('IRC-PROTO', {
        event: 'numeric_error',
        code: message.command,
        line: message.raw,
      });
    }
  }

  private handleNameReply(message: IRCMessage): void {
    const channel = message.params[2];
    const namesParam = message.params[message.params.length - 1];
    if (!channel || !namesParam) return;

    const names = namesParam.split(' ');

    if (!this.channelMembers.has(channel)) {
      this.channelMembers.set(channel, new Set());
    }

    const memberSet = this.channelMembers.get(channel)!;
    for (const name of names) {
      const cleanName = name.replace(/^[@+~&%]/, '');
      if (cleanName) memberSet.add(cleanName);
    }

    this.emitter.emit('members', { channel, members: Array.from(memberSet) } as IRCMembers);
  }

  private handleJoin(message: IRCMessage): void {
    const channel = message.params[0];
    if (!channel) return;

    const nick = extractNickFromPrefix(message.prefix);

    if (!this.channelMembers.has(channel)) {
      this.channelMembers.set(channel, new Set());
    }

    this.channelMembers.get(channel)!.add(nick);
    this.emitter.emit('members', { channel, members: Array.from(this.channelMembers.get(channel)!) } as IRCMembers);
  }

  private handlePart(message: IRCMessage): void {
    const channel = message.params[0];
    if (!channel) return;

    const nick = extractNickFromPrefix(message.prefix);

    const memberSet = this.channelMembers.get(channel);
    if (memberSet) {
      memberSet.delete(nick);
      this.emitter.emit('members', { channel, members: Array.from(memberSet) } as IRCMembers);
    }
  }

  private handleQuit(message: IRCMessage): void {
    const nick = extractNickFromPrefix(message.prefix);

    for (const [channel, memberSet] of this.channelMembers.entries()) {
      if (memberSet.has(nick)) {
        memberSet.delete(nick);
        this.emitter.emit('members', { channel, members: Array.from(memberSet) } as IRCMembers);
      }
    }
  }

  private handleKick(message: IRCMessage): void {
    const channel = message.params[0];
    const kickedNick = message.params[1];
    if (!channel || !kickedNick) return;

    const memberSet = this.channelMembers.get(channel);
    if (memberSet) {
      memberSet.delete(kickedNick);
      this.emitter.emit('members', { channel, members: Array.from(memberSet) } as IRCMembers);
    }
  }

  private handleNickChange(message: IRCMessage): void {
    const oldNick = extractNickFromPrefix(message.prefix);
    const newNick = message.params[0];
    if (!newNick) return;

    for (const [channel, memberSet] of this.channelMembers.entries()) {
      if (memberSet.has(oldNick)) {
        memberSet.delete(oldNick);
        memberSet.add(newNick);
        this.emitter.emit('members', { channel, members: Array.from(memberSet) } as IRCMembers);
      }
    }
  }

  private handleAway(message: IRCMessage): void {
    const nick = extractNickFromPrefix(message.prefix);
    const awayMessage = message.params[0] || '';
    const status = awayMessage ? 'away' : 'online';

    this.emitter.emit('presence', {
      nick,
      status,
      message: awayMessage
    } as IRCPresence);
  }

  private handlePrivmsg(message: IRCMessage): void {
    const channel = message.params[0];
    if (!channel) return;

    const contentParts = message.params.slice(1).join(' ');
    const content = contentParts.startsWith(':') ? contentParts.substring(1) : contentParts;

    const msgData = extractMessageData(message.tags, message.prefix, channel, content);

    const batchTag = getBatchTag(message.tags);
    if (batchTag && this.batchHandler.hasBatch(batchTag)) {
      this.batchHandler.addMessage(batchTag, msgData);
    } else {
      this.emitter.emit('message', msgData);
    }
  }

  private handleTagMsg(message: IRCMessage): void {
    const target = message.params[0];
    if (!target) return;

    const typingTag = message.tags['+typing'];
    if (typingTag) {
      const nick = extractNickFromPrefix(message.prefix);
      this.emitter.emit('typing', {
        nick,
        target,
        status: typingTag as 'active' | 'paused' | 'done'
      } as IRCTyping);
    }
  }
}
