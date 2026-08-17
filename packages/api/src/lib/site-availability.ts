import { Setting } from '@pawtag/db';
import { SiteAvailabilityStatus } from '@pawtag/shared';

const cache = new Map<string, { value: string; fetchedAt: number }>();
const CACHE_TTL_MS = 10_000; // 10 seconds — fast propagation for availability changes

const MAINTENANCE_KEY = 'site.maintenanceMode';
const OFFLINE_KEY = 'site.offlineMode';

async function getCachedSetting(key: string): Promise<string> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.value;
  const setting = await Setting.findOne({ key }).lean();
  const value = setting?.value ?? 'false';
  cache.set(key, { value, fetchedAt: Date.now() });
  return value;
}

export async function getSiteAvailabilityStatus(): Promise<SiteAvailabilityStatus> {
  const [offline, maintenance] = await Promise.all([
    getCachedSetting(OFFLINE_KEY),
    getCachedSetting(MAINTENANCE_KEY),
  ]);

  if (offline === 'true') return SiteAvailabilityStatus.OFFLINE;
  if (maintenance === 'true') return SiteAvailabilityStatus.MAINTENANCE;
  return SiteAvailabilityStatus.ONLINE;
}

export function clearSiteAvailabilityCache(): void {
  cache.clear();
}

/**
 * Check if a mutation is allowed given the current site state.
 * Returns null if allowed, or an error response object if blocked.
 */
export function checkMutationAllowed(
  status: SiteAvailabilityStatus,
  isAdminEndpoint: boolean,
): { blocked: boolean; statusCode: number; body: Record<string, unknown> } | null {
  // Admin endpoints are always allowed
  if (isAdminEndpoint) return null;

  if (status === SiteAvailabilityStatus.OFFLINE) {
    return {
      blocked: true,
      statusCode: 503,
      body: {
        success: false,
        error: 'PawTag is currently offline. Please come back later.',
        code: 'SITE_OFFLINE',
      },
    };
  }

  if (status === SiteAvailabilityStatus.MAINTENANCE) {
    return {
      blocked: true,
      statusCode: 503,
      body: {
        success: false,
        error: 'PawTag is currently under maintenance. This action is temporarily unavailable.',
        code: 'SITE_MAINTENANCE',
      },
    };
  }

  return null;
}
