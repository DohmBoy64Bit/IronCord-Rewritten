import { describe, it, expect } from 'vitest';
import { parseIRCMessage, extractNickFromPrefix } from './parser.js';

describe('parseIRCMessage', () => {
  it('should parse a simple PING message', () => {
    const result = parseIRCMessage('PING :server.example.com');

    expect(result.command).toBe('PING');
    expect(result.params).toEqual(['server.example.com']);
    expect(result.prefix).toBeNull();
    expect(result.tags).toEqual({});
  });

  it('should parse PRIVMSG with prefix', () => {
    const result = parseIRCMessage(':alice!user@host PRIVMSG #channel :Hello World');

    expect(result.command).toBe('PRIVMSG');
    expect(result.prefix).toBe('alice!user@host');
    expect(result.params).toEqual(['#channel', 'Hello World']);
  });

  it('should parse message with IRCv3 tags', () => {
    const result = parseIRCMessage('@msgid=abc123;time=2024-01-01T00:00:00.000Z :alice!user@host PRIVMSG #channel :Hi');

    expect(result.tags).toEqual({
      msgid: 'abc123',
      time: '2024-01-01T00:00:00.000Z',
    });
    expect(result.command).toBe('PRIVMSG');
    expect(result.prefix).toBe('alice!user@host');
    expect(result.params).toEqual(['#channel', 'Hi']);
  });

  it('should parse CAP LS response', () => {
    const result = parseIRCMessage(':server CAP * LS :sasl echo-message server-time');

    expect(result.command).toBe('CAP');
    expect(result.params).toEqual(['*', 'LS', 'sasl echo-message server-time']);
  });

  it('should parse numeric responses', () => {
    const result = parseIRCMessage(':server 001 TestUser :Welcome to the network');

    expect(result.command).toBe('001');
    expect(result.params).toEqual(['TestUser', 'Welcome to the network']);
  });

  it('should parse multiword trailing parameters', () => {
    const result = parseIRCMessage(':server 353 TestUser = #channel :alice bob charlie');

    expect(result.command).toBe('353');
    expect(result.params).toEqual(['TestUser', '=', '#channel', 'alice bob charlie']);
  });
});

describe('extractNickFromPrefix', () => {
  it('should extract nick from full prefix', () => {
    expect(extractNickFromPrefix('alice!user@host')).toBe('alice');
  });

  it('should return empty string for null prefix', () => {
    expect(extractNickFromPrefix(null)).toBe('');
  });

  it('should handle prefix without user/host', () => {
    expect(extractNickFromPrefix('alice')).toBe('alice');
  });
});
