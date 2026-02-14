import { Request, Response, NextFunction } from 'express';
import { Guild, Channel } from '@ironcord/shared';
import { GuildRepository, ChannelRepository } from '@ironcord/db';
import { logger } from '@ironcord/shared';
import { AuthenticatedRequest } from '../../middleware/auth.middleware.js';

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
