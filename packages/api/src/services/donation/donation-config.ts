/**
 * Donation configuration — ALL product values from Setting (no hardcode in UI/domain).
 * Defaults live here only as seed/fallback documentation; admin can override via Settings.
 */
import { Setting } from '@pawtag/db';
import { dollarsToCents } from '@pawtag/shared';
import type { DonationSettingsPublic, DonationFrequency } from '@pawtag/shared';
import logger from '../../lib/logger';

export const DONATION_SETTING_DEFAULTS = {
  'donation.enabled': 'true',
  'donation.publicEnabled': 'false',
  'donation.currency': 'NZD',
  'donation.frequenciesEnabled': 'one_time,monthly',
  'donation.suggestedAmounts': '5,10,20,50',
  'donation.minAmountCents': '500',
  'donation.maxAmountCents': '1000000',
  'donation.rateLimit.createPerHour': '20',
  'donation.captcha.required': 'false',
  'donation.mission.headline': 'Help reunite lost pets with their families',
  'donation.mission.body': 'Your support keeps finder recovery working for lost pets across New Zealand.',
  'donation.receipt.organisationName': 'PawTag',
  'donation.receipt.numberPrefix': 'PTD',
  'donation.receipt.irdNumber': '',
  'donation.receipt.charitiesNumber': '',
  'donation.receipt.taxClassification': 'neutral',
  'donation.receipt.statement': 'Thank you for your donation to PawTag.',
  'donation.receipt.signatory': '',
  'donation.recurring.enabled': 'true',
} as const;

const cache = new Map<string, { value: string; at: number }>();
const TTL = 60_000;

async function readSetting(key: keyof typeof DONATION_SETTING_DEFAULTS): Promise<string> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  try {
    const doc = await Setting.findOne({ key }).lean();
    const value = doc?.value ?? DONATION_SETTING_DEFAULTS[key];
    cache.set(key, { value, at: Date.now() });
    return value;
  } catch {
    return DONATION_SETTING_DEFAULTS[key];
  }
}

export function invalidateDonationSettingsCache(): void {
  cache.clear();
}

export async function getDonationSettings(): Promise<DonationSettingsPublic> {
  const [
    currency,
    suggestedRaw,
    minCents,
    maxCents,
    frequenciesRaw,
    headline,
    body,
    orgName,
    taxClass,
    statement,
    publicEnabled,
    numberPrefix,
  ] = await Promise.all([
    readSetting('donation.currency'),
    readSetting('donation.suggestedAmounts'),
    readSetting('donation.minAmountCents'),
    readSetting('donation.maxAmountCents'),
    readSetting('donation.frequenciesEnabled'),
    readSetting('donation.mission.headline'),
    readSetting('donation.mission.body'),
    readSetting('donation.receipt.organisationName'),
    readSetting('donation.receipt.taxClassification'),
    readSetting('donation.receipt.statement'),
    readSetting('donation.publicEnabled'),
    readSetting('donation.receipt.numberPrefix'),
  ]);

  const suggestedAmounts = suggestedRaw
    .split(',')
    .map((s) => parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const frequencies = frequenciesRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is DonationFrequency => s === 'one_time' || s === 'monthly');

  return {
    currency: currency || 'NZD',
    suggestedAmounts: suggestedAmounts.length ? suggestedAmounts : [5, 10, 20, 50],
    minAmountCents: parseInt(minCents, 10) || 500,
    maxAmountCents: parseInt(maxCents, 10) || 1000000,
    frequencies: frequencies.length ? frequencies : ['one_time'],
    missionHeadline: headline,
    missionBody: body,
    organisationName: orgName || 'PawTag',
    taxClassification: taxClass || 'neutral',
    receiptStatement: statement,
    publicEnabled: publicEnabled === 'true',
    numberPrefix: (numberPrefix || 'PTD').trim().toUpperCase() || 'PTD',
  };
}

export async function getDonationReceiptPrefix(): Promise<string> {
  const raw = await readSetting('donation.receipt.numberPrefix');
  return (raw || 'PTD').trim().toUpperCase() || 'PTD';
}

export async function validateDonationAmount(amountDollars: number): Promise<{ ok: true; amountCents: number } | { ok: false; error: string }> {
  const settings = await getDonationSettings();
  const amountCents = dollarsToCents(amountDollars);

  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    return { ok: false, error: 'Please enter a valid donation amount' };
  }
  if (amountCents < settings.minAmountCents) {
    return { ok: false, error: `Minimum donation is $${(settings.minAmountCents / 100).toFixed(2)}` };
  }
  if (amountCents > settings.maxAmountCents) {
    return { ok: false, error: `Maximum donation is $${(settings.maxAmountCents / 100).toFixed(2)}` };
  }
  return { ok: true, amountCents };
}

export async function isDonationModuleEnabled(): Promise<boolean> {
  return (await readSetting('donation.enabled')) === 'true';
}

export async function seedDonationSettingsIfMissing(): Promise<void> {
  try {
    for (const [key, value] of Object.entries(DONATION_SETTING_DEFAULTS)) {
      // Setting.value is required — skip empty strings; missing keys fall back to defaults on read
      if (!value) continue;
      const existing = await Setting.findOne({ key }).lean();
      if (!existing) {
        const anyUser = await mongooseUserFallback();
        await Setting.create({
          key,
          value,
          category: 'donation',
          description: `Donation setting ${key}`,
          updatedBy: anyUser,
        });
      }
    }
    invalidateDonationSettingsCache();
    logger.info('Donation settings seeded where missing');
  } catch (err) {
    logger.warn({ err }, 'Failed to seed donation settings');
  }
}

async function mongooseUserFallback(): Promise<any> {
  const { User } = await import('@pawtag/db');
  const user = await User.findOne({ role: 'admin' }).lean();
  if (user?._id) return user._id;
  const created = await User.create({
    email: 'system@pawtag.local',
    passwordHash: 'seed-only-not-login',
    fullName: 'System',
    phoneNumber: '+64000000000',
    role: 'admin',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
  });
  return created._id;
}
