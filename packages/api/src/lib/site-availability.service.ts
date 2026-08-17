import { Setting } from '@pawtag/db';
import { SiteAvailabilityStatus } from '@pawtag/shared';

const CACHE_TTL_MS = 10_000; // 10 seconds — availability changes must propagate fast

interface CachedAvailability {
  status: SiteAvailabilityStatus;
  maintenanceMode: boolean;
  offlineMode: boolean;
  messages: AvailabilityMessages;
  pollingInterval: number;
  fetchedAt: number;
}

export interface AvailabilityMessages {
  maintenanceTitle: string;
  maintenanceMessage: string;
  offlineTitle: string;
  offlineMessage: string;
}

const SETTING_KEYS = [
  'site.maintenanceMode',
  'site.offlineMode',
  'site.maintenanceTitle',
  'site.maintenanceMessage',
  'site.offlineTitle',
  'site.offlineMessage',
  'site.availabilityPollingInterval',
];

const DEFAULTS: Record<string, string> = {
  'site.maintenanceMode': 'false',
  'site.offlineMode': 'false',
  'site.maintenanceTitle': 'PawTag is currently under maintenance',
  'site.maintenanceMessage': 'Some website functionality is temporarily unavailable. Please check back shortly.',
  'site.offlineTitle': 'PawTag is currently offline',
  'site.offlineMessage': 'Please come back later.',
  'site.availabilityPollingInterval': '30',
};

let cache: CachedAvailability | null = null;

function getEffectiveStatus(maintenanceMode: boolean, offlineMode: boolean): SiteAvailabilityStatus {
  if (offlineMode) return SiteAvailabilityStatus.OFFLINE;
  if (maintenanceMode) return SiteAvailabilityStatus.MAINTENANCE;
  return SiteAvailabilityStatus.ONLINE;
}

async function loadSettings(): Promise<CachedAvailability> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const settings = await Setting.find({ key: { $in: SETTING_KEYS } }).lean();
  const map = new Map(settings.map((s) => [s.key, s.value]));

  const maintenanceMode = (map.get('site.maintenanceMode') ?? DEFAULTS['site.maintenanceMode']) === 'true';
  const offlineMode = (map.get('site.offlineMode') ?? DEFAULTS['site.offlineMode']) === 'true';

  const result: CachedAvailability = {
    status: getEffectiveStatus(maintenanceMode, offlineMode),
    maintenanceMode,
    offlineMode,
    messages: {
      maintenanceTitle: map.get('site.maintenanceTitle') ?? DEFAULTS['site.maintenanceTitle'],
      maintenanceMessage: map.get('site.maintenanceMessage') ?? DEFAULTS['site.maintenanceMessage'],
      offlineTitle: map.get('site.offlineTitle') ?? DEFAULTS['site.offlineTitle'],
      offlineMessage: map.get('site.offlineMessage') ?? DEFAULTS['site.offlineMessage'],
    },
    pollingInterval: parseInt(map.get('site.availabilityPollingInterval') ?? DEFAULTS['site.availabilityPollingInterval'], 10),
    fetchedAt: Date.now(),
  };

  cache = result;
  return result;
}

export async function getSiteAvailabilityStatus(): Promise<SiteAvailabilityStatus> {
  const data = await loadSettings();
  return data.status;
}

export async function getSiteAvailability(): Promise<CachedAvailability> {
  return loadSettings();
}

export function clearSiteAvailabilityCache(): void {
  cache = null;
}
