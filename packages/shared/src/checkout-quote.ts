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
  /**
   * Card processing fee for this quote (GST-inclusive; null when the
   * commerce.cpf switch is off). `payableTotal` = total + cpf — the exact
   * amount submitted to Stripe (docs/COMMERCE-FINANCE-PLAN-GST-CPF.md).
   */
  cpf?: import('./commerce-finance').CpfComputation | null;
  /** total + card processing fee — what the customer actually pays */
  payableTotal?: number;
  /** Stable revision for stale-quote detection */
  quoteRevision: string;
  quotedAt: Date;
  expiresAt: Date;
  isZeroTotal: boolean;
}
