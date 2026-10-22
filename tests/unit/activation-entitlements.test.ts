import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Free 3-Month Activation benefit context — docs/ACTIVATION-ENTITLEMENTS.md.
 * Context resolution matrix + registry-driven hasAccess/getValue/entitlements.
 */

const mocks = vi.hoisted(() => ({
  benefitFind: vi.fn(),
  tierBenefitFind: vi.fn(),
  membershipFindOne: vi.fn(),
  tierFindOne: vi.fn(),
  tagExists: vi.fn(),
}));

vi.mock('@pawtag/db', () => ({
  MembershipBenefit: { find: (...a: any[]) => mocks.benefitFind(...a) },
  MembershipTierBenefit: { find: (...a: any[]) => mocks.tierBenefitFind(...a) },
  UserMembership: { findOne: (...a: any[]) => mocks.membershipFindOne(...a) },
  MembershipTier: { findOne: (...a: any[]) => mocks.tierFindOne(...a) },
  Tag: { exists: (...a: any[]) => mocks.tagExists(...a) },
}));

import { membershipEntitlementService, ACTIVATION_CONTEXT } from '../../packages/api/src/services/membership-entitlement.service';

const BENEFITS = [
  { key: 'pet_health_records', enabled: true, defaultValue: true, type: 'boolean', name: 'Pet Health Records' },
  { key: 'medical_alerts', enabled: true, defaultValue: true, type: 'boolean', name: 'Medical Alerts' },
  { key: 'in_app_notifications', enabled: true, defaultValue: true, type: 'boolean', name: 'In-App Notifications' },
  { key: 'free_shipping_threshold', enabled: true, defaultValue: null, type: 'number', name: 'Free Shipping Threshold' },
  { key: 'points_multiplier', enabled: true, defaultValue: 1, type: 'number', name: 'Points Multiplier' },
];

const TIER_ROWS = [
  { tier: 'gold', benefitKey: 'pet_health_records', enabled: true, value: true },
  { tier: 'gold', benefitKey: 'free_shipping_threshold', enabled: true, value: 100 },
  // Free 3-Month Activation: features on, money perks off
  { tier: ACTIVATION_CONTEXT, benefitKey: 'pet_health_records', enabled: true, value: true },
  { tier: ACTIVATION_CONTEXT, benefitKey: 'medical_alerts', enabled: true, value: true },
  { tier: ACTIVATION_CONTEXT, benefitKey: 'in_app_notifications', enabled: true, value: true },
  { tier: ACTIVATION_CONTEXT, benefitKey: 'free_shipping_threshold', enabled: false, value: null },
  { tier: ACTIVATION_CONTEXT, benefitKey: 'points_multiplier', enabled: false, value: null },
];

function membershipFor(tier: string | null) {
  return {
    populate: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(tier ? { tierId: { tier } } : null),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.benefitFind.mockReturnValue({ lean: vi.fn().mockResolvedValue(BENEFITS) });
  mocks.tierBenefitFind.mockReturnValue({ lean: vi.fn().mockResolvedValue(TIER_ROWS) });
  mocks.membershipFindOne.mockReturnValue(membershipFor(null));
  mocks.tagExists.mockResolvedValue(null);
  mocks.tierFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
  membershipEntitlementService.invalidateCache();
});

