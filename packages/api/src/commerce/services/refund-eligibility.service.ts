/**
 * @module Refund Eligibility Service
 * @description Single source of truth for WHAT is refundable on an order
 * and HOW MUCH — used by cancellation, return refunds, admin refunds, the
 * admin picker, the customer return estimate, credit notes, and the
 * finance dashboard. No other module may re-implement these rules.
 *
 * Plan: docs/COMMERCE-FINANCE-PLAN-GST-CPF.md (founder decisions D1-D17).
 *
 * Business rules enforced here:
 * - Product lines are refundable per un-refunded unit.
 * - The engraving surcharge is refundable ONLY for units whose PawTag ID
 *   has NOT been generated (Fulfilment.tagAssignments). Tagged units'
 *   engraving is permanently retained (hard cap — D14).
 * - The card processing fee (CPF) is retained on refunds except through
 *   the explicit exception paths in cpf.service (merchant fault /
 *   unsupported brand).
 * - Master cap every money path must respect:
 *     maxRefundable = captured − retained CPF − retained engraving − prior refunds
 * - GST is never computed independently: it is the inclusive-price
 *   extraction of whatever amount actually moves.
 *
 * Money math: shared helpers only (cents-safe), per skills/monetary-precision.
 */

import { Fulfilment, PaymentTransaction } from '@pawtag/db';
import {
  fromCents,
  roundToCents,
  toCents,
  type ItemRefundability,
  type RefundBreakdownLine,
  type RefundBreakdownSnapshot,
  type RefundLineSelection,
  type RefundRetainedCharges,
} from '@pawtag/shared';
import { nzGstProvider } from '../providers/simple-gst';
import { cpfForOrder, cpfRetained } from './cpf.service';
import { InvalidRefundSelectionError, RefundExceedsCapError } from '../errors';
import logger from '../../lib/logger';

/** Sum of cents of succeeded/pending refund transactions for an order. */
export async function alreadyRefundedCents(orderId: any): Promise<number> {
  const txs = await PaymentTransaction.find({
    orderId,
    type: 'refund',
    status: { $in: ['succeeded', 'pending'] },
  })
    .select('amount')
    .lean();
  return txs.reduce((sum, t) => sum + toCents(Number((t as any).amount || 0)), 0);
}

/**
 * GST portion of a GST-inclusive amount (rate from the tax provider).
 * For tax-exclusive stores the rate is applied to the net amount instead.
 */
export async function gstPortion(amount: number): Promise<number> {
  if (!(amount > 0)) return 0;
  const rate = await nzGstProvider.getRate();
  if (!(rate > 0)) return 0;
  const inclusive = await nzGstProvider.isInclusive();
  return roundToCents(inclusive ? (amount * rate) / (1 + rate) : amount * rate);
}

/**
 * Units of an order item whose PawTag ID has been generated, summed from
 * every fulfilment tag assignment for the order (proven matching pattern:
 * services/returns/tag-return-detach.service).
 */
export async function getTaggedUnits(orderId: any, orderItemId: any): Promise<number> {
  const fulfilments = await Fulfilment.find({ orderId }).lean();
  let tagged = 0;
  for (const f of fulfilments as any[]) {
    for (const assignment of f.tagAssignments || []) {
      if (String(assignment.orderItemId) === String(orderItemId)) {
        tagged += Number(assignment.quantity || 1);
      }
    }
  }
  return tagged;
}

/** Per-item refundability view (picker pre-fill + CSR balance display). */
export async function lineRefundability(order: any): Promise<ItemRefundability[]> {
  const result: ItemRefundability[] = [];
  for (const item of order.items || []) {
    const quantity = Number(item.quantity || 0);
    const refundedQty = Number(item.refundedQuantity || 0);
    const taggedUnits = Math.min(quantity, await getTaggedUnits(order._id, item._id));
    const unrefundedUnits = Math.max(0, quantity - refundedQty);
    const untaggedUnits = Math.max(0, quantity - taggedUnits);
    const customizationTotal = Number(item.customizationTotal || 0);

    result.push({
      orderItemId: String(item._id),
      productName: item.productName,
      quantity,
      alreadyRefundedQuantity: refundedQty,
      unitPrice: Number(item.unitPrice || 0),
      customizationTotal,
      customisationTexts: (item.customisationTexts || []).filter(Boolean),
      taggedUnits,
      productRefundableQty: unrefundedUnits,
      engravingRefundableUnits: Math.min(untaggedUnits, unrefundedUnits),
      engravingRetained: roundToCents(customizationTotal * taggedUnits),
    });
  }
  return result;
}

