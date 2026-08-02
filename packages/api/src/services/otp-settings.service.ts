import { Setting } from '@pawtag/db';

const cache = new Map<string, { value: string; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

async function getSetting(key: string): Promise<string> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const setting = await Setting.findOne({ key }).lean();
  const value = setting?.value || 'false';
  cache.set(key, { value, fetchedAt: Date.now() });
  return value;
}

export async function isInvoiceOtpDisabled(): Promise<boolean> {
  const val = await getSetting('otp.noOtpForInvoice');
  return val === 'true';
}

export async function isRegistrationOtpDisabled(): Promise<boolean> {
  const val = await getSetting('otp.noOtpDuringRegistration');
  return val === 'true';
}

export function clearOtpSettingsCache(): void {
  cache.clear();
}
