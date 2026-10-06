---
name: membership-tier-change
description: Implement or review PawTag membership tier changes, upgrade-while-cancelling (Option A), Stripe Billing Portal cancel/resume sync, gold tag billing interval changes, and typed membership error codes. Use when touching change-tier, estimate, cancel-state sync, or gold plan billing.
---

# Membership Tier Change & Cancel Sync

Follow `AGENTS.md` first. Specialist rules live here so they stay reusable.

## Shared contracts (single source of truth)

`packages/shared/src/membership.ts`:

- `MEMBERSHIP_TIER_CHANGE_CODES` + `MEMBERSHIP_TIER_CHANGE_HTTP_STATUS`
- `TierChangeEstimate` (includes `isCancelling`, `willResumeOnUpgrade`)
- `MembershipChangeErrorBody`
- `resolveStripeCancelSyncAction` — one cancel-state rule for membership + tag subs
- Gold billing setting keys + `goldStripePriceSettingKey(interval)`

API and web **must** import these. Do not re-declare parallel types/codes in pages.

## Option A — upgrade while cancelling

When `UserMembership.cancelledAt` is set and customer confirms immediate upgrade:

1. Estimate returns `willResumeOnUpgrade: true`
2. Stripe: price update + `cancel_at_period_end: false` + `create_prorations`
3. Local after Stripe success only: clear cancel fields, `autoRenew=true`, new tier
4. Stripe fail → cancel state + old tier unchanged
5. Stripe mode rejects missing/`demo` subscription IDs (`membership.subscription_missing`)
6. Audit: `membership_tier_changed_resumed`

**Customer UI while cancelling:** Prefer **Keep my Membership** (`keepMyMembership`) over upgrade cards. Hide tier grid on Subscribe when `isCancelling` or benefits ended. Upgrade-while-cancelling remains for API/admin; customer path is Keep.

## Repair upgrade (active membership + dead Stripe sub)

- Endpoint: `POST /membership/change-tier/repair` `{ tierId }`
- When: local membership `active` but Stripe sub missing/ended (`subscription_not_active` / `subscription_missing`)
- Charge: **full target-tier price** from `MembershipTier` — no proration on dead sub
- Stripe: create new subscription `default_incomplete`; return `clientSecret`
- Local benefits stay active until payment; `pendingTierId` marks repair
- On activate/`invoice.payment_succeeded`: `completeRepairUpgrade` updates same membership `_id`, new period from payment
- UI: not “subscribe again” marketing loop — repair CTA + StripeElements

## Keep my Membership

- Endpoint: `POST /membership/keep`
- Shared outcomes: `KEEP_MEMBERSHIP_OUTCOMES` (`resumed` | `payment_required`)
- Path A (in period): resume, no charge, original dates
- Path B (period ended): paid rejoin via `subscribeToTier` + payment
- Component: `apps/web/src/components/KeepMembershipPanel.tsx`

## Stripe Billing Portal cancel/resume

Route `stripe-webhooks.ts` must stay thin:

```text
handleSubscriptionUpdated
  → billing-cancel-sync.service
  → shared resolveStripeCancelSyncAction
  → apply to UserMembership / Subscription
```

Actions: `none | cancel | resume | expire`.

## Gold tag subscription billing interval

- Endpoint: `POST /customer/subscriptions/:id/change-plan`
- Gold path: `changeGoldPlan` — **`planType` stays `'gold'`**
- Prices from CMS via `gold-billing.service` (no magic fallbacks in Stripe mode)
- Stripe price cache key: `gold.stripePriceId.{monthly|annual}`
- Fail closed if Stripe update fails or CMS gold price missing

Do **not** send gold billing changes to `/membership/change-tier`.

## Stripe error classification

Use `packages/api/src/services/stripe/stripe-subscription-errors.ts`:

- `classifyStripeSubscriptionFailure` / `logStripeSubscriptionFailure`
- `isInvalidStripeSubscriptionId`
- `stripeSubscriptionEnded`
- `firstSubscriptionItemId`

Map kinds to membership codes; do not invent per-service message tables.

## Layering

```text
route → membership.service / subscription.service / billing-cancel-sync.service → models
```

Webhook routes orchestrate only. Domain cancel/tier rules live in services + shared resolver.

## Audit context

Use `systemAuditContext` / `stripeWebhookAuditContext` from `packages/api/src/lib/app-meta.ts`.
Do not hardcode `applicationVersion: '1.0.0'` in handlers.

## Verification

- Unit: `resolveStripeCancelSyncAction` cases (cancel/resume/expire/none)
- Integration: Option A upgrade, webhook portal cancel/resume, gold planType preserved
- `pnpm --filter @pawtag/api typecheck`
- Targeted: `membership-upgrade`, `membership-webhook-cancel-sync`, `membership-cancel-resume`
