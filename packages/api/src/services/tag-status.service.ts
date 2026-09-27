/**
 * @module Tag Status Service
 * @description Centralized tag status calculation for the HYBRID 2 model.
 *
 * This service determines tag status based on:
 * - Active Period (configurable per product, default 3 months)
 * - Warranty Period (configurable per product, default 12 months)
 * - Membership status (Gold/Platinum/Black)
 *
 * Tag Status Logic:
 * - ACTIVE: Within Active Period OR has active membership
 * - LIMITED: Active Period expired, no membership, but warranty still valid
 * - EXPIRED: Warranty period expired
 *
 * @example
 * ```typescript
 * const status = await calculateTagStatus(tag);
 * if (status.finderEnabled) {
 *   // Allow finder notifications
 * }
 * ```
 */

import { Tag, UserMembership, MembershipTier } from '@pawtag/db';
import type { ITagDocument } from '@pawtag/db';
import logger from '../lib/logger';

export interface TagStatusResult {
  status: 'active' | 'limited' | 'expired';
  reason: string;
  activePeriodEndsAt?: Date;
  warrantyEndsAt?: Date;
  membershipEndsAt?: Date;
  finderEnabled: boolean;
  daysUntilActivePeriodEnds?: number;
  daysUntilWarrantyEnds?: number;
}

/**
 * Calculate the current status of a tag based on HYBRID 2 model rules.
 *
 * @param tag - The tag document (must have activePeriodEndsAt and warrantyEndsAt)
 * @returns TagStatusResult with status, reason, and relevant dates
 */
export async function calculateTagStatus(tag: ITagDocument): Promise<TagStatusResult> {
  const now = new Date();

  // If tag doesn't have period dates, fall back to basic status check
  if (!tag.activePeriodEndsAt || !tag.warrantyEndsAt) {
    // Legacy tags without period dates - use basic status
    if (tag.status === 'active') {
      return {
        status: 'active',
        reason: 'Legacy tag - active',
        finderEnabled: true,
      };
    }
    return {
      status: 'expired',
      reason: 'Tag not configured with period dates',
      finderEnabled: false,
    };
  }

  // Check warranty first - if expired, tag is expired
  if (now > tag.warrantyEndsAt) {
    return {
      status: 'expired',
      reason: 'Warranty expired',
      warrantyEndsAt: tag.warrantyEndsAt,
      finderEnabled: false,
    };
  }

  // Calculate days until warranty ends
  const daysUntilWarrantyEnds = Math.ceil(
    (tag.warrantyEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check active period
  if (now <= tag.activePeriodEndsAt) {
    const daysUntilActivePeriodEnds = Math.ceil(
      (tag.activePeriodEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      status: 'active',
      reason: 'Within active period',
      activePeriodEndsAt: tag.activePeriodEndsAt,
      warrantyEndsAt: tag.warrantyEndsAt,
      finderEnabled: true,
      daysUntilActivePeriodEnds,
      daysUntilWarrantyEnds,
    };
  }

  // Active period expired - check for membership
  if (tag.membershipStartsAt) {
    const membershipEndsAt = new Date(tag.membershipStartsAt);
    membershipEndsAt.setMonth(membershipEndsAt.getMonth() + 12);

    if (now <= membershipEndsAt) {
      return {
        status: 'active',
        reason: 'Covered by membership',
        activePeriodEndsAt: tag.activePeriodEndsAt,
        warrantyEndsAt: tag.warrantyEndsAt,
        membershipEndsAt,
        finderEnabled: true,
        daysUntilWarrantyEnds,
      };
    }
  }

  // Check for active UserMembership (Gold/Platinum/Black)
  if (tag.ownerId) {
    const membership = await UserMembership.findOne({
      userId: tag.ownerId,
      status: 'active',
    }).lean();

    if (membership) {
      const membershipEndsAt = membership.currentPeriodEnd;
      if (now <= membershipEndsAt) {
        return {
          status: 'active',
          reason: 'Covered by user membership',
          activePeriodEndsAt: tag.activePeriodEndsAt,
          warrantyEndsAt: tag.warrantyEndsAt,
          membershipEndsAt,
          finderEnabled: true,
          daysUntilWarrantyEnds,
        };
      }
    }
  }

  // No membership or membership expired - limited mode
  return {
    status: 'limited',
    reason: 'Active period expired, no membership',
    activePeriodEndsAt: tag.activePeriodEndsAt,
    warrantyEndsAt: tag.warrantyEndsAt,
    finderEnabled: false,
    daysUntilWarrantyEnds,
  };
}

/**
 * Update tag status based on current date and membership.
 * This should be called periodically (e.g., via background job) or on-demand.
 *
 * @param tagId - The tag ID to update
 * @returns Updated tag status
 */
export async function updateTagStatus(tagId: string): Promise<TagStatusResult> {
  const tag = await Tag.findById(tagId);
  if (!tag) {
    throw new Error(`Tag not found: ${tagId}`);
  }

  const statusResult = await calculateTagStatus(tag);

  // Update tag status if it has changed
  if (tag.status !== statusResult.status && tag.status !== 'deleted') {
    const oldStatus = tag.status;
    tag.status = statusResult.status;
    await tag.save();

    logger.info({
      tagId: tag.tagId,
      oldStatus,
      newStatus: statusResult.status,
      reason: statusResult.reason,
    }, 'Tag status updated');
  }

  return statusResult;
}

/**
 * Check if a tag is active for finder operations.
 * This is a quick check that doesn't require full status calculation.
 *
 * @param tag - The tag document
 * @returns true if finder operations are allowed
 */
export async function isTagActiveForFinder(tag: ITagDocument): Promise<boolean> {
  const status = await calculateTagStatus(tag);
  return status.finderEnabled;
}

/**
 * Get tags that need status updates (for background job).
 * Returns tags where:
 * - Active period is expiring within 24 hours
 * - Warranty is expiring within 24 hours
 * - Status needs to be updated from active to limited
 *
 * @returns Array of tags that need status updates
 */
export async function getTagsNeedingStatusUpdate(): Promise<ITagDocument[]> {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tags = await Tag.find({
    status: { $in: ['active', 'limited'] },
    deletedAt: null,
    $or: [
      // Active period expiring within 24 hours
      { activePeriodEndsAt: { $lte: tomorrow, $gt: now } },
      // Warranty expiring within 24 hours
      { warrantyEndsAt: { $lte: tomorrow, $gt: now } },
      // Active period expired but status still active (needs to be limited)
      { activePeriodEndsAt: { $lte: now }, status: 'active' },
    ],
  }).lean();

  return tags;
}

export default {
  calculateTagStatus,
  updateTagStatus,
  isTagActiveForFinder,
  getTagsNeedingStatusUpdate,
};
