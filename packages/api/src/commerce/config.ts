/**
 * @module CommerceConfig
 * @description CMS-driven commerce configuration service.
 *
 * All business values are stored in the `settings` collection, NOT hardcoded.
 * This service provides typed accessors for commerce-related settings.
 *
 * Settings are cached in-memory for 60 seconds to reduce database reads.
 *
 * Setting key convention: `commerce.category.property`
 *
 * @example
 * ```typescript
 * const taxRate = await commerceConfig.get('commerce.tax.rate');
 * const freeShippingThreshold = await commerceConfig.get('commerce.shipping.freeThreshold');
 * ```
 */

import { Setting } from '@pawtag/db';
import logger from '../lib/logger';

/** Cache entry with TTL */
interface CacheEntry {
  value: string;
  expiresAt: number;
}

/** Cache TTL in milliseconds (60 seconds) */
const CACHE_TTL_MS = 60_000;

/** In-memory settings cache */
const cache = new Map<string, CacheEntry>();

/**
 * All commerce setting keys and their default values.
 * Use this as the single source of truth for available settings.
 */
export const COMMERCE_SETTINGS = {
  // ─── Payment ──────────────────────────────────────────────
  'commerce.payment.provider': { default: 'stripe', description: 'Payment provider identifier' },
  'commerce.payment.currency': { default: 'NZD', description: 'Default currency code' },
  'commerce.payment.testMode': { default: 'true', description: 'Enable demo/test payment mode' },

  // ─── Shipping ─────────────────────────────────────────────
  'commerce.shipping.enabled': { default: 'true', description: 'Enable shipping calculation' },
  'commerce.shipping.provider': { default: 'nz-shipping', description: 'Shipping provider identifier' },
  'commerce.shipping.freeEnabled': { default: 'true', description: 'Enable free shipping' },
  'commerce.shipping.freeThreshold': { default: '0', description: 'Minimum order amount for free shipping (0 = always free)' },
  'commerce.shipping.flatRate': { default: '0', description: 'Flat rate shipping cost (0 = free)' },
  'commerce.shipping.taxEnabled': { default: 'false', description: 'Apply tax to shipping' },
  'commerce.shipping.defaultCarrier': { default: 'nz-post', description: 'Default carrier identifier' },
  'commerce.shipping.rateTypes': { default: 'free,flat_rate,weight_based,price_based', description: 'Available rate types (comma-separated)' },
  'commerce.shipping.carriers': { default: 'nz-post,courierpost,aramex,dhl,fedex,ups', description: 'Available carriers (comma-separated)' },
  'commerce.shipping.nzpostClientId': { default: '', description: 'NZ Post API client ID (leave empty for demo mode)' },
  'commerce.shipping.nzpostClientSecret': { default: '', description: 'NZ Post API client secret' },
  'commerce.shipping.nzpostLive': { default: 'false', description: 'Use NZ Post live API (false = sandbox)' },

  // ─── Tax ──────────────────────────────────────────────────
  'commerce.tax.enabled': { default: 'true', description: 'Enable tax calculation' },
  'commerce.tax.provider': { default: 'nz-gst', description: 'Tax provider identifier' },
  'commerce.tax.rate': { default: '0.15', description: 'Tax rate (0.15 = 15% GST)' },
  'commerce.tax.label': { default: 'GST', description: 'Tax label for display' },
  'commerce.tax.inclusive': { default: 'true', description: 'Prices include tax' },

  // ─── Inventory ────────────────────────────────────────────
  'commerce.inventory.enabled': { default: 'true', description: 'Enable inventory tracking' },
  'commerce.inventory.lowStockThreshold': { default: '10', description: 'Low stock alert threshold' },
  'commerce.inventory.outOfStockThreshold': { default: '0', description: 'Out of stock threshold' },
  'commerce.inventory.defaultPolicy': { default: 'deny', description: 'Default stock policy (deny or allow)' },
  'commerce.inventory.reservationTtlMinutes': { default: '30', description: 'How long to hold stock during checkout' },

  // ─── Checkout ─────────────────────────────────────────────
  'commerce.checkout.guestEnabled': { default: 'false', description: 'Allow guest checkout' },
  'commerce.checkout.verificationRequired': { default: 'true', description: 'Require email+phone verification' },
  'commerce.checkout.termsRequired': { default: 'true', description: 'Require terms acceptance' },
  'commerce.checkout.pendingOrderTtlMinutes': { default: '30', description: 'How long a pending order is held' },

  // ─── Cart ─────────────────────────────────────────────────
  'commerce.cart.ttlDays': { default: '30', description: 'How long items stay in a cart before expiry' },
  'commerce.cart.priceRevalidation': { default: 'true', description: 'Re-validate prices when cart is loaded' },
  'commerce.cart.maxItems': { default: '50', description: 'Maximum number of unique items in a cart' },

  // ─── Orders ───────────────────────────────────────────────
  'commerce.orders.autoCancelMinutes': { default: '60', description: 'Auto-cancel unpaid orders after this many minutes' },
  'commerce.orders.numberPrefix': { default: 'PT', description: 'Order number prefix' },
  'commerce.orders.numberLength': { default: '6', description: 'Order number length after prefix' },

  // ─── Subscriptions ────────────────────────────────────────
  'commerce.subscriptions.annualPrice': { default: '0.99', description: 'Annual subscription price (NZD)' },
  'commerce.subscriptions.monthlyPrice': { default: '1.99', description: 'Monthly subscription price (NZD)' },
  'commerce.subscriptions.freePeriodMonths': { default: '12', description: 'Free period in months' },
  'commerce.subscriptions.gracePeriodWeeks': { default: '4', description: 'Grace period in weeks' },

  // ─── Refunds ──────────────────────────────────────────────
  'commerce.refunds.enabled': { default: 'true', description: 'Allow refunds' },
  'commerce.refunds.maxDaysAfterPurchase': { default: '60', description: 'Maximum days after purchase for refund' },
  'commerce.refunds.partialEnabled': { default: 'true', description: 'Allow partial refunds' },

  // ─── Promotions ───────────────────────────────────────────
  'commerce.promotions.enabled': { default: 'true', description: 'Enable discount codes' },
  'commerce.promotions.maxUsesPerCode': { default: '1000', description: 'Maximum uses per discount code' },
  'commerce.promotions.bundle2Items': { default: '10', description: 'Bundle discount % for 2 items' },
  'commerce.promotions.bundle3PlusItems': { default: '15', description: 'Bundle discount % for 3+ items' },

  // ─── Notifications ────────────────────────────────────────
  'commerce.notifications.orderConfirmation': { default: 'true', description: 'Send order confirmation email' },
  'commerce.notifications.invoiceEmail': { default: 'true', description: 'Send invoice email' },
  'commerce.notifications.adminAlert': { default: 'true', description: 'Send admin alert for new orders' },
  'commerce.notifications.shippingUpdate': { default: 'true', description: 'Send shipping update email' },

  // ─── Feature Flags ────────────────────────────────────────
  'commerce.feature.stripeSignatureVerification': { default: 'true', description: 'Verify Stripe webhook signatures' },
  'commerce.feature.orphanPaymentDetection': { default: 'true', description: 'Detect orphaned payments' },
  'commerce.feature.priceValidation': { default: 'true', description: 'Server-side price validation' },
} as const;

