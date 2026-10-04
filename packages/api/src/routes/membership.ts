import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { UserMembership, MembershipTier, User, Tag, Invoice } from '@pawtag/db';
import {
  getMembershipTiers,
  getUserMembershipStatus,
  subscribeToTier,
  activateMembership,
  cancelMembership,
  resumeMembership,
  changeTier,
  estimateTierChange,
  requestDowngrade,
  cancelPendingDowngrade,
  checkTagAccess,
  MembershipTierChangeError,
} from '../services/membership.service';
import { MEMBERSHIP_TIER_CHANGE_CODES } from '@pawtag/shared';
import { membershipEntitlementService } from '../services/membership-entitlement.service';
import { isFakeMode } from '../commerce/payment-mode';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

/**
 * Map membership tier-change/service errors to stable HTTP responses.
 * Clients can branch on `code` for recovery (e.g. payment_method_required).
 */
function sendMembershipError(res: Response, error: any, fallbackMessage: string): void {
  if (error instanceof MembershipTierChangeError) {
    res.status(error.httpStatus).json({
      success: false,
      error: error.userMessage || error.message,
      code: error.membershipCode,
    });
    return;
  }

  if (error?.membershipCode) {
    res.status(error.httpStatus || 400).json({
      success: false,
      error: error.userMessage || error.message || fallbackMessage,
      code: error.membershipCode,
    });
    return;
  }

  res.status(400).json({
    success: false,
    error: error?.message || fallbackMessage,
  });
}

/**
 * GET /api/membership/tiers
 * List available membership tiers with entitlements
 */
router.get('/tiers', async (_req: AuthRequest, res: Response) => {
  try {
    const tiers = await getMembershipTiers();
    // Enrich each tier with entitlements from the registry
    const enrichedTiers = await Promise.all(tiers.map(async (tier) => {
      const entitlements = await membershipEntitlementService.getTierEntitlements(tier.tier);
      return { ...tier, entitlements };
    }));
    res.json({ success: true, data: enrichedTiers });
  } catch (error: any) {
    logger.error({ err: error }, '[Membership] Failed to fetch tiers');
    res.status(500).json({ success: false, error: 'Failed to fetch membership tiers' });
  }
});

/**
 * GET /api/membership/status
 * Get current user's membership status with entitlements
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const status = await getUserMembershipStatus(req.user!.id);
    // Add entitlements from the registry
    const entitlements = await membershipEntitlementService.getUserEntitlements(req.user!.id);
    res.json({ success: true, data: { ...status, entitlements } });
  } catch (error: any) {
    logger.error({ err: error }, '[Membership] Failed to fetch status');
    res.status(500).json({ success: false, error: 'Failed to fetch membership status' });
  }
});

/**
 * POST /api/membership/subscribe
 * Subscribe to a membership tier
 */
router.post('/subscribe', async (req: AuthRequest, res: Response) => {
  try {
    const { tierId, paymentMethodId } = req.body;
    if (!tierId) {
      res.status(400).json({ success: false, error: 'tierId is required' });
      return;
    }

    const result = await subscribeToTier(req.user!.id, tierId, paymentMethodId);
    res.json({
      success: true,
      data: {
        membership: result.membership,
        clientSecret: result.clientSecret,
        isDemoMode: isFakeMode(),
        message: 'Membership subscription created. Complete payment to activate.',
      },
    });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Subscribe error');
    res.status(400).json({ success: false, error: error.message || 'Failed to subscribe' });
  }
});

/**
 * POST /api/membership/activate
 * Activate membership after payment (called by webhook or frontend)
 */
