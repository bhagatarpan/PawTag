import { Setting } from '@pawtag/db';
import type { LogLevel, LogCategory } from '@pawtag/db';

const CACHE_TTL_MS = 60_000;

interface CachedSettings {
  enabled: boolean;
  levels: Record<LogLevel, boolean>;
  categories: Record<LogCategory, boolean>;
  sampling: Record<LogLevel, number>;
  retentionDays: number;
  fetchedAt: number;
}

let cache: CachedSettings | null = null;

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
const LOG_CATEGORIES: LogCategory[] = ['HTTP', 'DATABASE', 'AUTH', 'INTEGRATION', 'JOB', 'SECURITY', 'NOTIFICATION', 'CONFIG', 'GENERAL'];

function defaults(): CachedSettings {
  return {
    enabled: true,
    levels: { debug: false, info: true, warn: true, error: true, fatal: true },
    categories: {
      HTTP: true, DATABASE: true, AUTH: true, INTEGRATION: true,
      JOB: true, SECURITY: true, NOTIFICATION: true, CONFIG: true, GENERAL: true,
    },
    sampling: { debug: 100, info: 100, warn: 100, error: 100, fatal: 100 },
    retentionDays: 30,
    fetchedAt: 0,
  };
}

async function loadSettings(): Promise<CachedSettings> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;

  const d = defaults();
  const keys = [
    'systemLog.enabled',
    ...LOG_LEVELS.map((l) => `systemLog.level.${l}`),
    ...LOG_CATEGORIES.map((c) => `systemLog.category.${c}`),
    ...LOG_LEVELS.map((l) => `systemLog.sampling.${l}`),
    'systemLog.retentionDays',
  ];

  const settings = await Setting.find({ key: { $in: keys } }).lean();
  const map = new Map(settings.map((s) => [s.key, s.value]));

  const result: CachedSettings = {
    enabled: map.get('systemLog.enabled') !== 'false',
    levels: {} as Record<LogLevel, boolean>,
    categories: {} as Record<LogCategory, boolean>,
    sampling: {} as Record<LogLevel, number>,
    retentionDays: parseInt(map.get('systemLog.retentionDays') || '30', 10) || 30,
    fetchedAt: Date.now(),
  };

  for (const level of LOG_LEVELS) {
    const val = map.get(`systemLog.level.${level}`);
    result.levels[level] = val !== undefined ? val !== 'false' : d.levels[level];
  }
  for (const cat of LOG_CATEGORIES) {
    const val = map.get(`systemLog.category.${cat}`);
    result.categories[cat] = val !== undefined ? val !== 'false' : d.categories[cat];
  }
  for (const level of LOG_LEVELS) {
    const val = map.get(`systemLog.sampling.${level}`);
    result.sampling[level] = val !== undefined ? Math.min(100, Math.max(0, parseInt(val, 10) || 0)) : d.sampling[level];
  }

  cache = result;
  return result;
}

export async function shouldStoreLog(level: LogLevel, category: LogCategory): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') return false;
  const s = await loadSettings();
  if (!s.enabled) return false;
  if (!s.levels[level]) return false;
  if (!s.categories[category]) return false;

  const rate = s.sampling[level];
  if (rate >= 100) return true;
  return Math.random() * 100 < rate;
}

export async function getRetentionDays(): Promise<number> {
  const s = await loadSettings();
  return s.retentionDays;
}

export async function getAllSystemLogSettings() {
  return loadSettings();
}

export function invalidateSystemLogSettingsCache(): void {
  cache = null;
}

export { LOG_LEVELS, LOG_CATEGORIES };