/** Engraving permanently retained across the whole order (tagged units). */
export async function engravingRetainedCents(order: any): Promise<number> {
  const items = await lineRefundability(order);
  return items.reduce((sum, i) => sum + toCents(i.engravingRetained), 0);
}

/**
 * The master refundable cap for an order, in cents.
 * maxRefundable = captured − retained CPF − retained engraving − prior refunds.
 * Pass `priorRefundedCents` when the caller already computed it.
 */
export async function maxRefundableCents(order: any, priorRefundedCents?: number): Promise<number> {
  const capturedCents = toCents(Number(order?.payment?.amount || 0));
  const cpfRetainedCents = toCents(cpfRetained(order));
  const engravingRetained = await engravingRetainedCents(order);
  const prior = priorRefundedCents ?? (await alreadyRefundedCents(order._id));
  return Math.max(0, capturedCents - cpfRetainedCents - engravingRetained - prior);
}

/**
 * Full-selection breakdown used by CANCELLATION: every un-refunded unit
 * of every product line, plus engraving for untagged units only. The CPF
 * is always retained (merchant-fault refunds add it back separately via
 * cpf.refundCpfForMerchantFault).
 */
export async function buildFullSelection(order: any): Promise<RefundLineSelection> {
  const items = await lineRefundability(order);
  return {
    lines: items
      .filter((i) => i.productRefundableQty > 0 || i.engravingRefundableUnits > 0)
      .map((i) => ({
        orderItemId: i.orderItemId,
        productQuantity: i.productRefundableQty,
        engravingQuantity: i.engravingRefundableUnits,
      })),
  };
}

/**
 * Validate a selection against live refundability and build the durable
 * breakdown snapshot + total refund amount.
 *
 * Throws InvalidRefundSelectionError for unknown items, over-quantities,
 * and any engraving selection covering a tagged unit (hard cap, D14).
 */
export async function buildBreakdown(order: any, selection: RefundLineSelection): Promise<{
  breakdown: RefundBreakdownSnapshot;
  refundAmount: number;
}> {
  const items = await lineRefundability(order);
  const byId = new Map(items.map((i) => [i.orderItemId, i]));

  const lines: RefundBreakdownLine[] = [];
  let refundedCents = 0;
  let refundedGstCents = 0;

  for (const requested of selection.lines || []) {
    const item = byId.get(String(requested.orderItemId));
    if (!item) {
      throw new InvalidRefundSelectionError('Refund line does not belong to this order', {
        orderItemId: String(requested.orderItemId),
      });
    }

    const productQty = Number(requested.productQuantity || 0);
    const engravingQty = Number(requested.engravingQuantity || 0);
    if (productQty < 0 || engravingQty < 0) {
      throw new InvalidRefundSelectionError('Refund quantities cannot be negative', { orderItemId: item.orderItemId });
    }

    if (productQty > 0) {
      if (productQty > item.productRefundableQty) {
        throw new InvalidRefundSelectionError(
          `Only ${item.productRefundableQty} unit(s) of ${item.productName} are refundable`,
          { orderItemId: item.orderItemId, requested: productQty, available: item.productRefundableQty },
        );
      }
      const amountCents = toCents(item.unitPrice) * productQty;
      const gstCents = toCents(await gstPortion(fromCents(amountCents)));
      lines.push({
        orderItemId: item.orderItemId,
        productName: item.productName,
        kind: 'product',
        quantity: productQty,
        unitInclusive: item.unitPrice,
        refundedAmount: fromCents(amountCents),
        gstPortion: fromCents(gstCents),
      });
      refundedCents += amountCents;
      refundedGstCents += gstCents;
    }

    if (engravingQty > 0) {
      if (item.customizationTotal <= 0) {
        throw new InvalidRefundSelectionError(`${item.productName} has no engraving charge to refund`, {
          orderItemId: item.orderItemId,
        });
      }
      if (engravingQty > item.engravingRefundableUnits) {
        if (item.taggedUnits > 0) {
          throw new InvalidRefundSelectionError(
            `Engraving for ${item.productName} is non-refundable for ${item.taggedUnits} unit(s) — the PawTag ID has already been generated`,
            { orderItemId: item.orderItemId, requested: engravingQty, available: item.engravingRefundableUnits },
          );
        }
        throw new InvalidRefundSelectionError(
          `Only ${item.engravingRefundableUnits} engraving unit(s) of ${item.productName} are refundable`,
          { orderItemId: item.orderItemId, requested: engravingQty, available: item.engravingRefundableUnits },
        );
      }
      const amountCents = toCents(item.customizationTotal) * engravingQty;
      const gstCents = toCents(await gstPortion(fromCents(amountCents)));
      lines.push({
        orderItemId: item.orderItemId,
        productName: item.productName,
        kind: 'engraving',
        quantity: engravingQty,
        unitInclusive: item.customizationTotal,
        refundedAmount: fromCents(amountCents),
        gstPortion: fromCents(gstCents),
      });
      refundedCents += amountCents;
      refundedGstCents += gstCents;
    }
  }

  const retained = await buildRetainedCharges(order, items);

  const breakdown: RefundBreakdownSnapshot = {
    lines,
    totals: {
      refunded: fromCents(refundedCents),
      refundedGst: fromCents(refundedGstCents),
    },
    retained,
  };

  logger.debug(
    { orderId: String(order._id), orderNumber: order.orderNumber, refunded: breakdown.totals.refunded },
    'Refund breakdown built',
  );

  return { breakdown, refundAmount: breakdown.totals.refunded };
}

