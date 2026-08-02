import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Subscription, Invoice, Tag, User } from '@pawtag/db';
import {
  renewSubscription,
  cancelSubscription,
} from '../services/subscription.service';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/admin/subscriptions:
 *   get:
 *     summary: List all subscriptions (admin)
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', requirePermission('subscription.read'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, planType, search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { deletedAt: null };
    if (status) filter.status = status;
    if (planType) filter.planType = planType;

    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .populate('userId', 'fullName email')
        .populate('tagId', 'tagId tagType status')
        .populate('planId', 'name price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Subscription.countDocuments(filter),
    ]);

    // If search by user email or tag ID, do post-filter
    let filtered = subscriptions;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = subscriptions.filter((sub) => {
        const user = sub.userId as any;
        const tag = sub.tagId as any;
        return (
          (user?.email?.toLowerCase().includes(searchLower)) ||
          (user?.fullName?.toLowerCase().includes(searchLower)) ||
          (tag?.tagId?.toLowerCase().includes(searchLower)) ||
          (sub.invoiceNumber?.toString().includes(searchLower))
        );
      });
    }

    res.json({
      success: true,
      data: {
        items: filtered,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
  }
});

/**
 * @swagger
 * /api/admin/subscriptions/stats:
 *   get:
 *     summary: Get subscription statistics
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/stats', requirePermission('subscription.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalActive,
      totalExpired,
      totalGracePeriod,
      totalCancelled,
      totalPendingPayment,
      totalSubscriptions,
      recentSubscriptions,
    ] = await Promise.all([
      Subscription.countDocuments({ status: 'active', deletedAt: null }),
      Subscription.countDocuments({ status: 'expired', deletedAt: null }),
      Subscription.countDocuments({ status: 'grace_period', deletedAt: null }),
      Subscription.countDocuments({ status: 'cancelled', deletedAt: null }),
      Subscription.countDocuments({ status: 'pending_payment', deletedAt: null }),
      Subscription.countDocuments({ deletedAt: null }),
      Subscription.find({ deletedAt: null })
        .populate('userId', 'fullName email')
        .populate('tagId', 'tagId')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    // Monthly recurring revenue (annual plans: $0.99/mo, monthly: $1.99/mo)
    const activeSubs = await Subscription.find({ status: 'active', deletedAt: null });
    const mrr = activeSubs.reduce((sum, sub) => sum + (sub.price || 0), 0);

    res.json({
      success: true,
      data: {
        totalActive,
        totalExpired,
        totalGracePeriod,
        totalCancelled,
        totalPendingPayment,
        totalSubscriptions,
        mrr: Math.round(mrr * 100) / 100,
        recentSubscriptions,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch subscription stats' });
  }
});

/**
 * @swagger
 * /api/admin/subscriptions/{id}:
 *   get:
 *     summary: Get subscription detail (admin)
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', requirePermission('subscription.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate('userId', 'fullName email phoneNumber')
      .populate('tagId', 'tagId tagType status petId')
      .populate('planId', 'name price images');

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const invoices = await Invoice.find({ subscriptionId: subscription._id })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { subscription, invoices } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
});

/**
 * @swagger
 * /api/admin/subscriptions/{id}/status:
 *   put:
 *     summary: Override subscription status (admin)
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/status', requirePermission('subscription.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, reason } = req.body;
    if (!status || !['active', 'expired', 'grace_period', 'cancelled', 'pending_payment'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const oldStatus = subscription.status;
    subscription.status = status;

    if (status === 'cancelled') {
      subscription.cancelledAt = new Date();
      subscription.cancellationReason = reason || 'Admin override';
    }

    await subscription.save();

    // Update tag subscription status
    if (status === 'active') {
      await Tag.findByIdAndUpdate(subscription.tagId, { subscriptionStatus: 'active' });
    } else if (status === 'expired') {
      await Tag.findByIdAndUpdate(subscription.tagId, { subscriptionStatus: 'inactive' });
    } else if (status === 'grace_period') {
      await Tag.findByIdAndUpdate(subscription.tagId, { subscriptionStatus: 'grace_period' });
    }

    res.json({
      success: true,
      data: subscription,
      message: `Subscription status changed from ${oldStatus} to ${status}`,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update subscription status' });
  }
});

/**
 * @swagger
 * /api/admin/subscriptions/{id}/extend:
 *   post:
 *     summary: Extend subscription by X days (admin support tool)
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/extend', requirePermission('subscription.update'), async (req: AuthRequest, res: Response) => {
  try {
    const { days, reason } = req.body;
    if (!days || days <= 0 || days > 365) {
      res.status(400).json({ success: false, error: 'Days must be between 1 and 365' });
      return;
    }

    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const extensionMs = days * 24 * 60 * 60 * 1000;
    subscription.currentPeriodEnd = new Date(subscription.currentPeriodEnd.getTime() + extensionMs);

    if (subscription.freePeriodEndsAt) {
      subscription.freePeriodEndsAt = new Date(subscription.freePeriodEndsAt.getTime() + extensionMs);
    }

    if (subscription.status === 'grace_period' || subscription.status === 'expired') {
      subscription.status = 'active';
      await Tag.findByIdAndUpdate(subscription.tagId, { subscriptionStatus: 'active' });
    }

    subscription.reminderStates = {
      reminder30dSent: false,
      reminder7dSent: false,
      reminder1dSent: false,
      graceWeeklySentCount: 0,
    };

    await subscription.save();

    // Log admin extension in invoice
    await Invoice.create({
      subscriptionId: subscription._id,
      userId: subscription.userId,
      invoiceNumber: `ADMIN-EXT-${Date.now()}`,
      amount: 0,
      currency: 'NZD',
      status: 'paid',
      billingPeriod: {
        start: new Date(),
        end: subscription.currentPeriodEnd,
      },
      paymentMethod: 'admin-extend',
      paidAt: new Date(),
      dueDate: subscription.currentPeriodEnd,
    });

    res.json({
      success: true,
      data: subscription,
      message: `Subscription extended by ${days} days. Reason: ${reason || 'Admin support'}`,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to extend subscription' });
  }
});

export default router;
