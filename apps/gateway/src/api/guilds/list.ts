import { Request, Response, NextFunction } from 'express';
import { Guild, Channel } from '@ironcord/shared';
import { GuildRepository, ChannelRepository, MemberRepository } from '@ironcord/db';
import { logger } from '@ironcord/shared';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { gatewayEvents } from '../../events.js';

interface GuildWithChannels extends Guild {
  channels: Channel[];
}

interface ListGuildsResponse {
  success: boolean;
  guilds?: GuildWithChannels[];
  error?: string;
}

export async function listGuildsHandler(
  req: Request,
  res: Response<ListGuildsResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const guildRepo = new GuildRepository(req.app.locals.db);
    const channelRepo = new ChannelRepository(req.app.locals.db);

    const guilds = await guildRepo.findByUserId(userId);

    const guildsWithChannels = await Promise.all(
      guilds.map(async (guild) => {
        const channels = await channelRepo.findByGuildId(guild.id);
        return {
          ...guild,
          channels,
        };
      })
    );

    logger.info('GUILD-LIST', {
      userId,
      guildCount: guilds.length,
    });

    res.json({
      success: true,
      guilds: guildsWithChannels,
    });
  } catch (err) {
    logger.error('GUILD-LIST', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    next(err);
  }
}

interface UpdateGuildResponse {
  success: boolean;
  guild?: Guild;
  error?: string;
}

export async function updateGuildHandler(
  req: Request,
  res: Response<UpdateGuildResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;
    const guildId = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!guildId) {
      res.status(400).json({ success: false, error: 'Guild ID is required' });
      return;
    }

    const { name } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'Guild name is required' });
      return;
    }

    const guildRepo = new GuildRepository(req.app.locals.db);
    const guild = await guildRepo.findById(guildId);

    if (!guild) {
      res.status(404).json({ success: false, error: 'Guild not found' });
      return;
    }

    if (guild.owner_id !== userId) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const updatedGuild = await guildRepo.update(guildId, name);
    if (!updatedGuild) {
      res.status(500).json({ success: false, error: 'Failed to update guild' });
      return;
    }

    logger.info('GUILD-UPDATE', { userId, guildId, newName: name });
    res.json({ success: true, guild: updatedGuild });
  } catch (err) {
    logger.error('GUILD-UPDATE', { error: err instanceof Error ? err.message : 'Unknown error' });
    next(err);
  }
}

interface CreateGuildResponse {
  success: boolean;
  guild?: Guild;
  channelId?: string;
  error?: string;
}

export async function createGuildHandler(
  req: Request,
  res: Response<CreateGuildResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name, description, banner_url } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'Guild name is required' });
      return;
    }

    // Create a unique namespace prefix for IRC channels
    const namespacePrefix = name.toLowerCase().replace(/[^a-z0-t]/g, '').substring(0, 10) + '-' + Math.random().toString(36).substring(2, 10);

    const guildRepo = new GuildRepository(req.app.locals.db);
    const guild = await guildRepo.create({
      name,
      owner_id: userId,
      irc_namespace_prefix: namespacePrefix,
      description,
      banner_url,
    });

    // Automatically add owner as a member
    const memberRepo = new MemberRepository(req.app.locals.db);
    await memberRepo.add({ guild_id: guild.id as string, user_id: userId });

    // Create a default #general channel
    const channelRepo = new ChannelRepository(req.app.locals.db);
    const generalChannel = await channelRepo.create({
      guild_id: guild.id,
      name: 'general',
      irc_channel_name: `#${namespacePrefix}-general`,
      topic: `Welcome to ${name}!`,
    });

    // Provision the bot to the new channel
    gatewayEvents.emit('irc:provision-channel', {
      channel: generalChannel.irc_channel_name,
      ownerNick: authReq.user?.irc_nick || 'Owner'
    });

    // Also join the owner immediately
    gatewayEvents.emit('irc:immediate-join', {
      userId,
      channel: generalChannel.irc_channel_name
    });

    logger.info('GUILD-CREATE', { userId, guildId: guild.id, name });
    res.status(201).json({ success: true, guild, channelId: generalChannel.id });
  } catch (err) {
    logger.error('GUILD-CREATE', { error: err instanceof Error ? err.message : 'Unknown error' });
    next(err);
  }
}

export async function discoveryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : undefined;
    const guildRepo = new GuildRepository(req.app.locals.db);
    const guilds = await guildRepo.findAllPublic(query);
    res.json({ success: true, guilds });
  } catch (err) {
    logger.error('GUILD-DISCOVERY', { error: err instanceof Error ? err.message : 'Unknown error' });
    next(err);
  }
}

export async function joinGuildHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;
    const guildId = req.params.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!guildId) {
      res.status(400).json({ success: false, error: 'Guild ID is required' });
      return;
    }

    const guildRepo = new GuildRepository(req.app.locals.db);
    const guild = await guildRepo.findById(guildId as string);

    if (!guild) {
      res.status(404).json({ success: false, error: 'Guild not found' });
      return;
    }

    const memberRepo = new MemberRepository(req.app.locals.db);
    const existingMember = await memberRepo.isMember(guildId as string, userId);

    if (existingMember) {
      res.status(400).json({ success: false, error: 'Already a member' });
      return;
    }

    await memberRepo.add({ guild_id: guildId as string, user_id: userId });

    // Join all channels in the guild
    const channelRepo = new ChannelRepository(req.app.locals.db);
    const channels = await channelRepo.findByGuildId(guildId as string);

    // Emit internal event for the websocket to join the user to these channels on IRC
    for (const channel of channels) {
      gatewayEvents.emit('irc:immediate-join', {
        userId,
        channel: channel.irc_channel_name
      });
    }

    logger.info('GUILD-JOIN', { userId, guildId, name: guild.name });
    res.json({ success: true, guild });
  } catch (err) {
    logger.error('GUILD-JOIN', { error: err instanceof Error ? err.message : 'Unknown error' });
    next(err);
  }
}
