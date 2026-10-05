import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb } from './setup';
import { Tag, UserMembership, MembershipTier } from '@pawtag/db';
import { calculateTagStatus } from '../../packages/api/src/services/tag-status.service';
import { checkTagAccess } from '../../packages/api/src/services/membership.service';
import { detachTagsReturnedToPawTag } from '../../packages/api/src/services/returns/tag-return-detach.service';

let userId: string;
let goldTierId: string;

beforeAll(async () => {
  process.env.PAYMENT_MODE = 'fake';
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await mongoose.connection.collections.tags?.deleteMany({});
  await mongoose.connection.collections.usermemberships?.deleteMany({});
  await mongoose.connection.collections.membershiptiers?.deleteMany({});
  await mongoose.connection.collections.users?.deleteMany({});
});

async function seedBase() {
  const user = await mongoose.connection.collections.users.insertOne({
    email: 'hybrid2@example.com',
    passwordHash: '$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    fullName: 'Hybrid Two',
    role: 'customer',
    status: 'active',
    emailVerified: true,
    phoneVerified: true,
    responsibilityScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  userId = user.insertedId.toString();

  const tier = await mongoose.connection.collections.membershiptiers.insertOne({
    tier: 'gold',
    name: 'Gold',
    displayName: 'Gold',
    price: 89,
    currency: 'NZD',
    isActive: true,
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  goldTierId = tier.insertedId.toString();
}

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function insertTag(opts: {
  tagId: string;
  activePeriodEndsAt: Date;
  warrantyEndsAt: Date;
  ownerId?: string | null;
  status?: string;
  returnedAt?: Date | null;
}) {
  return Tag.create({
    tagId: opts.tagId,
    tagType: 'qr',
    ownerId: opts.ownerId ?? new mongoose.Types.ObjectId(userId),
    status: opts.status || 'active',
    activePeriodEndsAt: opts.activePeriodEndsAt,
    warrantyEndsAt: opts.warrantyEndsAt,
    returnedAt: opts.returnedAt ?? undefined,
    nfcEnabled: false,
    subscriptionStatus: 'none',
  });
}

describe('HYBRID 2 tag access + returned tags', () => {
  describe('calculateTagStatus / checkTagAccess', () => {
    it('Active Period still open → Active, finder enabled (no membership required)', async () => {
      await seedBase();
      const tag = await insertTag({
        tagId: 'PT-ACTIVE-1',
        activePeriodEndsAt: daysFromNow(90),
        warrantyEndsAt: daysFromNow(365),
      });

      const status = await calculateTagStatus(tag);
      expect(status.status).toBe('active');
      expect(status.finderEnabled).toBe(true);

      const access = await checkTagAccess(String(tag._id));
      expect(access.hasAccess).toBe(true);
      expect(access.finderEnabled).toBe(true);
      expect(access.status).toBe('active');
    });

    it('Active Period ended, no membership → Limited, finder disabled', async () => {
      await seedBase();
      const tag = await insertTag({
        tagId: 'PT-LIMITED-1',
        activePeriodEndsAt: daysFromNow(-10),
        warrantyEndsAt: daysFromNow(200),
      });

      const status = await calculateTagStatus(tag);
      expect(status.status).toBe('limited');
      expect(status.finderEnabled).toBe(false);

      const access = await checkTagAccess(String(tag._id));
      expect(access.hasAccess).toBe(true);
      expect(access.finderEnabled).toBe(false);
      expect(access.status).toBe('limited');
    });

    it('Active Period ended + active membership → Active, finder enabled', async () => {
      await seedBase();
      await UserMembership.create({
        userId: new mongoose.Types.ObjectId(userId),
        tierId: new mongoose.Types.ObjectId(goldTierId),
        status: 'active',
        billingCycle: 'annual',
        price: 89,
        currency: 'NZD',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: daysFromNow(200),
        autoRenew: true,
        adminExtensionGraceUsed: false,
        adminExtensionCount: 0,
      });

      const tag = await insertTag({
        tagId: 'PT-MEM-1',
        activePeriodEndsAt: daysFromNow(-10),
        warrantyEndsAt: daysFromNow(200),
      });

      const access = await checkTagAccess(String(tag._id));
      expect(access.finderEnabled).toBe(true);
      expect(access.status).toBe('active');
    });

    it('Returned tag → no access, finder disabled', async () => {
      await seedBase();
      const tag = await insertTag({
        tagId: 'PT-RET-1',
        activePeriodEndsAt: daysFromNow(90),
        warrantyEndsAt: daysFromNow(365),
        status: 'returned',
        returnedAt: new Date(),
      });

      const status = await calculateTagStatus(tag);
      expect(status.status).toBe('returned');
      expect(status.finderEnabled).toBe(false);

      const access = await checkTagAccess(String(tag._id));
      expect(access.hasAccess).toBe(false);
      expect(access.finderEnabled).toBe(false);
    });
  });

  describe('detachTagsReturnedToPawTag', () => {
    it('clears ownership and sets status returned (idempotent)', async () => {
      await seedBase();
      const tag = await insertTag({
        tagId: 'PT-DETACH-1',
        activePeriodEndsAt: daysFromNow(90),
        warrantyEndsAt: daysFromNow(365),
      });

      const first = await detachTagsReturnedToPawTag({
        orderId: new mongoose.Types.ObjectId(),
        returnId: new mongoose.Types.ObjectId(),
        tagIds: [tag._id],
      });
      expect(first.detached).toBe(1);

      const updated = await Tag.findById(tag._id).lean();
      expect(updated!.status).toBe('returned');
      expect(updated!.ownerId).toBeFalsy();
      expect(updated!.returnedAt).toBeTruthy();

      const second = await detachTagsReturnedToPawTag({
        orderId: new mongoose.Types.ObjectId(),
        returnId: new mongoose.Types.ObjectId(),
        tagIds: [tag._id],
      });
      expect(second.detached).toBe(0);
      expect(second.skipped).toBe(1);
    });

    it('refundWithoutReturn does not detach tags', async () => {
      await seedBase();
      const tag = await insertTag({
        tagId: 'PT-NORET-1',
        activePeriodEndsAt: daysFromNow(90),
        warrantyEndsAt: daysFromNow(365),
      });

      const result = await detachTagsReturnedToPawTag({
        orderId: new mongoose.Types.ObjectId(),
        returnId: new mongoose.Types.ObjectId(),
        tagIds: [tag._id],
        refundWithoutReturn: true,
      });
      expect(result.detached).toBe(0);

      const updated = await Tag.findById(tag._id).lean();
      expect(updated!.status).toBe('active');
      expect(updated!.ownerId).toBeTruthy();
    });

    it('GET membership tags excludes returned tags', async () => {
      await seedBase();
      await insertTag({
        tagId: 'PT-KEPT-1',
        activePeriodEndsAt: daysFromNow(90),
        warrantyEndsAt: daysFromNow(365),
      });
      await insertTag({
        tagId: 'PT-GONE-1',
        activePeriodEndsAt: daysFromNow(90),
        warrantyEndsAt: daysFromNow(365),
        status: 'returned',
        returnedAt: new Date(),
      });

      const remaining = await Tag.find({
        ownerId: new mongoose.Types.ObjectId(userId),
        deletedAt: null,
        status: { $ne: 'returned' },
      });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].tagId).toBe('PT-KEPT-1');
    });
  });
});
