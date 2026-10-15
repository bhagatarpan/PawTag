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
      items.push({
        name: item.productName,
        subtitles,
        quantity: item.quantity ?? 1,
        lineTotal: (item.unitPrice ?? 0) * (item.quantity ?? 1),
      });
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
    totals: order && (order.subtotal != null || order.tax != null)
      ? {
          subtotal: order.subtotal ?? undefined,
          discount: order.discount?.amount || undefined,
          discountReason: order.discount?.reason || undefined,
          shipping: order.shippingCost ?? undefined,
          tax: order.tax ?? undefined,
        }
      : undefined,
    payment: {
      method: invoice.paymentMethod || (order?.payment?.method) || (invoice.stripeInvoiceId || invoice.stripePaymentIntentId ? 'card' : undefined),
      cardBrand: snapshotBrand,
      cardLast4: snapshotLast4,
      refundDestination,
      stripePaymentIntentId: channel === 'admin' ? (invoice.stripePaymentIntentId || order?.payment?.stripePaymentIntentId || undefined) : undefined,
      stripeInvoiceId: channel === 'admin' ? (invoice.stripeInvoiceId || undefined) : undefined,
    },
    notes: [],
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
