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

- Backend: `changeTier(userId, newTierId, prorationBehavior)`
- Proration options: `'now'` (immediate prorated charge) or `'next_billing_cycle'` (takes effect at renewal)
- Tag re-evaluation: `removeMembershipFromTags()` + `extendTagsForMembership()` called automatically
- Retention offer: Generated for downgrades, included in email

## Cancellation

- Backend: `cancelMembership(userId, reason)`
- Generates retention offer (15% off + free shipping)
- Includes offer in cancellation email
- Removes membership from tags
- Audit logged with full metadata

## Notifications

All lifecycle events create in-app notifications via `createAndDeliverNotification()`:
- `membership_activated` — Welcome
- `membership_cancelled` — Cancellation confirmation
- `membership_upgraded` — Upgrade confirmation
- `membership_downgraded` — Downgrade confirmation
- `membership_extended` — Admin extension
- `membership_expired` — Expiry warning
- `membership_renewal_reminder` — 30/7 day renewal reminder

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
- Verify invoices created with INVM- prefix
- Verify notifications delivered
- Verify audit trail captures all events
- Test adding new tier via admin → verify it appears everywhere
- Test adding new benefit via admin → verify it's enforced
