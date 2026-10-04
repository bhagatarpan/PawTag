---
name: membership-lifecycle
description: Implement or review PawTag membership lifecycle changes including subscriptions, activations, upgrades, downgrades, cancellations, renewals, invoices, notifications, retention offers, and the entitlement registry system. Use when changing membership subscription flows, tier changes, billing, membership-related notifications, or entitlement configuration.
---

# Membership Lifecycle

Follow `AGENTS.md` first.

## Architecture

```
Admin: Entitlements Page (/membership/entitlements)
  │  SINGLE SOURCE OF TRUTH
  │
  ├─► MembershipBenefit (benefit definitions)
  ├─► MembershipTierBenefit (per-tier values)
  │
  │  All benefit data flows FROM here
  │
  ├─► Frontend pages (dynamic rendering)
  ├─► Backend services (entitlement checks)
  ├─► Cart/Checkout (discounts, shipping)
  ├─► Escalation service (tier gating)
  ├─► Finder route (medical alerts)
  └─► Notification service (delivery)
```

### Key Models
- `MembershipTier` — Tier definitions (name, price, tagLimit, Stripe IDs, display properties). NO embedded benefits.
- `UserMembership` — User's membership record, status, billing, Stripe subscription ID, invoice ID
- `MembershipBenefit` — Benefit definitions (flexible, admin-configurable via entitlements page)
- `MembershipTierBenefit` — Per-tier values (admin-configurable via entitlements page)
- `PromoCode` — Used for retention offers (one-time discount codes)

### Key Services
- `membership.service.ts` — Core membership business logic
- `membership-entitlement.service.ts` — Entitlement evaluation (SINGLE SOURCE OF TRUTH for benefits)
- `membership-retention.service.ts` — Retention offer generation

### Key API Endpoints
- `GET /api/membership/tiers` — Returns tiers with entitlements from registry
- `GET /api/public/membership/tiers` — Public endpoint with entitlements
- `GET /api/membership/status` — User's membership status with entitlements
- `GET /api/membership/entitlements` — User's full entitlements from registry
- `GET /api/admin/entitlements/matrix` — Full benefits matrix for admin UI
- `POST /api/admin/membership/tiers` — Create new tier dynamically

## Entitlement Registry (Single Source of Truth)

### How It Works
1. Admin configures benefits on `/membership/entitlements` page
2. Benefits stored in `MembershipBenefit` + `MembershipTierBenefit` collections
3. Services read via `membershipEntitlementService.hasAccess(userId, key)` or `.getValue(userId, key)`
4. Frontend reads from enriched API responses (entitlements included)

### Dynamic Tier Support
- Tiers are stored in `MembershipTier` collection (no hardcoded enum)
- Adding a new tier: `POST /admin/membership/tiers` → auto-appears in entitlements matrix
- No code changes needed for new tiers or benefits

### Service Enforcement
ALL service code MUST use the entitlement registry, NOT hardcoded tier strings:
```typescript
// CORRECT: Dynamic entitlement check
const hasAccess = await membershipEntitlementService.hasAccess(userId, 'emergency_contact');
if (!hasAccess) { ... }

// WRONG: Hardcoded tier check
if (ownerTier === 'gold') { ... }
if (ownerTier !== 'black') { ... }
```

## Subscription Flow

1. Customer clicks "Join {Tier}" on `/account/membership/subscribe`
2. Frontend calls `POST /api/membership/subscribe` with `{ tierId }`
3. Server creates Stripe Subscription (incomplete) + UserMembership (pending_payment)
4. Returns `{ clientSecret, membership, membershipId }`
5. Frontend renders StripePaymentForm
6. User pays → `stripe.confirmPayment()` succeeds
7. Frontend calls `POST /api/membership/activate` with `{ membershipId }`
8. Server activates membership, creates INVM- invoice, sends welcome email, extends tags
9. Webhook also activates as safety net via `invoice.payment_succeeded`

## Invoice Numbering

- Membership invoices: `INVM-XXXXXX` (atomic counter on `counters` collection)
- Product invoices: `INV-XXXXXX` (separate counter)
- Credit notes: `CN-XXXXXX`

