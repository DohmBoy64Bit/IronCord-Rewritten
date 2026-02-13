import { User, Guild, Channel } from '@ironcord/shared';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  irc_nick: string;
  avatar_url: string | null;
  created_at: Date;
}

export interface CreateUserInput {
  email: string;
  password_hash: string;
  irc_nick: string;
  avatar_url?: string;
}

export interface GuildRow {
  id: string;
  name: string;
  owner_id: string | null;
  irc_namespace_prefix: string;
  created_at: Date;
}

export interface CreateGuildInput {
  name: string;
  owner_id: string;
  irc_namespace_prefix: string;
}

export interface ChannelRow {
  id: string;
  guild_id: string;
  name: string;
  irc_channel_name: string;
  topic: string | null;
  created_at: Date;
}

export interface CreateChannelInput {
  guild_id: string;
  name: string;
  irc_channel_name: string;
  topic?: string;
}

export interface GuildMemberRow {
  guild_id: string;
  user_id: string;
  joined_at: Date;
}

export interface CreateGuildMemberInput {
  guild_id: string;
  user_id: string;
}

export interface DatabaseConfig {
  user: string;
  host: string;
  database: string;
  password: string;
  port: number;
}

export function userRowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    irc_nick: row.irc_nick,
    avatar_url: row.avatar_url || undefined,
    created_at: row.created_at.toISOString(),
  };
}

export function guildRowToGuild(row: GuildRow): Guild {
  return {
    id: row.id,
    name: row.name,
    owner_id: row.owner_id || '',
    irc_namespace_prefix: row.irc_namespace_prefix,
    created_at: row.created_at.toISOString(),
  };
}

export function channelRowToChannel(row: ChannelRow): Channel {
  return {
    id: row.id,
    guild_id: row.guild_id,
    name: row.name,
    irc_channel_name: row.irc_channel_name,
    topic: row.topic || undefined,
    created_at: row.created_at.toISOString(),
  };
}
