/**
 * Authoritative checkout quote contract.
 * Server recalculates all monetary values; clients select IDs/options only.
 */
export interface CheckoutQuote {
  userId: string;
  currency: string;
  subtotal: number;
  /** Promo/discount amount from cart (excluding rewards) */
  discount: number;
  /** PawRewards amount clamped to available unreserved balance */
  rewardsDiscount: number;
  shipping: number;
  shippingMethodId?: string;
  shippingMethodName?: string;
  tax: number;
  /** Final payable total (server-authoritative) */
  total: number;
  /** Stable revision for stale-quote detection */
  quoteRevision: string;
  quotedAt: Date;
  expiresAt: Date;
  isZeroTotal: boolean;
}
