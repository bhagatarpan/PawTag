import { Request, Response, NextFunction } from 'express';
import { Setting } from '@pawtag/db';

const cache = new Map<string, { value: string; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

const isDev = () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';

/**
 * Read a numeric setting from the DB with a 1-minute in-memory cache.
 */
async function getNumericSetting(key: string, defaultValue: number): Promise<number> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return parseInt(cached.value, 10) || defaultValue;
  }
  try {
    const setting = await Setting.findOne({ key }).lean();
    const value = setting?.value || String(defaultValue);
    cache.set(key, { value, fetchedAt: Date.now() });
    return parseInt(value, 10) || defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Read a boolean setting from the DB with a 1-minute in-memory cache.
 */
export async function getBooleanSetting(key: string, defaultValue: boolean): Promise<boolean> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value === 'true';
  }
  try {
    const setting = await Setting.findOne({ key }).lean();
    const value = setting?.value ?? String(defaultValue);
    cache.set(key, { value, fetchedAt: Date.now() });
    return value === 'true';
  } catch {
    return defaultValue;
  }
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Create a DB-driven rate limiter middleware.
 * Tracks request counts per IP in memory. Settings are re-read from the DB every 60 seconds.
 */
export function createDbRateLimiter(opts: {
  settingKey: string;       // DB setting for max requests (e.g. 'rateLimit.finder.view')
  defaultValue: number;     // fallback if setting not found
  windowMs: number;         // time window in milliseconds
  message: string;          // error message when rate limited
  skipInDev?: boolean;      // skip in dev/test (default: true)
  keySuffix?: string;       // additional key to separate counters (e.g. per-route)
}) {
  const store = new Map<string, RateLimitEntry>();
  const skipDev = opts.skipInDev !== false;

  // Periodic cleanup of expired entries (every 5 minutes)
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 5 * 60 * 1000).unref();

  return async (req: Request, res: Response, next: NextFunction) => {
    if (skipDev && isDev()) return next();

    const max = await getNumericSetting(opts.settingKey, opts.defaultValue);
    const ip = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 'unknown';
    const storeKey = `${ip}:${opts.keySuffix || opts.settingKey}`;
    const now = Date.now();

    let entry = store.get(storeKey);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      store.set(storeKey, entry);
    }

    entry.count++;

    // Set rate limit headers
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      res.status(429).json({ success: false, error: opts.message });
      return;
    }

    next();
  };
}

/**
 * Get a setting value from the cache (for use in other services).
 */
export async function getCachedSetting(key: string, defaultValue: string): Promise<string> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }
  try {
    const setting = await Setting.findOne({ key }).lean();
    const value = setting?.value ?? defaultValue;
    cache.set(key, { value, fetchedAt: Date.now() });
    return value;
  } catch {
    return defaultValue;
  }
}
