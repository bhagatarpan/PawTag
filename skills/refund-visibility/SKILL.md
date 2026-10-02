---
name: refund-visibility
description: Implement or review PawTag refund destination visibility and refund data accuracy. Use when changing customer/admin refund display, Stripe refund mapping (ARN/arrival), PaymentTransaction refund snapshots, refund emails, or CSR refund surfaces. Enforces original-payment-method destination truthfulness and durable refund audit data.
---

# Refund Visibility

Refund destination is **always the original payment method** used for the charge (Stripe default). PawTag does not offer refund-to-new-card selection in the normal cancel/refund flow.

`AGENTS.md` and `commerce-safety` remain authoritative for financial safety.

## Core rules

1. **Never invent a destination.** If `payment.cardBrand`/`cardLast4` are missing, show "Original payment method", not a fabricated card.
2. **Always label destination as original payment method.** Example: `Visa ••••1234 (original payment method)`.
3. **Explain replacement cards honestly.** If the card expired/was lost, the bank usually posts the refund to the replacement card/account. Do not claim money is lost.
4. **Persist provider truth.** When Stripe provides `arn` and `arrival_date`, store them on Order and PaymentTransaction.
5. **Snapshot destination on refund records.** Write `cardBrand`, `cardLast4`, and `refundDestination` on refund PaymentTransactions at refund time.
6. **Do not hardcode `arn: undefined` in emails.** Pass real ARN when present.
7. **Failed refunds need a recovery path.** Customer copy must say support will arrange an alternate method (e.g. bank transfer). Automated alternate payouts are out of scope unless explicitly built.

## Where the data lives

| Data | Source | Stored |
|---|---|---|
| Original card brand/last4 | Checkout payment record | `order.payment.cardBrand`, `order.payment.cardLast4` |
| Refund id/status | Stripe refund | `order.refundId`, `order.refundStatus`, PaymentTransaction |
| ARN | Stripe refund `arn` | `order.refundArn`, PaymentTransaction `arn` |
| Expected arrival | Stripe refund `arrival_date` | `order.refundExpectedArrival`, PaymentTransaction `expectedArrival` |
| Destination snapshot | Derived at refund time | PaymentTransaction `refundDestination` |

## Shared formatters

Use `@pawtag/shared` (also re-exported from `@pawtag/ui`):

- `formatCardDisplay(brand, last4)`
- `formatRefundDestination(brand, last4)`
- `formatRefundDestinationShort(brand, last4)`
- `formatRefundDestinationSentence(brand, last4)`

Do not re-implement local destination string helpers in apps.

## Customer surfaces to update when refund behavior changes

- Cancel modal footnote + success message (`apps/web/.../OrderDetail.tsx`)
- Order detail refund card (`packages/ui/.../OrderDetailView.tsx`)
- Orders list destination label
- Refund processing/settled/failed emails

## Admin/CSR surfaces

- Admin refunds API list item must include destination + timing fields
- `OrderRefunds` expanded details + `RefundStatusCard`
- Admin Orders refund section

## Monitoring

Refund cancellation writes:
- operational logs via `logger`
- durable audit events (`order_cancelled`) with refundId/destination metadata
- order activity entries

Webhook refund updates write order fields + activity with ARN when present.

## Tests expected

- Formatter unit tests
- Stripe `mapRefund` extracts ARN/arrival
- Customer cancel stores destination snapshot + initiatedBy=`customer`
- Webhook persists ARN/arrival
- Ownership/auth unchanged (cancel still owner-only)

## Out of scope unless explicitly requested

- Refund to a different card chosen by customer
- Automatic bank payouts
- Manual CSR alternate-refund workflow (separate packet)