router.post('/activate', async (req: AuthRequest, res: Response) => {
  try {
    const { membershipId } = req.body;
    if (!membershipId) {
      res.status(400).json({ success: false, error: 'membershipId is required' });
      return;
    }

    // Verify ownership
    const membership = await UserMembership.findOne({
      _id: membershipId,
      userId: req.user!.id,
    });
    if (!membership) {
      res.status(404).json({ success: false, error: 'Membership not found' });
      return;
    }

    // In real Stripe mode, require that a Stripe subscription was actually created.
    // Prevents activating phantom memberships that were created due to Stripe errors
    // or misconfigurations — only the webhook should activate these.
    if (!isFakeMode() && !membership.stripeSubscriptionId) {
      res.status(400).json({
        success: false,
        error: 'This membership has no associated payment. Please subscribe again.',
      });
      return;
    }

    const activated = await activateMembership(membershipId);
    res.json({ success: true, data: activated });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Activate error');
    res.status(500).json({ success: false, error: error.message || 'Failed to activate membership' });
  }
});

/**
 * POST /api/membership/cancel
 * Cancel membership
 */
router.post('/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const cancelled = await cancelMembership(req.user!.id, reason);
    res.json({ success: true, data: cancelled });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Cancel error');
    res.status(400).json({ success: false, error: error.message || 'Failed to cancel membership' });
  }
});

/**
 * POST /api/membership/resume
 * Resume a membership that was cancelled for period end (undo cancellation).
 */
router.post('/resume', async (req: AuthRequest, res: Response) => {
  try {
    const resumed = await resumeMembership(req.user!.id);
    res.json({ success: true, data: resumed });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Resume error');
    res.status(400).json({ success: false, error: error.message || 'Failed to resume membership' });
  }
});

/**
 * GET /api/membership/change-tier/estimate?tierId=xxx
 * Estimate the prorated charge for a tier change (preview before confirm).
 * Includes isCancelling / willResumeOnUpgrade for Option A upgrade-while-cancelling.
 */
router.get('/change-tier/estimate', async (req: AuthRequest, res: Response) => {
  try {
    const tierId = req.query.tierId as string;
    if (!tierId) {
      res.status(400).json({
        success: false,
        error: 'tierId is required',
        code: MEMBERSHIP_TIER_CHANGE_CODES.TIER_REQUIRED,
      });
      return;
    }

    const estimate = await estimateTierChange(req.user!.id, tierId);
    res.json({ success: true, data: estimate });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Change tier estimate error');
    sendMembershipError(res, error, 'Failed to estimate tier change');
  }
});

/**
 * POST /api/membership/change-tier
 * Change membership tier.
 * Cancelling members: immediate upgrade also resumes (clears cancel + auto-renew on).
 */
router.post('/change-tier', async (req: AuthRequest, res: Response) => {
  try {
    const { tierId, prorationBehavior } = req.body;
    if (!tierId) {
      res.status(400).json({
        success: false,
        error: 'tierId is required',
        code: MEMBERSHIP_TIER_CHANGE_CODES.TIER_REQUIRED,
      });
      return;
    }

    const result = await changeTier(req.user!.id, tierId, prorationBehavior);
    res.json({
      success: true,
      data: {
        membership: result.membership,
        invoice: result.invoice,
        invoiceUrl: result.invoiceUrl,
        resumedOnUpgrade: result.resumedOnUpgrade,
      },
    });
  } catch (error: any) {
    logger.error(
      {
        err: error,
        userId: req.user?.id,
        membershipCode: error?.membershipCode,
        stripeCode: error?.metadata?.stripeCode,
      },
      '[Membership] Change tier error',
    );
    sendMembershipError(res, error, 'Failed to change tier');
  }
});

/**
 * POST /api/membership/downgrade
 * Request a deferred downgrade (effective at end of current subscription cycle)
 */
router.post('/downgrade', async (req: AuthRequest, res: Response) => {
  try {
    const { tierId, reason, termsAccepted, termsVersion } = req.body;

    if (!tierId) {
      res.status(400).json({ success: false, error: 'tierId is required' });
      return;
    }
    if (!termsAccepted) {
      res.status(400).json({ success: false, error: 'You must accept the downgrade terms to proceed' });
      return;
    }

    const membership = await requestDowngrade(req.user!.id, {
      tierId,
      reason,
      termsAccepted: Boolean(termsAccepted),
      termsVersion: termsVersion || 'v1',
    });

    res.json({
      success: true,
      data: {
        membership,
        pendingTierEffectiveAt: membership.pendingTierEffectiveAt,
        message: `Downgrade scheduled for ${membership.pendingTierEffectiveAt?.toLocaleDateString('en-NZ', { dateStyle: 'medium' }) || 'renewal'}`,
      },
    });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Downgrade request error');
    res.status(400).json({ success: false, error: error.message || 'Failed to request downgrade' });
  }
});

