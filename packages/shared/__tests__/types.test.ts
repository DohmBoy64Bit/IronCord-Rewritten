import { describe, it, expect } from 'vitest';
import type {
  User,
  AuthCredentials,
  UserPresence,
  Guild,
  CreateGuildRequest,
  Channel,
  CreateChannelRequest,
  Message,
  MessageTags,
  HistoryRequest,
} from '../src/types';

describe('types', () => {
  describe('User types', () => {
    it('should create valid User object', () => {
      const user: User = {
        id: '123',
        email: 'test@example.com',
        irc_nick: 'testuser',
        created_at: new Date().toISOString(),
      };
      expect(user).toBeDefined();
      expect(user.id).toBe('123');
    });

    it('should create valid AuthCredentials object', () => {
      const creds: AuthCredentials = {
        email: 'test@example.com',
        password: 'password123',
      };
      expect(creds).toBeDefined();
    });

    it('should accept valid UserPresence values', () => {
      const statuses: UserPresence[] = ['online', 'idle', 'dnd', 'invisible'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('Guild types', () => {
    it('should create valid Guild object', () => {
      const guild: Guild = {
        id: '456',
        name: 'Test Guild',
        owner_id: '123',
        irc_namespace_prefix: '#testguild-',
        created_at: new Date().toISOString(),
      };
      expect(guild).toBeDefined();
      expect(guild.name).toBe('Test Guild');
    });

    it('should create valid CreateGuildRequest object', () => {
      const request: CreateGuildRequest = {
        name: 'New Guild',
      };
      expect(request).toBeDefined();
    });
  });

  describe('Channel types', () => {
    it('should create valid Channel object', () => {
      const channel: Channel = {
        id: '789',
        guild_id: '456',
        name: 'general',
        irc_channel_name: '#testguild-general',
        created_at: new Date().toISOString(),
      };
      expect(channel).toBeDefined();
      expect(channel.name).toBe('general');
    });

    it('should create valid CreateChannelRequest object', () => {
      const request: CreateChannelRequest = {
        name: 'new-channel',
        topic: 'Channel topic',
      };
      expect(request).toBeDefined();
    });
  });

  describe('Message types', () => {
    it('should create valid Message object', () => {
      const message: Message = {
        id: 'msg-123',
        author: 'testuser',
        channel: '#testguild-general',
        content: 'Hello world',
      };
      expect(message).toBeDefined();
      expect(message.content).toBe('Hello world');
    });

    it('should create valid MessageTags object', () => {
      const tags: MessageTags = {
        msgid: 'msg-123',
        account: 'testuser',
        time: '2024-01-15T10:30:00.000Z',
      };
      expect(tags).toBeDefined();
    });

    it('should create valid HistoryRequest object', () => {
      const request: HistoryRequest = {
        channel: '#testguild-general',
        limit: 50,
      };
      expect(request).toBeDefined();
    });
  });
});
