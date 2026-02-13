import { describe, it, expect, beforeEach } from 'vitest';
import { SASLHandler } from './sasl.js';
import type { IRCMessage } from '../types.js';

describe('SASLHandler Integration', () => {
  let handler: SASLHandler;
  const testNick = 'testuser';
  const testPassword = 'testpass123';

  beforeEach(() => {
    handler = new SASLHandler(testNick, testPassword);
  });

  it('should emit send event on CAP ACK with sasl', () => {
    const sendEvents: string[] = [];
    handler.on('send', (data: string) => sendEvents.push(data));

    handler.handleCapabilityAck(['sasl']);

    expect(sendEvents).toHaveLength(1);
    expect(sendEvents[0]).toBe('AUTHENTICATE PLAIN');
  });

  it('should emit CAP END when no password and CAP ACK received', () => {
    const noPasswordHandler = new SASLHandler(testNick, undefined);
    const sendEvents: string[] = [];
    noPasswordHandler.on('send', (data: string) => sendEvents.push(data));

    noPasswordHandler.handleCapabilityAck(['sasl']);

    expect(sendEvents).toHaveLength(1);
    expect(sendEvents[0]).toBe('CAP END');
  });

  it('should emit CAP END when sasl not in acked capabilities', () => {
    const sendEvents: string[] = [];
    handler.on('send', (data: string) => sendEvents.push(data));

    handler.handleCapabilityAck(['multi-prefix', 'userhost-in-names']);

    expect(sendEvents).toHaveLength(1);
    expect(sendEvents[0]).toBe('CAP END');
  });

  it('should send AUTHENTICATE response on + challenge', () => {
    const sendEvents: string[] = [];
    handler.on('send', (data: string) => sendEvents.push(data));

    const message: IRCMessage = {
      command: 'AUTHENTICATE',
      params: ['+'],
      tags: {},
      raw: 'AUTHENTICATE +',
    };

    handler.handleAuthenticate(message);

    expect(sendEvents).toHaveLength(1);
    expect(sendEvents[0]).toContain('AUTHENTICATE');
    expect(sendEvents[0]).not.toBe('AUTHENTICATE PLAIN');
  });

  it('should handle missing password on AUTHENTICATE challenge', () => {
    const noPasswordHandler = new SASLHandler(testNick, undefined);
    const sendEvents: string[] = [];
    noPasswordHandler.on('send', (data: string) => sendEvents.push(data));

    const message: IRCMessage = {
      command: 'AUTHENTICATE',
      params: ['+'],
      tags: {},
      raw: 'AUTHENTICATE +',
    };

    noPasswordHandler.handleAuthenticate(message);

    expect(sendEvents).toHaveLength(1);
    expect(sendEvents[0]).toBe('CAP END');
  });

  it('should handle 903 SASL success', () => {
    const sendEvents: string[] = [];
    const successEvents: string[] = [];

    handler.on('send', (data: string) => sendEvents.push(data));
    handler.on('success', () => successEvents.push('success'));

    const message: IRCMessage = {
      command: '903',
      params: [testNick, 'SASL authentication successful'],
      tags: {},
      raw: ':server 903 testuser :SASL authentication successful',
    };

    handler.handleNumeric(message);

    expect(successEvents).toHaveLength(1);
    expect(sendEvents).toContain('CAP END');
  });

  it('should handle 904 SASL failure', () => {
    const failureEvents: Error[] = [];
    handler.on('failure', (err: Error) => failureEvents.push(err));

    const message: IRCMessage = {
      command: '904',
      params: [testNick, 'SASL authentication failed'],
      tags: {},
      raw: ':server 904 testuser :SASL authentication failed',
    };

    handler.handleNumeric(message);

    expect(failureEvents).toHaveLength(1);
    expect(failureEvents[0].message).toContain('SASL Authentication Failed');
  });

  it('should attempt registration on account does not exist error', () => {
    const sendEvents: string[] = [];
    handler.on('send', (data: string) => sendEvents.push(data));

    const message: IRCMessage = {
      command: '904',
      params: [testNick, 'Account does not exist'],
      tags: {},
      raw: ':server 904 testuser :Account does not exist',
    };

    handler.handleNumeric(message);

    expect(sendEvents).toHaveLength(1);
    expect(sendEvents[0]).toContain('REGISTER');
  });

  it('should handle 900 account registration success', () => {
    const sendEvents: string[] = [];
    const registeredEvents: string[] = [];

    handler.on('send', (data: string) => sendEvents.push(data));
    handler.on('registered', () => registeredEvents.push('registered'));

    const message: IRCMessage = {
      command: '900',
      params: [testNick, 'You are now logged in'],
      tags: {},
      raw: ':server 900 testuser :You are now logged in',
    };

    handler.handleNumeric(message);

    expect(registeredEvents).toHaveLength(1);
    expect(sendEvents).toContain('CAP END');
  });

  it('should handle 907 already registered', () => {
    const sendEvents: string[] = [];
    handler.on('send', (data: string) => sendEvents.push(data));

    const message: IRCMessage = {
      command: '907',
      params: [testNick, 'You have already authenticated'],
      tags: {},
      raw: ':server 907 testuser :You have already authenticated',
    };

    handler.handleNumeric(message);

    expect(sendEvents).toContain('CAP END');
  });

  it('should handle account registration completion message', () => {
    const sendEvents: string[] = [];
    const registeredEvents: string[] = [];

    handler.on('send', (data: string) => sendEvents.push(data));
    handler.on('registered', () => registeredEvents.push('registered'));

    const message: IRCMessage = {
      command: 'NOTICE',
      params: [testNick, 'Account successfully registered'],
      tags: {},
      raw: ':NickServ NOTICE testuser :Account successfully registered',
    };

    handler.handleNumeric(message);

    expect(registeredEvents).toHaveLength(1);
    expect(sendEvents).toContain('CAP END');
  });

  it('should handle 905 SASL failure (alternate error code)', () => {
    const failureEvents: Error[] = [];
    handler.on('failure', (err: Error) => failureEvents.push(err));

    const message: IRCMessage = {
      command: '905',
      params: [testNick, 'SASL authentication failed'],
      tags: {},
      raw: ':server 905 testuser :SASL authentication failed',
    };

    handler.handleNumeric(message);

    expect(failureEvents).toHaveLength(1);
  });
});
