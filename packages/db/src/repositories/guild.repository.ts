import { Guild } from '@ironcord/shared';
import { DatabaseService } from '../database.service.js';
import { GuildRow, CreateGuildInput, guildRowToGuild } from '../types.js';

export class GuildRepository {
  constructor(private db: DatabaseService) { }

  async create(input: CreateGuildInput): Promise<Guild> {
    const result = await this.db.query<GuildRow>(
      `INSERT INTO guilds (name, owner_id, irc_namespace_prefix, description, banner_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.name, input.owner_id, input.irc_namespace_prefix, input.description || null, input.banner_url || null]
    );
    if (!result.rows[0]) {
      throw new Error('Failed to create guild');
    }
    return guildRowToGuild(result.rows[0]);
  }

  async findById(id: string): Promise<Guild | null> {
    const result = await this.db.query<GuildRow>(
      'SELECT * FROM guilds WHERE id = $1',
      [id]
    );
    return result.rows[0] ? guildRowToGuild(result.rows[0]) : null;
  }

  async findByOwnerId(ownerId: string): Promise<Guild[]> {
    const result = await this.db.query<GuildRow>(
      'SELECT * FROM guilds WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId]
    );
    return result.rows.map(guildRowToGuild);
  }

  async findByUserId(userId: string): Promise<Guild[]> {
    const result = await this.db.query<GuildRow>(
      `SELECT g.* FROM guilds g
       INNER JOIN guild_members gm ON g.id = gm.guild_id
       WHERE gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [userId]
    );
    return result.rows.map(guildRowToGuild);
  }

  async findByNamespacePrefix(prefix: string): Promise<Guild | null> {
    const result = await this.db.query<GuildRow>(
      'SELECT * FROM guilds WHERE irc_namespace_prefix = $1',
      [prefix]
    );
    return result.rows[0] ? guildRowToGuild(result.rows[0]) : null;
  }

  async update(id: string, name: string): Promise<Guild | null> {
    const result = await this.db.query<GuildRow>(
      'UPDATE guilds SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    );
    return result.rows[0] ? guildRowToGuild(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM guilds WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM guilds WHERE id = $1)',
      [id]
    );
    return result.rows[0]?.exists || false;
  }

  async findAllPublic(query?: string): Promise<Guild[]> {
    let sql = 'SELECT * FROM guilds';
    const params: any[] = [];

    if (query) {
      sql += ' WHERE name ILIKE $1 OR description ILIKE $1';
      params.push(`%${query}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';

    const result = await this.db.query<GuildRow>(sql, params);
    return result.rows.map(guildRowToGuild);
  }
}
