/**
 * Gold tag-subscription billing prices and Stripe price keys.
 * CMS is source of truth — no silent magic prices in Stripe mode.
 */
import { Setting } from '@pawtag/db';
import {
  DEFAULT_CURRENCY,
  GOLD_BILLING_SETTING_KEYS,
  STRIPE_CURRENCY_NZD,
  goldStripePriceSettingKey,
  type GoldBillingInterval,
} from '@pawtag/shared';

export interface GoldBillingPrices {
  monthly: number;
  annual: number;
  currency: string;
}

export class GoldBillingConfigError extends Error {
  readonly code = 'membership.gold_price_not_configured';
  constructor(message: string) {
    super(message);
    this.name = 'GoldBillingConfigError';
  }
}

export async function loadGoldBillingPrices(): Promise<GoldBillingPrices> {
  const [monthlySetting, annualSetting] = await Promise.all([
    Setting.findOne({ key: GOLD_BILLING_SETTING_KEYS.monthlyPrice }).lean(),
    Setting.findOne({ key: GOLD_BILLING_SETTING_KEYS.annualPrice }).lean(),
  ]);

  const monthly = Number(monthlySetting?.value);
  const annual = Number(annualSetting?.value);

  return {
    monthly: Number.isFinite(monthly) ? monthly : Number.NaN,
    annual: Number.isFinite(annual) ? annual : Number.NaN,
    currency: DEFAULT_CURRENCY,
  };
}

export function goldPriceForInterval(prices: GoldBillingPrices, interval: GoldBillingInterval): number {
  const value = interval === 'annual' ? prices.annual : prices.monthly;
  if (!Number.isFinite(value) || value <= 0) {
    throw new GoldBillingConfigError(
      `Gold ${interval} price is not configured in CMS settings`,
    );
  }
  return value;
}

export async function loadGoldStripeProductId(): Promise<string | null> {
  const setting = await Setting.findOne({ key: GOLD_BILLING_SETTING_KEYS.stripeProductId }).lean();
  return setting?.value || null;
}

export async function loadCachedGoldStripePriceId(
  interval: GoldBillingInterval,
): Promise<string | null> {
  const setting = await Setting.findOne({ key: goldStripePriceSettingKey(interval) }).lean();
  return setting?.value || null;
}

export async function cacheGoldStripePriceId(
  interval: GoldBillingInterval,
  priceId: string,
): Promise<void> {
  const key = goldStripePriceSettingKey(interval);
  await Setting.findOneAndUpdate(
    { key },
    { key, value: priceId },
    { upsert: true },
  );
}

export function stripeCurrencyForGold(): string {
  return STRIPE_CURRENCY_NZD;
}

export function goldBillingIntervalFromPlanType(planType: string): GoldBillingInterval {
  return planType === 'annual' ? 'annual' : 'monthly';
}
