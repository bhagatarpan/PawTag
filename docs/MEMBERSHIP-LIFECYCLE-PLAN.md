# Membership Lifecycle - Complete Implementation Plan

**Created:** 2026-09-28
**Branch:** `feature/membership-lifecycle`
**Status:** In Progress

---

## Product Decisions

| Decision | Choice |
|----------|--------|
| Upgrade proration | Customer chooses: "Upgrade now" (prorated) or "Wait till next billing cycle" |
| Downgrade timing | Customer chooses: "Downgrade now" (prorated) or "Wait till next billing cycle" |
| Black tier | Keep "Coming Soon" but build all logic so enabling is a config toggle |
| Retention offers | One-time discount code + free shipping for next purchase |
| Invoice prefix | `INVM-XXXXXX` (separate from product `INV-XXXXXX`) |
| Admin tier change | With evidence: email date, content, action, reason, CSR name |

---

## Progress Tracker

| Phase | Description | Status | Files Changed | Verified |
|-------|-------------|--------|---------------|----------|
| P0 | Critical Activation Fix | ✅ Complete | MembershipSubscribe.tsx, stripe-webhooks.ts, membership.service.ts | ✅ |
| P1 | Membership Invoices | ✅ Complete | UserMembership.ts, membership.service.ts, membership.ts, endpoints.ts, MembershipManage.tsx | ✅ |
| P2 | Complete Notification Coverage | ✅ Complete | membership.service.ts, notification-delivery.service.ts | ✅ |
| P3 | Upgrade / Downgrade Flow | ✅ Complete | membership.service.ts, membership.ts, membership-cancelled.ts | ✅ |
| P4 | Cancellation Flow | ✅ Complete | MembershipManage.tsx, membership-cancelled.ts | ✅ |
| P5 | Customer Portal Enhancements | ✅ Complete | Dashboard.tsx, MembershipManage.tsx | ✅ |
| P6 | Admin Portal | ✅ Complete | admin-membership.ts, MembershipSubscriberDetail.tsx, endpoints.ts | ✅ |
| P7 | Black Tier Readiness | ✅ Verified | No changes needed | ✅ |
| P8 | Documentation & Skills | ✅ Complete | SKILL.md, MEMBERSHIP-LIFECYCLE-PLAN.md | ✅ |

---

## Phase 0: Critical Activation Fix

### Problem
The "Join Platinum" button is broken. 3 bugs prevent the basic flow from working end-to-end.

### Bugs

| # | Bug | Fix | Files |
|---|-----|-----|-------|
| C1 | Frontend never calls activate after Stripe payment | Store membership ID from subscribe response, call `POST /api/membership/activate` in `handlePaymentSuccess()` | `MembershipSubscribe.tsx` |
| C2 | Webhook queries wrong model (`Subscription` vs `UserMembership`) | Add `UserMembership` lookup in `handleInvoicePaymentSucceeded()` | `stripe-webhooks.ts:268` |
| C3 | Demo mode leaves membership as `pending_payment` | Auto-activate membership when `isFakeMode()` | `membership.service.ts:266-269` |

### Current Flow (Broken)
```
Click "Join Platinum"
  → POST /api/membership/subscribe { tierId }
  → Server creates Stripe Subscription (incomplete) + UserMembership (pending_payment)
  → Returns { clientSecret, membership }
  → Frontend shows StripePaymentForm
  → User pays → stripe.confirmPayment() succeeds
  → handlePaymentSuccess() sets success=true, navigates to /account/membership
  → MembershipManage shows "No Active Membership" (status !== 'active')

  Meanwhile, Stripe fires invoice.payment_succeeded webhook
  → webhook handler looks for Subscription model (tag-based)
  → finds nothing → no-op
  → membership stays pending_payment permanently
```

### Target Flow (Fixed)
```
Click "Join Platinum"
  → POST /api/membership/subscribe { tierId }
  → Server creates Stripe Subscription + UserMembership (pending_payment)
  → Returns { clientSecret, membership, membershipId }
  → Frontend stores membershipId, shows StripePaymentForm
  → User pays → stripe.confirmPayment() succeeds
  → Frontend calls POST /api/membership/activate { membershipId }
  → Server activates membership, creates invoice, sends welcome email
  → Frontend shows success, navigates to /account/membership
  → MembershipManage shows active Platinum membership

  Safety net: Stripe webhook also activates if frontend call fails
```

### Changes Required

#### C1: Frontend — Store membership ID and call activate

**File:** `apps/web/src/pages/account/MembershipSubscribe.tsx`

1. Add `membershipId` state variable
2. Store `membership._id` from subscribe response (line 91)
3. In `handlePaymentSuccess()`, call `POST /api/membership/activate` with stored membershipId
4. Handle activation failure gracefully (payment succeeded, so still show success)

#### C2: Backend — Webhook handles membership subscriptions

**File:** `packages/api/src/routes/stripe-webhooks.ts`

1. Import `UserMembership` and `activateMembership`
2. In `handleInvoicePaymentSucceeded()` (line 265), after `Subscription` lookup fails:
   - Look up `UserMembership` by `stripeSubscriptionId`
   - If found with status `pending_payment`, call `activateMembership()`
   - Log the activation

