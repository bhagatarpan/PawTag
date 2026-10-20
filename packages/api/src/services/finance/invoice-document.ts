/**
 * @module Invoice Document Assembly
 * @description Single source of truth for every financial document's
 * presentation data — commerce invoices, credit notes, and donation
 * receipts all flow through here before rendering (HTML viewer or PDF).
 *
 * Channel-aware by design (AGENTS.md + founder decision):
 * - `customer`: invoice/order/receipt numbers, dates, card brand + last4.
 *   NEVER provider identifiers (`pi_`, `in_`, `ch_`) — the invoice number
 *   is the customer's reference and the payment provider is internal.
 * - `admin`: everything, including Stripe PaymentIntent/Invoice IDs for
 *   CSR troubleshooting.
 *
 * Payment card data is a SNAPSHOT taken at document creation
 * (Invoice.cardBrand/cardLast4, DonationReceipt.cardBrand/cardLast4).
 * Legacy documents predate the snapshot — assembly falls back to the
 * historical Order/Membership joins so old records keep rendering.
 *
 * External lookups (Stripe card extraction for donations) are best-effort:
 * a failure never blocks or falsifies document issuance.
 */
import {
  Invoice,
  Order,
  User,
  Subscription,
  UserMembership,
  MembershipTier,
  Setting,
  DonationPayment,
} from '@pawtag/db';
import { formatRefundDestination } from '@pawtag/shared';
import { nzGstProvider } from '../../commerce/providers/simple-gst';
import logger from '../../lib/logger';

export type DocumentChannel = 'customer' | 'admin';
export type InvoiceDocumentKind = 'invoice' | 'credit_note' | 'donation_receipt';

export interface InvoiceDocumentLine {
  /** Bold main description */
  name: string;
  /** Small secondary lines (variant, pet names, engraving, tag id) */
  subtitles: string[];
  quantity: number;
  /** Per-line total; undefined for flat documents (membership, donations) */
  lineTotal?: number;
}

export interface InvoiceDocumentModel {
  kind: InvoiceDocumentKind;
  number: string;
  /** Uppercase document title: INVOICE | CREDIT NOTE | DONATION RECEIPT */
  title: string;
  status: string;
  issuedAt: Date | string;
  paidAt?: Date | string;
  dueDate?: Date | string;
  billingPeriod?: { start: Date | string; end: Date | string };
  amount: number;
  currency: string;
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
    gst: string;
    website: string;
  };
  customer: {
    name: string;
    email: string;
    phone?: string;
    addressLines: string[];
  };
  /** Present for shipped orders */
  shippingAddressLines?: string[];
  orderNumber?: string;
  /** Credit notes: the invoice this note corrects */
  originalInvoiceNumber?: string;
  /** Tag subscription invoices */
  subscriptionPlan?: string;
  subscriptionTagId?: string;
  /** Membership invoices */
  membershipTier?: string;
  items: InvoiceDocumentLine[];
  totals?: {
    subtotal?: number;
    discount?: number;
    discountReason?: string;
    shipping?: number;
    tax?: number;
    /**
     * Config-driven tax label with the effective rate baked in, e.g.
     * "GST (15%)". Sourced from the tax provider at assembly time so the
     * percentage is never hardcoded in a renderer and stays correct if
     * `commerce.tax.rate` ever changes. Undefined when no tax applies.
     */
    taxLabel?: string;
    /** Card processing fee charged on the order (GST-inclusive) */
    cpf?: { amount: number; gst?: number };
  };
  payment: {
    method?: string;
    cardBrand?: string;
    cardLast4?: string;
    /** Credit notes: where the refund went (original payment method) */
    refundDestination?: string;
    /**
     * Provider identifiers — ADMIN CHANNEL ONLY. Renderers must gate
     * these on `channel === 'admin'`; customer documents never show them.
     */
    stripePaymentIntentId?: string;
    stripeInvoiceId?: string;
  };
  /** Kind-specific neutral statements (donation tax notes, signatories) */
  notes: string[];
  channel: DocumentChannel;
}

/** Company/branding settings shared by every document renderer. */
export async function getCompanySettings(): Promise<Record<string, string>> {
  const keys = [
    'company.name',
    'company.address',
    'company.phone',
    'company.email',
    'company.gst',
    'company.website',
    'company.logo',
  ];
  const settings = await Setting.find({ key: { $in: keys } });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return map;
}

