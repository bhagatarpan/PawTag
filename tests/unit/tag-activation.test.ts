import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tag activation cap — docs/TAG-ACTIVATION-LIMIT.md business rules:
 * limit resolution (paid tier → commerce setting), the three cap states,
 * paid-fee idempotency, unused-paid-fee guard, replacement bypass.
 */

const mocks = vi.hoisted(() => ({
  tagCountDocuments: vi.fn(),
  tagFindOne: vi.fn(),
  orderFindOne: vi.fn(),
  orderFind: vi.fn(),
  getNumberSetting: vi.fn(),
  getUserBenefitContext: vi.fn(),
  getValue: vi.fn(),
}));

vi.mock('@pawtag/db', () => ({
  Tag: {
    countDocuments: (...a: any[]) => mocks.tagCountDocuments(...a),
    findOne: (...a: any[]) => mocks.tagFindOne(...a),
  },
  Order: {
    findOne: (...a: any[]) => mocks.orderFindOne(...a),
    find: (...a: any[]) => mocks.orderFind(...a),
  },
}));

vi.mock('../../packages/api/src/commerce/config', () => ({
  getNumberSetting: (...a: any[]) => mocks.getNumberSetting(...a),
}));

vi.mock('../../packages/api/src/services/membership-entitlement.service', () => ({
  ACTIVATION_CONTEXT: 'activation',
  membershipEntitlementService: {
    getUserBenefitContext: (...a: any[]) => mocks.getUserBenefitContext(...a),
    getValue: (...a: any[]) => mocks.getValue(...a),
  },
}));

import { tagActivationService } from '../../packages/api/src/commerce/services/tag-activation.service';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getNumberSetting.mockImplementation(async (key: string) =>
    key === 'commerce.tagActivation.nonMemberLimit' ? 2 : key === 'commerce.tagActivation.feeAmount' ? 19.99 : 0,
  );
  mocks.getUserBenefitContext.mockResolvedValue(null); // default: non-member
  mocks.getValue.mockResolvedValue(null);
  mocks.tagCountDocuments.mockResolvedValue(0);
  // Order.findOne(...).select(...) and Order.find(...).select(...).limit(...) chains
  mocks.orderFindOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
  mocks.orderFind.mockReturnValue({ select: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) });
});

describe('resolveTagLimit', () => {
  it('paid members use their tier registry value (Gold = 3)', async () => {
    mocks.getUserBenefitContext.mockResolvedValue('gold');
    mocks.getValue.mockImplementation(async (_u: string, key: string) => (key === 'tag_limit' ? 3 : null));

    expect(await tagActivationService.resolveTagLimit('u1')).toBe(3);
  });

  it('non-members (incl. free 3-month activation) use the commerce setting (2)', async () => {
    mocks.getUserBenefitContext.mockResolvedValue('activation');
    expect(await tagActivationService.resolveTagLimit('u2')).toBe(2);

    mocks.getUserBenefitContext.mockResolvedValue(null);
    expect(await tagActivationService.resolveTagLimit('u3')).toBe(2);
  });

  it('falls back to the setting when a paid tier has no tag_limit row', async () => {
    mocks.getUserBenefitContext.mockResolvedValue('gold');
    mocks.getValue.mockResolvedValue(null);
    expect(await tagActivationService.resolveTagLimit('u4')).toBe(2);
  });
});

describe('checkActivationCap — the founder decision tree', () => {
  it('below the limit → free activation allowed', async () => {
    mocks.tagCountDocuments.mockResolvedValue(1); // 1 active of 2
    const cap = await tagActivationService.checkActivationCap('u1');
    expect(cap).toMatchObject({ allowed: true, feeEligible: false, activeCount: 1, limit: 2 });
  });

  it('at the limit → NOT allowed, the single paid activation is offered', async () => {
    mocks.tagCountDocuments.mockResolvedValue(2);
    const cap = await tagActivationService.checkActivationCap('u1');
    expect(cap.allowed).toBe(false);
    expect(cap.feeEligible).toBe(true);
    expect(cap.feeAmount).toBe(19.99); // from config, not hardcoded at call sites
    expect(cap.upgradeUrl).toBe('/membership');
  });

  it('at the limit with the fee already paid for THIS tag → allowed', async () => {
    mocks.tagCountDocuments.mockResolvedValue(2);
    mocks.orderFindOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: 'order1' }) }); // paid fee order for this tag
    const cap = await tagActivationService.checkActivationCap('u1', { tagId: 'PT-1' });
    expect(cap.allowed).toBe(true);
    expect(cap.feeEligible).toBe(false);
  });

  it('beyond the paid slot (active > limit) → hard block, upgrade only', async () => {
    mocks.tagCountDocuments.mockResolvedValue(3); // limit 2 → already at 2+1
    const cap = await tagActivationService.checkActivationCap('u1');
    expect(cap.allowed).toBe(false);
    expect(cap.feeEligible).toBe(false);
    expect(cap.limit).toBe(2);
    expect(cap.activeCount).toBe(3);
  });

  it('an UNUSED paid fee for another tag blocks a second charge', async () => {
    mocks.tagCountDocuments.mockResolvedValue(2);
    // Paid fee order for a different tag…
    mocks.orderFind.mockReturnValue({
      select: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ tagActivation: { tagId: 'PT-PAID' } }]) }),
    });
    mocks.tagFindOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ status: 'inactive' }) }); // …its tag never activated

    const cap = await tagActivationService.checkActivationCap('u1', { tagId: 'PT-NEW' });
    expect(cap.allowed).toBe(false);
    expect(cap.feeEligible).toBe(false);
    expect(cap.existingPaidTagId).toBe('PT-PAID');
  });

  it('replacement tags bypass the cap entirely (R4)', async () => {
    mocks.tagCountDocuments.mockResolvedValue(5); // way over the limit
    const cap = await tagActivationService.checkActivationCap('u1', { replacingTagId: 'old-tag' });
    expect(cap.allowed).toBe(true);
    expect(cap.feeEligible).toBe(false);
  });
});

describe('getTagUsage', () => {
  it('returns the same definitions both portals display', async () => {
    mocks.tagCountDocuments
      .mockResolvedValueOnce(2) // active
      .mockResolvedValueOnce(4); // purchased
    mocks.getUserBenefitContext.mockResolvedValue('platinum');
    mocks.getValue.mockResolvedValue(10);

    expect(await tagActivationService.getTagUsage('u1')).toEqual({
      activeCount: 2,
      purchasedCount: 4,
      limit: 10,
    });
  });

  it('purchased excludes released tags (returned/cancelled) — the count query must say so', async () => {
    mocks.tagCountDocuments.mockResolvedValue(0);
    await tagActivationService.getTagUsage('u1');
    const purchaseQuery = mocks.tagCountDocuments.mock.calls[1][0];
    expect(purchaseQuery.status).toEqual({ $nin: ['returned', 'cancelled'] });
    expect(purchaseQuery.deletedAt).toBeNull();
  });
});
