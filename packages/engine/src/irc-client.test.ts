import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IRCClient } from './irc-client.js';
import type { IRCConfig } from './types.js';

const mockSocket = {
  on: vi.fn(),
  connect: vi.fn(),
  send: vi.fn(),
  disconnect: vi.fn(),
  isConnected: vi.fn(() => true),
};

vi.mock('./connection/socket.js', () => {
  return {
    SocketWrapper: vi.fn(() => mockSocket),
  };
});

describe('IRCClient', () => {
  let client: IRCClient;
  const config: IRCConfig = {
    host: 'localhost',
    port: 6667,
    nick: 'TestUser',
    username: 'testuser',
    realname: 'Test User',
    password: 'testpass',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockReturnValue(mockSocket);
    client = new IRCClient(config, { maxRetries: 0 });
  });

  describe('connect', () => {
    it('should create socket and setup handlers', () => {
      client.connect();

      expect(mockSocket.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should send initial IRC commands on connection', () => {
      client.connect();
      const connectedHandler = mockSocket.on.mock.calls.find(
        ([event]: [string]) => event === 'connected'
      )?.[1];

      connectedHandler?.();

      const sends = mockSocket.send.mock.calls.map(([data]: [string]) => data.trim());
      expect(sends).toContain('CAP LS 302');
      expect(sends).toContain('NICK TestUser');
      expect(sends).toContain('USER testuser 0 * :Test User');
    });
  });

  describe('public methods', () => {
    it('should send JOIN command', () => {
      client.connect();
      client.join('#test-channel');

      const sends = mockSocket.send.mock.calls.map(([data]: [string]) => data.trim());
      expect(sends).toContain('JOIN #test-channel');
    });

    it('should send PART command', () => {
      client.connect();
      client.part('#test-channel');

      const sends = mockSocket.send.mock.calls.map(([data]: [string]) => data.trim());
      expect(sends).toContain('PART #test-channel');
    });

    it('should send PRIVMSG command', () => {
      client.connect();
      client.privmsg('#test-channel', 'Hello!');

      const sends = mockSocket.send.mock.calls.map(([data]: [string]) => data.trim());
      expect(sends).toContain('PRIVMSG #test-channel :Hello!');
    });

    it('should send CHATHISTORY command', () => {
      client.connect();
      client.fetchHistory('#test-channel', 25);

      const sends = mockSocket.send.mock.calls.map(([data]: [string]) => data.trim());
      expect(sends).toContain('CHATHISTORY LATEST #test-channel * 25');
    });

    it('should send AWAY command for presence', () => {
      client.connect();
      client.setPresence('idle');

      const sends = mockSocket.send.mock.calls.map(([data]: [string]) => data.trim());
      expect(sends).toContain('AWAY :Idle');
    });
  });

  describe('ready', () => {
    it('should return false initially', () => {
      expect(client.ready()).toBe(false);
    });

    it('should return true after registration', () => {
      client.connect();
      const messageHandler = mockSocket.on.mock.calls.find(
        ([event]: [string]) => event === 'message'
      )?.[1];

      messageHandler?.({
        command: '001',
        params: ['TestUser', 'Welcome to the IRC network'],
        tags: {},
        prefix: 'server',
        raw: ':server 001 TestUser :Welcome to the IRC network',
      });

      expect(client.ready()).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect socket', () => {
      client.connect();
      client.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });
});
