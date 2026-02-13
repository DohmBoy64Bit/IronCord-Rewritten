import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { MessageHandlers } from './handlers.js';
import { SASLHandler } from '../capabilities/sasl.js';
import { BatchHandler } from '../capabilities/batch.js';
import type { IRCMessage, IRCMembers, IRCPresence, IRCMessageData } from '../types.js';

describe('MessageHandlers', () => {
  let emitter: EventEmitter;
  let sender: ReturnType<typeof vi.fn>;
  let saslHandler: SASLHandler;
  let batchHandler: BatchHandler;
  let handlers: MessageHandlers;

  beforeEach(() => {
    emitter = new EventEmitter();
    sender = vi.fn();
    saslHandler = new SASLHandler('testnick', 'testpass');
    batchHandler = new BatchHandler();
    handlers = new MessageHandlers(emitter, sender, saslHandler, batchHandler, {
      nick: 'testnick',
      password: 'testpass',
    });
  });

  describe('handlePing', () => {
    it('should respond to PING with PONG', () => {
      const message: IRCMessage = {
        command: 'PING',
        params: ['server1.example.com'],
        tags: {},
        raw: 'PING server1.example.com',
      };

      handlers.handleMessage(message);
      expect(sender).toHaveBeenCalledWith('PONG :server1.example.com');
    });

    it('should handle PING with colon prefix', () => {
      const message: IRCMessage = {
        command: 'PING',
        params: [':1234567890'],
        tags: {},
        raw: 'PING :1234567890',
      };

      handlers.handleMessage(message);
      expect(sender).toHaveBeenCalledWith('PONG ::1234567890');
    });
  });

  describe('handleError', () => {
    it('should emit error event', async () => {
      const errorPromise = new Promise<Error>((resolve) => {
        emitter.once('error', resolve);
      });

      const message: IRCMessage = {
        command: 'ERROR',
        params: ['Closing Link: Connection timeout'],
        tags: {},
        raw: 'ERROR :Closing Link: Connection timeout',
      };

      handlers.handleMessage(message);

      const error = await errorPromise;
      expect(error.message).toContain('Closing Link');
    });
  });

  describe('handleWelcome', () => {
    it('should emit registered event on 001', async () => {
      const registeredPromise = new Promise<void>((resolve) => {
        emitter.once('registered', resolve);
      });

      const message: IRCMessage = {
        command: '001',
        params: ['testnick', 'Welcome to the IRC Network'],
        tags: {},
        raw: ':server 001 testnick :Welcome to the IRC Network',
      };

      handlers.handleMessage(message);
      await registeredPromise;
    });
  });

  describe('handleCapability', () => {
    it('should request capabilities on CAP LS', () => {
      const message: IRCMessage = {
        command: 'CAP',
        params: ['*', 'LS', 'sasl echo-message server-time batch'],
        tags: {},
        raw: 'CAP * LS :sasl echo-message server-time batch',
      };

      handlers.handleMessage(message);
      expect(sender).toHaveBeenCalledWith(expect.stringContaining('CAP REQ'));
    });

    it('should handle CAP ACK', () => {
      const message: IRCMessage = {
        command: 'CAP',
        params: ['testnick', 'ACK', 'sasl server-time'],
        tags: {},
        raw: 'CAP testnick ACK :sasl server-time',
      };

      handlers.handleMessage(message);
    });
  });

  describe('handleNameReply', () => {
    it('should emit members event with channel users', async () => {
      const membersPromise = new Promise<IRCMembers>((resolve) => {
        emitter.once('members', resolve);
      });

      const message: IRCMessage = {
        command: '353',
        params: ['testnick', '=', '#test-channel', '@alice +bob charlie'],
        tags: {},
        raw: ':server 353 testnick = #test-channel :@alice +bob charlie',
      };

      handlers.handleMessage(message);

      const members = await membersPromise;
      expect(members.channel).toBe('#test-channel');
      expect(members.members).toContain('alice');
      expect(members.members).toContain('bob');
      expect(members.members).toContain('charlie');
    });

    it('should strip user mode prefixes', async () => {
      const membersPromise = new Promise<IRCMembers>((resolve) => {
        emitter.once('members', resolve);
      });

      const message: IRCMessage = {
        command: '353',
        params: ['testnick', '=', '#ops', '@operator ~owner %halfop +voice regular'],
        tags: {},
        raw: ':server 353 testnick = #ops :@operator ~owner %halfop +voice regular',
      };

      handlers.handleMessage(message);

      const members = await membersPromise;
      expect(members.members).toContain('operator');
      expect(members.members).toContain('owner');
      expect(members.members).toContain('halfop');
      expect(members.members).toContain('voice');
      expect(members.members).toContain('regular');
    });
  });

  describe('handleJoin', () => {
    it('should add user to channel members', async () => {
      const membersPromise = new Promise<IRCMembers>((resolve) => {
        emitter.once('members', resolve);
      });

      const message: IRCMessage = {
        command: 'JOIN',
        params: ['#new-channel'],
        prefix: 'alice!alice@host.com',
        tags: {},
        raw: ':alice!alice@host.com JOIN #new-channel',
      };

      handlers.handleMessage(message);

      const members = await membersPromise;
      expect(members.channel).toBe('#new-channel');
      expect(members.members).toContain('alice');
    });
  });

  describe('handlePart', () => {
    it('should remove user from channel members', async () => {
      const membersUpdates: IRCMembers[] = [];
      emitter.on('members', (members) => membersUpdates.push(members));

      const joinMsg: IRCMessage = {
        command: 'JOIN',
        params: ['#test'],
        prefix: 'bob!bob@host.com',
        tags: {},
        raw: ':bob!bob@host.com JOIN #test',
      };

      handlers.handleMessage(joinMsg);

      const partMsg: IRCMessage = {
        command: 'PART',
        params: ['#test'],
        prefix: 'bob!bob@host.com',
        tags: {},
        raw: ':bob!bob@host.com PART #test',
      };

      handlers.handleMessage(partMsg);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(membersUpdates.length).toBeGreaterThanOrEqual(2);
      const afterPart = membersUpdates[membersUpdates.length - 1];
      expect(afterPart.members).not.toContain('bob');
    });
  });

  describe('handleQuit', () => {
    it('should remove user from all channels', async () => {
      const membersUpdates: IRCMembers[] = [];
      emitter.on('members', (members) => membersUpdates.push(members));

      const join1: IRCMessage = {
        command: 'JOIN',
        params: ['#channel1'],
        prefix: 'charlie!charlie@host.com',
        tags: {},
        raw: ':charlie!charlie@host.com JOIN #channel1',
      };

      const join2: IRCMessage = {
        command: 'JOIN',
        params: ['#channel2'],
        prefix: 'charlie!charlie@host.com',
        tags: {},
        raw: ':charlie!charlie@host.com JOIN #channel2',
      };

      handlers.handleMessage(join1);
      handlers.handleMessage(join2);

      const quitMsg: IRCMessage = {
        command: 'QUIT',
        params: ['Leaving'],
        prefix: 'charlie!charlie@host.com',
        tags: {},
        raw: ':charlie!charlie@host.com QUIT :Leaving',
      };

      handlers.handleMessage(quitMsg);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const quitUpdates = membersUpdates.slice(2);
      expect(quitUpdates.length).toBeGreaterThan(0);
      expect(quitUpdates.every((u) => !u.members.includes('charlie'))).toBe(true);
    });
  });

  describe('handleKick', () => {
    it('should remove kicked user from channel', async () => {
      const membersUpdates: IRCMembers[] = [];
      emitter.on('members', (members) => membersUpdates.push(members));

      const joinMsg: IRCMessage = {
        command: 'JOIN',
        params: ['#moderated'],
        prefix: 'troublemaker!trouble@host.com',
        tags: {},
        raw: ':troublemaker!trouble@host.com JOIN #moderated',
      };

      handlers.handleMessage(joinMsg);

      const kickMsg: IRCMessage = {
        command: 'KICK',
        params: ['#moderated', 'troublemaker', 'Spamming'],
        prefix: 'operator!op@host.com',
        tags: {},
        raw: ':operator!op@host.com KICK #moderated troublemaker :Spamming',
      };

      handlers.handleMessage(kickMsg);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(membersUpdates.length).toBeGreaterThanOrEqual(2);
      const afterKick = membersUpdates[membersUpdates.length - 1];
      expect(afterKick.members).not.toContain('troublemaker');
    });
  });

  describe('handleNickChange', () => {
    it('should update nick in all channels', async () => {
      const membersUpdates: IRCMembers[] = [];
      emitter.on('members', (members) => membersUpdates.push(members));

      const joinMsg: IRCMessage = {
        command: 'JOIN',
        params: ['#chat'],
        prefix: 'oldnick!user@host.com',
        tags: {},
        raw: ':oldnick!user@host.com JOIN #chat',
      };

      handlers.handleMessage(joinMsg);

      const nickMsg: IRCMessage = {
        command: 'NICK',
        params: ['newnick'],
        prefix: 'oldnick!user@host.com',
        tags: {},
        raw: ':oldnick!user@host.com NICK newnick',
      };

      handlers.handleMessage(nickMsg);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(membersUpdates.length).toBeGreaterThanOrEqual(2);
      const afterNick = membersUpdates[membersUpdates.length - 1];
      expect(afterNick.members).toContain('newnick');
      expect(afterNick.members).not.toContain('oldnick');
    });
  });

  describe('handleAway', () => {
    it('should emit presence with away status', async () => {
      const presencePromise = new Promise<IRCPresence>((resolve) => {
        emitter.once('presence', resolve);
      });

      const awayMsg: IRCMessage = {
        command: 'AWAY',
        params: ['Gone for lunch'],
        prefix: 'user!user@host.com',
        tags: {},
        raw: ':user!user@host.com AWAY :Gone for lunch',
      };

      handlers.handleMessage(awayMsg);

      const presence = await presencePromise;
      expect(presence.nick).toBe('user');
      expect(presence.status).toBe('away');
      expect(presence.message).toBe('Gone for lunch');
    });

    it('should emit presence with online status when no message', async () => {
      const presencePromise = new Promise<IRCPresence>((resolve) => {
        emitter.once('presence', resolve);
      });

      const backMsg: IRCMessage = {
        command: 'AWAY',
        params: [],
        prefix: 'user!user@host.com',
        tags: {},
        raw: ':user!user@host.com AWAY',
      };

      handlers.handleMessage(backMsg);

      const presence = await presencePromise;
      expect(presence.status).toBe('online');
    });
  });

  describe('handlePrivmsg', () => {
    it('should emit message event', async () => {
      const messagePromise = new Promise<IRCMessageData>((resolve) => {
        emitter.once('message', resolve);
      });

      const privmsg: IRCMessage = {
        command: 'PRIVMSG',
        params: ['#channel', 'Hello world'],
        prefix: 'sender!sender@host.com',
        tags: { msgid: 'msg123', time: '2024-01-01T00:00:00Z' },
        raw: '@msgid=msg123 :sender!sender@host.com PRIVMSG #channel :Hello world',
      };

      handlers.handleMessage(privmsg);

      const msgData = await messagePromise;
      expect(msgData.author).toBe('sender');
      expect(msgData.channel).toBe('#channel');
      expect(msgData.content).toBe('Hello world');
    });

    it('should add message to batch when batch tag present', () => {
      const batchStart: IRCMessage = {
        command: 'BATCH',
        params: ['+batch123', 'chathistory', '#test'],
        tags: {},
        raw: 'BATCH +batch123 chathistory #test',
      };

      handlers.handleMessage(batchStart);

      const privmsg: IRCMessage = {
        command: 'PRIVMSG',
        params: ['#test', 'Batched message'],
        prefix: 'user!user@host.com',
        tags: { batch: 'batch123', msgid: 'msg456' },
        raw: '@batch=batch123 :user!user@host.com PRIVMSG #test :Batched message',
      };

      handlers.handleMessage(privmsg);

      expect(batchHandler.hasBatch('batch123')).toBe(true);
    });
  });

  describe('handleNumeric', () => {
    it('should log error numerics starting with 4', () => {
      const errorMsg: IRCMessage = {
        command: '401',
        params: ['testnick', 'nonexistent', 'No such nick/channel'],
        tags: {},
        raw: ':server 401 testnick nonexistent :No such nick/channel',
      };

      handlers.handleMessage(errorMsg);
    });

    it('should log error numerics starting with 5', () => {
      const errorMsg: IRCMessage = {
        command: '502',
        params: ['testnick', "Can't change mode"],
        tags: {},
        raw: ":server 502 testnick :Can't change mode",
      };

      handlers.handleMessage(errorMsg);
    });
  });
});
