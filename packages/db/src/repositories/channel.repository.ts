import { Channel } from '@ironcord/shared';
import { DatabaseService } from '../database.service.js';
import { ChannelRow, CreateChannelInput, channelRowToChannel } from '../types.js';

export class ChannelRepository {
  constructor(private db: DatabaseService) {}

  async create(input: CreateChannelInput): Promise<Channel> {
    const result = await this.db.query<ChannelRow>(
      `INSERT INTO channels (guild_id, name, irc_channel_name, topic)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.guild_id, input.name, input.irc_channel_name, input.topic || null]
    );
    if (!result.rows[0]) {
      throw new Error('Failed to create channel');
    }
    return channelRowToChannel(result.rows[0]);
  }

  async findById(id: string): Promise<Channel | null> {
    const result = await this.db.query<ChannelRow>(
      'SELECT * FROM channels WHERE id = $1',
      [id]
    );
    return result.rows[0] ? channelRowToChannel(result.rows[0]) : null;
  }

  async findByGuildId(guildId: string): Promise<Channel[]> {
    const result = await this.db.query<ChannelRow>(
      'SELECT * FROM channels WHERE guild_id = $1 ORDER BY created_at ASC',
      [guildId]
    );
    return result.rows.map(channelRowToChannel);
  }

  async findByIrcChannelName(ircChannelName: string): Promise<Channel | null> {
    const result = await this.db.query<ChannelRow>(
      'SELECT * FROM channels WHERE irc_channel_name = $1',
      [ircChannelName]
    );
    return result.rows[0] ? channelRowToChannel(result.rows[0]) : null;
  }

  async updateTopic(id: string, topic: string): Promise<Channel | null> {
    const result = await this.db.query<ChannelRow>(
      'UPDATE channels SET topic = $1 WHERE id = $2 RETURNING *',
      [topic, id]
    );
    return result.rows[0] ? channelRowToChannel(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM channels WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  async deleteByGuildId(guildId: string): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM channels WHERE guild_id = $1',
      [guildId]
    );
    return result.rowCount || 0;
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM channels WHERE id = $1)',
      [id]
    );
    return result.rows[0]?.exists || false;
  }
}
