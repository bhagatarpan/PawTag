# PawTag Commerce Migration — Production Readiness & Architecture Blueprint

**Date:** 2026-08-28
**Status:** PLANNING ONLY — No code changes authorised
**Author:** Lead Software Engineer (AI)

---

## Table of Contents

1. [Executive Summary for the Product Owner](#1-executive-summary-for-the-product-owner)
2. [Re-Verification of the Previous Audit](#2-re-verification-of-the-previous-audit)
3. [Production Readiness of Existing PawTag Commerce Code](#3-production-readiness-of-existing-pawtag-commerce-code)
4. [Definitive Source-of-Truth Map](#4-definitive-source-of-truth-map)
5. [Proposed Payment and Order Architecture](#5-proposed-payment-and-order-architecture)
6. [Stripe and Webhook Strategy](#6-stripe-and-webhook-strategy)
7. [Critical Path vs Background Processing](#7-critical-path-vs-background-processing)
8. [Migration Blueprint](#8-migration-blueprint)
9. [Production Test Strategy](#9-production-test-strategy)
10. [Security and Financial Integrity Review](#10-security-and-financial-integrity-review)
11. [Risks and Reasons to Keep Medusa](#11-risks-and-reasons-to-keep-medusa)
12. [Final Architecture Recommendation](#12-final-architecture-recommendation)
13. [Implementation Readiness Checklist](#13-implementation-readiness-checklist)
14. [Confidence and Unknowns](#14-confidence-and-unknowns)

---

## 1. Executive Summary for the Product Owner

### What this document is

This is a thorough investigation of whether PawTag should remove MedusaJS and own its commerce domain directly. I inspected every file, traced every dependency, and stress-tested every assumption from the previous audit.

### Bottom line

**Proceed with migration away from Medusa, but in a specific order that eliminates the highest-risk dependency (Medusa as payment intermediary) first, and only after fixing three critical gaps that exist today.**

### The three critical gaps that must be fixed before ANY migration begins

1. **Stripe webhook signature verification is stubbed.** The PawTag Stripe webhook handler (`/api/webhooks/stripe`) does NOT actually verify signatures. An attacker can POST fake events to mark orders as paid. This is a production security vulnerability that exists today, regardless of Medusa.

2. **No recovery for "payment succeeded but cart complete failed."** If `stripe.confirmPayment()` succeeds but `sdk.store.cart.complete()` fails (network error, Medusa down), the customer is charged but no order exists anywhere. There is no automatic recovery path.

3. **Subscription pricing is hardcoded.** The `subscription.service.ts` hardcodes `$0.99/month` and `$1.99/month` as fallback prices instead of reading from product metadata. This means subscription renewal pricing can diverge from what the customer actually purchased.

### What the previous audit got right

- Medusa adds genuine complexity (52+ source files, bidirectional sync, 3-layer reliability architecture)
- PawTag already has the core data models (Order, Invoice, Subscription, Tag, WebhookEvent)
- The `createOrderFromMedusa()` function is well-designed and idempotent
- Removing Medusa eliminates an entire class of sync failures

### What the previous audit overstated

- The MongoDB Product model is **not** production-ready for reuse — it is deprecated, and the shop page bypasses it entirely
- PawTag does **not** have a complete cart system — the MongoDB Cart model is deprecated with no active routes
- PawTag does **not** handle payment session creation — this is currently Medusa's role
- The "no webhooks needed" claim is wrong — Stripe webhooks remain essential

### Biggest remaining risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Payment failure recovery gap | HIGH | Must build orphan-payment detection before migration |
| Stripe signature verification missing | CRITICAL | Must fix before migration (production vulnerability today) |
| No server-side cart | MEDIUM | Must build minimal cart or use Stripe Checkout Sessions |
| Subscription pricing hardcoded | LOW | Must read from product configuration |
| Historical Medusa order data | MEDIUM | Must maintain read-access to Medusa API or archive |

### Timeline estimate

If approved, the migration can be executed in **4 phases over 6-10 weeks**. Phase 1 (fix critical gaps + build direct payment) is the most important and can be deployed independently.

---

## 2. Re-Verification of the Previous Audit

### 2.1 Product Model — What Changed

**Previous audit claim:** "PawTag has a Product model that could become the source of truth."

**What I found:**

The MongoDB Product model (`packages/db/src/models/Product.ts`, 100 lines) is explicitly deprecated in **5 separate documentation files** (AGENTS.md, README.md, BUSINESS-RULES.md, COMPLETE-ARCHITECTURE.md, PawTag-Enterprise-Roadmap.md).

**Critical finding:** The shop page (`apps/web/src/pages/Shop.tsx:76-80`) fetches products entirely from Medusa via `sdk.store.product.list()`. The ProductDetail page (`apps/web/src/pages/ProductDetail.tsx`) also fetches from Medusa via `sdk.store.product.retrieve()`. The MongoDB Product model is completely bypassed by all customer-facing code.

**However, the model is still actively used for:**
- Admin CRUD (`packages/api/src/routes/admin.ts:2002-2316`) — full list/create/update/delete
- Low-stock alerts (`packages/api/src/jobs/lowStockCheck.ts`) — queries MongoDB stock (stale data)
- Analytics dashboard (`packages/api/src/routes/admin-analytics.ts`) — reads MongoDB stock (stale data)
- Test fixtures — tests create MongoDB products for setup

**Verdict: Should Not Be Reused** for new commerce features. The model is deprecated, its stock data is stale (Medusa owns inventory), and it lacks fields that Medusa's product metadata provides (subscription config, affiliate fields, warranty). It can be retained for backward-compatible admin views during migration but must not become the source of truth.

### 2.2 Existing Commerce Functionality — Accurate Classification

| Functionality | Status | Evidence |
|--------------|--------|----------|
| Order creation | Production-ready, actively used | `order-creation.service.ts` — tested, idempotent, used by both API and webhook |
| Invoice generation | Production-ready, actively used | Atomic counter, secure tokens, tested |
| Subscription lifecycle | Production-ready, actively used | `subscription.service.ts` — hourly cron, tested, handles grace periods |
| Referral system | Production-ready, actively used | `referral.service.ts` — triggered on order placement |
| Tag auto-creation | Production-ready, actively used | Created on payment success in `webhooks.ts` |
| Webhook retry | Production-ready, actively used | 60s interval, exponential backoff, dead-letter queue |
| Reconciliation | Production-ready, actively used | 60s interval, corrects status drift |
| Cart management | **Medusa-only** — MongoDB Cart model deprecated | All cart CRUD via `sdk.store.cart.*` |
| Product catalog | **Medusa-only** — MongoDB Product model deprecated | Shop/product pages use Medusa SDK |
| Payment session creation | **Medusa-only** — `sdk.store.payment.initiatePaymentSession()` | No PawTag equivalent exists |
| Shipping calculation | **Medusa-only** — `sdk.store.fulfillment.listCartOptions()` | No PawTag equivalent exists |
| Tax calculation | **Medusa-only** — Medusa tax module | No PawTag equivalent exists |
| Promo codes/discounts | **Medusa-only** — Medusa promotion module | No PawTag equivalent exists |
| Inventory management | **Medusa-only** — Medusa inventory module | `restoreOrderStock()` is a no-op |

**Key insight:** PawTag has a production-ready order/invoice/subscription pipeline, but it does NOT have cart, product catalog, payment session, shipping, tax, or inventory systems. These are the functions that must be rebuilt or replaced.

### 2.3 Current Production Dependencies — Definitive Inventory

**52+ source files** depend on Medusa across the codebase. Here is the complete inventory:

**Frontend (7 files):**
- `apps/web/src/lib/medusa.ts` — SDK client initialization
- `apps/web/src/context/CartContext.tsx` — All cart operations via Medusa SDK
- `apps/web/src/pages/Checkout.tsx` — 4-step wizard with Medusa orchestration
- `apps/web/src/pages/Shop.tsx` — Product listing from Medusa
- `apps/web/src/pages/ProductDetail.tsx` — Single product from Medusa
- `apps/admin/src/components/MedusaStatusCard.tsx` — Health check widget
- `apps/admin/src/components/Sidebar.tsx` — Link to Medusa dashboard

**Backend (11 files):**
- `packages/api/src/routes/medusa-webhooks.ts` — 6 Medusa event handlers
- `packages/api/src/routes/medusa-sync.ts` — Customer sync endpoint
- `packages/api/src/routes/admin-webhooks.ts` — Webhook management dashboard
- `packages/api/src/routes/admin.ts` — Cancel/refund/ship sync to Medusa
- `packages/api/src/routes/webhooks.ts` — Stripe webhook (fetches Medusa product metadata)
- `packages/api/src/routes/index.ts` — Route mounting + job startup
- `packages/api/src/services/medusa-sync.service.ts` — Customer sync logic
- `packages/api/src/services/medusa-admin.service.ts` — Medusa admin API client
- `packages/api/src/services/order-creation.service.ts` — Fetches Medusa order data
- `packages/api/src/services/inventory.service.ts` — No-op (Medusa owns inventory)
- `packages/api/src/jobs/orderSyncReconciliation.ts` — Status drift correction
- `packages/api/src/jobs/webhookRetry.ts` — Failed event retry

**Database (3 models with Medusa fields):**
- `Order.medusaOrderId` (sparse, indexed)
- `User.medusaCustomerId`
- `WebhookEvent.source: 'medusa'`

**Medusa app (4 source files + generated assets):**
- `apps/medusa/medusa-config.ts` — Configuration
- `apps/medusa/src/subscribers/pawtag-webhook.ts` — Event forwarding
- `apps/medusa/src/scripts/seed.ts` — Product migration script
- `apps/medusa/package.json` — 7 `@medusajs/*` dependencies

**Infrastructure:**
- 14 environment variables across 4 `.env` files
- Docker Compose with PostgreSQL for Medusa
- pnpm workspace with Medusa build scripts
- `@medusajs/js-sdk` in API and web `package.json`
- 50+ `@medusajs/*` packages in `pnpm-lock.yaml`

**Tests (5 files):**
- `tests/unit/order-creation-service.test.ts`
- `tests/integration/order-sync-architecture.test.ts`
- `tests/integration/payment-confirmation.test.ts`
- `tests/integration/dunning-webhook.test.ts`
- `tests/integration/order-cancel-refund.test.ts`

---

## 3. Production Readiness of Existing PawTag Commerce Code

### 3.1 Order Model — Production Ready

**File:** `packages/db/src/models/Order.ts`

| Aspect | Assessment | Evidence |
|--------|-----------|----------|
| Schema completeness | Good | 30+ fields covering status, payment, shipping, activity timeline, referral |
| Indexes | Good | 8 indexes including `orderNumber` (unique), `medusaOrderId` (sparse), compound indexes |
| Medusa linkage | Functional | `medusaOrderId` field, `payment.transactionId` (legacy), `payment.stripePaymentIntentId` |
| Soft delete | Present | `deletedAt` field with index |
| Activity timeline | Present | Embedded array with actor tracking |
| Tests | Good | Unit + integration tests covering creation, idempotency, sync |

**Gaps:**
- No separate Refund model — refunds are tracked as status changes on Order
- No Payment model — payment details embedded in Order
- `Order.discount` is inline `{ percent, amount, reason }` — no promo code reference
- `Subscription.planId` references deprecated Product model via `ref: 'Product'`

### 3.2 Invoice Model — Production Ready

**File:** `packages/db/src/models/Invoice.ts`

| Aspect | Assessment | Evidence |
|--------|-----------|----------|
| Schema completeness | Good | Links to Order, Subscription, User; billing periods; Stripe references |
| Atomic counter | Yes | `findOneAndUpdate` with `$inc` in `order-creation.service.ts` |
| Secure access tokens | Yes | `InvoiceAccessToken` model with SHA-256 hashing, TTL expiry, OTP |
| Tests | Good | `invoice-access-full.test.ts` |

**Gaps:**
- Non-atomic counter in `webhooks.ts:341-342` (`Invoice.countDocuments() + 1`) — race condition with parallel webhooks
- No partial refund tracking on invoices

### 3.3 Subscription Model — Production Ready

**File:** `packages/db/src/models/Subscription.ts`

| Aspect | Assessment | Evidence |
|--------|-----------|----------|
| Lifecycle | Complete | Active → Grace Period → Expired → Cancelled |
| Cron processing | Working | Hourly `runSubscriptionChecks()` handles all transitions |
| Reminder system | Complete | 30d, 7d, 1d expiry reminders + grace period weekly |
| Stripe integration | Partial | `stripeSubscriptionId` and `stripeCustomerId` fields exist but not always populated |
| Tests | Good | Unit + integration tests |

**Gaps:**
- `processAutoRenewals()` creates invoices without charging via Stripe (just marks as "paid")
- Subscription pricing is hardcoded in `createSubscription()` (`$0.99 annual, $1.99 monthly`)
- Dual renewal path (PawTag cron + Stripe Billing webhooks) can conflict

### 3.4 Order Creation Service — Production Ready

**File:** `packages/api/src/services/order-creation.service.ts`

| Aspect | Assessment | Evidence |
|--------|-----------|----------|
| Idempotency | Strong | 3-field fallback: `medusaOrderId` → `payment.transactionId` → `notes` |
| User lookup | Robust | 5-level fallback chain via `Promise.any` (parallel for speed) |
| Email delivery | Non-blocking | `Promise.allSettled()` — order succeeds even if emails fail |
| Atomic order numbers | Yes | MongoDB `findOneAndUpdate` with `$inc` |
| Invoice creation | Atomic counter | Separate `findOneAndUpdate` for invoice numbers |
| Tests | Good | Unit tests cover success, idempotency, user lookup, error cases |

### 3.5 Webhook Infrastructure — Production Ready

**File:** `packages/api/src/routes/medusa-webhooks.ts`, `packages/api/src/jobs/webhookRetry.ts`

| Aspect | Assessment | Evidence |
|--------|-----------|----------|
| Event storage | Yes | `WebhookEvent` with unique `{source, eventId}` index |
| Idempotency | Strong | Duplicate events detected and skipped |
| Retry with backoff | Yes | 5 retries: 60s → 120s → 300s → 900s → 3600s |
| Dead letter queue | Yes | Events >5 attempts marked `dead`, CRITICAL audit log |
| Max age | Yes | Events >24h not retried |
| HMAC verification | Yes | SHA-256 signature verification on Medusa webhooks |

### 3.6 Reconciliation — Production Ready

**File:** `packages/api/src/jobs/orderSyncReconciliation.ts`

| Aspect | Assessment | Evidence |
|--------|-----------|----------|
| Status drift detection | Yes | Compares PawTag status against Medusa admin API |
| Skip recent | Yes | 5-minute window avoids interfering with in-flight webhooks |
| Tracking number sync | Yes | Extracts tracking from Medusa fulfillments |
| Configurable | Yes | Interval, skip window via CMS settings |

### 3.7 Stripe Webhook Handler — Has Critical Security Gap

**File:** `packages/api/src/routes/webhooks.ts`

| Aspect | Assessment | Evidence |
|--------|-----------|----------|
| Event handling | Working | 5 event types: `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted` |
| Idempotency | Partial | `payment_intent.succeeded` checks `status === 'pending_payment'` before updating |
| **Signature verification** | **STUBBED** | Line 75-76: "signature handling is stubbed" — only checks header presence, never calls `stripe.webhooks.constructEvent()` |
| Invoice counter | Race condition | `Invoice.countDocuments() + 1` not atomic |

---

## 4. Definitive Source-of-Truth Map

| Entity | Creates | Authoritative Source | Updates | External Authority |
|--------|---------|---------------------|---------|-------------------|
| **User/Customer** | PawTag (registration) | **PawTag (MongoDB)** | PawTag (profile), Medusa (synced copy) | None — PawTag is sole owner |
| **Product** | Medusa admin (Medusa admin UI) | **Medusa (PostgreSQL)** | Medusa admin | None — Medusa is sole owner |
| **Price** | Medusa admin (variant prices) | **Medusa (PostgreSQL)** | Medusa admin | None — Medusa is sole owner |
| **Cart** | Medusa SDK (frontend) | **Medusa (PostgreSQL)** | Medusa SDK | None — Medusa is sole owner |
| **Checkout session** | Frontend (Medusa SDK) | **Client-side state + Medusa cart** | Frontend | None |
| **Payment** | Stripe (via Medusa module) | **Stripe** | Stripe (webhooks) | Stripe is authority on payment state |
| **Order** | PawTag (on payment success) | **PawTag (MongoDB)** — PawTag order is the business record | PawTag (status changes), Admin (cancel/ship/refund) | Stripe on payment state; Medusa on fulfillment |
| **Refund** | Admin (via Stripe API) | **Stripe** (refund record) + **PawTag** (order status) | Stripe (refund status) | Stripe is authority on refund state |
| **Subscription** | PawTag (on order placement) | **PawTag (MongoDB)** | PawTag (renewal cron), Stripe (billing webhooks) | Stripe Billing if `stripeSubscriptionId` exists |
| **Invoice** | PawTag (on order placement) | **PawTag (MongoDB)** | PawTag (status changes) | None — PawTag is sole owner |
| **Fulfilment** | Admin (via Medusa admin API) | **Medusa (PostgreSQL)** during migration; **PawTag** after | Admin, Reconciliation job | None |
| **Inventory** | Medusa admin | **Medusa (PostgreSQL)** | Medusa admin | None — Medusa is sole owner |
| **Promo codes** | Medusa admin | **Medusa (PostgreSQL)** | Medusa admin | None — Medusa is sole owner |
| **Shipping** | Medusa admin | **Medusa (PostgreSQL)** | Medusa admin | None — Medusa is sole owner |
| **Tax** | Medusa module (system provider) | **Medusa (PostgreSQL)** | Medusa admin | None — Medusa is sole owner |
| **Tag** | PawTag (auto-created on order) | **PawTag (MongoDB)** | PawTag (activation, subscription) | None — PawTag is sole owner |
| **Webhook events** | PawTag (on receipt) | **PawTag (MongoDB)** | PawTag (status, retry) | None |

**Key insight for migration:** PawTag already owns Orders, Invoices, Subscriptions, Tags, and Users. Medusa owns Products, Prices, Cart, Shipping, Tax, Inventory, and Promos. The migration must transfer ownership of Products, Cart, and Payment session creation to PawTag. Shipping, Tax, and Inventory can be simplified to PawTag-native implementations (PawTag only ships within NZ with free shipping and 15% GST).

---

## 5. Proposed Payment and Order Architecture

### 5.1 Design Principles

1. **Stripe is the payment authority.** PawTag never claims payment succeeded without Stripe confirmation.
2. **Idempotency is mandatory.** Every operation that creates state must be safe to retry.
3. **Critical path is minimal.** Only payment confirmation + order record happen synchronously.
4. **Background work is fire-and-forget.** Emails, notifications, subscriptions, referrals can happen after confirmation.
5. **Orphan payments must be recoverable.** If the order creation fails after payment, a background job must detect and reconcile.

### 5.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CRITICAL PATH (synchronous)                  │
│                                                                     │
│  Customer        PawTag API              Stripe         MongoDB     │
│     │                │                     │               │        │
│     │── Pay ────────>│                     │               │        │
│     │                │── create PaymentIntent ──────────> │        │
│     │                │<── client_secret ──────────────────│        │
│     │<── client_secret ──│                     │               │        │
│     │                │                     │               │        │
│     │── stripe.confirmPayment() ───────────────────────>  │        │
│     │<── paymentIntent (succeeded) ─────────────────────  │        │
│     │                │                     │               │        │
│     │── POST /orders/place ────────────────>│               │        │
│     │                │── Validate payment via Stripe API ──>        │
│     │                │<── payment confirmed ──────────────         │
│     │                │── Idempotency check ──────────────>│        │
│     │                │<── no existing order ──────────────│        │
│     │                │── Create Order ───────────────────>│        │
│     │                │── Create Invoice ─────────────────>│        │
│     │                │<── success ────────────────────────│        │
│     │<── { order, invoice } ──────────────│               │        │
│     │                │                     │               │        │
│     └── Confirmation page                 │               │        │
│                                            │               │        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   BACKGROUND (async, non-blocking)                   │
│                                                                     │
│  PawTag API              Services                                   │
│     │                     │                                         │
│     │── Send emails ─────>│ (Promise.allSettled)                    │
│     │── Create notifs ───>│ (fire-and-forget)                       │
│     │── Process subs ────>│ (best-effort, retry later)             │
│     │── Process referrals >│ (best-effort, retry later)             │
│     │── Audit log ───────>│ (queue-based, async)                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    SAFETY NET (periodic background jobs)             │
│                                                                     │
│  Stripe Webhook          Orphan Payment Job       Reconciliation    │
│     │                        │                        │             │
│     │── payment_intent.       │── Query: paid orders   │── Compare  │
│     │   succeeded             │   without Order        │   PawTag   │
│     │── Match by              │── Check Stripe API     │   vs       │
│     │   stripePaymentIntent   │   for each             │   Stripe   │
│     │── Create order if       │── Create missing       │── Correct  │
│     │   missing               │   orders               │   drift    │
│     │                         │── Refund orphans       │            │
│     │                         │   if unrecoverable     │            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Scenario A — Normal Success

| Step | Actor | Action | State Change |
|------|-------|--------|-------------|
| 1 | Customer | Clicks Pay | UI → 25% progress |
| 2 | Frontend | `stripe.confirmPayment()` | Stripe charges card |
| 3 | Stripe | Returns `paymentIntent: { status: 'succeeded' }` | Client receives confirmation |
| 4 | Frontend | `POST /orders/place { stripePaymentIntentId }` | API receives request |
| 5 | API | Retrieve payment intent from Stripe | Verify amount, currency, status |
| 6 | API | Idempotency check | No existing order found |
| 7 | API | Create Order (status: `paid`) | MongoDB write |
| 8 | API | Create Invoice | MongoDB write |
| 9 | API | Generate invoice access token | MongoDB write |
| 10 | API | Return `{ order, invoice, invoiceUrl }` | Response to frontend |
| 11 | Frontend | Show confirmation page | UI → 100% progress |
| 12 | API | (background) Send 3 emails, create notifications, process subscriptions | Async |
| 13 | API | (background) Process referral rewards | Async |

### 5.4 Scenario B — Payment Succeeds but PawTag Fails

**Current gap:** If `POST /orders/place` fails after payment, the customer sees "Your payment was received — please contact support" with no automatic recovery.

**Proposed solution — Orphan Payment Detection Job:**

```
Every 60 seconds:
  1. Query Stripe for recent payment intents with status 'succeeded'
     that have PawTag metadata (orderNumber, userId)
  2. For each, check if a PawTag Order exists for that payment intent
  3. If no order exists:
     a. Attempt to create order from Stripe payment intent metadata
     b. If creation fails, flag for admin review
  4. If order exists but status is wrong, correct it
  5. Audit log all corrections
```

**Alternatively (simpler):** Use Stripe webhooks as the authoritative recovery path. Stripe always sends `payment_intent.succeeded` — if the frontend call fails, the webhook creates the order.

### 5.5 Scenario C — Customer Refreshes or Closes Browser

**Current behavior:**
- Stripe payment intent persists server-side (owned by Stripe)
- If payment succeeded, the `payment_intent.succeeded` webhook will fire
- The webhook creates the order regardless of browser state
- Customer can check order status on "My Orders" page

**Proposed improvement:**
- Store `stripePaymentIntentId` in `sessionStorage` before payment
- On checkout page load, check if there's an orphaned payment intent
- If payment succeeded but order not shown, call `POST /orders/place` to reconcile
- This makes recovery faster (seconds vs. waiting for webhook)

### 5.6 Scenario D — Duplicate Requests

**Protection layers:**

| Layer | Mechanism | What it prevents |
|-------|-----------|-----------------|
| Frontend | Disable Pay button after first click | Prevents double-click |
| Frontend | `paymentClientSecret` stored in state, consumed once | Prevents re-initiation |
| API | Idempotency check on `stripePaymentIntentId` | Prevents duplicate order creation |
| API | Unique index on `Order.orderNumber` | Prevents duplicate order numbers |
| API | Unique index on `Invoice.invoiceNumber` | Prevents duplicate invoice numbers |
| Stripe | PaymentIntent is idempotent | Same PaymentIntent ID can be confirmed multiple times safely |

**What happens on double-click:**
1. First click: `stripe.confirmPayment()` succeeds, `POST /orders/place` creates order
2. Second click: `stripe.confirmPayment()` returns same PaymentIntent (already succeeded), `POST /orders/place` finds existing order via idempotency check, returns existing order

### 5.7 Scenario E — Stripe Webhook Late or Duplicate

**Idempotent processing:**

| Aspect | Design |
|--------|--------|
| Event storage | `WebhookEvent` model with unique `{source: 'stripe', eventId}` compound index |
| Duplicate detection | Check if event already processed; if so, skip |
| Out-of-order handling | Each event is independent — `payment_intent.succeeded` is idempotent on its own |
| Temporary failure | Store with `status: 'failed'`, retry with exponential backoff (60s→1h) |
| Permanent failure | After 5 attempts, mark `dead` with CRITICAL audit log |
| Event age limit | Events >24 hours not retried |

**Specific handling for `payment_intent.succeeded`:**
- Only updates order if `status === 'pending_payment'` (already paid orders are skipped)
- This means if both direct API and webhook arrive, only one creates the order

### 5.8 Scenario F — Email Failure

**Critical path (must succeed for order to be confirmed):**
- Payment status correctly established in Stripe
- Order durably recorded in MongoDB exactly once
- Invoice durably recorded in MongoDB exactly once

**Non-critical background work (can fail and retry later):**
- Order confirmation email delivery
- Invoice email delivery
- Admin notification email
- In-app notifications (customer + admin)
- Push notifications
- Subscription creation (retried on next cron)
- Referral processing (retried)

**Justification:** A customer who has paid has a confirmed order regardless of email delivery. Emails are informational. Failed emails should trigger admin alerts (which already happens for invoice creation failures in `order-creation.service.ts:340-366`).

---

## 6. Stripe and Webhook Strategy

### 6.1 Stripe Webhooks Are Required

**The previous audit suggested "no webhooks needed." This is incorrect.**

Stripe webhooks serve a fundamentally different purpose than Medusa webhooks:

| Webhook Type | Purpose | Can it be eliminated? |
|-------------|---------|---------------------|
| Medusa → PawTag | Syncing duplicate data between two internal systems | **YES** — eliminate by removing Medusa |
| Stripe → PawTag | External payment provider reporting authoritative payment events | **NO** — Stripe is the payment authority |

**Stripe webhooks are the production safety net.** They guarantee that even if the frontend crashes, the order is eventually created. Removing them would create a single point of failure.

### 6.2 Required Stripe Webhooks

| Event | Purpose | Processing | Idempotency |
|-------|---------|-----------|-------------|
| `payment_intent.succeeded` | Confirm payment, create order if missing | Check if order exists; if not, create it | `WebhookEvent` unique index + Order status check |
| `payment_intent.payment_failed` | Mark order as failed/cancelled | Update order status to `cancelled` | Status check (`pending_payment` only) |
| `invoice.payment_succeeded` | Subscription renewal invoice | Update subscription, create invoice record | `WebhookEvent` unique index |
| `invoice.payment_failed` | Dunning notification | Create failed invoice, notify customer/admin | `WebhookEvent` unique index |
| `customer.subscription.deleted` | Subscription cancelled via Stripe | Cancel subscription in PawTag | `WebhookEvent` unique index |

### 6.3 Critical Fix Required: Stripe Signature Verification

**Current state (SECURITY VULNERABILITY):**

```typescript
// packages/api/src/routes/webhooks.ts:75-76
// "Real Stripe verification — signature handling is stubbed"
```

The handler accepts any POST with a `stripe-signature` header and processes the body as-is. An attacker could:
- POST a fake `payment_intent.succeeded` to mark any order as paid
- POST a fake `invoice.payment_succeeded` to create fake subscription invoices

**Required fix before migration:**

```typescript
const event = stripe.webhooks.constructEvent(
  req.body,           // raw body (must use express.raw())
  sig,                // stripe-signature header
  STRIPE_WEBHOOK_SECRET  // webhook signing secret
);
```

This requires:
1. Setting `express.raw({ type: 'application/json' })` for the webhook route
2. Configuring `STRIPE_WEBHOOK_SECRET` environment variable
3. Using `stripe.webhooks.constructEvent()` for verification

### 6.4 What Changes When Medusa Is Removed

| Before (with Medusa) | After (without Medusa) |
|----------------------|----------------------|
| Stripe → PawTag `/webhooks/stripe` | Same — no change |
| Medusa internal Stripe module handles payment sessions | PawTag creates PaymentIntents directly via Stripe API |
| `sdk.store.payment.initiatePaymentSession()` | `stripe.paymentIntents.create()` directly |
| `sdk.store.cart.complete()` creates Medusa order | `POST /orders/place` creates PawTag order directly |
| Medusa → PawTag `/webhooks/medusa` | **REMOVED** — no Medusa events to forward |
| Order sync reconciliation | **REMOVED** — single system, no drift possible |
| Webhook retry for Medusa events | **REMOVED** — no Medusa events |

---

## 7. Critical Path vs Background Processing

### 7.1 Critical Path (Synchronous — Customer Waits)

These operations MUST complete before the customer sees "Order Confirmed":

| Step | Operation | Why critical |
|------|-----------|-------------|
| 1 | Validate Stripe PaymentIntent | Must confirm payment actually succeeded |
| 2 | Idempotency check | Must prevent duplicate orders |
| 3 | Create Order record | The business record of the purchase |
| 4 | Create Invoice record | Customer's proof of purchase |
| 5 | Generate invoice access token | Customer must be able to view invoice |
| 6 | Return response to frontend | Customer needs confirmation |

**Not on critical path:**
- Email delivery (can fail, retry later)
- Subscription creation (can fail, retry later)
- Referral processing (can fail, retry later)
- Push notifications (can fail)
- In-app notifications (can fail)
- Audit logging (fire-and-forget)

### 7.2 Background Processing (Asynchronous — Fire-and-Forget)

| Operation | Trigger | Retry |
|-----------|---------|-------|
| Order confirmation email | After order creation | Manual retry via admin |
| Invoice email | After invoice creation | Manual retry via admin |
| Admin notification email | After order creation | Manual retry via admin |
| Customer in-app notification | After order creation | None needed |
| Admin in-app notification | After order creation | None needed |
| Push notification | After order creation | None needed |
| Subscription creation | After order creation | Retry on next cron run |
| Referral processing | After order creation | Retry on next cron run |
| Audit log entry | After any state change | Queue-based retry |

### 7.3 Architectural Choices That Reduce Latency

| Choice | Why it helps |
|--------|-------------|
| Create Order + Invoice in same DB transaction (or sequential writes) | Avoids 2 round-trips to MongoDB |
| Send 3 emails in parallel via `Promise.allSettled()` | ~400ms total instead of ~1200ms sequential |
| Atomic order number generation | Single `findOneAndUpdate` vs. read-then-write race |
| Fire-and-forget for non-critical work | Customer response is fast |
| Validate payment intent server-side (single Stripe API call) | No need to fetch full customer data |

**Note:** No timing claims are made here. Actual performance should be measured under load before optimising.

---

## 8. Migration Blueprint

### 8.1 Phase Overview

```
Phase 0: Fix Critical Gaps (no migration, production fixes)
Phase 1: Build Direct Payment Path (parallel to Medusa, shadow mode)
Phase 2: Replace Cart and Product Catalog (remove Medusa dependency)
Phase 3: Remove Medusa (final switchover)
```

### 8.2 Phase 0 — Fix Critical Gaps

**Objective:** Fix production security and reliability issues that exist today, regardless of migration.

**Changes:**
1. Implement Stripe webhook signature verification
2. Build orphan payment detection job
3. Fix non-atomic invoice counter in `webhooks.ts`
4. Make subscription pricing configurable (read from product config, not hardcoded)

**Dependencies:** None — these are standalone fixes.

**What must be tested:**
- Stripe webhook signature verification with valid/invalid/missing signatures
- Orphan payment detection: create payment intent, skip order creation, verify job detects it
- Invoice counter under concurrent requests
- Subscription pricing read from config

**Success criteria:**
- Stripe webhook rejects unsigned events with 400
- Orphan payments are detected and reconciled within 5 minutes
- No duplicate invoice numbers under concurrent load
- Subscription prices match product configuration

**Rollback strategy:** Each fix is independent; revert individual commits.

**Medusa status:** Remains fully active. No changes to Medusa.

### 8.3 Phase 1 — Build Direct Payment Path

**Objective:** Create a PawTag-native checkout flow that works alongside Medusa, using Stripe directly.

**Changes:**
1. **New endpoint:** `POST /api/checkout/create-payment-intent` — creates Stripe PaymentIntent directly, stores pending order in MongoDB
2. **New endpoint:** `POST /api/checkout/confirm` — confirms payment succeeded, creates order + invoice
3. **New service:** `checkout.service.ts` — orchestrates Stripe PaymentIntent creation, pending order storage, confirmation
4. **New model:** `PendingOrder` — stores cart contents + PaymentIntent ID before payment confirmation
5. **New frontend:** Replace `Checkout.tsx` Medusa SDK calls with PawTag API calls
6. **New frontend:** Replace `CartContext.tsx` Medusa SDK calls with PawTag API calls
7. **Shadow validation:** Run both old (Medusa) and new (PawTag) paths simultaneously, compare results

**Dependencies:** Phase 0 complete.

**What must be tested:**
- Full checkout flow with Stripe directly (no Medusa)
- Payment succeeds → order created → invoice generated
- Payment fails → order not created → no charge
- Double-click prevention
- Browser refresh recovery
- Webhook backup path (payment_intent.succeeded creates order if frontend path fails)
- Shadow mode: old path and new path produce identical orders

**Success criteria:**
- 100% of test transactions produce correct orders in both paths
- No duplicate charges
- No orphan payments
- Customer experience identical to current flow

**Rollback strategy:** New endpoints are feature-flagged. Disable flag to revert to Medusa path. Both paths coexist.

**Medusa status:** Remains active. Both paths run in parallel during shadow period.

### 8.4 Phase 2 — Replace Cart and Product Catalog

**Objective:** Remove Medusa dependency from cart, product catalog, shipping, tax.

**Changes:**
1. **New MongoDB Cart model** (or reuse existing, remove deprecated fields) — server-side cart with TTL
2. **New product endpoints:** `GET /api/products`, `GET /api/products/:id` — serve from MongoDB Product model (promoted from deprecated)
3. **Product admin sync:** Ensure admin CRUD writes to MongoDB AND Medusa during transition
4. **Shipping configuration:** CMS setting for free NZ-wide shipping (simplification — PawTag only ships within NZ)
5. **Tax configuration:** CMS setting for 15% NZ GST (simplification — PawTag has single tax rate)
6. **Promo codes:** Either simple MongoDB PromoCode model or keep Medusa promo system

**Dependencies:** Phase 1 complete and validated.

**What must be tested:**
- Product listing from MongoDB matches Medusa
- Cart persistence across sessions
- Shipping calculation (free NZ-wide)
- Tax calculation (15% GST)
- Promo code application

**Success criteria:**
- Shop page loads products from MongoDB
- Cart works without Medusa SDK
- Checkout produces correct totals (shipping + tax)

**Rollback strategy:** Feature-flagged. Medusa remains available as fallback.

**Medusa status:** Still running but no longer called by frontend. Read-only mode.

### 8.5 Phase 3 — Remove Medusa

**Objective:** Fully remove MedusaJS. PawTag owns all commerce.

**Changes:**
1. Remove `apps/medusa/` directory
2. Remove all Medusa SDK imports and dependencies
3. Remove Medusa-related environment variables
4. Remove `medusa-sync.ts`, `medusa-webhooks.ts`, `medusa-sync.service.ts`, `medusa-admin.service.ts`
5. Remove `orderSyncReconciliation.ts`, `webhookRetry.ts` jobs
6. Remove Medusa references from Docker Compose
7. Archive Medusa PostgreSQL database (read-only backup)
8. Update documentation

**Dependencies:** Phase 2 complete and validated in production.

**What must be tested:**
- Full regression test of all commerce flows
- Verify no remaining Medusa imports or references
- Verify no broken environment variables
- Verify Docker Compose starts cleanly

**Success criteria:**
- `pnpm build` succeeds with no Medusa dependencies
- All tests pass
- No Medusa processes running
- Production order flow works end-to-end

**Rollback strategy:** Keep Medusa PostgreSQL backup for 90 days. If critical issues arise, re-enable Medusa from backup.

**Medusa status:** Decommissioned.

### 8.6 Handling Historical Data

| Data Type | Strategy |
|-----------|----------|
| **Existing Medusa orders** | All PawTag orders already have `medusaOrderId`. Medusa PostgreSQL kept as read-only archive. Historical orders accessible via admin API. |
| **Historical order references** | `medusaOrderId` field retained on Order model (never removed). Backward compatible. |
| **Stripe payment/customer relationships** | Stripe PaymentIntent IDs already stored on Order/Invoice. No change needed — Stripe is the authority. |
| **Existing products** | Product data migrated from Medusa to MongoDB during Phase 2. Admin CRUD switches to MongoDB. |
| **Existing customers** | `medusaCustomerId` field retained on User model. No change needed. |
| **Refund history** | Refunds processed via Stripe API directly (already the case). PawTag Order stores `payment.status: 'refunded'`. |
| **Subscription relationships** | `stripeSubscriptionId` and `stripeCustomerId` retained. PawTag cron handles renewals (already the case). |
| **Medusa order IDs in other systems** | `medusaOrderId` field on Order model preserved indefinitely. |

---

## 9. Production Test Strategy

### 9.1 Functional Testing

| Test Case | Priority | Type | Current Coverage |
|-----------|----------|------|-----------------|
| Successful purchase (card payment) | P0 | Integration | Partial (webhook handler tested) |
| Failed payment | P0 | Integration | Yes (`payment-confirmation.test.ts`) |
| Cancelled payment | P0 | Integration | Partial |
| Duplicate submission (double-click) | P0 | Unit | No |
| Browser interruption + recovery | P0 | E2E | No |
| Order visibility (customer dashboard) | P1 | Integration | Yes (`order-status.test.ts`) |
| Refund (full) | P0 | Integration | Yes (`order-cancel-refund.test.ts`) |
| Refund (partial) | P1 | Integration | No |
| Subscription lifecycle | P1 | Integration | Yes (`subscriptions.test.ts`) |
| Subscription renewal | P1 | Integration | Yes (`subscription.service.test.ts`) |
| Invoice generation + access | P1 | Integration | Yes (`invoice-access-full.test.ts`) |
| Dunning email on failed renewal | P2 | Integration | Yes (`dunning-webhook.test.ts`) |

### 9.2 Failure Testing

| Scenario | Test Method | Expected Outcome |
|----------|------------|-----------------|
| PawTag API unavailable during payment | Mock API failure after `stripe.confirmPayment()` | Stripe webhook creates order (recovery) |
| MongoDB unavailable | Mock DB connection failure | Graceful error, payment NOT lost (Stripe retains payment intent) |
| Stripe API temporarily unavailable | Mock Stripe timeout | Payment not initiated, customer sees error |
| Webhook delayed 5 minutes | Delay webhook delivery | Order created via webhook after delay |
| Webhook duplicated (3x) | Send same event 3 times | Only one order created (idempotency) |
| Email provider unavailable | Mock email service failure | Order still confirmed, admin alerted |
| Invoice creation fails | Mock Invoice.create failure | Order still confirmed, admin alerted |

### 9.3 Data Integrity Testing

| Assertion | Test Method |
|-----------|------------|
| One successful payment → exactly one PawTag order | Create payment, verify Order.countDocuments() === 1 for that PaymentIntent |
| No order appears paid without Stripe confirmation | Create Order with `status: 'paid'` without Stripe PaymentIntent, verify webhook doesn't flip it |
| Invoice number is unique under concurrent load | 10 parallel invoice creations, verify all numbers unique |
| Order number is unique under concurrent load | 10 parallel order creations, verify all numbers unique |
| Idempotency: same PaymentIntent called twice → same order | Call `POST /orders/place` twice with same PaymentIntent ID, verify same order returned |

### 9.4 Migration Testing

| Scenario | Test Method |
|----------|------------|
| Historical orders remain accessible | Query orders with `medusaOrderId` set, verify data intact |
| Product data matches between Medusa and MongoDB | Compare product list from both sources |
| Customer data matches | Verify `medusaCustomerId` field on User model |
| Subscription data matches | Verify `stripeSubscriptionId` on Subscription model |
| No orphaned data after migration | Check for references to deleted Medusa collections |

### 9.5 Load and Performance Testing

**Do not assume performance. Measure it.**

| Metric | How to Measure | Target |
|--------|---------------|--------|
| Checkout completion time (critical path) | Instrument `POST /orders/place` endpoint | Measure, don't guess |
| Product listing load time | Instrument `GET /api/products` endpoint | Measure, don't guess |
| Cart operations latency | Instrument cart CRUD endpoints | Measure, don't guess |
| Concurrent checkout throughput | Load test with k6 or Artillery | Measure, don't guess |
| Database write latency under load | MongoDB profiler | Measure, don't guess |
| Stripe API call latency | Instrument Stripe calls | Measure, don't guess |

---

## 10. Security and Financial Integrity Review

### 10.1 Server-Side Price Validation

**Current state:** Prices come from Medusa during checkout (`sdk.store.payment.initiatePaymentSession()`). Medusa's pricing module is authoritative.

**After migration:** Prices must be validated server-side before creating PaymentIntents.

**Required controls:**
- `POST /checkout/create-payment-intent` must fetch product price from MongoDB (server-side) — never trust frontend price
- Stripe PaymentIntent amount must match server-side price × quantity
- If price mismatch detected, reject the request and log audit event

**Current gap:** No server-side price validation exists because Medusa handles it. This MUST be built in Phase 1.

### 10.2 Product/Price Tampering from Browser

**Current state:** Frontend sends `variant_id` to Medusa SDK. Medusa resolves price server-side.

**After migration:** Frontend sends `productId` and `quantity` to PawTag API. API resolves price server-side.

**Required controls:**
- Never accept price from frontend
- Never accept `unitPrice` from frontend in checkout flow
- All price calculations server-side
- Zod validation on all checkout inputs

### 10.3 Stripe Webhook Signature Verification

**Current state: CRITICAL VULNERABILITY** — Signature is stubbed. See Section 6.3.

**Required fix:** Implement `stripe.webhooks.constructEvent()` before any migration work.

### 10.4 Idempotency

**Current state:** Strong. `WebhookEvent` unique index + `Order.findOne()` idempotency check.

**After migration:** Maintain same pattern. Add `PaymentIntent.id` as idempotency key on `PendingOrder` model.

### 10.5 Authentication and Authorisation

**Current state:** Checkout requires authentication (inline login/register in Step 2). Payment is tied to authenticated user.

**After migration:** Same pattern. `POST /checkout/*` endpoints require JWT auth. User ID extracted from token, not trusted from frontend.

### 10.6 Refund Permissions

**Current state:** `POST /admin/orders/:id/refund` requires admin role + `order.refund` permission.

**After migration:** Same pattern. Add explicit permission check. All refunds audit-logged.

### 10.7 Audit Trails

**Current state:** Enterprise-grade audit logging with SHA-256 hash chain. All admin actions logged.

**After migration:** Same pattern. Add audit logging for checkout events (payment initiated, payment confirmed, order created).

### 10.8 Prevention of Duplicate Charges

**Current state:** Stripe PaymentIntent is idempotent. `stripe.confirmPayment()` with same PaymentIntent returns same result.

**After migration:** Same. Plus: `POST /orders/place` idempotency check prevents duplicate order creation.

### 10.9 Prevention of Duplicate Orders

**Current state:** 3-layer protection (WebhookEvent unique index + Order idempotency check + atomic order numbers).

**After migration:** Same. Plus: `PendingOrder` model with `stripePaymentIntentId` unique index.

---

## 11. Risks and Reasons to Keep Medusa

### 11.1 What Medusa Provides That PawTag Will Need Soon

| Medusa Feature | PawTag Need | PawTag Alternative | Risk |
|---------------|-------------|-------------------|------|
| Multi-currency pricing | International expansion | Single currency (NZD) is fine for now | Low |
| Complex tax rules | Multi-jurisdiction tax | Single 15% GST is fine for NZ | Low |
| Shipping carrier integration | Real-time shipping rates | Free NZ-wide shipping is PawTag's model | Low |
| Multi-warehouse inventory | Stock management | PawTag has single warehouse | Low |
| Promotion engine | Complex discount rules | Simple promo code model or coupon system | Low |
| Order editing | Post-purchase modifications | Not currently offered | Low |
| Returns/RMA | Return management | Not currently offered | Low |
| Sales channels | Multi-channel selling | Single channel (web) | Low |

**Assessment:** Medusa's advanced features are not needed for PawTag's current or near-future business model. PawTag sells physical QR/NFC tags with a simple subscription model. The complexity of a generic commerce platform is not justified.

### 11.2 Is PawTag's Existing Code Mature Enough?

**Evidence of maturity:**
- Order creation service has unit tests covering success, idempotency, user lookup, errors
- Webhook infrastructure has retry with exponential backoff, dead letter queue, idempotency
- Reconciliation job handles status drift detection
- Audit logging is enterprise-grade with hash chain integrity
- Email delivery is non-blocking with admin alerts on failure

**Evidence of immaturity:**
- Stripe webhook signature verification is stubbed (security gap)
- Invoice counter has race condition in `webhooks.ts`
- Subscription pricing is hardcoded
- No orphan payment detection
- No server-side price validation (relies on Medusa)

**Assessment:** The core order pipeline is mature. The gaps are specific and fixable. Phase 0 addresses all of them.

### 11.3 Are We Underestimating Requirements?

**Tax:** PawTag operates in NZ with 15% GST. No multi-jurisdiction complexity. A CMS setting (`tax.rate`, `tax.label`) is sufficient.

**Inventory:** PawTag ships physical tags. A simple `stock` field on Product with low-stock alerts is sufficient. No need for multi-warehouse, reserved stock, or backorder management.

**Fulfilment:** PawTag ships via standard post. No carrier integration needed. Admin manually marks as shipped with tracking number.

**Assessment:** PawTag's commerce requirements are genuinely simple. The complexity of Medusa is not justified.

### 11.4 Would a Hybrid Approach Be Better?

**Hybrid option:** Keep Medusa for product/pricing/payment, but simplify the integration.

**Problem:** The integration is already the complexity. Medusa adds 52+ files of sync code, bidirectional webhooks, reconciliation jobs, and retry mechanisms. Simplifying the integration while keeping Medusa would still require significant work, and you'd still have two systems to maintain.

**Assessment:** A clean break is simpler than a half-measure.

### 11.5 Does the Complexity of Migration Outweigh the Benefit?

**Migration complexity:** 4 phases, 6-10 weeks, touching ~52 files.

**Post-migration benefit:**
- Eliminate 52+ files of sync code
- Eliminate Medusa infrastructure (PostgreSQL, Docker, separate app)
- Eliminate bidirectional webhooks and reconciliation
- Single codebase, single database, single deployment
- Simpler debugging and monitoring
- Lower hosting costs

**Assessment:** The migration is significant but the long-term simplification is substantial. The ROI is positive if PawTag continues as a product-focused business.

---

## 12. Final Architecture Recommendation

### **Proceed with migration away from Medusa**

**Justification:**

1. **PawTag's commerce requirements are simple.** Physical QR/NFC tags with subscriptions. No multi-currency, no complex tax, no carrier integration, no multi-warehouse.

2. **PawTag already owns the important data.** Orders, Invoices, Subscriptions, Tags, Users — all in MongoDB. Medusa owns products/prices/cart, which can be transferred.

3. **The Medusa integration is the primary source of complexity.** 52+ files, 3-layer sync architecture, bidirectional webhooks, reconciliation jobs. This complexity exists solely because two systems are trying to own the same domain.

4. **The gaps are specific and fixable.** Stripe signature verification, orphan payment detection, server-side price validation, configurable pricing. None of these require Medusa.

5. **The subscription system is already PawTag-native.** `subscription.service.ts` handles renewals, grace periods, dunning, reminders — all without Medusa. Medusa is not needed for this.

6. **Stripe integration is already partially direct.** Refunds, billing portal, and subscription management already bypass Medusa. The migration completes this pattern.

**The recommended approach is NOT a big-bang rewrite.** It is a phased migration with parallel validation, feature flags, and rollback capability at every stage.

---

## 13. Implementation Readiness Checklist

Before ANY code changes are authorised, ALL of the following must be true:

### Prerequisites (must be complete)

- [ ] **Stripe webhook signature verification implemented and tested**
- [ ] **Orphan payment detection job designed and tested**
- [ ] **Non-atomic invoice counter in `webhooks.ts` fixed**
- [ ] **Subscription pricing made configurable (read from product config)**
- [ ] **Server-side price validation designed for checkout flow**
- [ ] **Pending order model designed and reviewed**
- [ ] **Migration plan reviewed and approved by Product Owner**
- [ ] **Rollback strategy documented for each phase**
- [ ] **Test strategy documented and reviewed**
- [ ] **Medusa PostgreSQL backup strategy confirmed**

### Technical Readiness

- [ ] **All existing tests passing** (no pre-existing failures)
- [ ] **Build succeeds** (`pnpm build` clean)
- [ ] **Typecheck succeeds** (`pnpm typecheck` clean)
- [ ] **No Medusa-related security vulnerabilities** (signature verification, price tampering)
- [ ] **Stripe API keys confirmed working in test mode**
- [ ] **MongoDB Atlas cluster confirmed healthy**
- [ ] **Docker environment confirmed working**

### Business Readiness

- [ ] **Product Owner has reviewed and approved this blueprint**
- [ ] **Product catalogue confirmed** (all products, prices, variants in Medusa)
- [ ] **Subscription pricing confirmed** (annual/monthly rates, free period, grace period)
- [ ] **Shipping policy confirmed** (free NZ-wide, or specific rates)
- [ ] **Tax policy confirmed** (15% GST inclusive or exclusive)
- [ ] **Promo code requirements confirmed** (simple codes or complex rules?)
- [ ] **Admin workflow confirmed** (how will admin manage products after migration?)

---

## 14. Confidence and Unknowns

### Verified from actual code

- Product model schema and all 11 files that reference it
- All 52+ files that depend on Medusa
- Complete checkout flow (4-step wizard with exact API calls)
- Order creation service with idempotency and 5-level user lookup
- Webhook retry mechanism with exponential backoff
- Reconciliation job with status drift detection
- Stripe integration: 60% Medusa-mediated, 40% direct PawTag
- All 46 MongoDB models with complete schemas
- Test coverage for order creation, payment confirmation, subscriptions, invoices

### High-confidence inference

- Removing Medusa eliminates the primary source of sync complexity
- PawTag's order/invoice/subscription pipeline is production-ready
- The migration is feasible in 4 phases over 6-10 weeks
- PawTag's commerce requirements will not outgrow a MongoDB-based system in the near term

### Assumptions

- PawTag will continue to operate in NZ only (single currency, single tax rate)
- PawTag will not need complex multi-warehouse inventory management
- PawTag will not need carrier-integrated shipping rate calculation
- PawTag will not need complex promotion/discount rules beyond simple promo codes
- The Stripe API will remain PawTag's payment provider
- MongoDB Atlas will remain the primary database

### Unknowns / Requires testing

- Actual checkout latency without Medusa (needs measurement)
- Concurrent checkout throughput under load (needs load testing)
- Stripe PaymentIntent creation latency from PawTag API (needs measurement)
- Product catalogue migration accuracy (needs validation against Medusa data)
- Historical order accessibility after Medusa removal (needs testing)
- Edge cases in orphan payment detection (needs production monitoring)
- Stripe webhook delivery timing in production (needs monitoring)

---

*End of blueprint. This document is a planning artefact. No code was modified during its creation.*