function formatAddressLines(addr: any): string[] {
  if (!addr) return [];
  return [addr.line1, addr.line2, [addr.city, addr.state].filter(Boolean).join(', '), [addr.zip, addr.country].filter(Boolean).join(' ')]
    .filter((l): l is string => Boolean(l));
}

/**
 * Assemble the presentation model for an Invoice or credit note document.
 * Prefer the on-document payment snapshot; fall back to the historical
 * Order/Membership joins for legacy records.
 */
export async function assembleInvoiceDocument(
  invoiceId: string,
  channel: DocumentChannel,
): Promise<InvoiceDocumentModel> {
  const invoice = await Invoice.findById(invoiceId).lean() as any;
  if (!invoice) throw new Error('Invoice not found');

  const [order, user, company] = await Promise.all([
    invoice.orderId ? Order.findById(invoice.orderId).lean() : null,
    User.findById(invoice.userId).select('fullName name email phoneNumber address').lean(),
    getCompanySettings(),
  ]);

  let membership: any = null;
  let membershipTier: any = null;
  if (invoice.userMembershipId) {
    membership = await UserMembership.findById(invoice.userMembershipId).lean();
    membershipTier = membership?.tierId ? await MembershipTier.findById(membership.tierId).lean() : null;
  }

  let subscription: any = null;
  if (invoice.subscriptionId) {
    subscription = await Subscription.findById(invoice.subscriptionId)
      .populate('tagId', 'tagId')
      .populate('planId', 'name')
      .lean();
  }

  let originalInvoiceNumber: string | undefined;
  if (invoice.type === 'credit_note' && invoice.relatedInvoiceId) {
    const original = await Invoice.findById(invoice.relatedInvoiceId).select('invoiceNumber').lean();
    originalInvoiceNumber = original?.invoiceNumber;
  }

  const isCreditNote = invoice.type === 'credit_note';

  // ---- Items -------------------------------------------------------------
  const items: InvoiceDocumentLine[] = [];
  if (order?.items?.length) {
    for (const item of order.items) {
      const subtitles: string[] = [];
      if (item.variantName) subtitles.push(item.variantName);
      if (item.petName) subtitles.push(`For: ${item.petName}`);
      for (const t of (item.customisationTexts || []).filter((x: string) => x)) {
        subtitles.push(`Pet name: ${t}`);
      }
      if (item.tagId) subtitles.push(`Tag: ${item.tagId}`);
      const quantity = item.quantity ?? 1;

      // Engraving/customisation surcharge is stored per-unit on the
      // product line; documents present it as its OWN line item so both
      // the product and the engraving show separate prices that sum to
      // the order subtotal (founder decision — WO-000507 review).
      // Pet-name subtitles belong on the engraving line (that is what
      // was engraved); the product row keeps variant/tag references.
      const engravingPerUnit = item.customizationTotal || 0;
      if (engravingPerUnit > 0) {
        const engravingSubtitles = [
          ...(item.petName ? [`For: ${item.petName}`] : []),
          ...(item.customisationTexts || []).filter((x: string) => x).map((x: string) => `Pet name: ${x}`),
        ];
        items.push({
          name: item.productName,
          subtitles: subtitles.filter((s) => !s.startsWith('Pet name:') && !s.startsWith('For:')),
          quantity,
          lineTotal: (item.unitPrice ?? 0) * quantity,
        });
        items.push({
          name: 'Engraving',
          subtitles: engravingSubtitles,
          quantity,
          lineTotal: engravingPerUnit * quantity,
        });
      } else {
        items.push({
          name: item.productName,
          subtitles,
          quantity,
          lineTotal: (item.unitPrice ?? 0) * quantity,
        });
      }
    }
  } else if (invoice.userMembershipId) {
    const tierName = membershipTier?.displayName || membershipTier?.name || 'Membership';
    const interval = membership?.billingInterval === 'monthly' ? 'Monthly' : 'Annual';
    items.push({ name: `${tierName} Membership — ${interval}`, subtitles: [], quantity: 1, lineTotal: invoice.amount });
  } else if (invoice.subscriptionId) {
    const planName = subscription?.planName || 'Subscription';
    const tagId = (subscription?.tagId as any)?.tagId;
    items.push({ name: planName, subtitles: tagId ? [`Tag: ${tagId}`] : [], quantity: 1, lineTotal: invoice.amount });
  } else {
    items.push({ name: isCreditNote ? 'Refund' : 'PawTag services', subtitles: [], quantity: 1, lineTotal: invoice.amount });
  }

  // ---- Payment (snapshot first, legacy joins as fallback) ---------------
  const snapshotBrand = invoice.cardBrand || order?.payment?.cardBrand || membership?.cardBrand || undefined;
  const snapshotLast4 = invoice.cardLast4 || order?.payment?.cardLast4 || membership?.cardLast4 || undefined;
  const refundDestination = isCreditNote
    ? formatRefundDestination(order?.payment?.cardBrand, order?.payment?.cardLast4)
    : undefined;

  // Config-driven tax label, e.g. "GST (15%)" — the name and rate both come
  // from the tax provider's settings, so the percentage is never hardcoded in
  // a renderer and stays correct if `commerce.tax.rate` changes. Only present
  // when an order tax amount exists, mirroring the old "show GST row" condition.
  let taxLabel: string | undefined;
  if (order && order.tax != null) {
    try {
      const [name, rate] = await Promise.all([nzGstProvider.getLabel(), nzGstProvider.getRate()]);
      const pct = Math.round(rate * 10000) / 100; // 0.15 -> 15 (2dp, no float dust)
      taxLabel = rate > 0 ? `${name} (${pct}%)` : name;
    } catch {
      taxLabel = 'GST';
    }
  }

  // ---- Totals presentation -------------------------------------------------
  let totalsOut: NonNullable<InvoiceDocumentModel['totals']> | undefined =
    order && (order.subtotal != null || order.tax != null)
      ? {
          subtotal: order.subtotal ?? undefined,
          discount: order.discount?.amount || undefined,
          discountReason: order.discount?.reason || undefined,
          shipping: order.shippingCost ?? undefined,
          tax: order.tax ?? undefined,
          taxLabel,
        }
      : undefined;
  const notes: string[] = [];

  // Card processing fee as its own totals row on ORDER invoices (never on
  // credit notes — it is never credited; finance plan §8).
  const cpfSnapshot = (order as any)?.payment?.cpf;
  if (!isCreditNote && totalsOut && Number(cpfSnapshot?.amount || 0) > 0) {
    totalsOut.cpf = { amount: cpfSnapshot.amount, gst: cpfSnapshot.gst || 0 };
  }

  // ---- Credit notes document the CREDITED scope, not the whole order -------
  // Source of truth: the breakdown snapshot stored on the refund
  // PaymentTransaction at money-move time. Legacy credit notes without a
  // snapshot keep the original full-order presentation (backward compat).
  if (isCreditNote && order) {
    try {
      const { PaymentTransaction } = await import('@pawtag/db');
      const refundTx: any = await PaymentTransaction.findOne({
        orderId: order._id,
        type: 'refund',
        ...(invoice.stripePaymentIntentId ? { providerTransactionId: invoice.stripePaymentIntentId } : {}),
      })
        .sort({ createdAt: -1 })
        .lean();
      const breakdown = refundTx?.breakdown;
      if (breakdown?.lines?.length) {
        items.length = 0;
        for (const line of breakdown.lines) {
          items.push({
            name: line.kind === 'engraving' ? 'Engraving' : line.productName,
            subtitles: [],
            quantity: line.quantity,
            lineTotal: line.refundedAmount,
          });
        }
        const refundedGst = Number(breakdown.totals?.refundedGst || 0);
        const refundedTotal = Number(breakdown.totals?.refunded || invoice.amount || 0);
        totalsOut = {
          subtotal: Math.round((refundedTotal - refundedGst) * 100) / 100,
          tax: refundedGst,
          taxLabel,
        };
        // D1: customer documents NEVER itemize retained charges; the full
        // detail lives on the admin channel + the refund transaction.
        if (channel === 'admin' && breakdown.retained &&
            (Number(breakdown.retained.engraving || 0) > 0 || Number(breakdown.retained.cpf || 0) > 0)) {
          const retainedParts: string[] = [];
          if (Number(breakdown.retained.engraving || 0) > 0) {
            retainedParts.push(`engraving $${Number(breakdown.retained.engraving).toFixed(2)}`);
          }
          if (Number(breakdown.retained.cpf || 0) > 0) {
            retainedParts.push(`card processing fee $${Number(breakdown.retained.cpf).toFixed(2)}`);
          }
          notes.push(`Retained charges (not credited on this note): ${retainedParts.join(' · ')}`);
        }
      }
    } catch (err) {
      logger.error({ err, invoiceNumber: invoice.invoiceNumber }, 'Credit note breakdown lookup failed — using legacy full-order presentation');
    }
  }

  return {
    kind: isCreditNote ? 'credit_note' : 'invoice',
    number: invoice.invoiceNumber,
    title: isCreditNote ? 'CREDIT NOTE' : 'INVOICE',
    status: invoice.status,
    issuedAt: invoice.createdAt,
    paidAt: invoice.paidAt,
    dueDate: invoice.dueDate,
    billingPeriod: invoice.billingPeriod,
    amount: invoice.amount,
    currency: invoice.currency || 'NZD',
    company: {
      name: company['company.name'] || 'PawTag',
      address: company['company.address'] || '',
      phone: company['company.phone'] || '',
      email: company['company.email'] || '',
      gst: company['company.gst'] || '',
      website: company['company.website'] || '',
    },
    customer: {
      name: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phoneNumber || undefined,
      addressLines: formatAddressLines(user?.address),
    },
    shippingAddressLines: order?.shippingAddress ? formatAddressLines(order.shippingAddress) : undefined,
    orderNumber: order?.orderNumber,
    originalInvoiceNumber,
    subscriptionPlan: subscription?.planName || undefined,
    subscriptionTagId: (subscription?.tagId as any)?.tagId || undefined,
    membershipTier: membershipTier?.displayName || membershipTier?.name || undefined,
    items,
    totals: totalsOut,
    payment: {
      method: invoice.paymentMethod || (order?.payment?.method) || (invoice.stripeInvoiceId || invoice.stripePaymentIntentId ? 'card' : undefined),
      cardBrand: snapshotBrand,
      cardLast4: snapshotLast4,
      refundDestination,
      stripePaymentIntentId: channel === 'admin' ? (invoice.stripePaymentIntentId || order?.payment?.stripePaymentIntentId || undefined) : undefined,
      stripeInvoiceId: channel === 'admin' ? (invoice.stripeInvoiceId || undefined) : undefined,
    },
    notes,
    channel,
  };
}

