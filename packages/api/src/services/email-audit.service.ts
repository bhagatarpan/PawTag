import { EmailAudit } from '@pawtag/db';
import logger from '../lib/logger';

interface AuditEmailParams {
  templateId?: string;
  templateSlug: string;
  templateVersion?: number;
  businessFlow?: string;
  recipientEmail: string;
  recipientName?: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  previewText?: string;
  htmlContent: string;
  plainTextContent?: string;
  variables?: Array<{ key: string; value: string; source?: string }>;
  providerMessageId?: string;
  providerResponse?: Record<string, any>;
  relatedEntityType?: 'customer' | 'order' | 'subscription' | 'pet' | 'tag' | 'referral';
  relatedEntityId?: string;
  relatedEntityDisplay?: string;
  /** Optional durable key so retries do not create duplicate audit rows */
  idempotencyKey?: string;
  isTest?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Record an email audit entry.
 * Called after every successful or attempted email send.
 * Idempotent when `idempotencyKey` is provided.
 */
export async function recordEmailAudit(params: AuditEmailParams): Promise<string | null> {
  try {
    if (params.idempotencyKey) {
      const existing = await EmailAudit.findOne({ idempotencyKey: params.idempotencyKey }).lean();
      if (existing) {
        return existing._id.toString();
      }
    }

    const audit = await EmailAudit.create({
      templateId: params.templateId || undefined,
      templateSlug: params.templateSlug,
      templateVersion: params.templateVersion || undefined,
      businessFlow: params.businessFlow || 'other',
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName || undefined,
      senderEmail: params.senderEmail,
      senderName: params.senderName,
      subject: params.subject,
      previewText: params.previewText || undefined,
      htmlContent: params.htmlContent,
      plainTextContent: params.plainTextContent || undefined,
      variables: params.variables || [],
      status: params.providerMessageId ? 'sent' : 'failed',
      provider: 'resend',
      providerMessageId: params.providerMessageId || undefined,
      providerResponse: params.providerResponse || undefined,
      deliveryTimeline: [
        {
          event: params.providerMessageId ? 'sent' : 'failed',
          timestamp: new Date(),
          details: params.providerMessageId ? `Provider message ID: ${params.providerMessageId}` : params.providerResponse?.error || 'Send failed',
        },
      ],
      relatedEntityType: params.relatedEntityType || undefined,
      relatedEntityId: params.relatedEntityId || undefined,
      relatedEntityDisplay: params.relatedEntityDisplay || undefined,
      idempotencyKey: params.idempotencyKey || undefined,
      isTest: params.isTest || false,
      ipAddress: params.ipAddress || undefined,
      userAgent: params.userAgent || undefined,
      sentAt: params.providerMessageId ? new Date() : undefined,
      failedAt: params.providerMessageId ? undefined : new Date(),
    });

    return audit._id.toString();
  } catch (err: any) {
    // Unique idempotencyKey race — return existing row
    if (err?.code === 11000 && params.idempotencyKey) {
      const existing = await EmailAudit.findOne({ idempotencyKey: params.idempotencyKey }).lean();
      if (existing) return existing._id.toString();
    }
    logger.error({ err, templateSlug: params.templateSlug, recipient: params.recipientEmail }, 'Failed to record email audit');
    return null;
  }
}

/**
 * Update an email audit record with delivery status from webhook.
 * Idempotent: does not append a duplicate timeline entry for the same status.
 */
export async function updateEmailAuditStatus(
  providerMessageId: string,
  status: string,
  details?: Record<string, any>,
): Promise<void> {
  try {
    const update: Record<string, any> = { status };
    const timelineEntry = { event: status, timestamp: new Date(), details: JSON.stringify(details) };

    if (status === 'delivered') update.deliveredAt = new Date();
    if (status === 'opened') update.openedAt = new Date();
    if (status === 'clicked') update.clickedAt = new Date();
    if (status === 'failed' || status === 'bounced') {
      update.failedAt = new Date();
      update.failureReason = details?.reason || details?.message || status;
    }

    const existing = await EmailAudit.findOne({ providerMessageId }).lean();
    if (!existing) return;

    const alreadyHasStatus = (existing.deliveryTimeline || []).some(
      (t: any) => t.event === status,
    );

    await EmailAudit.findOneAndUpdate(
      { providerMessageId },
      alreadyHasStatus
        ? { $set: update }
        : {
            $set: update,
            $push: { deliveryTimeline: timelineEntry },
          },
    );
  } catch (err) {
    logger.error({ err, providerMessageId, status }, 'Failed to update email audit status');
  }
}
