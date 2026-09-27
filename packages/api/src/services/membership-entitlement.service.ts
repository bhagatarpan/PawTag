import { MembershipBenefit, MembershipTierBenefit, UserMembership, MembershipTier } from '@pawtag/db';

const CACHE_TTL = 60_000; // 60 seconds

interface CachedBenefits {
  benefits: Map<string, any>;
  tierValues: Map<string, any>; // key: `${tier}:${benefitKey}`
  userTier: Map<string, string | null>; // key: userId → tier string
  expiry: number;
}

let cache: CachedBenefits = {
  benefits: new Map(),
  tierValues: new Map(),
  userTier: new Map(),
  expiry: 0,
};

function isCacheValid(): boolean {
  return Date.now() < cache.expiry;
}

function invalidateCache(): void {
  cache = { benefits: new Map(), tierValues: new Map(), userTier: new Map(), expiry: 0 };
}

async function loadAllBenefits(): Promise<void> {
  if (isCacheValid() && cache.benefits.size > 0) return;

  const benefits = await MembershipBenefit.find({ enabled: true }).lean();
  const tierBenefits = await MembershipTierBenefit.find({}).lean();

  cache.benefits = new Map();
  for (const b of benefits) {
    cache.benefits.set(b.key, b);
  }

  cache.tierValues = new Map();
  for (const tb of tierBenefits) {
    cache.tierValues.set(`${tb.tier}:${tb.benefitKey}`, tb);
  }

  cache.expiry = Date.now() + CACHE_TTL;
}

async function getUserTierString(userId: string): Promise<string | null> {
  if (!userId) return null;

  await loadAllBenefits();

  // Check cache — but skip cached nulls to allow tier changes to take effect
  const cached = cache.userTier.get(userId);
  if (cached !== undefined && cached !== null) return cached;

  const membership = await UserMembership.findOne({
    userId,
    status: 'active',
  })
    .populate('tierId')
    .lean();

  const tierDoc = membership?.tierId as any;
  const tier: string | null = tierDoc?.tier || null;

  if (tier) {
    cache.userTier.set(userId, tier);
  }
  return tier;
}

/**
 * Check if a user has access to a boolean benefit.
 */
async function hasAccess(userId: string, benefitKey: string): Promise<boolean> {
  const tier = await getUserTierString(userId);
  if (!tier) return false;

  await loadAllBenefits();

  const benefit = cache.benefits.get(benefitKey);
  if (!benefit || !benefit.enabled) return false;

  const tierValue = cache.tierValues.get(`${tier}:${benefitKey}`);
  if (!tierValue) return (benefit.defaultValue as boolean) ?? false;
  return tierValue.enabled && (tierValue.value as boolean);
}

/**
 * Get a typed value for a user's benefit.
 */
async function getValue<T extends boolean | number | string | null>(
  userId: string,
  benefitKey: string
): Promise<T | null> {
  const tier = await getUserTierString(userId);
  if (!tier) return null;

  await loadAllBenefits();

  const benefit = cache.benefits.get(benefitKey);
  if (!benefit || !benefit.enabled) return null;

  const tierValue = cache.tierValues.get(`${tier}:${benefitKey}`);
  if (!tierValue || !tierValue.enabled) return null;

  const val = tierValue.value ?? benefit.defaultValue;
  return (val as T) ?? null;
}

/**
 * Get a benefit value for a specific tier (no userId needed).
 */
async function getTierValue(
  tier: string,
  benefitKey: string
): Promise<number | string | boolean | null> {
  await loadAllBenefits();

  const benefit = cache.benefits.get(benefitKey);
  if (!benefit || !benefit.enabled) return null;

  const tierValue = cache.tierValues.get(`${tier}:${benefitKey}`);
  if (!tierValue || !tierValue.enabled) return (benefit.defaultValue as any) ?? null;

  return tierValue.value ?? benefit.defaultValue ?? null;
}

/**
 * Get all benefits for a user's current tier.
 */
async function getUserEntitlements(
  userId: string
): Promise<Record<string, { enabled: boolean; value: any }>> {
  const tier = await getUserTierString(userId);
  if (!tier) return {};

  return getTierEntitlements(tier);
}

/**
 * Get all benefits for a specific tier.
 */
