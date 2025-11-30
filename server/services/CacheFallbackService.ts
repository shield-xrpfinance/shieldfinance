/**
 * CacheFallbackService - Graceful Degradation with Smart Caching
 * 
 * Provides multi-tier caching with automatic fallback during service outages.
 * Integrates with PriceService, WalletBalanceService, and other data services.
 * 
 * Features:
 * - In-memory L1 cache for hot data
 * - Database L2 cache for persistence
 * - Stale-while-revalidate pattern
 * - TTL-based expiration with grace periods
 * - Cache warming on startup
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  createdAt: Date;
  expiresAt: Date;
  staleAt: Date;
  source: "fresh" | "stale" | "fallback";
}

export interface CacheConfig {
  defaultTtl?: number;
  staleTtl?: number;
  maxMemoryEntries?: number;
  enablePersistence?: boolean;
}

interface MemoryCacheEntry {
  data: any;
  createdAt: Date;
  expiresAt: Date;
  staleAt: Date;
  hits: number;
}

export class CacheFallbackService {
  private memoryCache: Map<string, MemoryCacheEntry> = new Map();
  private config: Required<CacheConfig>;
  private warmupCallbacks: Map<string, () => Promise<void>> = new Map();
  private revalidationQueue: Set<string> = new Set();
  private revalidationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: CacheConfig = {}) {
    this.config = {
      defaultTtl: config.defaultTtl ?? 60000,
      staleTtl: config.staleTtl ?? 300000,
      maxMemoryEntries: config.maxMemoryEntries ?? 1000,
      enablePersistence: config.enablePersistence ?? true,
    };

    this.startRevalidationLoop();
    console.log("📦 CacheFallbackService: Initialized");
  }

  /**
   * Get a cached value with automatic fallback
   */
  async get<T>(
    key: string,
    fetcher?: () => Promise<T>,
    options?: { ttl?: number; staleTtl?: number }
  ): Promise<CacheEntry<T> | null> {
    const memEntry = this.memoryCache.get(key);
    const now = new Date();

    if (memEntry) {
      memEntry.hits++;

      if (now < memEntry.expiresAt) {
        return {
          key,
          data: memEntry.data as T,
          createdAt: memEntry.createdAt,
          expiresAt: memEntry.expiresAt,
          staleAt: memEntry.staleAt,
          source: "fresh",
        };
      }

      if (now < memEntry.staleAt) {
        if (fetcher && !this.revalidationQueue.has(key)) {
          this.revalidationQueue.add(key);
          this.revalidateInBackground(key, fetcher, options);
        }

        return {
          key,
          data: memEntry.data as T,
          createdAt: memEntry.createdAt,
          expiresAt: memEntry.expiresAt,
          staleAt: memEntry.staleAt,
          source: "stale",
        };
      }
    }

    if (this.config.enablePersistence) {
      const dbEntry = await this.getFromDatabase<T>(key);
      if (dbEntry) {
        this.setMemoryCache(key, dbEntry.data, options);

        if (fetcher && now > dbEntry.expiresAt) {
          this.revalidationQueue.add(key);
          this.revalidateInBackground(key, fetcher, options);
        }

        return {
          ...dbEntry,
          source: now < dbEntry.expiresAt ? "fresh" : now < dbEntry.staleAt ? "stale" : "fallback",
        };
      }
    }

    if (fetcher) {
      try {
        const data = await fetcher();
        await this.set(key, data, options);
        return {
          key,
          data,
          createdAt: now,
          expiresAt: new Date(now.getTime() + (options?.ttl ?? this.config.defaultTtl)),
          staleAt: new Date(now.getTime() + (options?.staleTtl ?? this.config.staleTtl)),
          source: "fresh",
        };
      } catch (error) {
        console.error(`❌ CacheFallbackService: Fetcher failed for ${key}:`, error);
        return null;
      }
    }

    return null;
  }

  /**
   * Set a cache value
   */
  async set<T>(
    key: string,
    data: T,
    options?: { ttl?: number; staleTtl?: number }
  ): Promise<void> {
    const ttl = options?.ttl ?? this.config.defaultTtl;
    const staleTtl = options?.staleTtl ?? this.config.staleTtl;

    this.setMemoryCache(key, data, options);

    if (this.config.enablePersistence) {
      await this.setInDatabase(key, data, ttl, staleTtl);
    }
  }

  /**
   * Set value in memory cache
   */
  private setMemoryCache(key: string, data: any, options?: { ttl?: number; staleTtl?: number }): void {
    const now = new Date();
    const ttl = options?.ttl ?? this.config.defaultTtl;
    const staleTtl = options?.staleTtl ?? this.config.staleTtl;

    if (this.memoryCache.size >= this.config.maxMemoryEntries) {
      this.evictLeastUsed();
    }

    this.memoryCache.set(key, {
      data,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttl),
      staleAt: new Date(now.getTime() + staleTtl),
      hits: 0,
    });
  }

  /**
   * Get value from database
   */
  private async getFromDatabase<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const result = await db.execute(sql`
        SELECT data, created_at, expires_at, stale_at
        FROM cache_entries
        WHERE key = ${key}
        LIMIT 1
      `);

      if (result.rows.length === 0) return null;

      const row = result.rows[0] as any;
      return {
        key,
        data: JSON.parse(row.data),
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
        staleAt: new Date(row.stale_at),
        source: "fresh",
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Set value in database
   */
  private async setInDatabase(key: string, data: any, ttl: number, staleTtl: number): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl);
    const staleAt = new Date(now.getTime() + staleTtl);

    try {
      await db.execute(sql`
        INSERT INTO cache_entries (key, data, created_at, expires_at, stale_at)
        VALUES (${key}, ${JSON.stringify(data)}, ${now.toISOString()}, ${expiresAt.toISOString()}, ${staleAt.toISOString()})
        ON CONFLICT (key) DO UPDATE SET
          data = EXCLUDED.data,
          created_at = EXCLUDED.created_at,
          expires_at = EXCLUDED.expires_at,
          stale_at = EXCLUDED.stale_at
      `);
    } catch (error) {
    }
  }

  /**
   * Revalidate cache in background
   */
  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttl?: number; staleTtl?: number }
  ): Promise<void> {
    try {
      const data = await fetcher();
      await this.set(key, data, options);
      console.log(`🔄 CacheFallbackService: Revalidated ${key}`);
    } catch (error) {
      console.warn(`⚠️ CacheFallbackService: Background revalidation failed for ${key}`);
    } finally {
      this.revalidationQueue.delete(key);
    }
  }

  /**
   * Start background revalidation loop
   */
  private startRevalidationLoop(): void {
    this.revalidationTimer = setInterval(() => {
      const now = new Date();
      const entries = Array.from(this.memoryCache.entries());
      
      for (const [key, entry] of entries) {
        if (now > entry.staleAt) {
          this.memoryCache.delete(key);
        }
      }
    }, 60000);
  }

  /**
   * Evict least used entries when cache is full
   */
  private evictLeastUsed(): void {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].hits - b[1].hits);
    
    const toEvict = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toEvict; i++) {
      this.memoryCache.delete(entries[i][0]);
    }
  }

  /**
   * Invalidate a specific cache key
   */
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (this.config.enablePersistence) {
      try {
        await db.execute(sql`DELETE FROM cache_entries WHERE key = ${key}`);
      } catch (error) {}
    }
  }

  /**
   * Invalidate all entries matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    const keys = Array.from(this.memoryCache.keys());
    
    for (const key of keys) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    }

    if (this.config.enablePersistence) {
      try {
        await db.execute(sql`DELETE FROM cache_entries WHERE key LIKE ${pattern.replace(/\*/g, '%')}`);
      } catch (error) {}
    }
  }

  /**
   * Register a warmup callback
   */
  registerWarmup(name: string, callback: () => Promise<void>): void {
    this.warmupCallbacks.set(name, callback);
  }

  /**
   * Run all warmup callbacks
   */
  async warmup(): Promise<void> {
    console.log("🔥 CacheFallbackService: Starting cache warmup...");
    
    const callbacks = Array.from(this.warmupCallbacks.entries());
    for (const [name, callback] of callbacks) {
      try {
        await callback();
        console.log(`✅ CacheFallbackService: Warmed up ${name}`);
      } catch (error) {
        console.error(`❌ CacheFallbackService: Failed to warm up ${name}:`, error);
      }
    }

    console.log("🔥 CacheFallbackService: Cache warmup complete");
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memoryEntries: number;
    maxMemoryEntries: number;
    revalidationQueueSize: number;
  } {
    return {
      memoryEntries: this.memoryCache.size,
      maxMemoryEntries: this.config.maxMemoryEntries,
      revalidationQueueSize: this.revalidationQueue.size,
    };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (this.config.enablePersistence) {
      try {
        await db.execute(sql`DELETE FROM cache_entries`);
      } catch (error) {}
    }

    console.log("📦 CacheFallbackService: All caches cleared");
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    if (this.revalidationTimer) {
      clearInterval(this.revalidationTimer);
      this.revalidationTimer = null;
    }
    console.log("🛑 CacheFallbackService: Shutdown complete");
  }
}

export const cacheFallbackService = new CacheFallbackService();
