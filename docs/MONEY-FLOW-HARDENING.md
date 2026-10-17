# Money-Flow Hardening — Checkout Durability, Refunds, Emails

**Status:** Complete (2026-10-17)
**Branch:** work completed on `feature/money-flow-hardening`
**Origin:** Pre-launch audit of the full payment → fulfilment → refund lifecycle (~40 findings); founder approved fixing all batches with tests.

---

## Root cause of WO-000505 (the headline bug)

The monetary-precision refactor (`1731f92`) accidentally dropped the **required** `provider` (and `currency`) fields from the checkout's PaymentTransaction write. Every `confirmCheckout` since then threw at step 7b — after the Order was created as `paid` but before the completion pipeline ran. The idempotency branch then returned the half-done order on retry **without resuming completion**, and the expiry job/webhooks had no path to repair it. Result: money taken, order exists, no invoice/emails/entitlements/fulfilment — permanently.

## What changed

### 1. Checkout durability (`commerce/services/checkout.service.ts`, `jobs/orderCompletionRepair.ts`)
- Post-payment pipeline extracted into a **re-runnable** `runPostPaymentCompletion()`; both fresh confirms and resumes use it
- **Order-exists check now runs BEFORE the expiry check** — a paid checkout stays recoverable after the PendingOrder TTL
- Both idempotency branches (converted-pending + order-exists) **resume interrupted completion** instead of returning half-done orders
- Step-level idempotency: inventory (StockMovement per-order guard), Guardian Points (purchase-ledger guard), invoice (reuse-by-orderId), fulfilment (exists guard), activity (conditional push), PaymentTransaction (unique-index dedupe); the previously-unguarded activity/transaction writes can no longer abort the pipeline
- **New repair job** `order-completion-repair` (5 min, seeded) resumes paid orders stuck at `completionStatus: 'pending'` older than 10 min — third safety net after webhook/customer retries
- **Expiry job never expires a checkout whose Stripe payment succeeded** (checks first; Stripe outage = skip, fail-safe) and the job is now seeded (`pending-order-expiry` was registered but never scheduled)
- Cart conversion is scoped to `PendingOrder.cartId` — delayed completions never wipe a newer cart
- PaymentIntent **amount/currency validated** against the pending total before recording money
- `createPendingOrder` stores `cartId` (additive field on PendingOrder)

### 2. Invoice numbering — one atomic counter
- `lib/invoice-number.ts` rewritten to the atomic `counters` collection; webhook paths that used racy `countDocuments() + 1` now use it; membership factory is the only INVM producer

### 3. Admin money surfaces (`routes/admin.ts`)
- Admin cancel **delegates to the shared `cancelOrder` engine** — the old inline copy recorded a phantom "refund" transaction on Stripe failure (with the PaymentIntent id as the refund id) and could mark orders cancelled with no money returned; it also never deducted points or scheduled retries
- Generic status endpoint **rejects `cancelled`/`refunded` targets** — money movement requires the dedicated endpoints
- Admin refund transactions now snapshot the refund destination (card brand/last4) per the refund-visibility rule

### 4. Credit notes on every live refund path (`commerce/services/credit-note.service.ts`)
- New shared creator (deduped per refund, linked to the original invoice, atomic CN- counter); wired into return refunds, admin refunds, cancellation refunds, and refund retries. Previously the only credit-note code lived in dead service — **no refund ever produced a credit note**

### 5. Proportional Guardian Points clawback (`services/loyalty/points-earning.service.ts`)
- **Founder decision:** claw back what was *earned*, not a flat 1pt/$1. New `refundClawbackForOrder()`: `originalPurchasePoints × refundShare`, capped so cumulative partial refunds never exceed the original award
- Wired into **every** money-moving path: cancellation, return refund, admin refund, refund retry (previously only customer self-cancellation deducted, with the flat rule)
- Refund retry also gained a remaining-balance guard (never re-refunds past the charge), records its PaymentTransaction, and creates its credit note

### 6. Reconciliation
- `mapRefund` now carries `paymentIntentId` — the daily refund sync was matching on a field that never existed and synced **zero** refunds

### 7. Zero-total end-to-end
- Checkout frontend bypasses Stripe.js for `isZeroTotal` quotes (Complete Order button → direct confirm); orphan/reconciliation jobs skip synthetic `pi_zero_`/demo ids via the new `isSyntheticPaymentIntentId()` helper; orphan job completes zero-total pendings directly; **cancellation of $0 orders succeeds** (no more Stripe call against a nonexistent intent)

### 8. Membership emails & notifications (`services/membership.service.ts`, `stripe-webhooks.ts`, `db/models/Notification.ts`)
- Activation invoice emails **never sent** (raw `token` field vs required `tokenHash`) — fixed, pre-verified, and links now point at the working `/invoice/:token` viewer (the old `/account/invoices/<number>?token=` links dead-ended)
- Renewal confirmation uses a new past-tense confirmation template (the reminder template said "will renew" *after* renewal)
- Added all membership lifecycle notification types + `membership_payment_failed` + `subscription_payment_failed` to the Notification enum — **every membership in-app notification was silently dropped by enum validation**
- Dunning emails (customer + CSR alert) are CMS-first with seeded templates (`membership-payment-failed`, `membership-payment-failed-admin`)

### 9. Email/notification polish
- Web checkouts now create the customer **in-app "Order Confirmed" notification + push** (previously only the legacy admin path did); deduped by order so resumes never double-notify
- **One customer email per refund:** webhook refund emails (processing/settled) are suppressed when a refund email already went out for the order within 30 min — refunds no longer stack up to 3 emails
- Customer notification API filters `audience: 'customer'` — CSR-internal admin alerts no longer leak into the customer portal
- Donor payment failures now notify the donor (CMS-first `donation-payment-failed`, seeded) — previously silent
- Order-confirmation CMS templates gain an `items` variable; customer invoice links lose the misleading `?admin=1`; orphan per-checkout access tokens removed; tag-subscription dunning notifications use the correct type

## Verification (2026-10-17)

| Check | Result |
|---|---|
| Typecheck api/shared/db/web/admin | **PASS** |
| Builds web/admin/api | **PASS** |
| Lint (all packages) | **0 errors** |
| `order-completion-repair` (new: resume/idempotency/job/confirm-resume) | **5/5 PASS** |
| `refund-clawback` (new: proportional math, partial-refund caps) | **4/4 PASS** |
| Money suites: cart-correctness, checkout-completion-status, checkout-ownership, order-cancel-refund, refund-correctness, refund-webhook-arn | **49/49 PASS** |
| Loyalty points-earning suite | **71/71 PASS** (display-only order-number lookup made defensive) |
| Full unit suite | **1074/1074 PASS** |

## Deferred (documented, not fixed)

- Frontend checkout recovery effect reads the *latest* PendingOrder rather than matching the stored PaymentIntent id (works for the common case; resume-on-reconfirm now heals the rest)
- Stripe metadata order number at intent time differs from the confirm-time number (cosmetic dashboard confusion)
- `GET /api/checkout/pending` returns the raw PendingOrder (owner-only; DTO would be tighter)
- Refund-balance race across concurrent partial refunds is bounded by Stripe's remaining-charge limit, not locally locked
- Email HTML variable interpolation is unescaped in the CMS email layer (separate hardening item)
- No resend UI for failed transactional emails (EmailAudit records them; separate feature)
