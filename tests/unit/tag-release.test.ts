import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

/**
 * Tag release on cancellation/refund — docs/TAG-RELEASE-ON-CANCEL-REFUND.md
 * Service-level: per-tag idempotency, fulfilment/subscription cascade, and
 * the status-engine branch that keeps released tags out of finder service.
 */

const ids = {
  tagA: new mongoose.Types.ObjectId(),
  tagB: new mongoose.Types.ObjectId(),
  returnedTag: new mongoose.Types.ObjectId(),
  order: new mongoose.Types.ObjectId(),
  ghost: new mongoose.Types.ObjectId(),
};

const mocks = vi.hoisted(() => ({
  tagFindById: vi.fn(),
  tagFind: vi.fn(),
  fulfilmentFind: vi.fn(),
  fulfilmentUpdateOne: vi.fn(),
  subscriptionFind: vi.fn(),
  cancelSubscription: vi.fn(),
  userMembershipFindOne: vi.fn(),
}));

vi.mock('@pawtag/db', () => ({
  Tag: {
    findById: (...args: any[]) => mocks.tagFindById(...args),
    find: (...args: any[]) => mocks.tagFind(...args),
  },
  Fulfilment: {
    find: (...args: any[]) => mocks.fulfilmentFind(...args),
    updateOne: (...args: any[]) => mocks.fulfilmentUpdateOne(...args),
  },
  Subscription: {
    find: (...args: any[]) => mocks.subscriptionFind(...args),
  },
  UserMembership: {
    findOne: (...args: any[]) => mocks.userMembershipFindOne(...args),
  },
}));

vi.mock('../../packages/api/src/services/subscription.service', () => ({
  cancelSubscription: (...args: any[]) => mocks.cancelSubscription(...args),
}));

vi.mock('../../packages/api/src/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  releaseTagsByIds,
  releaseTagsForOrder,
  cancelFulfilmentForOrder,
  cancelSubscriptionsForTagIds,
} from '../../packages/api/src/commerce/services/tag-release.service';
import { calculateTagStatus } from '../../packages/api/src/services/tag-status.service';

function tagDoc(overrides: Record<string, any> = {}) {
  return {
    _id: ids.tagA,
    tagId: 'PT-000001',
    orderId: ids.order,
    status: 'active',
    save: vi.fn(async () => undefined),
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tagFind.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
  mocks.fulfilmentFind.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
  mocks.subscriptionFind.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
  mocks.cancelSubscription.mockResolvedValue(undefined);
});

describe('releaseTagsByIds', () => {
  it('freezes an active tag and cancels its subscription', async () => {
    const doc = tagDoc({ status: 'active' });
    mocks.tagFindById.mockResolvedValue(doc);
    mocks.subscriptionFind.mockReturnValue({ select: vi.fn().mockResolvedValue([{ _id: 'sub1' }]) });

    const result = await releaseTagsByIds([ids.tagA], 'order_cancelled');

    expect(doc.status).toBe('cancelled');
    expect(doc.save).toHaveBeenCalled();
    expect(result.released).toEqual([String(ids.tagA)]);
    expect(mocks.cancelSubscription).toHaveBeenCalledWith(
      'sub1',
      expect.stringMatching(/order cancelled/i),
      expect.objectContaining({ portal: 'system' }),
    );
  });

  it('is idempotent — already cancelled/returned tags are skipped and never re-saved', async () => {
    const cancelled = tagDoc({ status: 'cancelled' });
    const returned = tagDoc({ _id: ids.returnedTag, status: 'returned', returnedAt: new Date() });
    mocks.tagFindById
      .mockResolvedValueOnce(cancelled)
      .mockResolvedValueOnce(returned);

    const result = await releaseTagsByIds([ids.tagA, ids.returnedTag], 'full_refund');

    expect(result.released).toEqual([]);
    expect(result.skipped).toHaveLength(2);
    expect(cancelled.save).not.toHaveBeenCalled();
    expect(returned.save).not.toHaveBeenCalled();
    expect(mocks.cancelSubscription).not.toHaveBeenCalled();
  });

  it('skips missing tag documents without throwing', async () => {
    mocks.tagFindById.mockResolvedValue(null);
    const result = await releaseTagsByIds([ids.ghost], 'full_refund');
    expect(result).toEqual({ released: [], skipped: [String(ids.ghost)] });
  });
});

