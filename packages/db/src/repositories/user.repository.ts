import { User } from '@ironcord/shared';
import { DatabaseService } from '../database.service.js';
import { UserRow, CreateUserInput, userRowToUser } from '../types.js';

export class UserRepository {
  constructor(private db: DatabaseService) {}

  async create(input: CreateUserInput): Promise<User> {
    const result = await this.db.query<UserRow>(
      `INSERT INTO users (email, password_hash, irc_nick, avatar_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.email, input.password_hash, input.irc_nick, input.avatar_url || null]
    );
    if (!result.rows[0]) {
      throw new Error('Failed to create user');
    }
    return userRowToUser(result.rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] ? userRowToUser(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query<UserRow>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] ? userRowToUser(result.rows[0]) : null;
  }

  async findByIrcNick(ircNick: string): Promise<User | null> {
    const result = await this.db.query<UserRow>(
      'SELECT * FROM users WHERE irc_nick = $1',
      [ircNick]
    );
    return result.rows[0] ? userRowToUser(result.rows[0]) : null;
  }

  async findPasswordHash(email: string): Promise<string | null> {
    const result = await this.db.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0]?.password_hash || null;
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<User | null> {
    const result = await this.db.query<UserRow>(
      'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING *',
      [avatarUrl, id]
    );
    return result.rows[0] ? userRowToUser(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }

  async exists(email: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)',
      [email]
    );
    return result.rows[0]?.exists || false;
  }
}