/**
 * POST /api/membership/downgrade/cancel
 * Cancel a pending downgrade
 */
router.post('/downgrade/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const membership = await cancelPendingDowngrade(req.user!.id);
    res.json({ success: true, data: { membership } });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Cancel downgrade error');
    res.status(400).json({ success: false, error: error.message || 'Failed to cancel downgrade' });
  }
});

/**
 * GET /api/membership/tags
 * Get user's tags with access status
 */
router.get('/tags', async (req: AuthRequest, res: Response) => {
  try {
    const tags = await Tag.find({ ownerId: req.user!.id, deletedAt: null });
    const tagsWithAccess = await Promise.all(
      tags.map(async (tag) => {
        const access = await checkTagAccess(tag._id.toString());
        return {
          ...tag.toObject(),
          access,
        };
      })
    );
    res.json({ success: true, data: tagsWithAccess });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Failed to fetch tags');
    res.status(500).json({ success: false, error: 'Failed to fetch tags' });
  }
});

/**
 * GET /api/membership/entitlements
 * Get current user's full entitlements from the registry.
 */
router.get('/entitlements', async (req: AuthRequest, res: Response) => {
  try {
    const { membershipEntitlementService } = await import('../services/membership-entitlement.service');
    const entitlements = await membershipEntitlementService.getUserEntitlements(req.user!.id);
    const tier = await membershipEntitlementService.getUserTierString(req.user!.id);
    res.json({ success: true, data: { tier, entitlements } });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Failed to fetch entitlements');
    res.status(500).json({ success: false, error: 'Failed to fetch entitlements' });
  }
});

/**
 * GET /api/membership/payment-methods
 * List saved payment methods from Stripe Customer
 */
router.get('/payment-methods', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('stripeCustomerId').lean();
    if (!user?.stripeCustomerId) {
      res.json({ success: true, data: [] });
      return;
    }

    if (isFakeMode()) {
      res.json({ success: true, data: [] });
      return;
    }

    const { getStripeClient } = await import('../services/membership.service');
    const stripe = getStripeClient();
    const paymentMethods = await stripe.customers.listPaymentMethods(user.stripeCustomerId, { type: 'card' });

    const formatted = paymentMethods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
      isDefault: false, // Stripe doesn't expose this directly; frontend can compare with membership.cardBrand/last4
    }));

    res.json({ success: true, data: formatted });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Failed to list payment methods');
    res.status(500).json({ success: false, error: 'Failed to list payment methods' });
  }
});

/**
 * POST /api/membership/payment-methods/portal
 * Create Stripe Billing Portal session for payment method management
 */
router.post('/payment-methods/portal', async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('stripeCustomerId email fullName').lean();
    if (!user?.stripeCustomerId) {
      res.status(400).json({ success: false, error: 'No payment profile found. Please make a payment first.' });
      return;
    }

    if (isFakeMode()) {
      res.json({ success: true, data: { url: null, isDemoMode: true } });
      return;
    }

    const { getStripeClient } = await import('../services/membership.service');
    const stripe = getStripeClient();

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/membership`,
    });

    logger.info({ userId: req.user!.id, sessionId: session.id }, '[Membership] Billing Portal session created');
    res.json({ success: true, data: { url: session.url } });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Failed to create Billing Portal session');
    res.status(500).json({ success: false, error: 'Failed to open payment settings' });
  }
});

/**
 * GET /api/membership/invoices
 * Get current user's membership invoices
 */
router.get('/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const invoices = await Invoice.find({
      userId: req.user!.id,
      invoiceNumber: { $regex: /^INVM-/ },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: invoices });
  } catch (error: any) {
    logger.error({ err: error, userId: req.user?.id }, '[Membership] Failed to fetch invoices');
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

export default router;
