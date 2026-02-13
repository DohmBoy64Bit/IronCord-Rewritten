import { describe, it, expect } from 'vitest';
import {
  DEFAULT_IRC_PORT,
  DEFAULT_GATEWAY_PORT,
  DEFAULT_DB_PORT,
  JWT_EXPIRES_IN,
  BCRYPT_ROUNDS,
  MAX_NICKNAME_LENGTH,
  MAX_GUILD_NAME_LENGTH,
  MAX_CHANNEL_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
  PRESENCE_STATUSES,
  IRC_PRESENCE_STATUSES,
} from '../src/constants';

describe('constants', () => {
  it('should export correct port values', () => {
    expect(DEFAULT_IRC_PORT).toBe(6667);
    expect(DEFAULT_GATEWAY_PORT).toBe(3000);
    expect(DEFAULT_DB_PORT).toBe(5432);
  });

  it('should export correct security values', () => {
    expect(JWT_EXPIRES_IN).toBe('24h');
    expect(BCRYPT_ROUNDS).toBe(10);
  });

  it('should export correct length constraints', () => {
    expect(MAX_NICKNAME_LENGTH).toBe(32);
    expect(MAX_GUILD_NAME_LENGTH).toBe(100);
    expect(MAX_CHANNEL_NAME_LENGTH).toBe(100);
    expect(MIN_PASSWORD_LENGTH).toBe(6);
  });

  it('should export correct history limits', () => {
    expect(DEFAULT_HISTORY_LIMIT).toBe(50);
    expect(MAX_HISTORY_LIMIT).toBe(1000);
  });

  it('should export correct presence status arrays', () => {
    expect(PRESENCE_STATUSES).toEqual(['online', 'idle', 'dnd', 'invisible']);
    expect(IRC_PRESENCE_STATUSES).toEqual(['online', 'away']);
  });
});
