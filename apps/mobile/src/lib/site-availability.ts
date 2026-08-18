import axios from 'axios';
import { SiteAvailabilityStatus } from '@pawtag/shared';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

let cachedStatus: SiteAvailabilityStatus = SiteAvailabilityStatus.ONLINE;
let cachedMessages = {
  offlineTitle: 'PawTag is currently offline',
  offlineMessage: 'Please come back later.',
};
let lastFetchTime = 0;
const CACHE_TTL_MS = 10_000; // 10 seconds

export async function fetchSiteAvailability(): Promise<{
  status: SiteAvailabilityStatus;
  messages: typeof cachedMessages;
}> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL_MS) {
    return { status: cachedStatus, messages: cachedMessages };
  }

  try {
    const res = await axios.get(`${API_BASE_URL}/public/system/status`);
    cachedStatus = res.data.data.status || SiteAvailabilityStatus.ONLINE;
    lastFetchTime = now;
    return { status: cachedStatus, messages: cachedMessages };
  } catch {
    // Network error — don't update cache, return last known
    return { status: cachedStatus, messages: cachedMessages };
  }
}

export function getLastKnownStatus(): SiteAvailabilityStatus {
  return cachedStatus;
}

export function clearAvailabilityCache(): void {
  lastFetchTime = 0;
}
