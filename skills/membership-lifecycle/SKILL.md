---
name: membership-lifecycle
description: Implement or review PawTag membership lifecycle changes including subscriptions, activations, upgrades, downgrades, cancellations, renewals, invoices, notifications, and retention offers. Use when changing membership subscription flows, tier changes, billing, or membership-related notifications.
---

# Membership Lifecycle

Follow `AGENTS.md` first.

## Architecture

```
MembershipTier (definitions) → UserMembership (user records) → Services (business logic)
```

### Key Models
- `MembershipTier` — Tier definitions (gold/platinum/black), pricing, benefits, Stripe IDs
- `UserMembership` — User's membership record, status, billing, Stripe subscription ID, invoice ID
- `MembershipBenefit` — Benefit definitions for the entitlement registry
- `MembershipTierBenefit` — Per-tier benefit values (admin-configurable)
- `PromoCode` — Used for retention offers (one-time discount codes)

### Key Services
- `membership.service.ts` — Core membership business logic
- `membership-entitlement.service.ts` — Entitlement evaluation
- `membership-retention.service.ts` — Retention offer generation

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

## Admin Operations

- Admin tier change requires evidence: customerEmailDate, customerEmailContent, actionRequired, reason, csrFullName
- Admin cancel requires same evidence pattern
- All admin actions logged with `actorType: 'CSR'` and full evidence in metadata

## Black Tier

- Currently `comingSoon: true` in frontend config
- All backend logic handles Black tier (tag limit = 999)
- To enable: just set `comingSoon: false` in `TIER_CONFIG`

## Verification

- Run `pnpm typecheck` after changes
- Run `pnpm lint` after changes
- Test: Subscribe → Activate → View on manage page → Upgrade → Downgrade → Cancel
- Verify invoices created with INVM- prefix
- Verify notifications delivered
- Verify audit trail captures all events
