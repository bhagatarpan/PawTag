# Plan: Real Stripe Subscription Renewal Charging

**Status:** Implementing
**Date:** 2026-09-18

---

## Current State (the gap)

The `processAutoRenewals()` function (`subscription.service.ts:642-728`) finds active subscriptions with `autoRenew: true` whose period has ended, advances `currentPeriodEnd`, and creates a local invoice marked "paid" — **without calling Stripe**. No money is collected.

---

## Architecture Decision

**Use Stripe Subscriptions with trial periods** (same pattern as Gold membership).

- Stripe handles invoicing, charging, retries, and dunning automatically
- Existing `invoice.payment_succeeded` and `invoice.payment_failed` webhook handlers already work for Stripe-managed subscriptions
- No need for custom retry logic — Stripe's built-in retry is more reliable
- `processAutoRenewals()` becomes a fallback/safety net for non-Stripe subscriptions only

---

## Timeline Flow (after implementation)

```
CHECKOUT (one-time charge for tag)
  → Stripe PaymentIntent charges customer's card
  → setup_future_usage: 'off_session' saves the payment method
  → Stripe Customer created if needed
  → Stripe Subscription created with trial_end = now + freePeriodMonths
  → PawTag Subscription stores stripeSubscriptionId + stripeCustomerId

FREE PERIOD (Stripe handles timing)
  → Stripe Subscription is in "trialing" status
  → No charges during trial
  → PawTag reminders still fire (14d, 3d before freePeriodEndsAt)

TRIAL ENDS (Stripe automatically charges)
  → Stripe creates Invoice → charges saved payment method
  → invoice.payment_succeeded webhook → updates PawTag subscription
  → OR invoice.payment_failed webhook → dunning flow begins

ONGOING MONTHLY/YEARLY
  → Stripe auto-invoices each period
  → PawTag webhooks keep local state in sync
```

---

## State Machine

```
STRIPE STATES          →  PAWTAG STATES
trialing               →  active (freePeriodEndsAt in future)
active                 →  active
past_due               →  active (with paymentRetryCount > 0)
canceled               →  cancelled
unpaid                 →  grace_period
```

---

## Changes Required

### 1. Stripe provider — setup_future_usage, customer, idempotency

**File:** `packages/api/src/commerce/providers/stripe/index.ts`

- Add `setup_future_usage: 'off_session'` to `createPaymentIntent()` to save payment method
- Accept optional `customer` (Stripe Customer ID) parameter
- Pass `customer` to Stripe API when provided

### 2. Checkout — create Stripe Customer, correct creation order

**File:** `packages/api/src/commerce/services/checkout.service.ts`

- Before creating PaymentIntent, check if user has `stripeCustomerId`
- If not, create Stripe Customer (same pattern as Gold)
- Store `stripeCustomerId` on User model
- Pass `customer` to `stripePaymentProvider.createPaymentIntent()`
- **Create Stripe Subscription BEFORE PawTag records** — if Stripe fails, don't create orphaned local records

### 3. Subscription service — create Stripe Sub with trial, idempotency, audit

**File:** `packages/api/src/services/subscription.service.ts`

**In `createSubscription()`:**
- After creating PawTag Subscription, if `autoRenew: true` AND product has `monthlyPrice` AND not demo mode:
  - Check idempotency: skip if `stripeSubscriptionId` already exists for this order
  - Look up or create Stripe Price for the product
  - Create Stripe Subscription with `trial_end` set to `freePeriodEndsAt`
  - Store `stripeSubscriptionId` and `stripeCustomerId` on PawTag Subscription
  - Add audit event: `subscription_stripe_created`

**In `processAutoRenewals()`:**
- Add filter: `stripeSubscriptionId: { $exists: false }` to skip Stripe-managed subscriptions
- This makes it a safety net only

### 4. Webhook handlers — idempotency, ownership, enhanced dunning

**File:** `packages/api/src/routes/stripe-webhooks.ts`

**`handleInvoicePaymentSucceeded`:**
- Add idempotency: check if PawTag Invoice already exists for this `stripeInvoiceId`
- Reset `paymentRetryCount` to 0
- Create PawTag Invoice with `stripeInvoiceId` for dedup
- Add audit event: `subscription_stripe_renewed`

**`handleInvoicePaymentFailed`:**
- Add idempotency: check if already processed
- Call `handlePaymentFailure()` to start dunning
- Add audit event: `subscription_stripe_payment_failed`

**Add `customer.subscription.updated`:**
- Sync status changes from Stripe (past_due, canceled)
- Update PawTag subscription status accordingly

**Add `customer.subscription.deleted`:**
- Already exists — verify it handles PawTag-managed subscriptions too

---

## Files Changed (5 files)

| # | File | Change |
|---|------|--------|
| 1 | `packages/api/src/commerce/providers/stripe/index.ts` | Add `setup_future_usage`, `customer` param |
| 2 | `packages/api/src/commerce/services/checkout.service.ts` | Create Stripe Customer, pass to PI |
| 3 | `packages/api/src/services/subscription.service.ts` | Create Stripe Sub with trial, skip in processAutoRenewals, audit |
| 4 | `packages/api/src/routes/stripe-webhooks.ts` | Idempotent handlers, enhanced dunning, new handlers |

---

## Verification

1. `pnpm typecheck` — all packages pass
2. `pnpm build` — all apps build
3. Manual test: purchase tag → verify Stripe Customer created → verify Stripe Subscription with trial → verify trial end charges → verify webhooks update PawTag
4. Test payment failure: Stripe test card that fails → verify dunning flow
5. Test idempotency: replay webhook → verify no duplicate invoices
