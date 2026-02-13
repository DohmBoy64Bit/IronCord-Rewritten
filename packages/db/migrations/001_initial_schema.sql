-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    irc_nick VARCHAR(32) UNIQUE NOT NULL,
    avatar_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for IRC nick lookups (used frequently in IRC bridge)
CREATE INDEX IF NOT EXISTS idx_users_irc_nick ON users(irc_nick);

-- Guilds Table (Discord-like Servers)
CREATE TABLE IF NOT EXISTS guilds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    irc_namespace_prefix VARCHAR(32) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Channels Table
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    irc_channel_name VARCHAR(64) NOT NULL,
    topic TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, name)
);

-- Index for IRC channel name lookups (used for IRC -> Guild mapping)
CREATE INDEX IF NOT EXISTS idx_channels_irc_channel_name ON channels(irc_channel_name);

-- Guild Members (Join table)
CREATE TABLE IF NOT EXISTS guild_members (
    guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
);

-- Index for user guild lookups
CREATE INDEX IF NOT EXISTS idx_guild_members_user_id ON guild_members(user_id);
