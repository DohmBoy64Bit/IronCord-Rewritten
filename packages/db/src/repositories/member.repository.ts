import { User } from '@ironcord/shared';
import { DatabaseService } from '../database.service.js';
import { CreateGuildMemberInput, UserRow, userRowToUser } from '../types.js';

export class MemberRepository {
  constructor(private db: DatabaseService) {}

  async add(input: CreateGuildMemberInput): Promise<void> {
    await this.db.query(
      `INSERT INTO guild_members (guild_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (guild_id, user_id) DO NOTHING`,
      [input.guild_id, input.user_id]
    );
  }

  async remove(guildId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM guild_members WHERE guild_id = $1 AND user_id = $2',
      [guildId, userId]
    );
    return (result.rowCount || 0) > 0;
  }

  async findByGuildId(guildId: string): Promise<User[]> {
    const result = await this.db.query<UserRow>(
      `SELECT u.* FROM users u
       INNER JOIN guild_members gm ON u.id = gm.user_id
       WHERE gm.guild_id = $1
       ORDER BY gm.joined_at ASC`,
      [guildId]
    );
    return result.rows.map(userRowToUser);
  }

  async findByUserId(userId: string): Promise<string[]> {
    const result = await this.db.query<{ guild_id: string }>(
      'SELECT guild_id FROM guild_members WHERE user_id = $1',
      [userId]
    );
    return result.rows.map(row => row.guild_id);
  }

  async isMember(guildId: string, userId: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM guild_members 
        WHERE guild_id = $1 AND user_id = $2
      )`,
      [guildId, userId]
    );
    return result.rows[0]?.exists || false;
  }

  async getMemberCount(guildId: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM guild_members WHERE guild_id = $1',
      [guildId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  async removeAllFromGuild(guildId: string): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM guild_members WHERE guild_id = $1',
      [guildId]
    );
    return result.rowCount || 0;
  }
}