/**
 * Assemble the presentation model for a donation receipt. Keeps the
 * document type distinct (neutral tax wording preserved from the receipt
 * record) while sharing the engine's visual language and payment details.
 */
export async function assembleDonationReceiptDocument(
  receipt: any,
  channel: DocumentChannel,
): Promise<InvoiceDocumentModel> {
  const company = await getCompanySettings();

  // Best-effort provider ID from the linked payment for admin channel —
  // failures never block receipt rendering. Card data comes from the
  // receipt's own issuance snapshot (with no render-time Stripe calls).
  let stripePaymentIntentId: string | undefined;
  try {
    if (receipt.paymentId) {
      const payment = await DonationPayment.findById(receipt.paymentId).lean();
      stripePaymentIntentId = payment?.stripePaymentIntentId || undefined;
    }
  } catch {
    // best-effort only
  }

  const taxNote =
    !receipt.taxClassification || receipt.taxClassification === 'neutral'
      ? 'This is a donation payment receipt. Tax treatment, if any, depends on your circumstances and applicable law.'
      : `Tax classification (configured): ${receipt.taxClassification}`;

  const notes: string[] = [receipt.statement || 'Thank you for your donation.', taxNote];
  if (receipt.irdNumber) notes.push(`IRD number: ${receipt.irdNumber}`);
  if (receipt.charitiesNumber) notes.push(`Charities number: ${receipt.charitiesNumber}`);
  if (receipt.signatory) notes.push(`Authorised by: ${receipt.signatory}`);

  const donorName = receipt.donorNameSnapshot || 'Supporter';

  return {
    kind: 'donation_receipt',
    number: receipt.receiptNumber,
    title: 'DONATION RECEIPT',
    status: receipt.status,
    issuedAt: receipt.issuedAt || receipt.createdAt,
    amount: (receipt.amountCents || 0) / 100,
    currency: (receipt.currency || 'NZD').toUpperCase(),
    company: {
      name: receipt.organisationName || company['company.name'] || 'PawTag',
      address: company['company.address'] || '',
      phone: company['company.phone'] || '',
      email: company['company.email'] || '',
      gst: company['company.gst'] || '',
      website: company['company.website'] || '',
    },
    customer: { name: donorName, email: '', addressLines: [] },
    items: [{ name: 'Donation', subtitles: [], quantity: 1, lineTotal: (receipt.amountCents || 0) / 100 }],
    payment: {
      method: stripePaymentIntentId ? 'card' : undefined,
      cardBrand: receipt.cardBrand || undefined,
      cardLast4: receipt.cardLast4 || undefined,
      stripePaymentIntentId: channel === 'admin' ? stripePaymentIntentId : undefined,
    },
    notes,
    channel,
  };
}
