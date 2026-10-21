# Skill: commerce-finance-rules

**Single source of truth** for what is refundable on an order and how the
Card Processing Fee (CPF) works. `AGENTS.md` remains authoritative.
Plan of record: `docs/COMMERCE-FINANCE-PLAN-GST-CPF.md` (founder decisions D1–D17).

## Never re-implement these rules

All money paths MUST go through the two services below. Do not re-derive
refundability, GST portions, or CPF handling anywhere else.

| Service | Owns |
|---|---|
| `packages/api/src/commerce/services/refund-eligibility.service.ts` | `lineRefundability`, `getTaggedUnits`, `gstPortion`, `buildBreakdown`, `buildFullSelection`, `allocateAmountToBreakdown`, `estimateReturnRefund`, `maxRefundableCents` |
| `packages/api/src/commerce/services/cpf.service.ts` | `computeCpf`, `cpfForOrder`/`cpfRetained`, `isCpfCardNetwork`, `processCpfExceptionRefund`, `refundCpfForMerchantFault` |

## The master cap (every refund/cancellation path)

```
maxRefundable = captured − retained CPF − retained engraving − Σ prior refunds
```

- **Engraving surcharge** is refundable ONLY for units whose PawTag ID has
  NOT been generated (`Fulfilment.tagAssignments` per `orderItemId` is the
  durable signal; `Order.items[].tagId` is NOT reliable). Tagged units'
  engraving is permanently retained — hard cap, no override.
- **CPF** is retained on all refunds EXCEPT two audited exception paths:
  merchant-fault cancellations (`cpf.refundOnMerchantFault` config) and
  unsupported captured card networks (auto-refunded post-capture).
- Cancellation with an unverifiable eligibility computation must **fail
  closed** (REFUND_FAILED under `requireRefundSuccess`), never refund past
  the cap silently.

## Breakdown snapshot (durable truth)

Every money-moving refund writes a `RefundBreakdownSnapshot` onto the
`PaymentTransaction.breakdown` AT MONEY-MOVE TIME. It records refunded
lines (product/engraving, amounts, per-line GST) + retained charges.
Nothing may re-derive eligibility later — returned tags detach, which
would flip the answer. Credit notes, admin UI, and the finance dashboard
all read this snapshot.

## CPF rules (config-driven — never hardcode)

- Settings: `commerce.cpf.enabled` (ships **OFF**), `.percent`, `.fixed`,
  `.appliesTo` (default `visa,mastercard,amex` — Amex added Oct 2026,
  founder decision: Stripe's domestic Amex rate equals Visa/MC),
  `.refundOnMerchantFault`, `.scheduleVersion`. Rates are GST-INCLUSIVE;
  GST portion extracted via the tax provider, never hardcoded.
- The post-capture brand check (record network, auto-refund fee for brands
  outside `.appliesTo`) is step 7c of `runPostPaymentCompletion` in
  `checkout.service.ts` — it runs on confirm AND on repair-job resumes, and
  backfills the brand from Stripe before deciding. Never move it back to a
  one-shot block after order creation.
- Fee is computed on the order payable (before the fee) at intent
  creation, folded into `pending.total` — the existing
  `intent amount == pending.total` invariant carries it; retries and
  webhooks can never double-charge it. Zero-total orders never pay it.
- Each order snapshots the schedule (`Order.payment.cpf`) — later config
  changes never rewrite history. Absent field = historical order, treat 0.

## Customer vs admin surfaces (D1)

- **Customer**: totals only — accurate amounts, "Card payment fee
  (incl. GST)" row on checkout/invoice, one FAQ entry. NEVER itemize
  retained charges in customer emails/notifications/credit notes.
- **Admin/CSR**: full transparency — `RefundLinePicker`, breakdown tables,
  Finance Dashboard (`finance.view` permission), admin-channel credit
  notes may list retained charges.

## Testing

- `tests/unit/commerce-finance-phase1.test.ts` — CPF math/GST, tagging,
  caps, breakdowns, allocation
- `tests/unit/commerce-finance-cancellation.test.ts` — cancellation
  wiring, merchant fault, fail-closed
- `tests/unit/return-refund-service.test.ts` — return path enforcement
Add cases here when touching refund amounts, GST portions, or CPF.
