/**
 * Credit note creation for refunds — shared by every refund path
 * (CSR return refunds, admin refunds, cancellation reconciliation).
 *
 * A credit note is the financial document that records money returned to
 * the customer; without it, refund emails reference a document that
 * never exists and the customer receives money with no paper trail.
 *
 * Idempotency: one credit note per successful refund transaction —
 * matched by orderId + the refund's providerTransactionId in the note's
 * metadata-less fields (relatedInvoiceId links the corrected invoice).
 * Failures never block the refund itself (the money already moved);
 * they log loudly for reconciliation.
 */
import { Invoice } from '@pawtag/db';
import { roundToCents } from '@pawtag/shared';
import { generateCreditNoteNumber } from '../../lib/invoice-number';
import logger from '../../lib/logger';

export interface CreditNoteContext {
  orderId: any;
  userId: any;
  refundAmount: number;
  currency: string;
  /** The refund's provider id (pi_/re_) — used to dedupe repeat attempts */
  refundId?: string;
  paymentMethod?: string;
  cardBrand?: string;
  cardLast4?: string;
}

/**
 * Create (or reuse) the credit note for a refunded order.
 * Returns the credit note document, or null when creation failed.
 */
export async function createCreditNoteForRefund(ctx: CreditNoteContext): Promise<any | null> {
  try {
    const orderId = ctx.orderId;

    // Find original invoice for this order (the document being credited)
    const originalInvoice = await Invoice.findOne({ orderId, type: 'invoice' }).sort({ createdAt: -1 }).lean();

    // One credit note per refund: a previous (retry) attempt may have
    // already created it
    const existing = ctx.refundId
      ? await Invoice.findOne({ type: 'credit_note', orderId, stripePaymentIntentId: ctx.refundId }).lean()
      : await Invoice.findOne({ type: 'credit_note', orderId }).lean();
    if (existing) return existing;

    const creditNoteNumber = await generateCreditNoteNumber();
    const creditNote = await Invoice.create({
      type: 'credit_note',
      relatedInvoiceId: originalInvoice?._id || null,
      orderId,
      userId: ctx.userId,
      invoiceNumber: creditNoteNumber,
      amount: roundToCents(ctx.refundAmount),
      currency: ctx.currency || 'NZD',
      status: 'paid',
      paymentMethod: ctx.paymentMethod,
      cardBrand: ctx.cardBrand,
      cardLast4: ctx.cardLast4,
      stripePaymentIntentId: ctx.refundId,
      paidAt: new Date(),
    });

    logger.info({ orderId, creditNoteId: creditNote._id, creditNoteNumber, refundAmount: ctx.refundAmount }, 'Credit note generated');
    return creditNote;
  } catch (err: any) {
    logger.error({ err, orderId: ctx.orderId }, 'Failed to generate credit note — non-fatal, refund already processed');
    return null;
  }
}