#### C3: Backend — Demo mode auto-activates

**File:** `packages/api/src/services/membership.service.ts`

In `subscribeToTier()`, when `isFakeMode()`:
- Create membership with status `'active'` instead of `'pending_payment'`
- Call `extendTagsForMembership()` immediately
- Return `clientSecret: undefined` (triggers demo path on frontend)

---

## Phase 1: Membership Invoices

### Problem
`subscribeToTier()` creates `UserMembership` but never creates an `Invoice`. Only the deprecated `createGoldSubscription()` creates invoices.

### Invoice Numbering
- Prefix: `INVM-XXXXXX` (membership-specific)
- Separate counter from product invoices (`INV-XXXXXX`)
- Use atomic `findOneAndUpdate` on `counters` collection

### Changes Required

1. **Add membership invoice counter** — new counter key `membershipInvoiceNumber`
2. **Create invoice in `activateMembership()`** — after setting status to active
3. **Send invoice email** — call `sendInvoiceEmail()` after creation
4. **Add `invoiceId` field to `UserMembership` model**
5. **Add `GET /api/membership/invoices` endpoint**
6. **Add billing history section to `MembershipManage.tsx`**

---

## Phase 2: Complete Notification Coverage

### Problem
Only `activateMembership()` creates in-app notifications. All other lifecycle events are silent.

### Notification Matrix

| Event | Type | Title | Priority |
|-------|------|-------|----------|
| activated | `membership_activated` | "Welcome to {tier}!" | normal |
| cancelled | `membership_cancelled` | "Your {tier} membership has been cancelled" | normal |
| upgraded | `membership_upgraded` | "Welcome to {newTier}!" | normal |
| downgraded | `membership_downgraded` | "Your membership has changed to {newTier}" | normal |
| extended | `membership_extended` | "Your {tier} membership has been extended" | normal |
| expired | `membership_expired` | "Your {tier} membership has expired" | high |
| renewal reminder | `membership_renewal_reminder` | "Your {tier} renews in {days} days" | low |

---

## Phase 3: Upgrade / Downgrade Flow

### 3.1 Backend: Tag re-evaluation in `changeTier()`
Call `removeMembershipFromTags()` then `extendTagsForMembership()` after tier change.

### 3.2 Backend: Proration options
Add `prorationBehavior: 'now' | 'next_billing_cycle'` parameter.
- `'now'`: `proration_behavior: 'create_prorations'`
- `'next_billing_cycle'`: `proration_behavior: 'none'`

### 3.3 Retention offer mechanism
New `MembershipRetentionOffer` concept:
- One-time promo code: `RETAIN-{TIER}-{RANDOM}`
- 15% discount + free shipping
- 90-day expiry
- Generated during downgrade/cancel flow
- Displayed in confirmation dialog and email

### 3.4 Downgrade-specific email
New `membership-tier-downgraded.ts` template showing lost benefits and retention offer.

### 3.5 Frontend tier change page
New `/account/membership/change-tier` page with:
- Current tier highlighted
- Tier selection cards
- Proration timing choice
- Summary with proration estimate
- Confirmation dialog
- Retention offer for downgrades

---

## Phase 4: Cancellation Flow

### Enhanced cancellation dialog
- Show specific benefits being lost
- Show tag impact
- Show retention offer
- Show downgrade alternative
- Confirmation for high-value memberships

### Enhanced cancellation email
- List lost benefits
- Tag impact dates
- Retention offer code
- Free shipping code
- Re-subscribe CTA

---

## Phase 5: Customer Portal Enhancements

### 5.1 Dashboard membership status card
### 5.2 Fix "Active Since" bug (`currentPeriodEnd` → `currentPeriodStart`)
### 5.3 Billing history section
### 5.4 Payment method update
### 5.5 Notification center updates
### 5.6 Notification preferences
### 5.7 Shared constants

---

## Phase 6: Admin Portal

### 6.1 Admin tier change with evidence
Required fields: customerEmailDate, customerEmailContent, actionRequired, reason, csrFullName, csrNotes

### 6.2 Admin cancel with evidence
Same evidence pattern as tier change.

### 6.3 Fix subscriber search
Add name/email search to backend.

### 6.4 Membership audit trail on subscriber detail
### 6.5 Membership-specific audit filter
### 6.6 Add missing entity/action labels

---

## Phase 7: Black Tier Readiness

Keep "Coming Soon" but ensure all code paths work:
- Entitlement registry configured
- Tag limit = 999
- Stripe price created
- All service logic handles Black tier
- To enable: just set `comingSoon: false`

---

## Phase 8: Documentation & Skills

### Update documentation
- `AGENTS.md` — membership lifecycle rules
- `README.md` — membership section updates
- `docs/DESIGN.md` — membership design tokens

### Create skill
- `skills/membership-lifecycle/` — reusable membership workflow guidance

---

## Verification

After each phase:
1. Run `pnpm typecheck`
2. Run `pnpm lint`
3. Run `pnpm test:unit`
4. Run `pnpm test:integration`
5. Run `pnpm build`
6. Manual verification where applicable