## Tier Changes (Upgrade/Downgrade)

Specialist rules for tier change, Option A resume, portal cancel sync, gold billing interval, and shared error codes: **`skills/membership-tier-change/`**.

Shared contracts: `packages/shared/src/membership.ts`.

### Upgrades (immediate)
- Backend: `changeTier(userId, newTierId, prorationBehavior: 'now')`
- Stripe subscription price updated with `proration_behavior: 'create_prorations'`
- Proration invoice created immediately (INVM- prefix)
- New benefits activate immediately
- Response includes `resumedOnUpgrade: boolean`

### Downgrades (deferred to renewal)
- Backend: `requestDowngrade(userId, { tierId, reason, termsAccepted, termsVersion })`
- **Requires explicit terms acceptance** — customer must see points-at-risk and entitlements-lost
- Records `pendingTierId`, `pendingTierEffectiveAt`, `downgradeTermsAcceptedAt` on membership
- Stripe subscription price updated for next renewal (no immediate charge)
- Current tier benefits REMAIN ACTIVE until `currentPeriodEnd`
- Background job `processScheduledDowngrades()` executes at period end:
  - Checks Stripe renewal succeeded before executing
  - Flips `tierId` to `pendingTierId`
  - Applies Guardian Points clawback
  - Re-evaluates tags
  - Invalidates entitlement cache
  - Sends downgrade-executed email
- If renewal failed: keeps current tier, notifies customer

### Guardian Points Clawback (on downgrade)
- Formula: `floor(points_at_higher_tier × (1 - newMultiplier / oldMultiplier))`
- Example: Black (3×) → Gold (1×): lose 2/3 of points earned at Black rate
- Applied by `applyDowngradePointsClawback()` in `points-earning.service.ts`
- Idempotent — checks for existing clawback by `referenceId`
- Ledger entry with `activity: 'membership_downgrade_clawback'`
- Points ledger metadata includes `basePoints`, `multiplier`, `bonusPoints` (forward-only)

## Cancellation (deferred to period end)

- Backend: `cancelMembership(userId, reason)`
- Uses Stripe `cancel_at_period_end: true` — NOT immediate cancel
- `User.membershipTier` remains active until `currentPeriodEnd`
- Tags remain active until `currentPeriodEnd`
- `autoRenew` set to false immediately
- Benefits continue until period end (matches email copy)
- `checkExpiredMemberships` job transitions to 'expired' at period end
- Generates retention offer (15% off + free shipping)
- Audit logged with `cancelAtPeriodEnd: true` metadata

## Keep my Membership (single customer action)

`POST /api/membership/keep` → `keepMyMembership(userId)`

| Scenario | Behavior |
|---|---|
| Cancelling + benefits still active | Resume same Stripe sub + same membership doc; **no charge**; original start/end dates; `cancelledAt` cleared; `autoRenew=true` |
| Benefits already ended | Close old membership; **paid rejoin** same tier at full CMS/tier price; `clientSecret` for Stripe Elements |
| Not cancelling / no membership | Typed error |

- UI: `KeepMembershipPanel` — calm single CTA (no noisy ConfirmDialog)
- Manage + Subscribe pages: **only** Keep action while cancelling (hide upgrade grid)
- Audit: `membership_kept` / `membership_reactivated_paid`
- Email: `membership-resumed` (Path A); welcome/invoice on Path B activate
- Stripe: central factory only (`lib/stripe-client.ts`)

## Stripe Billing Portal cancel/resume sync

Webhook `customer.subscription.updated` keeps local cancel state aligned with Stripe:

- `cancel_at_period_end: true` + local not cancelling → set `cancelledAt`, `autoRenew=false`
- `cancel_at_period_end: false` + local cancelling → clear cancel fields, `autoRenew=true`
- Stripe `canceled`/`incomplete_expired` → mark membership/sub cancelled
- Applies to both `UserMembership` and tag `Subscription`
- Audit: `membership_cancelled_via_stripe` / `membership_resumed_via_stripe`

