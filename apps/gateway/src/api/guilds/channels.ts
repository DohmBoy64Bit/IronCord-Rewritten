import { Request, Response, NextFunction } from 'express';
import { Channel, CreateChannelRequest } from '@ironcord/shared';
import { ChannelRepository, GuildRepository, MemberRepository, UserRepository } from '@ironcord/db';
import { logger } from '@ironcord/shared';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { gatewayEvents } from '../../events.js';

interface ListChannelsResponse {
  success: boolean;
  channels?: Channel[];
  error?: string;
}

interface CreateChannelResponse {
  success: boolean;
  channel?: Channel;
  error?: string;
}

export async function listChannelsHandler(
  req: Request,
  res: Response<ListChannelsResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;
    const guildId = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    if (!guildId) {
      res.status(400).json({
        success: false,
        error: 'Guild ID is required',
      });
      return;
    }

    const guildRepo = new GuildRepository(req.app.locals.db);
    const memberRepo = new MemberRepository(req.app.locals.db);
    const channelRepo = new ChannelRepository(req.app.locals.db);

    const guildExists = await guildRepo.exists(guildId);
    if (!guildExists) {
      res.status(404).json({
        success: false,
        error: 'Guild not found',
      });
      return;
    }

    const isMember = await memberRepo.isMember(guildId, userId);
    if (!isMember) {
      res.status(403).json({
        success: false,
        error: 'Not a member of this guild',
      });
      return;
    }

    const channels = await channelRepo.findByGuildId(guildId);

    logger.info('CHANNEL-LIST', {
      userId,
      guildId,
      channelCount: channels.length,
    });

    res.json({
      success: true,
      channels,
    });
  } catch (err) {
    logger.error('CHANNEL-LIST', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    next(err);
  }
}

export async function createChannelHandler(
  req: Request,
  res: Response<CreateChannelResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;
    const guildId = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    if (!guildId) {
      res.status(400).json({
        success: false,
        error: 'Guild ID is required',
      });
      return;
    }

    const { name, topic } = req.body as CreateChannelRequest;

    if (!name || typeof name !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Channel name is required',
      });
      return;
    }

    if (name.length < 1 || name.length > 50) {
      res.status(400).json({
        success: false,
        error: 'Channel name must be between 1 and 50 characters',
      });
      return;
    }

    const guildRepo = new GuildRepository(req.app.locals.db);
    const channelRepo = new ChannelRepository(req.app.locals.db);

    const guild = await guildRepo.findById(guildId);
    if (!guild) {
      res.status(404).json({
        success: false,
        error: 'Guild not found',
      });
      return;
    }

    if (guild.owner_id !== userId) {
      res.status(403).json({
        success: false,
        error: 'Only the guild owner can create channels',
      });
      return;
    }

    // Check for duplicate channel name
    const existingChannels = await channelRepo.findByGuildId(guildId);
    const duplicate = existingChannels.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      res.status(409).json({
        success: false,
        error: 'A channel with this name already exists',
      });
      return;
    }

    const sanitizedName = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const ircChannelName = `#${guild.irc_namespace_prefix}-${sanitizedName}`;

    logger.info('CHANNEL-CREATE', {
      phase: 'attempt',
      userId,
      guildId,
      channelName: name,
      ircChannelName,
    });

    const channel = await channelRepo.create({
      guild_id: guildId,
      name,
      irc_channel_name: ircChannelName,
      topic,
    });

    logger.info('CHANNEL-CREATE', {
      phase: 'success',
      userId,
      guildId,
      channelId: channel.id,
    });

    const userRepo = new UserRepository(req.app.locals.db);
    const user = await userRepo.findById(userId);
    const ownerNick = user?.irc_nick || 'Unknown';

    // Trigger bot provisioning first to ensure it's the first in the channel (gets Op)
    gatewayEvents.emit('irc:provision-channel', {
      channel: channel.irc_channel_name,
      ownerNick,
    });

    // Delay user join slightly to ensure Bot wins the race for @ status
    setTimeout(() => {
      gatewayEvents.emit('irc:immediate-join', {
        userId,
        channel: channel.irc_channel_name,
      });
    }, 500);

    res.status(201).json({
      success: true,
      channel,
    });
  } catch (err) {
    logger.error('CHANNEL-CREATE', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    next(err);
  }
}

export async function updateChannelHandler(
  req: Request,
  res: Response<UpdateChannelResponse>,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;
    const channelId = typeof req.params.channelId === 'string' ? req.params.channelId : req.params.channelId?.[0];
    const guildId = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!guildId || !channelId) {
      res.status(400).json({ success: false, error: 'Guild and Channel IDs are required' });
      return;
    }

    const { name, topic } = req.body;

    const guildRepo = new GuildRepository(req.app.locals.db);
    const channelRepo = new ChannelRepository(req.app.locals.db);

    const guild = await guildRepo.findById(guildId);
    if (!guild || guild.owner_id !== userId) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const updatedChannel = await channelRepo.update(channelId, { name, topic });
    if (!updatedChannel) {
      res.status(404).json({ success: false, error: 'Channel not found' });
      return;
    }

    logger.info('CHANNEL-UPDATE', { userId, guildId, channelId, updates: { name, topic } });
    res.json({ success: true, channel: updatedChannel });
  } catch (err) {
    logger.error('CHANNEL-UPDATE', { error: err instanceof Error ? err.message : 'Unknown error' });
    next(err);
  }
}

export async function deleteChannelHandler(
  req: Request,
  res: Response<{ success: boolean; error?: string }>,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;
    const channelId = typeof req.params.channelId === 'string' ? req.params.channelId : req.params.channelId?.[0];
    const guildId = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!guildId || !channelId) {
      res.status(400).json({ success: false, error: 'Guild and Channel IDs are required' });
      return;
    }

    const guildRepo = new GuildRepository(req.app.locals.db);
    const channelRepo = new ChannelRepository(req.app.locals.db);

    const guild = await guildRepo.findById(guildId);
    if (!guild || guild.owner_id !== userId) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const deleted = await channelRepo.delete(channelId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Channel not found' });
      return;
    }

    logger.info('CHANNEL-DELETE', { userId, guildId, channelId });
    res.json({ success: true });
  } catch (err) {
    logger.error('CHANNEL-DELETE', { error: err instanceof Error ? err.message : 'Unknown error' });
    next(err);
  }
}

interface UpdateChannelResponse {
  success: boolean;
  channel?: Channel;
  error?: string;
}
