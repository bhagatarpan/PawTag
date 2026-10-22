import { MembershipBenefit, MembershipTierBenefit, UserMembership, MembershipTier, Tag } from '@pawtag/db';

const CACHE_TTL = 60_000; // 60 seconds

/**
 * Pseudo-tier benefit context for the FREE 3-Month Activation window
 * (docs/ACTIVATION-ENTITLEMENTS.md): every tag purchase ships with an
 * Active Period during which the buyer has "all features except money
 * perks". Values live in MembershipTierBenefit rows (`tier: 'activation'`)
 * and are admin-editable, but NO MembershipTier product doc exists — the
 * context can never be subscribed to.
 */
export const ACTIVATION_CONTEXT = 'activation';

/** Released tags (docs/TAG-RELEASE-ON-CANCEL-REFUND.md) never grant activation. */
const RELEASED_TAG_STATUSES = ['returned', 'cancelled'];

interface CachedBenefits {
  benefits: Map<string, any>;
  tierValues: Map<string, any>; // key: `${tier}:${benefitKey}`
  userTier: Map<string, string | null>; // key: userId → tier string
  userActivation: Map<string, { context: string | null; at: number }>; // per-entry TTL — window end locks within CACHE_TTL
  expiry: number;
}

let cache: CachedBenefits = {
  benefits: new Map(),
  tierValues: new Map(),
  userTier: new Map(),
  userActivation: new Map(),
  expiry: 0,
};

function isCacheValid(): boolean {
  return Date.now() < cache.expiry;
}

function invalidateCache(): void {
  cache = { benefits: new Map(), tierValues: new Map(), userTier: new Map(), userActivation: new Map(), expiry: 0 };
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
 * Resolve the user's benefit context: paid tier when they have an active
 * membership, otherwise 'activation' while any owned tag is inside its
 * Active Period ("FREE 3 Month Activation with all features" — product
 * promise on every tag card). Uses the SAME `activePeriodEndsAt` clock the
 * finder uses, so entitlements can never drift from the tag promise.
 */
async function getUserBenefitContext(userId: string): Promise<string | null> {
  if (!userId) return null;

  const paidTier = await getUserTierString(userId);
  if (paidTier) return paidTier;

  // Per-entry TTL (same length as the benefits cache) — a window ending
  // locks at most one TTL later; the finder itself decides access by date
  // at request time regardless of this cache.
  const cached = cache.userActivation.get(userId);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.context;

  const inActivationWindow = await Tag.exists({
    ownerId: userId,
    deletedAt: null,
    status: { $nin: RELEASED_TAG_STATUSES },
    activePeriodEndsAt: { $gt: new Date() },
  });

  const context = inActivationWindow ? ACTIVATION_CONTEXT : null;
  cache.userActivation.set(userId, { context, at: Date.now() });
  return context;
}

/**
 * Check if a user has access to a boolean benefit.
 */
async function hasAccess(userId: string, benefitKey: string): Promise<boolean> {
  const context = await getUserBenefitContext(userId);
  if (!context) return false;

  await loadAllBenefits();

  const benefit = cache.benefits.get(benefitKey);
  if (!benefit || !benefit.enabled) return false;

  const tierValue = cache.tierValues.get(`${context}:${benefitKey}`);
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
  const context = await getUserBenefitContext(userId);
  if (!context) return null;

  await loadAllBenefits();

  const benefit = cache.benefits.get(benefitKey);
  if (!benefit || !benefit.enabled) return null;

  const tierValue = cache.tierValues.get(`${context}:${benefitKey}`);
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
 * Get all benefits for a user's current context (paid tier or activation).
 */
async function getUserEntitlements(
  userId: string
): Promise<Record<string, { enabled: boolean; value: any; name?: string; description?: string }>> {
  const context = await getUserBenefitContext(userId);
  if (!context) return {};

  return getTierEntitlements(context);
}

/**
 * Get all benefits for a specific tier.
 */
async function getTierEntitlements(
  tier: string
): Promise<Record<string, { enabled: boolean; value: any; name?: string; description?: string }>> {
  await loadAllBenefits();

  const result: Record<string, { enabled: boolean; value: any; name?: string; description?: string }> = {};

  for (const [key, benefit] of cache.benefits) {
    const tierValue = cache.tierValues.get(`${tier}:${key}`);
    result[key] = {
      enabled: tierValue?.enabled ?? false,
      value: tierValue?.value ?? benefit.defaultValue ?? null,
      name: benefit.name,
      description: benefit.description,
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
  // Dynamic tier list from MembershipTier collection (no hardcoded values),
  // plus the non-subscribable activation context (founder product promise).
  const tierDocs = await MembershipTier.find({}).select('tier').sort({ displayOrder: 1 }).lean();
  const tiers = [...tierDocs.map(t => t.tier), ACTIVATION_CONTEXT];

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

  // Ensure tier entries exist for all tiers (dynamic from MembershipTier
  // collection) plus the activation context — new benefits always get an
  // (initially disabled) activation cell too.
  const tierDocs = await MembershipTier.find({}).select('tier').lean();
  const tiers = [...tierDocs.map(t => t.tier), ACTIVATION_CONTEXT];
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

/**
 * Tier contexts an admin may edit: real MembershipTier products plus the
 * activation pseudo-tier (single definition — routes must not hardcode lists).
 */
async function isEditableTierContext(tier: string): Promise<boolean> {
  if (tier === ACTIVATION_CONTEXT) return true;
  const tierDoc = await MembershipTier.findOne({ tier }).lean();
  return !!tierDoc;
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
  getUserBenefitContext,
  isEditableTierContext,
  ACTIVATION_CONTEXT,
};