## Resume (undo scheduled cancellation)

- Backend: `resumeMembership(userId)`
- Only valid while `status === 'active'` and `cancelledAt` set
- Stripe first: retrieve sub; reject `canceled`/`incomplete_expired`; set `cancel_at_period_end: false`
- Local only after Stripe success: clear `cancelledAt`/`cancellationReason`, `autoRenew=true`
- Upgrade while cancelling uses the same Stripe-first resume principle (Option A)

## Payment Failure Handling

- Webhook `invoice.payment_failed` handles `UserMembership` (not just tag Subscriptions)
- Records failed invoice (INVM- prefix, status: 'failed')
- Updates `dunningStatus: 'past_due'`, increments `dunningRetryCount`
- Notifies customer via email + in-app notification
- Alerts CSR via admin alert email
- Stripe retries automatically (~4 times over ~2 weeks)
- Membership NOT expired on first failure — grace period applies

## Renewal Handling

- Webhook `invoice.payment_succeeded` with `billing_reason: 'subscription_cycle'`
- Advances `currentPeriodStart/End` by 1 year (from Stripe invoice period)
- Resets `dunningStatus: 'active'`, `dunningRetryCount: 0`
- Creates INVM- invoice + sends renewal confirmation email
- Idempotent by `stripeInvoiceId`

## Payment Method Management

- Card display data populated from Stripe subscription after activation
- `GET /membership/payment-methods` — lists cards from Stripe Customer
- `POST /membership/payment-methods/portal` — Stripe Billing Portal session
- Customer can add/change/delete cards via Stripe-hosted portal
- "Update" button in MembershipManage opens portal

## Notifications

All lifecycle events create in-app notifications via `createAndDeliverNotification()`:
- `membership_activated` — Welcome
- `membership_cancelled` — Cancellation confirmation
- `membership_upgraded` — Upgrade confirmation
- `membership_downgrade_scheduled` — Downgrade scheduled
- `membership_downgraded` — Downgrade executed
- `membership_extended` — Admin extension
- `membership_expired` — Expiry warning
- `membership_renewal_reminder` — 30/7 day renewal reminder
- `membership_payment_failed` — Payment failure alert

## Pet Recovery (Black-Only)

3-stage escalation:
- Stage 1 (0-30 min): Owner notified
- Stage 2 (30-60 min): Emergency contact notified (Platinum/Black only)
- Stage 3 (60+ min): PawTag team notified (Black only)

Gated by entitlements: `emergency_contact`, `pet_recovery`

## Admin Operations

- Admin tier change requires evidence: customerEmailDate, customerEmailContent, actionRequired, reason, csrFullName
- Admin cancel requires same evidence pattern
- All admin actions logged with `actorType: 'CSR'` and full evidence in metadata

## Adding New Tiers

1. Admin creates tier via Tier Configuration page (`POST /admin/membership/tiers`)
2. New tier appears in Entitlements matrix automatically
3. Admin configures benefits for new tier
4. All frontend pages display new tier dynamically
5. All backend services enforce entitlements dynamically
6. **Zero code changes required**

## Adding New Benefits

1. Admin clicks "+ Add Benefit" on Entitlements page
2. Benefit appears in matrix
3. Admin toggles per tier
4. Frontend displays dynamically
5. Backend enforces via `hasAccess()` or `getValue()`
6. **Zero code changes required**

## Verification

- Run `pnpm typecheck` after changes
- Run `pnpm lint` after changes
- Test: Subscribe → Activate → View on manage page → Upgrade → Downgrade → Cancel
- Test upgrade-while-cancelling: estimate shows resume; confirm resumes + upgrades; Stripe fail leaves cancel intact
- Verify invoices created with INVM- prefix
- Verify notifications delivered
- Verify audit trail captures all events including `membership_tier_changed_resumed`
- Test adding new tier via admin → verify it appears everywhere
- Test adding new benefit via admin → verify it's enforced
- Integration: `pnpm test:integration -- membership-upgrade membership-cancel-resume`
