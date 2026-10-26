// ============================================================
// Customer portal invoices (list/detail)
// Shared contracts for GET /api/customer/invoices
// ============================================================

/** Default page size for customer invoice list. */
export const CUSTOMER_INVOICE_LIST_PAGE_SIZE = 20;

/**
 * Human labels for invoice statuses (DB enum: Invoice.ts). Config here so
 * every surface (list, detail, future admin/customer views) resolves copy
 * from one place instead of rendering raw enum text like "uncollectible".
 */
export const INVOICE_STATUS_LABELS: Readonly<Record<string, string>> = {
  paid: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  refunded: 'Refunded',
  void: 'Void',
  uncollectible: 'Uncollectible',
};

/** Invoice status → display label (unknown future values fall back to raw). */
export function getInvoiceStatusLabel(status: string): string {
  return INVOICE_STATUS_LABELS[status] || status;
}

/**
 * Signed amount for LIST display (plan §5.3: "credit-note negative amounts").
 * Credit notes are stored with positive amounts (semantics live in the
 * document type/labels) — the list shows them as money coming back, matching
 * the concept image. The guard keeps a future negative payload from
 * double-minusing; stored values are never mutated.
 */
export function invoiceDisplayAmount(type: CustomerInvoiceType, amount: number): number {
  if (type === 'credit_note' && amount > 0) return -amount;
  return amount;
}

export type CustomerInvoiceType = 'invoice' | 'credit_note';

export interface CustomerInvoiceListItem {
  _id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  type: CustomerInvoiceType;
  paidAt?: string | null;
  createdAt: string;
  orderId?: string | null;
  userMembershipId?: string | null;
  subscriptionId?: string | null;
}

export interface CustomerInvoiceListResponse {
  data: CustomerInvoiceListItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface CustomerInvoiceOrderLine {
  productName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice?: number | null;
  totalPrice?: number | null;
  tagId?: string | null;
  petName?: string | null;
  customisationTexts?: string[];
}

export interface CustomerInvoiceOrderSummary {
  orderNumber: string;
  items?: CustomerInvoiceOrderLine[];
  subtotal?: number | null;
  shippingCost?: number | null;
  tax?: number | null;
  discount?: { amount?: number | null; reason?: string | null } | null;
  /** Card processing fee charged on the order (GST-inclusive) */
  cpf?: { amount: number; gst?: number } | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  shippingAddress?: {
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  } | null;
  refundArn?: string | null;
  refundExpectedArrival?: string | null;
}

export interface CustomerInvoiceMembershipSummary {
  tierName: string;
  tier?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  price?: number | null;
  currency?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
}

export interface CustomerInvoiceSubscriptionSummary {
  planName: string;
  planType?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
}

export interface CustomerInvoiceDetail {
  _id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  type: CustomerInvoiceType;
  paidAt?: string | null;
  dueDate?: string | null;
  createdAt: string;
  billingPeriod?: { start: string; end: string } | null;
  paymentMethod?: string | null;
  voidedReason?: string | null;
  stripeInvoiceId?: string | null;
  orderId?: string | null;
  userMembershipId?: string | null;
  subscriptionId?: string | null;
  relatedInvoiceNumber?: string | null;
  order?: CustomerInvoiceOrderSummary | null;
  /**
   * Credited scope for credit notes (customer-safe: refunded lines + GST
   * portions only; retained charges are never projected). When present,
   * the page renders THIS instead of the original order's items/totals so
   * everything reconciles with the note amount.
   */
  refundScope?: {
    lines: Array<{
      productName: string;
      kind: 'product' | 'engraving';
      quantity: number;
      refundedAmount: number;
      gstPortion: number;
    }>;
    totals: { refunded: number | null; refundedGst: number | null };
  } | null;
  membership?: CustomerInvoiceMembershipSummary | null;
  subscription?: CustomerInvoiceSubscriptionSummary | null;
}

export interface CustomerInvoiceDetailResponse {
  data: CustomerInvoiceDetail;
}
