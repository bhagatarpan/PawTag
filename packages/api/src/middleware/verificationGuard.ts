import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { User } from '@pawtag/db';
import logger from '../lib/logger';

export async function requireVerifiedAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const user = await User.findById(req.user.id).select('status emailVerified phoneVerified role');
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact support.',
        code: 'ACCOUNT_SUSPENDED',
      });
      return;
    }

    if (user.status === 'inactive') {
      res.status(403).json({
        success: false,
        error: 'Your account is inactive. Please contact support.',
        code: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    if (user.status === 'pending_verification') {
      res.status(403).json({
        success: false,
        error: 'Please verify your email and phone number to activate your account.',
        code: 'REQUIRES_VERIFICATION',
        data: {
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
        },
      });
      return;
    }

    next();
  } catch (error) {
    logger.error({ err: error }, 'Verification guard error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * Require both email and phone verified flags to be true.
 * Used by onboarding-complete so admin-created active users
 * (phoneVerified=false) and contact-change bypasses cannot finish
 * onboarding without re-verifying.
 */
export async function requireVerifiedChannels(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const user = await User.findById(req.user.id).select('status emailVerified phoneVerified');
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact support.',
        code: 'ACCOUNT_SUSPENDED',
      });
      return;
    }

    if (user.status === 'inactive') {
      res.status(403).json({
        success: false,
        error: 'Your account is inactive. Please contact support.',
        code: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    const emailVerified = user.emailVerified === true;
    const phoneVerified = user.phoneVerified === true;

    if (!emailVerified || !phoneVerified) {
      res.status(403).json({
        success: false,
        error: 'Please verify your email address and mobile number to continue.',
        code: 'REQUIRES_VERIFICATION',
        data: { emailVerified, phoneVerified },
      });
      return;
    }

    next();
  } catch (error) {
    logger.error({ err: error }, 'Contact verification guard error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
