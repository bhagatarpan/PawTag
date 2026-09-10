import { Setting } from '@pawtag/db';

const cache = new Map<string, { value: string; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

async function getSetting(key: string, defaultValue: string): Promise<string> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const setting = await Setting.findOne({ key }).lean();
  const value = setting?.value || defaultValue;
  cache.set(key, { value, fetchedAt: Date.now() });
  return value;
}

export async function getMaxLoginAttempts(): Promise<number> {
  const val = await getSetting('auth.maxLoginAttempts', '5');
  return parseInt(val, 10) || 5;
}

export async function getLockoutMinutes(): Promise<number> {
  const val = await getSetting('auth.lockoutMinutes', '30');
  return parseInt(val, 10) || 30;
}

export async function getCaptchaRequiredAfterAttempts(): Promise<number> {
  const val = await getSetting('auth.captchaRequiredAfterAttempts', '2');
  return parseInt(val, 10) || 2;
}

export async function getCaptchaTokenExpiryMinutes(): Promise<number> {
  const val = await getSetting('auth.captchaTokenExpiryMinutes', '5');
  return parseInt(val, 10) || 5;
}

export function clearAuthSettingsCache(): void {
  cache.clear();
}
