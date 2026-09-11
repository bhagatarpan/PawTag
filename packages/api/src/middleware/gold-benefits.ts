import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { User, Subscription, Setting } from '@pawtag/db';
import { getGuardianNumber } from '../services/loyalty/guardian-config';
import logger from '../lib/logger';

/**
 * Middleware to check if user is a Gold member
 * Adds req.isGoldMember and req.goldBenefits
 */
export async function requireGoldMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const user = await User.findById(userId).select('fullName email').lean();
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user has Gold subscription (planType: 'gold')
    const goldSubscription = await Subscription.findOne({
      userId,
      status: 'active',
      planType: 'gold',
    }).lean();

    if (!goldSubscription) {
      return res.status(403).json({ success: false, error: 'Gold membership required' });
    }

    // Add Gold benefits to request
    (req as any).isGoldMember = true;
    (req as any).goldBenefits = {
      freeShippingOver50: true,
      prioritySupport: true,
      earlyAccess: true,
      doublePoints: true,
    };

    next();
  } catch (error) {
    logger.error({ error }, 'Gold benefits middleware error');
    res.status(500).json({ success: false, error: 'Failed to verify Gold membership' });
  }
}

/**
 * Middleware to check Gold benefits (non-blocking, adds to request if available)
 */
export async function checkGoldBenefits(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      (req as any).isGoldMember = false;
      (req as any).goldBenefits = null;
      return next();
    }

    const goldSubscription = await Subscription.findOne({
      userId,
      status: 'active',
      planType: 'gold',
    }).lean();

    (req as any).isGoldMember = !!goldSubscription;
    (req as any).goldBenefits = goldSubscription ? {
      freeShippingOver50: true,
      prioritySupport: true,
      earlyAccess: true,
      doublePoints: true,
    } : null;

    next();
  } catch (error) {
    logger.error({ error }, 'Gold benefits check error');
    (req as any).isGoldMember = false;
    (req as any).goldBenefits = null;
    next();
  }
}

/**
 * Check if user gets free shipping (Gold members: free over configurable threshold)
 */
export async function getsFreeShipping(isGoldMember: boolean, orderTotal: number): Promise<boolean> {
  if (isGoldMember) {
    const threshold = await getGuardianNumber('goldFreeShippingThreshold');
    if (orderTotal >= threshold) {
      return true;
    }
  }
  return false;
}

/**
 * Get Gold member benefits description
 */
export async function getGoldBenefitsDescription(): Promise<string[]> {
  const threshold = await getGuardianNumber('goldFreeShippingThreshold');
  return [
    `Free shipping on orders over $${threshold}`,
    'Priority customer support',
    'Early access to new products',
    'Double points on all purchases',
    'Nurture tier starting point (100 bonus points)',
  ];
}
