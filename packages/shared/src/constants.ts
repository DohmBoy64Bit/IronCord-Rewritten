export const DEFAULT_IRC_PORT = 6667;
export const DEFAULT_GATEWAY_PORT = 3000;
export const DEFAULT_DB_PORT = 5432;

export const JWT_EXPIRES_IN = '24h';
export const BCRYPT_ROUNDS = 10;

export const MAX_NICKNAME_LENGTH = 32;
export const MAX_GUILD_NAME_LENGTH = 100;
export const MAX_CHANNEL_NAME_LENGTH = 100;
export const MIN_PASSWORD_LENGTH = 6;

export const DEFAULT_HISTORY_LIMIT = 50;
export const MAX_HISTORY_LIMIT = 1000;

export const PRESENCE_STATUSES = ['online', 'idle', 'dnd', 'invisible'] as const;
export const IRC_PRESENCE_STATUSES = ['online', 'away'] as const;
