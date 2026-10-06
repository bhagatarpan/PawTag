import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { updateEmailAuditStatus } from '../services/email-audit.service';
import logger from '../lib/logger';

const router = Router();

/**
 * Verify Resend (Svix) webhook signatures.
 * Headers: svix-id, svix-timestamp, svix-signature
 * Signed content: `${svix-id}.${svix-timestamp}.${rawBody}`
 */
function verifyResendSignature(
  rawBody: Buffer,
  headers: Record<string, unknown>,
  secret: string,
): boolean {
  const svixId = headers['svix-id'];
  const svixTimestamp = headers['svix-timestamp'];
  const svixSignature = headers['svix-signature'];

  if (typeof svixId !== 'string' || typeof svixTimestamp !== 'string' || typeof svixSignature !== 'string') {
    return false;
  }

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedContent).digest('base64');

  const parts = svixSignature.split(' ');
  return parts.some((part) => {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

function getRawBody(req: Request): Buffer {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
  return Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');
}

/**
 * POST /api/webhooks/resend
 * Handles Resend email delivery webhooks (delivered, bounced, complained, opened, clicked)
 *
 * Mounted at /api/webhooks/resend with express.raw() so signatures verify against
 * the unmodified body. Production requires RESEND_WEBHOOK_SECRET.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = getRawBody(req);
    const secret = process.env.RESEND_WEBHOOK_SECRET;

    // Fail closed: production must verify Resend webhook signatures.
    if (process.env.NODE_ENV === 'production') {
      if (!secret) {
        logger.error('Resend webhook rejected — RESEND_WEBHOOK_SECRET not configured in production');
        res.status(500).json({ success: false, error: 'Email webhook secret not configured' });
        return;
      }
      if (!verifyResendSignature(rawBody, req.headers as Record<string, unknown>, secret)) {
        logger.warn('Resend webhook rejected — invalid signature');
        res.status(400).json({ success: false, error: 'Invalid webhook signature' });
        return;
      }
    } else if (secret) {
      // Non-production: verify when a secret is configured (staging/test hardening)
      if (!verifyResendSignature(rawBody, req.headers as Record<string, unknown>, secret)) {
        logger.warn('Resend webhook rejected — invalid signature');
        res.status(400).json({ success: false, error: 'Invalid webhook signature' });
        return;
      }
    }

    let body: any;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      res.status(400).json({ success: false, error: 'Invalid webhook payload' });
      return;
    }

    const eventType = body.type;
    const data = body.data;

    if (!eventType || !data?.email_id) {
      res.status(400).json({ success: false, error: 'Invalid webhook payload' });
      return;
    }

    const providerMessageId = data.email_id;

    // Map Resend event types to our status values
    const statusMap: Record<string, string> = {
      'email.delivered': 'delivered',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
      'email.opened': 'opened',
      'email.clicked': 'clicked',
      'email.sent': 'sent',
      'email.delivery_delayed': 'sent',
    };

    const status = statusMap[eventType];
    if (!status) {
      // Unknown event type — acknowledge but don't process
      res.json({ success: true, message: `Event type ${eventType} acknowledged` });
      return;
    }

    const details: Record<string, any> = {};
    if (data.bounce) details.reason = data.bounce.message || data.bounce.type;
    if (data.click) details.url = data.click.url;

    await updateEmailAuditStatus(providerMessageId, status, details);

    logger.info({ eventType, providerMessageId }, 'Resend webhook processed');
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Resend webhook processing failed');
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

export default router;
