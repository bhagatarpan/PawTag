/**
 * IP Geolocation Utility
 *
 * Resolves approximate location from IP address using ip-api.com (free, no API key).
 * Results are cached in memory for 1 hour to avoid rate limits.
 */

import logger from './logger';

interface GeoCacheEntry {
  location: string;
  timestamp: number;
}

const cache = new Map<string, GeoCacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const REQUEST_TIMEOUT_MS = 3000; // 3 seconds

/**
 * Get approximate location from IP address.
 * Returns city, region, country (e.g., "Auckland, Auckland, New Zealand").
 * Returns "Local Network" for private IPs, "Unknown" on failure.
 */
export async function getLocationFromIp(ip: string): Promise<string> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' ||
      ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return 'Local Network';
  }

  // Normalize IPv6-mapped IPv4
  const normalizedIp = ip.replace(/^::ffff:/, '');

  // Check cache
  const cached = cache.get(normalizedIp);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.location;
  }

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
