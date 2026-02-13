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
