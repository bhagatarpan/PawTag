import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

/**
 * CAPTCHA verification middleware for public endpoints.
 * Uses the same math-problem CAPTCHA as auth routes.
 * Skipped in dev/test environments.
 */
export function requireCaptcha(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return next();
  }

  const { captchaToken, captchaAnswer } = req.body;

  if (!captchaToken || captchaAnswer === undefined) {
    res.status(400).json({
      success: false,
      error: 'CAPTCHA required. Please complete the verification.',
      code: 'CAPTCHA_REQUIRED',
    });
    return;
  }

  try {
    const decoded = jwt.verify(captchaToken, config.jwtSecret) as { captchaAnswer: number; exp: number };
    if (decoded.captchaAnswer !== captchaAnswer) {
      res.status(400).json({ success: false, error: 'Invalid CAPTCHA answer. Please try again.' });
      return;
    }
  } catch {
    res.status(400).json({ success: false, error: 'CAPTCHA expired. Please get a new one.' });
    return;
  }

  next();
}
