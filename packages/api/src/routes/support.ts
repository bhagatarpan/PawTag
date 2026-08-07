import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { SupportRequest } from '@pawtag/db';
import { sendMail } from '../services/email.service';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

// --- Public: Contact form ---
export const publicRouter = Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.SUPPORT_RATE_LIMIT_MAX || '5', 10),
  message: { success: false, error: 'Too many support requests. Please try again later.' },
  skip: () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development',
});

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email is required').max(255),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
});

publicRouter.post('/contact', contactLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { name, email, message } = parsed.data;

    const supportRequest = await SupportRequest.create({ name, email, message });

    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    if (adminEmail) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#1e40af;">📩 New Support Request</h2>
          <table style="border-collapse:collapse;width:100%;margin:16px 0;">
            <tr><td style="padding:8px;font-weight:bold;width:100px;">Name</td><td style="padding:8px;">${name}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;">${email}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Submitted</td><td style="padding:8px;">${new Date().toISOString()}</td></tr>
          </table>
          <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
            <p style="margin:0;white-space:pre-wrap;">${message}</p>
          </div>
          <p style="color:#6b7280;font-size:13px;">Support Request ID: ${supportRequest._id}</p>
        </div>`;
      await sendMail(adminEmail, `[PawTag Support] New message from ${name}`, html);
    }

    res.status(201).json({ success: true, data: { id: supportRequest._id } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to submit support request' });
  }
});

// --- Admin: Support requests management ---
export const adminRouter = Router();

adminRouter.get('/', authenticate, requirePermission('admin.read'), async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const resolved = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;

    const filter: Record<string, unknown> = {};
    if (resolved !== undefined) filter.resolved = resolved;

    const [requests, total] = await Promise.all([
      SupportRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SupportRequest.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        requests,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch support requests' });
  }
});

adminRouter.patch('/:id/resolve', authenticate, requirePermission('admin.update'), async (req: AuthRequest, res: Response) => {
  try {
    const request = await SupportRequest.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedAt: new Date(), resolvedBy: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined, notes: req.body.notes },
      { new: true },
    );
    if (!request) {
      return res.status(404).json({ success: false, error: 'Support request not found' });
    }
    res.json({ success: true, data: request });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to resolve support request' });
  }
});