/** Retained charges snapshot (permanent retentions + remaining CPF). */
async function buildRetainedCharges(order: any, items: ItemRefundability[]): Promise<RefundRetainedCharges> {
  const engravingCents = items.reduce((sum, i) => sum + toCents(i.engravingRetained), 0);
  const cpf = cpfForOrder(order);
  const cpfRemainingCents = toCents(cpfRetained(order));
  return {
    engraving: fromCents(engravingCents),
    engravingGst: await gstPortion(fromCents(engravingCents)),
    cpf: fromCents(cpfRemainingCents),
    cpfGst: cpf ? roundToCents((cpf.gst || 0) * (cpfRemainingCents / Math.max(1, toCents(cpf.amount)))) : 0,
  };
}

/**
 * Enforce the master cap on a requested refund amount (cents).
 * Throws RefundExceedsCapError with a truthful customer-safe message.
 */
export async function assertWithinRefundableCap(order: any, requestedCents: number, priorRefundedCents?: number): Promise<number> {
  const cap = await maxRefundableCents(order, priorRefundedCents);
  if (requestedCents > cap) {
    throw new RefundExceedsCapError(
      `Refund of $${fromCents(requestedCents).toFixed(2)} exceeds the refundable amount of $${fromCents(cap).toFixed(2)}`,
      { orderId: String(order._id), requested: fromCents(requestedCents), cap: fromCents(cap) },
    );
  }
  return cap;
}

/**
 * Allocate a plain amount (amount-only legacy path, D16) across the
 * order's eligible lines proportionally — so even amount-based refunds
 * produce a truthful breakdown for records/documents/dashboard.
 * Pass `scopeOrderItemIds` to restrict allocation to specific items
 * (e.g. the items of one return).
 */
