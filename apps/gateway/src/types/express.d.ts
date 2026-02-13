import { DatabaseService } from '@ironcord/db';

declare global {
  namespace Express {
    interface Locals {
      db: DatabaseService;
    }

    interface Request {
      userId?: string;
    }
  }
}