/** Setting key type */
export type CommerceSettingKey = keyof typeof COMMERCE_SETTINGS;

/**
 * Get a commerce setting value from the database with caching.
 *
 * @param key - Setting key (e.g., 'commerce.tax.rate')
 * @returns Setting value as string, or default if not found
 */
export async function getSetting(key: CommerceSettingKey): Promise<string> {
  // Check cache first
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const setting = await Setting.findOne({ key }).lean();
    const value = setting?.value ?? COMMERCE_SETTINGS[key].default;

    // Cache the value
    cache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return value;
  } catch (err) {
    logger.warn({ err, key }, 'Failed to read commerce setting, using default');
    return COMMERCE_SETTINGS[key].default;
  }
}

/**
 * Get a commerce setting value as a number.
 *
 * @param key - Setting key
 * @returns Setting value as number
 */
export async function getNumberSetting(key: CommerceSettingKey): Promise<number> {
  const value = await getSetting(key);
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    logger.warn({ key, value }, 'Commerce setting is not a valid number, using default');
    return parseFloat(COMMERCE_SETTINGS[key].default);
  }
  return parsed;
}

/**
 * Get a commerce setting value as a boolean.
 *
 * @param key - Setting key
 * @returns Setting value as boolean
 */
export async function getBooleanSetting(key: CommerceSettingKey): Promise<boolean> {
  const value = await getSetting(key);
  return value === 'true' || value === '1';
}

/**
 * Update a commerce setting value.
 *
 * @param key - Setting key
 * @param value - New value
 * @param actor - Who made the change (for audit)
 */
export async function updateSetting(
  key: CommerceSettingKey,
  value: string,
  actor: string,
): Promise<void> {
  await Setting.findOneAndUpdate(
    { key },
    { key, value, updatedAt: new Date() },
    { upsert: true },
  );

  // Invalidate cache
  cache.delete(key);

  logger.info({ key, value, actor }, 'Commerce setting updated');
}

/**
 * Get all commerce settings (for admin UI).
 *
 * @returns All commerce settings with their current values and metadata
 */
export async function getAllSettings(): Promise<Array<{
  key: CommerceSettingKey;
  value: string;
  default: string;
  description: string;
}>> {
  const keys = Object.keys(COMMERCE_SETTINGS) as CommerceSettingKey[];
  const results = await Promise.all(
    keys.map(async (key) => ({
      key,
      value: await getSetting(key),
      default: COMMERCE_SETTINGS[key].default,
      description: COMMERCE_SETTINGS[key].description,
    })),
  );
  return results;
}

/**
 * Clear the settings cache (e.g., after a bulk update).
 */
export function clearCache(): void {
  cache.clear();
}
