import { Pool, QueryResult, QueryResultRow, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseService {
  private pool: Pool;

  constructor(config?: Partial<DatabaseConfig>) {
    const dbConfig: DatabaseConfig = {
      user: config?.user || process.env.DB_USER || 'ironcord',
      host: config?.host || process.env.DB_HOST || 'localhost',
      database: config?.database || process.env.DB_NAME || 'ironcord',
      password: config?.password || process.env.DB_PASSWORD || 'ironcord_password',
      port: config?.port || parseInt(process.env.DB_PORT || '5432', 10),
    };

    this.pool = new Pool(dbConfig);
  }

  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  public async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async initializeSchema(): Promise<void> {
    const schemaPath = path.join(__dirname, '../migrations/001_initial_schema.sql');
    try {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      const maxRetries = 10;
      const retryDelay = 2000;

      for (let i = 0; i < maxRetries; i++) {
        try {
          await this.pool.query(schemaSql);
          console.log('Database schema initialized successfully');
          return;
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`Error initializing database schema (Attempt ${i + 1}/${maxRetries}):`, errorMessage);
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
