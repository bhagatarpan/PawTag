import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { PushToken } from '@pawtag/db';
import { registerPushToken, removePushToken, getUserPushTokens } from '../services/push-notification.service';

const router = Router();

// Customer: Register push token
router.post('/customer/push-tokens', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { token, platform } = req.body;
    if (!token || !platform) {
      res.status(400).json({ success: false, error: 'Token and platform are required' });
      return;
    }
    if (!['web', 'ios', 'android'].includes(platform)) {
      res.status(400).json({ success: false, error: 'Platform must be web, ios, or android' });
      return;
    }

    await registerPushToken(req.user!.id, token, platform);
    res.json({ success: true, data: { message: 'Push token registered' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to register push token' });
  }
});

// Customer: Remove push token
router.delete('/customer/push-tokens/:token', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await removePushToken(req.params.token);
    res.json({ success: true, data: { message: 'Push token removed' } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to remove push token' });
  }
});

// Customer: List push tokens
router.get('/customer/push-tokens', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const tokens = await getUserPushTokens(req.user!.id);
    res.json({ success: true, data: tokens });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to list push tokens' });
  }
});

export default router;
