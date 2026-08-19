import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { syncUserToMedusa } from '../services/medusa-sync.service';

const router = Router();
router.use(authenticate);

// POST /api/customer/medusa-sync — sync current user to Medusa
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const customerId = await syncUserToMedusa(userId);

    if (!customerId) {
      return res.status(500).json({ success: false, error: 'Failed to sync with Medusa' });
    }

    return res.status(200).json({
      success: true,
      data: { medusaCustomerId: customerId },
    });
  } catch (error) {
    console.error('Medusa sync error:', error);
    return res.status(500).json({ success: false, error: 'Failed to sync with Medusa' });
  }
});

// GET /api/customer/medusa-sync — check sync status
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { User } = await import('@pawtag/db');
    const user = await User.findById(req.user!.id).select('medusaCustomerId');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        synced: !!user.medusaCustomerId,
        medusaCustomerId: user.medusaCustomerId || null,
      },
    });
  } catch (error) {
    console.error('Medusa sync status error:', error);
    return res.status(500).json({ success: false, error: 'Failed to check sync status' });
  }
});

export default router;