describe('getUserBenefitContext', () => {
  it('resolves to the paid tier when a membership exists (tag window never overrides)', async () => {
    mocks.membershipFindOne.mockReturnValue(membershipFor('gold'));
    mocks.tagExists.mockResolvedValue({ _id: 'tag1' });

    expect(await membershipEntitlementService.getUserBenefitContext('u1')).toBe('gold');
    expect(mocks.tagExists).not.toHaveBeenCalled();
  });

  it("resolves to 'activation' for a tag buyer inside the Active Period", async () => {
    mocks.tagExists.mockResolvedValue({ _id: 'tag1' });
    expect(await membershipEntitlementService.getUserBenefitContext('u1')).toBe(ACTIVATION_CONTEXT);
    // Same clock + release rules the finder/tag-release use
    expect(mocks.tagExists).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'u1',
      deletedAt: null,
      status: { $nin: ['returned', 'cancelled'] },
      activePeriodEndsAt: { $gt: expect.any(Date) },
    }));
  });

  it('resolves to null with no membership and no active tag', async () => {
    mocks.tagExists.mockResolvedValue(null);
    expect(await membershipEntitlementService.getUserBenefitContext('u2')).toBeNull();
  });

  it('a window that ENDS locks after the cache TTL (activation entries are not cached forever)', async () => {
    vi.useFakeTimers();
    try {
      mocks.tagExists.mockResolvedValue({ _id: 'tag1' });
      expect(await membershipEntitlementService.getUserBenefitContext('u-ttl')).toBe(ACTIVATION_CONTEXT);

      // Window ends + benefits TTL passes → must re-check, not serve stale activation
      mocks.tagExists.mockResolvedValue(null);
      vi.advanceTimersByTime(61_000);
      expect(await membershipEntitlementService.getUserBenefitContext('u-ttl')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('hasAccess / getValue across contexts', () => {
  it('activation users get feature benefits (health records, medical alerts, notifications)', async () => {
    mocks.tagExists.mockResolvedValue({ _id: 'tag1' });

    expect(await membershipEntitlementService.hasAccess('u1', 'pet_health_records')).toBe(true);
    expect(await membershipEntitlementService.hasAccess('u1', 'medical_alerts')).toBe(true);
    expect(await membershipEntitlementService.hasAccess('u1', 'in_app_notifications')).toBe(true);
  });

  it('activation users do NOT get money perks (founder decision)', async () => {
    mocks.tagExists.mockResolvedValue({ _id: 'tag1' });

    expect(await membershipEntitlementService.getValue<number>('u1', 'free_shipping_threshold')).toBeNull();
    expect(await membershipEntitlementService.getValue<number>('u1', 'points_multiplier')).toBeNull();
  });

  it('paid tiers keep their own values (gold keeps its $100 threshold)', async () => {
    mocks.membershipFindOne.mockReturnValue(membershipFor('gold'));

    expect(await membershipEntitlementService.getValue<number>('u1', 'free_shipping_threshold')).toBe(100);
    expect(await membershipEntitlementService.hasAccess('u1', 'pet_health_records')).toBe(true);
  });

  it('users without any context get nothing (locked)', async () => {
    expect(await membershipEntitlementService.hasAccess('u3', 'pet_health_records')).toBe(false);
    expect(await membershipEntitlementService.getValue<number>('u3', 'free_shipping_threshold')).toBeNull();
    expect(await membershipEntitlementService.getUserEntitlements('u3')).toEqual({});
  });

  it('activation context without an explicit row falls back to the registry defaultValue (finder-notify safety)', async () => {
    // Rows missing for this one benefit → hasAccess falls back to the
    // benefit's defaultValue (true), so notification delivery never breaks
    // for activation users when an admin adds/renames rows.
    mocks.tierBenefitFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue(
        TIER_ROWS.filter((r) => !(r.tier === ACTIVATION_CONTEXT && r.benefitKey === 'in_app_notifications')),
      ),
    });
    mocks.tagExists.mockResolvedValue({ _id: 'tag1' });

    expect(await membershipEntitlementService.hasAccess('u1', 'in_app_notifications')).toBe(true);
  });
});

describe('getUserEntitlements', () => {
  it('returns the activation map for a free-activation user (PetCard lock source)', async () => {
    mocks.tagExists.mockResolvedValue({ _id: 'tag1' });

    const entitlements = await membershipEntitlementService.getUserEntitlements('u1');
    expect(entitlements.pet_health_records).toEqual(expect.objectContaining({ enabled: true, value: true }));
    expect(entitlements.free_shipping_threshold.enabled).toBe(false);
  });
});

describe('isEditableTierContext', () => {
  it('accepts the activation pseudo-tier without a MembershipTier doc', async () => {
    expect(await membershipEntitlementService.isEditableTierContext(ACTIVATION_CONTEXT)).toBe(true);
    expect(mocks.tierFindOne).not.toHaveBeenCalled();
  });

  it('accepts real MembershipTier products and rejects unknown strings', async () => {
    mocks.tierFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ tier: 'gold' }) });
    expect(await membershipEntitlementService.isEditableTierContext('gold')).toBe(true);

    mocks.tierFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    expect(await membershipEntitlementService.isEditableTierContext('nope')).toBe(false);
  });
});
