/**
 * IP Geolocation Utility
 *
 * Primary: geoip-lite (local MaxMind database, offline, sub-microsecond)
 * Fallback: ip-api.com (free API, no key required)
 * Results are cached in memory for 1 hour.
 *
 * This product includes GeoLite data created by MaxMind, available from https://www.maxmind.com
 */

import logger from './logger';

interface GeoCacheEntry {
  location: string;
  timestamp: number;
}

interface GeoCacheDataEntry {
  data: IpGeoData;
  timestamp: number;
}

const cache = new Map<string, GeoCacheEntry>();
const geoDataCache = new Map<string, GeoCacheDataEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const REQUEST_TIMEOUT_MS = 3000; // 3 seconds

export interface IpGeoData {
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

// Lazy-load geoip-lite (only available after npm install)
let geoip: typeof import('geoip-lite') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  geoip = require('geoip-lite');
} catch {
  // geoip-lite not available — will use API fallback
  logger.warn('geoip-lite not available, falling back to ip-api.com');
}

function isPrivateIp(ip: string): boolean {
  return !ip ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.');
}

function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/, '');
}

/**
 * Get structured geolocation data from IP address.
 * Returns city, region, country, latitude, longitude.
 * Returns null for private IPs or on failure.
 */
export async function getIpGeoData(ip: string): Promise<IpGeoData | null> {
  if (isPrivateIp(ip)) {
    return null;
  }

  const normalizedIp = normalizeIp(ip);

  // Check cache
  const cached = geoDataCache.get(normalizedIp);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Try local database first (sub-microsecond, offline)
  if (geoip) {
    try {
      const geo = geoip.lookup(normalizedIp);
      if (geo) {
        const data: IpGeoData = {
          city: geo.city || undefined,
          region: geo.region || undefined,
          country: geo.country || undefined,
          latitude: geo.ll?.[0] || undefined,
          longitude: geo.ll?.[1] || undefined,
        };
        geoDataCache.set(normalizedIp, { data, timestamp: Date.now() });
        return data;
      }
    } catch (err) {
      logger.debug({ err, ip: normalizedIp }, 'geoip-lite lookup failed, trying API');
    }
  }

  // Fallback to ip-api.com
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(
      `http://ip-api.com/json/${normalizedIp}?fields=status,country,regionName,city,lat,lon`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    const result = await response.json();

    if (result.status === 'success') {
      const data: IpGeoData = {
        city: result.city || undefined,
        region: result.regionName || undefined,
        country: result.country || undefined,
        latitude: result.lat || undefined,
        longitude: result.lon || undefined,
      };
      geoDataCache.set(normalizedIp, { data, timestamp: Date.now() });
      return data;
    }
  } catch (err) {
    logger.debug({ err, ip: normalizedIp }, 'IP geolocation API lookup failed');
  }

  return null;
}

/**
 * Get approximate location string from IP address.
 * Returns city, region, country (e.g., "Auckland, Auckland, New Zealand").
 * Returns "Local Network" for private IPs, "Unknown" on failure.
 */
export async function getLocationFromIp(ip: string): Promise<string> {
  if (isPrivateIp(ip)) {
    return 'Local Network';
  }

  const normalizedIp = normalizeIp(ip);

  // Check cache
  const cached = cache.get(normalizedIp);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.location;
  }

  // Try local database first
  if (geoip) {
    try {
      const geo = geoip.lookup(normalizedIp);
      if (geo) {
        const parts = [geo.city, geo.region, geo.country].filter(Boolean);
        const location = parts.join(', ') || 'Unknown';
        cache.set(normalizedIp, { location, timestamp: Date.now() });
        return location;
      }
    } catch (err) {
      logger.debug({ err, ip: normalizedIp }, 'geoip-lite lookup failed, trying API');
    }
  }

  // Fallback to ip-api.com
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(
      `http://ip-api.com/json/${normalizedIp}?fields=status,country,regionName,city`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    const data = await response.json();

    if (data.status === 'success') {
      const parts = [data.city, data.regionName, data.country].filter(Boolean);
      const location = parts.join(', ') || 'Unknown';

      cache.set(normalizedIp, { location, timestamp: Date.now() });
      return location;
    }
  } catch (err) {
    // Geolocation is best-effort — don't fail the email
    logger.debug({ err, ip: normalizedIp }, 'IP geolocation lookup failed');
  }

  return 'Unknown';
}
