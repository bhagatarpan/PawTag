import { Router, Request, Response } from 'express';
import { updateEmailAuditStatus } from '../services/email-audit.service';
import logger from '../lib/logger';

const router = Router();

/**
 * POST /api/webhooks/resend
 * Handles Resend email delivery webhooks (delivered, bounced, complained, opened, clicked)
 * Resend sends these as POST requests with a type field indicating the event.
 */
router.post('/resend', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Resend webhook format: { type: string, data: { email_id: string, ... } }
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
