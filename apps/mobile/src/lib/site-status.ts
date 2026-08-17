import api from '../api/client';

type SiteStatus = 'ONLINE' | 'MAINTENANCE' | 'OFFLINE';

let cachedStatus: SiteStatus = 'ONLINE';
let lastFetchTime = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

export async function getSiteStatus(): Promise<SiteStatus> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL_MS) {
    return cachedStatus;
  }

  try {
    const res = await api.get('/public/system/status');
    cachedStatus = res.data.data.status;
    lastFetchTime = now;
    return cachedStatus;
  } catch {
    // On error, return cached status (fail-open)
    return cachedStatus;
  }
}

export function clearSiteStatusCache(): void {
  lastFetchTime = 0;
}
