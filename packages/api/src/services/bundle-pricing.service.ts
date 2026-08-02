import { Setting } from '@pawtag/db';

const cache = new Map<string, { value: number; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 1000;

function getBundleDiscount(itemCount: number): number {
  if (itemCount >= 3) return 15;
  if (itemCount >= 2) return 10;
  return 0;
}

async function getNumericSetting(key: string, defaultValue: number): Promise<number> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }
  const setting = await Setting.findOne({ key }).lean();
  const value = setting ? parseInt(setting.value, 10) : defaultValue;
  if (!isNaN(value)) {
    cache.set(key, { value, fetchedAt: Date.now() });
  }
  return isNaN(value) ? defaultValue : value;
}

export interface BundleDiscountResult {
  percent: number;
  amount: number;
  reason: string;
  subscriptionItemCount: number;
}

export async function calculateBundleDiscount(
  items: Array<{ productId: string; isSubscription: boolean; unitPrice: number; quantity: number }>,
): Promise<BundleDiscountResult> {
  const subscriptionItems = items.filter(i => i.isSubscription);
  const subscriptionItemCount = subscriptionItems.reduce((sum, i) => sum + i.quantity, 0);

  const percent = getBundleDiscount(subscriptionItemCount);

  if (percent === 0) {
    return { percent: 0, amount: 0, reason: '', subscriptionItemCount };
  }

  const subtotal = subscriptionItems.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);
  const amount = Math.round(subtotal * (percent / 100) * 100) / 100;

  const reason = subscriptionItemCount >= 3
    ? `Bundle discount: ${subscriptionItemCount} tags (${percent}% off)`
    : `Bundle discount: ${subscriptionItemCount} tags (${percent}% off)`;

  return { percent, amount, reason, subscriptionItemCount };
}

export function clearBundlePricingCache(): void {
  cache.clear();
}
