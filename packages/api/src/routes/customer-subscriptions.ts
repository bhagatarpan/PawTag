import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Subscription, Invoice, Tag, User, Pet } from '@pawtag/db';
import {
  renewSubscription,
  cancelSubscription,
  changeSubscriptionPlan,
} from '../services/subscription.service';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/customer/subscriptions:
 *   get:
 *     summary: List my subscriptions
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's subscriptions
 */
router.get('/', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscriptions = await Subscription.find({
      userId: req.user!.id,
      deletedAt: null,
    })
      .populate('tagId', 'tagId tagType status petId')
      .populate('planId', 'name price images sku')
      .sort({ createdAt: -1 });

    // Populate pet names from tag.petId
    const petIds = subscriptions
      .map((s) => (s.tagId as any)?.petId)
      .filter(Boolean);
    const pets = await Pet.find({ _id: { $in: petIds } }).select('name petType breed');
    const petMap = new Map(pets.map((p) => [p._id.toString(), p]));

    const enriched = subscriptions.map((s) => {
      const tag = s.tagId as any;
      const pet = tag?.petId ? petMap.get(tag.petId.toString()) : null;
      return {
        ...s.toObject(),
        petName: pet?.name || null,
        petType: pet?.petType || null,
        productName: (s.planId as any)?.name || s.planName,
      };
    });

    res.json({ success: true, data: enriched });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/{id}:
 *   get:
 *     summary: Get subscription detail
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      deletedAt: null,
    })
      .populate('tagId', 'tagId tagType status petId')
      .populate('planId', 'name price images description sku');

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    // Populate pet name
    const tag = subscription.tagId as any;
    let petName = null;
    let petType = null;
    if (tag?.petId) {
      const pet = await Pet.findById(tag.petId).select('name petType breed');
      if (pet) {
        petName = pet.name;
        petType = pet.petType;
      }
    }

    res.json({
      success: true,
      data: {
        ...subscription.toObject(),
        petName,
        petType,
        productName: (subscription.planId as any)?.name || subscription.planName,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/{id}/invoices:
 *   get:
 *     summary: List invoices for a subscription
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/invoices', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      deletedAt: null,
    });

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const invoices = await Invoice.find({
      subscriptionId: subscription._id,
      userId: req.user!.id,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: invoices });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/{id}/renew:
 *   put:
 *     summary: Manually renew subscription
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/renew', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      deletedAt: null,
    });

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    if (subscription.status === 'active' && subscription.autoRenew) {
      res.status(400).json({ success: false, error: 'Subscription is already active with auto-renew enabled' });
      return;
    }

    const renewed = await renewSubscription(subscription._id.toString(), 'card');

    res.json({ success: true, data: renewed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to renew subscription' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/{id}/cancel:
 *   put:
 *     summary: Cancel subscription (continues until end of billing period)
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/cancel', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      deletedAt: null,
    });

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    if (subscription.status !== 'active') {
      res.status(400).json({ success: false, error: 'Can only cancel active subscriptions' });
      return;
    }

    const cancelled = await cancelSubscription(subscription._id.toString(), req.body.reason);

    res.json({ success: true, data: cancelled });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to cancel subscription' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/{id}/auto-renew:
 *   put:
 *     summary: Toggle auto-renew on/off
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/auto-renew', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      deletedAt: null,
    });

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const { autoRenew } = req.body;
    if (typeof autoRenew !== 'boolean') {
      res.status(400).json({ success: false, error: 'autoRenew must be a boolean' });
      return;
    }

    subscription.autoRenew = autoRenew;
    await subscription.save();

    res.json({ success: true, data: subscription });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update auto-renew' });
  }
});

/**
 * @swagger
 * /api/customer/subscriptions/{id}/change-plan:
 *   post:
 *     summary: Change subscription plan (annual/monthly)
 *     tags: [Customer Subscriptions]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/change-plan', requirePermission('customer.read'), async (req: AuthRequest, res: Response) => {
  try {
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      userId: req.user!.id,
      deletedAt: null,
    });

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const { planType } = req.body;
    if (!planType || !['annual', 'monthly'].includes(planType)) {
      res.status(400).json({ success: false, error: 'planType must be "annual" or "monthly"' });
      return;
    }

    const updated = await changeSubscriptionPlan(subscription._id.toString(), planType);

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to change plan' });
  }
});

export default router;
