# Plan: Real Stripe Subscription Renewal Charging

**Status:** Saved for later implementation
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
- `processAutoRenewals()` becomes a fallback/safety net, not the primary mechanism

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

## Changes Required

### 1. Store payment method at checkout (Stripe provider)

**File:** `packages/api/src/commerce/providers/stripe/index.ts`

- Add `setup_future_usage: 'off_session'` to `createPaymentIntent()` (line ~185-212)
- Accept optional `customer` (Stripe Customer ID) parameter
- Accept optional `customerIdempotencyKey` for deduplication

### 2. Create Stripe Customer at checkout

**File:** `packages/api/src/commerce/services/checkout.service.ts`

- Before creating the PaymentIntent (line ~122), check if user has `stripeCustomerId`
- If not, create a Stripe Customer (same pattern as Gold, line 260-270)
- Store `stripeCustomerId` on User model
- Pass `customer` to `stripePaymentProvider.createPaymentIntent()`

### 3. Create Stripe Subscription at checkout (for tag products)

**File:** `packages/api/src/services/subscription.service.ts` — `createSubscription()`

After creating the PawTag Subscription (line ~170), if:
- `autoRenew: true` AND
- Product has `subscriptionConfig.monthlyPrice` AND
- Not demo mode

Then:
1. Look up or create a Stripe Price for the product (same pattern as Gold, lines 274-318)
2. Create a Stripe Subscription:
   ```ts
   stripe.subscriptions.create({
     customer: stripeCustomerId,
     items: [{ price: stripePriceId }],
     trial_end: Math.floor(freePeriodEndsAt.getTime() / 1000),
     payment_behavior: 'default_incomplete',
     payment_settings: { save_default_payment_method: 'on_subscription' },
     metadata: { userId, subscriptionId: pawtagSub._id.toString(), plan: 'tag' },
     expand: ['latest_invoice.payment_intent'],
   })
   ```
3. Store `stripeSubscriptionId` and `stripeCustomerId` on the PawTag Subscription

### 4. Skip local auto-renewal for Stripe-managed subscriptions

**File:** `packages/api/src/services/subscription.service.ts` — `processAutoRenewals()`

Add a filter to exclude subscriptions that have a `stripeSubscriptionId`:

```ts
const subsToRenew = await Subscription.find({
  status: 'active',
  autoRenew: true,
  currentPeriodEnd: { $lte: now },
  stripeSubscriptionId: { $exists: false },  // NEW: skip Stripe-managed
  deletedAt: null,
});
```

### 5. Enhance webhook handlers

**File:** `packages/api/src/routes/stripe-webhooks.ts`

**`handleInvoicePaymentSucceeded` (line 252-268):**
- Already works — finds subscription by `stripeSubscriptionId`, updates status/period
- Add: reset `paymentRetryCount` to 0
- Add: create a PawTag Invoice record (currently only updates the subscription)

**`handleInvoicePaymentFailed` (line 273-294):**
- Currently only creates a notification
- Add: call `handlePaymentFailure()` from subscription.service.ts to start dunning
- Add: increment `paymentRetryCount`
- Add: set `nextPaymentAttemptAt` based on retry schedule

**Add `customer.subscription.updated` handler:**
- Sync status changes from Stripe (e.g., `past_due`, `canceled`)
- Update PawTag subscription status accordingly

### 6. Add Stripe Price lookup/creation for tag products

**File:** `packages/api/src/services/subscription.service.ts`

Create a helper function `getOrCreateStripePrice(product, stripe)` that:
- Checks CMS setting `{product.sku}.stripePriceId` for cached price
- Verifies price is active and matches current amount
- If missing/stale, creates a new Stripe Price on the product
- Stores the Stripe Price ID in CMS settings for reuse

Same pattern as Gold (lines 274-318).

---

## Files Changed (6 files)

| # | File | Change |
|---|------|--------|
| 1 | `packages/api/src/commerce/providers/stripe/index.ts` | Add `setup_future_usage`, `customer` param to `createPaymentIntent` |
| 2 | `packages/api/src/commerce/services/checkout.service.ts` | Create Stripe Customer at checkout, pass to PaymentIntent |
| 3 | `packages/api/src/services/subscription.service.ts` | Create Stripe Subscription with trial in `createSubscription`; skip Stripe-managed subs in `processAutoRenewals` |
| 4 | `packages/api/src/routes/stripe-webhooks.ts` | Enhance `invoice.payment_succeeded/failed` handlers; add `customer.subscription.updated` |
| 5 | `packages/db/src/models/Subscription.ts` | Already has `stripeSubscriptionId` and `stripeCustomerId` — no change needed |
| 6 | `packages/db/src/models/User.ts` | Already has `stripeCustomerId` — no change needed |

---

## What we get after implementation

| Capability | Before | After |
|------------|--------|-------|
| Customer pays at checkout | ✅ | ✅ |
| Payment method saved for renewal | ❌ | ✅ |
| Stripe charges customer after free period | ❌ | ✅ |
| Automatic retries on payment failure | ❌ | ✅ (Stripe handles) |
| Grace period after failed retries | ❌ | ✅ (Stripe + PawTag) |
| Customer receives renewal invoices | ❌ | ✅ (Stripe emails) |
| PawTag subscription stays in sync | ❌ | ✅ (webhooks) |
| Admin can see real payment status | ❌ | ✅ (Stripe dashboard + webhooks) |

---

## What `processAutoRenewals()` becomes

A **safety net** for edge cases where Stripe is unavailable or a subscription was created without Stripe. It only runs for subscriptions without `stripeSubscriptionId`.

---

## Reference: Gold Membership Implementation

The Gold membership (`createGoldSubscription()` in `subscription.service.ts:222-427`) is the only fully-wired Stripe Subscription implementation and serves as the reference pattern:

- Creates Stripe Customer if needed (lines 260-270)
- Looks up or creates Stripe Price (lines 274-318)
- Creates Stripe Subscription with `payment_behavior: 'default_incomplete'` (lines 321-328)
- Stores `stripeCustomerId` and `stripeSubscriptionId` on PawTag Subscription (lines 353-374)
- Webhooks handle `invoice.payment_succeeded` and `invoice.payment_failed`

---

## Verification

1. `pnpm typecheck` — all packages pass
2. `pnpm build` — all apps build
3. Manual test: purchase a tag → verify Stripe Customer created → verify Stripe Subscription with trial → wait for trial end → verify charge → verify webhook updates PawTag subscription
4. Test payment failure: use a Stripe test card that fails on retry → verify dunning flow
