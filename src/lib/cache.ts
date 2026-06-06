/**
 * Simple in-memory TTL cache for scraper responses.
 *
 * Cache entries are stored in a Map with expiration timestamps.
 * Since Node.js runs on a single thread, no locking is needed.
 *
 * TTL defaults (can be overridden per call):
 *   - Listings (dashboard, fresh):    2 minutes
 *   - Best / Verified:                  5 minutes
 *   - Search:                           2 minutes
 *   - Video details:                   30 minutes
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

// Periodic cleanup every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

const startCleanup = () => {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) {
        store.delete(key);
      }
    }
    // If store is empty, stop the timer
    if (store.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, CLEANUP_INTERVAL);
};

/**
 * Get a value from the cache.
 * Returns undefined if the key doesn't exist or has expired.
 */
export const cacheGet = <T>(key: string): T | undefined => {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
};

/**
 * Set a value in the cache with a TTL in milliseconds.
 */
export const cacheSet = <T>(key: string, value: T, ttlMs: number): void => {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  startCleanup();
};

/**
 * Get or compute a cached value.
 * If the key exists and hasn't expired, returns the cached value.
 * Otherwise calls `fetcher()`, caches the result, and returns it.
 */
export const cacheWrap = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<T> => {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) return cached;

  const value = await fetcher();
  cacheSet(key, value, ttlMs);
  return value;
};

/**
 * Invalidate a specific cache key.
 */
export const cacheInvalidate = (key: string): void => {
  store.delete(key);
};

/**
 * Invalidate all cache keys matching a prefix.
 */
export const cacheInvalidatePrefix = (prefix: string): void => {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
};

/**
 * Clear the entire cache.
 */
export const cacheClear = (): void => {
  store.clear();
};

/**
 * Get the number of entries in the cache (for monitoring).
 */
export const cacheSize = (): number => store.size;

// Default TTLs
export const TTL = {
  LISTINGS: 2 * 60 * 1000,     // 2 minutes
  BEST: 5 * 60 * 1000,          // 5 minutes
  VERIFIED: 5 * 60 * 1000,      // 5 minutes
  DETAILS: 30 * 60 * 1000,      // 30 minutes
} as const;