describe('releaseTagsForOrder', () => {
  it('queries only non-released tags (returned/cancelled excluded at the DB level)', async () => {
    mocks.tagFind.mockReturnValue({ select: vi.fn().mockResolvedValue([{ _id: ids.tagA }]) });
    const doc = tagDoc({ _id: ids.tagA });
    mocks.tagFindById.mockResolvedValue(doc);

    await releaseTagsForOrder(ids.order, 'order_cancelled');

    expect(mocks.tagFind).toHaveBeenCalledWith({
      orderId: ids.order,
      deletedAt: null,
      status: { $nin: ['returned', 'cancelled'] },
    });
    expect(doc.status).toBe('cancelled');
  });

  it('no-ops when the order has no live tags', async () => {
    const result = await releaseTagsForOrder(ids.order, 'order_cancelled');
    expect(result.released).toEqual([]);
    expect(mocks.tagFindById).not.toHaveBeenCalled();
  });
});

describe('cancelFulfilmentForOrder', () => {
  it('cancels only open fulfilments and reports whether any were touched', async () => {
    mocks.fulfilmentFind.mockReturnValue({
      select: vi.fn().mockResolvedValue([{ _id: 'f1', status: 'packing' }]),
    });

    const touched = await cancelFulfilmentForOrder(ids.order);

    expect(touched).toBe(true);
    expect(mocks.fulfilmentFind).toHaveBeenCalledWith({
      orderId: ids.order,
      status: { $in: ['pending', 'picking', 'packing'] },
    });
    expect(mocks.fulfilmentUpdateOne).toHaveBeenCalledWith(
      { _id: 'f1' },
      { $set: { status: 'cancelled' } },
    );
  });

  it('returns false when there is no open fulfilment (idempotent re-run)', async () => {
    mocks.fulfilmentFind.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
    expect(await cancelFulfilmentForOrder(ids.order)).toBe(false);
    expect(mocks.fulfilmentUpdateOne).not.toHaveBeenCalled();
  });
});

describe('cancelSubscriptionsForTagIds', () => {
  it('cancels every live subscription for the given tags', async () => {
    mocks.subscriptionFind
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue([{ _id: 'sub1' }]) })
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue([{ _id: 'sub2' }]) });

    await cancelSubscriptionsForTagIds([ids.tagA, ids.tagB], 'Tag returned to PawTag');

    expect(mocks.cancelSubscription).toHaveBeenCalledTimes(2);
    expect(mocks.cancelSubscription).toHaveBeenCalledWith(
      'sub1',
      'Tag returned to PawTag',
      expect.objectContaining({ portal: 'system' }),
    );
    expect(mocks.cancelSubscription).toHaveBeenCalledWith('sub2', 'Tag returned to PawTag', expect.anything());
  });

  it('treats "already cancelled" as a clean no-op and keeps going', async () => {
    mocks.subscriptionFind
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue([{ _id: 'sub1' }, { _id: 'sub2' }]) });
    mocks.cancelSubscription
      .mockRejectedValueOnce(new Error('Subscription is already cancelled'))
      .mockResolvedValueOnce(undefined);

    await expect(
      cancelSubscriptionsForTagIds([ids.tagA], 'Order cancelled'),
    ).resolves.toBeUndefined();
    expect(mocks.cancelSubscription).toHaveBeenCalledTimes(2);
  });
});

describe('calculateTagStatus — released tags', () => {
  it('cancelled tags are never findable, regardless of period dates', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const result = await calculateTagStatus({
      status: 'cancelled',
      activePeriodEndsAt: future,
      warrantyEndsAt: future,
    } as any);

    expect(result.status).toBe('cancelled');
    expect(result.finderEnabled).toBe(false);
    expect(result.reason).toMatch(/cancelled or refunded/i);
  });

  it('returned tags keep their existing behavior (regression guard)', async () => {
    const result = await calculateTagStatus({ status: 'returned', returnedAt: new Date() } as any);
    expect(result.status).toBe('returned');
    expect(result.finderEnabled).toBe(false);
  });
});