export async function allocateAmountToBreakdown(
  order: any,
  amount: number,
  scopeOrderItemIds?: string[],
): Promise<RefundBreakdownSnapshot> {
  const items = await lineRefundability(order);
  const scope = scopeOrderItemIds ? new Set(scopeOrderItemIds.map(String)) : null;
  const eligible: Array<{ item: ItemRefundability; kind: 'product' | 'engraving'; unitCents: number; qty: number }> = [];
  for (const item of items) {
    if (scope && !scope.has(item.orderItemId)) continue;
    if (item.productRefundableQty > 0 && item.unitPrice > 0) {
      eligible.push({ item, kind: 'product', unitCents: toCents(item.unitPrice), qty: item.productRefundableQty });
    }
    if (item.engravingRefundableUnits > 0 && item.customizationTotal > 0) {
      eligible.push({ item, kind: 'engraving', unitCents: toCents(item.customizationTotal), qty: item.engravingRefundableUnits });
    }
  }
  const totalWeightCents = eligible.reduce((sum, e) => sum + e.unitCents * e.qty, 0);
  if (totalWeightCents <= 0) {
    return {
      lines: [],
      totals: { refunded: 0, refundedGst: 0 },
      retained: await buildRetainedCharges(order, items),
    };
  }

  const targetCents = Math.min(toCents(amount), totalWeightCents);
  const allocated = allocateCentsDistributed(targetCents, eligible.map((e) => e.unitCents * e.qty));

  const lines: RefundBreakdownLine[] = [];
  let refundedCents = 0;
  let refundedGstCents = 0;
  for (let i = 0; i < eligible.length; i++) {
    const shareCents = allocated[i];
    if (shareCents <= 0) continue;
    const e = eligible[i];
    // Amount-only refunds may cover a fraction of a unit (goodwill
    // adjustments). The allocated share is the authority; quantity is the
    // number of units the share reaches into (partial unit included).
    const qty = Math.min(e.qty, Math.ceil(shareCents / Math.max(1, e.unitCents)));
    const gstCents = toCents(await gstPortion(fromCents(shareCents)));
    lines.push({
      orderItemId: e.item.orderItemId,
      productName: e.item.productName,
      kind: e.kind,
      quantity: qty,
      unitInclusive: fromCents(e.unitCents),
      refundedAmount: fromCents(shareCents),
      gstPortion: fromCents(gstCents),
    });
    refundedCents += shareCents;
    refundedGstCents += gstCents;
  }

  return {
    lines,
    totals: { refunded: fromCents(refundedCents), refundedGst: fromCents(refundedGstCents) },
    retained: await buildRetainedCharges(order, items),
  };
}

/**
 * Estimate a return's refund scope: product value + engraving for
 * UNITS WHOSE PAWTAG ID WAS NOT GENERATED. Tagged units' engraving is
 * retained (hard cap). Used by the customer return request, the CSR
 * default refund amount, and the balance display — one source of truth.
 */
export async function estimateReturnRefund(
  order: any,
  returnItems: Array<{ orderItemId?: any; productId?: any; quantity?: number }>,
): Promise<{ grossCents: number; retainedEngravingCents: number; netCents: number; lines: Array<{ orderItemId: string; productCents: number; engravingCents: number }> }> {
  const orderItems = await lineRefundability(order);
  const lines: Array<{ orderItemId: string; productCents: number; engravingCents: number }> = [];
  let grossCents = 0;
  let retainedEngravingCents = 0;

  for (const ri of returnItems || []) {
    const qty = Number(ri.quantity || 0);
    if (qty <= 0) continue;
    const oi = orderItems.find(
      (i) => String(i.orderItemId) === String(ri.orderItemId) || String(i.orderItemId) === String(ri.productId),
    );
    if (!oi) continue;

    const productCents = toCents(oi.unitPrice) * qty;
    const engravingEligibleQty = Math.min(qty, oi.engravingRefundableUnits);
    const engravingRetainedQty = qty - engravingEligibleQty;
    const engravingCents = toCents(oi.customizationTotal) * engravingEligibleQty;
    const engravingRetained = toCents(oi.customizationTotal) * engravingRetainedQty;

    lines.push({ orderItemId: oi.orderItemId, productCents, engravingCents });
    grossCents += productCents + engravingCents + engravingRetained;
    retainedEngravingCents += engravingRetained;
  }

  return {
    grossCents,
    retainedEngravingCents,
    netCents: grossCents - retainedEngravingCents,
    lines,
  };
}

/** Largest-remainder allocation of a cents budget across weights. */
function allocateCentsDistributed(totalCents: number, weights: number[]): number[] {
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (weightSum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (totalCents * w) / weightSum);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = totalCents - floors.reduce((s, f) => s + f, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] += 1;
    remainder -= 1;
  }
  return result;
}
