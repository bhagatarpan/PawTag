import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { Referral, ReferralCode, User } from '@pawtag/db';
import {
  getOrCreateReferralCode,
  validateReferralCode,
  getReferralStats,
  getReferralHistory,
} from '../services/referral.service';

const router = Router();

// Customer: Get or create referral code
router.get('/customer/referral', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const code = await getOrCreateReferralCode(req.user!.id);
    res.json({ success: true, data: { code, shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/refer?code=${code}` } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get referral code' });
  }
});

// Customer: Get referral stats
router.get('/customer/referral/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await getReferralStats(req.user!.id);
    res.json({ success: true, data: stats });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get referral stats' });
  }
});

// Customer: Get referral history
router.get('/customer/referral/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const history = await getReferralHistory(req.user!.id);
    res.json({ success: true, data: history });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get referral history' });
  }
});

// Customer: Get referred-by info
router.get('/customer/referral/referred-by', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const referral = await Referral.findOne({ refereeId: req.user!.id })
      .populate('referrerId', 'fullName')
      .lean();
    res.json({ success: true, data: referral?.referrerId || null });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get referred-by info' });
  }
});

// Public: Validate referral code
router.get('/finder/referral/:code', async (req, res: Response) => {
  try {
    const result = await validateReferralCode(req.params.code);
    if (!result.valid) {
      res.status(404).json({ success: false, error: 'Invalid referral code' });
      return;
    }
    res.json({ success: true, data: { valid: true, referrerName: result.referrerName } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to validate referral code' });
  }
});

// Admin: List all referrals
router.get('/admin/referrals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Referral.find()
        .populate('referrerId', 'fullName email')
        .populate('refereeId', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Referral.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to list referrals' });
  }
});

// Admin: Referral stats
router.get('/admin/referrals/stats', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const totalReferrals = await Referral.countDocuments();
    const completedReferrals = await Referral.countDocuments({ status: { $in: ['completed', 'rewarded'] } });
    const pendingReferrals = await Referral.countDocuments({ status: 'pending' });
    const rewardedReferrals = await Referral.countDocuments({ status: 'rewarded' });
    const totalCodes = await ReferralCode.countDocuments({ isActive: true });

    res.json({
      success: true,
      data: { totalReferrals, completedReferrals, pendingReferrals, rewardedReferrals, totalCodes },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get referral stats' });
  }
});

export default router;
