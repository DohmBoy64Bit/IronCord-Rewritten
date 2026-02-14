import { logger } from '@ironcord/shared';

interface CacheEntry {
    password: string;
    expiry: number;
}

class PasswordCache {
    private cache = new Map<string, CacheEntry>();
    private readonly TTL = 30000; // 30 seconds

    public set(userId: string, password: string): void {
        const expiry = Date.now() + this.TTL;
        this.cache.set(userId, { password, expiry });

        // Auto-cleanup after TTL
        setTimeout(() => {
            this.cleanup(userId);
        }, this.TTL);
    }

    public get(userId: string): string | undefined {
        const entry = this.cache.get(userId);
        if (!entry) return undefined;

        if (Date.now() > entry.expiry) {
            this.cache.delete(userId);
            return undefined;
        }

        return entry.password;
    }

    public pop(userId: string): string | undefined {
        const password = this.get(userId);
        this.cache.delete(userId);
        return password;
    }

    private cleanup(userId: string): void {
        const entry = this.cache.get(userId);
        if (entry && Date.now() > entry.expiry) {
            this.cache.delete(userId);
            logger.debug('PWD-CACHE', { userId, message: 'Cold entry expired' });
        }
    }
}

export const passwordCache = new PasswordCache();
