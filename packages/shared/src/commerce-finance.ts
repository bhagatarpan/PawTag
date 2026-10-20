/**
 * Commerce finance shared types — Card Processing Fee (CPF) and the
 * refund breakdown snapshot shared by APIs, admin UI, emails, and
 * financial documents.
 *
 * Plan: docs/COMMERCE-FINANCE-PLAN-GST-CPF.md (founder decisions D1-D17).
 *
 * Invariants:
 * - ALL amounts are GST-INCLUSIVE dollars (roundToCents before persistence).
 * - The breakdown snapshot is written ONCE at money-move time and is the
 *   durable truth — tag state can change later (returned tags detach), so
 *   nothing may re-derive eligibility from live data after the fact.
 * - Customer-facing surfaces use totals only; line/retained detail is
 *   admin-channel information (D1).
 */

/** CPF snapshot persisted on the order at PaymentIntent creation. */
export interface CpfSnapshot {
  /** Gross fee charged (GST-inclusive) */
  amount: number;
  /** GST portion embedded in `amount` */
  gst: number;
  /** Percent used at charge time (schedule snapshot) */
  percent: number;
  /** Fixed component used at charge time (schedule snapshot) */
  fixed: number;
  /** Fee schedule version captured at charge time */
  scheduleVersion: string;
  /** Card network from the captured payment method (filled at capture) */
  cardNetwork?: string;
  /** Card country from the captured payment method (filled at capture) */
  cardCountry?: string;
  /** CPF amount refunded back (exception paths: merchant fault, unsupported brand) */
  refundedAmount?: number;
}

/** Result of computing CPF for a payable amount (null when disabled/zero). */
export interface CpfComputation {
  amount: number;
  gst: number;
  percent: number;
  fixed: number;
  scheduleVersion: string;
}

/** A refundable line kind within an order item. */
export type RefundLineKind = 'product' | 'engraving';

/** One line of a refund breakdown (what was actually refunded). */
export interface RefundBreakdownLine {
  orderItemId: string;
  productName: string;
  kind: RefundLineKind;
  quantity: number;
  /** GST-inclusive amount per unit for this line */
  unitInclusive: number;
  /** GST-inclusive amount actually refunded for this line */
  refundedAmount: number;
  /** GST portion contained in refundedAmount */
  gstPortion: number;
}

/** Charges permanently retained (never refunded) alongside a refund. */
export interface RefundRetainedCharges {
  /** Retained engraving service charge (PawTag ID generated) */
  engraving: number;
  /** GST portion embedded in the retained engraving */
  engravingGst: number;
  /** Retained card processing fee */
  cpf: number;
  /** GST portion embedded in the retained CPF */
  cpfGst: number;
}

/** Durable per-refund snapshot stored on the refund PaymentTransaction. */
export interface RefundBreakdownSnapshot {
  lines: RefundBreakdownLine[];
  totals: {
    /** Total refunded (GST-inclusive) — equals the Stripe refund amount */
    refunded: number;
    /** GST portion contained in the refunded total */
    refundedGst: number;
  };
  retained: RefundRetainedCharges;
}

/** Admin line-selection payload for a (partial) refund. */
export interface RefundLineSelection {
  lines: Array<{
    orderItemId: string;
    /** Units of the product line to refund */
    productQuantity?: number;
    /** Units of the engraving surcharge to refund (eligible units only) */
    engravingQuantity?: number;
  }>;
}

/** Per-item refundability view (admin picker + CSR balance display). */
export interface ItemRefundability {
  orderItemId: string;
  productName: string;
  quantity: number;
  alreadyRefundedQuantity: number;
  unitPrice: number;
  customizationTotal: number;
  customisationTexts?: string[];
  /** Units whose PawTag ID has been generated (engraving started) */
  taggedUnits: number;
  /** Units of the product still refundable */
  productRefundableQty: number;
  /** Units of the engraving surcharge still refundable (untagged + unrefunded) */
  engravingRefundableUnits: number;
  /** Engraving permanently retained (tagged units × per-unit charge) */
  engravingRetained: number;
}
