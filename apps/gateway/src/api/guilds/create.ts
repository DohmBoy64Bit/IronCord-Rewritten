import { Request, Response, NextFunction } from 'express';
import { Guild, CreateGuildRequest } from '@ironcord/shared';
import { GuildRepository, ChannelRepository, MemberRepository, UserRepository } from '@ironcord/db';
import { logger } from '@ironcord/shared';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { gatewayEvents } from '../../events.js';

interface CreateGuildResponse {
  success: boolean;
  guild?: Guild;
  error?: string;
}

function generateNamespacePrefix(guildName: string): string {
  const sanitized = guildName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const timestamp = Date.now().toString(36).substring(-4);
  return `${sanitized.substring(0, 20)}-${timestamp}`;
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
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const { name } = req.body as CreateGuildRequest;

    if (!name || typeof name !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Guild name is required',
      });
      return;
    }

    if (name.length < 3 || name.length > 50) {
      res.status(400).json({
        success: false,
        error: 'Guild name must be between 3 and 50 characters',
      });
      return;
    }

    const guildRepo = new GuildRepository(req.app.locals.db);
    const channelRepo = new ChannelRepository(req.app.locals.db);
    const memberRepo = new MemberRepository(req.app.locals.db);

    const namespacePrefix = generateNamespacePrefix(name);

    logger.info('GUILD-CREATE', {
      phase: 'attempt',
      userId,
      guildName: name,
      namespacePrefix,
    });

    const guild = await guildRepo.create({
      name,
      owner_id: userId,
      irc_namespace_prefix: namespacePrefix,
    });

    await memberRepo.add({
      guild_id: guild.id,
      user_id: userId,
    });

    const generalChannel = await channelRepo.create({
      guild_id: guild.id,
      name: 'general',
      irc_channel_name: `#${namespacePrefix}-general`,
    });

    logger.info('GUILD-CREATE', {
      phase: 'success',
      userId,
      guildId: guild.id,
      channelId: generalChannel.id,
    });

    const userRepo = new UserRepository(req.app.locals.db);
    const user = await userRepo.findById(userId);
    const ownerNick = user?.irc_nick || 'Unknown';

    // Trigger bot provisioning first to ensure it's the first in the channel (gets Op)
    gatewayEvents.emit('irc:provision-channel', {
      channel: generalChannel.irc_channel_name,
      ownerNick,
    });

    // Delay user join slightly to ensure Bot wins the race for @ status
    setTimeout(() => {
      gatewayEvents.emit('irc:immediate-join', {
        userId,
        channel: generalChannel.irc_channel_name,
      });
    }, 500);

    res.status(201).json({
      success: true,
      guild,
    });
  } catch (err) {
    logger.error('GUILD-CREATE', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    next(err);
  }
}
