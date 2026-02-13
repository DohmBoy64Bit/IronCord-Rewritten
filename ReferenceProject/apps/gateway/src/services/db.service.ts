import { Pool, QueryResult, QueryResultRow } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || 'ironcord',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'ironcord',
      password: process.env.DB_PASSWORD || 'ironcord_password',
      port: parseInt(process.env.DB_PORT || '5432', 10),
    });
  }

  public async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  public async initializeSchema(): Promise<void> {
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    try {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      const maxRetries = 10;
      const retryDelay = 2000; // 2 seconds

      for (let i = 0; i < maxRetries; i++) {
        try {
          await this.pool.query(schemaSql);
          console.log('Database schema initialized successfully');
          return;
        } catch (err: any) {
          console.error(`Error initializing database schema (Attempt ${i + 1}/${maxRetries}):`, err.message);
          if (i === maxRetries - 1) throw err;
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    } catch (fsError) {
      console.error("Critical Error: Could not read schema file at " + schemaPath);
      throw fsError;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export const dbService = new DatabaseService();