async function getTierEntitlements(
  tier: string
): Promise<Record<string, { enabled: boolean; value: any }>> {
  await loadAllBenefits();

  const result: Record<string, { enabled: boolean; value: any }> = {};

  for (const [key, benefit] of cache.benefits) {
    const tierValue = cache.tierValues.get(`${tier}:${key}`);
    result[key] = {
      enabled: tierValue?.enabled ?? false,
      value: tierValue?.value ?? benefit.defaultValue ?? null,
    };
  }

  return result;
}

/**
 * Get the full matrix for admin UI.
 */
async function getBenefitsMatrix(): Promise<{
  benefits: any[];
  tiers: string[];
  values: Record<string, Record<string, { enabled: boolean; value: any }>>;
}> {
  const benefits = await MembershipBenefit.find({}).sort({ category: 1, displayOrder: 1 }).lean();
  const tierBenefits = await MembershipTierBenefit.find({}).lean();
  const tiers = ['gold', 'platinum', 'black'];

  const valueMap = new Map<string, { enabled: boolean; value: any }>();
  for (const tb of tierBenefits) {
    valueMap.set(`${tb.tier}:${tb.benefitKey}`, {
      enabled: tb.enabled,
      value: tb.value,
    });
  }

  const values: Record<string, Record<string, { enabled: boolean; value: any }>> = {};
  for (const benefit of benefits) {
    values[benefit.key] = {};
    for (const tier of tiers) {
      const tv = valueMap.get(`${tier}:${benefit.key}`);
      values[benefit.key][tier] = {
        enabled: tv?.enabled ?? false,
        value: tv?.value ?? benefit.defaultValue ?? null,
      };
    }
  }

  return { benefits, tiers, values };
}

/**
 * Upsert a benefit definition (admin).
 */
async function upsertBenefit(data: {
  key: string;
  name: string;
  description?: string;
  type: 'boolean' | 'number' | 'string';
  category: string;
  defaultValue?: boolean | number | string | null;
  enabled?: boolean;
  displayOrder?: number;
}): Promise<any> {
  const benefit = await MembershipBenefit.findOneAndUpdate(
    { key: data.key },
    {
      $set: {
        name: data.name,
        description: data.description ?? '',
        type: data.type,
        category: data.category,
        defaultValue: data.defaultValue ?? null,
        enabled: data.enabled ?? true,
        displayOrder: data.displayOrder ?? 0,
      },
    },
    { upsert: true, new: true }
  ).lean();

  // Ensure tier entries exist for all tiers
  const tiers = ['gold', 'platinum', 'black'] as const;
  for (const tier of tiers) {
    await MembershipTierBenefit.findOneAndUpdate(
      { benefitKey: data.key, tier },
      {
        $setOnInsert: {
          benefitKey: data.key,
          tier,
          enabled: false,
          value: data.defaultValue ?? null,
        },
      },
      { upsert: true }
    );
  }

  invalidateCache();
  return benefit;
}

/**
 * Delete a benefit definition and all tier values.
 */
async function deleteBenefit(key: string): Promise<void> {
  await MembershipBenefit.deleteOne({ key });
  await MembershipTierBenefit.deleteMany({ benefitKey: key });
  invalidateCache();
}

/**
 * Update a single tier benefit value (admin cell edit).
 */
async function setTierBenefit(
  tier: string,
  benefitKey: string,
  enabled: boolean,
  value: boolean | number | string | null
): Promise<any> {
  const result = await MembershipTierBenefit.findOneAndUpdate(
    { benefitKey, tier },
    { $set: { enabled, value } },
    { upsert: true, new: true }
  ).lean();

  invalidateCache();
  return result;
}

/**
 * Bulk update all tier benefits for a tier (admin column edit).
 */
async function setTierBenefits(
  tier: string,
  benefits: Record<string, { enabled: boolean; value: boolean | number | string | null }>
): Promise<void> {
  const ops = Object.entries(benefits).map(([benefitKey, { enabled, value }]) => ({
    updateOne: {
      filter: { benefitKey, tier },
      update: { $set: { enabled, value } },
      upsert: true,
    },
  }));

  await MembershipTierBenefit.bulkWrite(ops);
  invalidateCache();
}

export const membershipEntitlementService = {
  hasAccess,
  getValue,
  getTierValue,
  getUserEntitlements,
  getTierEntitlements,
  getBenefitsMatrix,
  upsertBenefit,
  deleteBenefit,
  setTierBenefit,
  setTierBenefits,
  invalidateCache,
  getUserTierString,
};
