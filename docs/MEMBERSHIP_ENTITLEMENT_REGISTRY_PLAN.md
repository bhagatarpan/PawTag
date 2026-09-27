# Membership Entitlement Registry — Implementation Plan

**Branch:** `feature/membership-entitlement-registry`
**Date Started:** 2026-09-27
**Status:** IN PROGRESS

---

## Progress Tracker

| Phase | Description | Status | Date |
|-------|-------------|--------|------|
| 0 | Data Layer + Entitlement Service | ✅ COMPLETE | 2026-09-27 |
| 1 | Admin API + UI (Entitlements Table) | ✅ COMPLETE | 2026-09-27 |
| 2 | Checkout (Free Shipping for ALL tiers) | ✅ COMPLETE | 2026-09-27 |
| 3 | Points (Multiplier for ALL tiers) | ✅ COMPLETE | 2026-09-27 |
| 4 | Notifications (Channel Gating) | ✅ COMPLETE | 2026-09-27 |
| 5 | Remaining Services (Tag limits, PawRewards, etc.) | ✅ COMPLETE | 2026-09-27 |
| 6 | Frontend Cleanup (Remove hardcoded tier text) | ✅ COMPLETE | 2026-09-27 |
| 7 | Dead Code Removal + Documentation | ⬜ PENDING | |

---

## Architecture

### Data Model

**MembershipBenefit** (benefit definitions):
- `key` (string, unique) — slug identifier
- `name` (string) — display name
- `description` (string)
- `type` ('boolean' | 'number' | 'string')
- `category` (string) — 'shipping', 'notifications', 'loyalty', etc.
- `defaultValue` (any) — fallback
- `enabled` (boolean) — global on/off
- `displayOrder` (number)

**MembershipTierBenefit** (values per tier):
- `benefitKey` (string) — references MembershipBenefit.key
- `tier` ('gold' | 'platinum' | 'black')
- `enabled` (boolean) — tier-specific on/off
- `value` (any) — the actual value

### Entitlement Service API

```typescript
hasAccess(userId, benefitKey) → boolean
getValue<T>(userId, benefitKey) → T | null
getTierValue(tier, benefitKey) → value
getUserEntitlements(userId) → Record<key, {enabled, value}>
getTierEntitlements(tier) → Record<key, {enabled, value}>
getBenefitsMatrix() → { benefits, tiers, values }
invalidateCache() → void
```

### Seeded Benefits

| Key | Type | Category | Gold | Platinum | Black |
|-----|------|----------|------|----------|-------|
| free_shipping_threshold | number | shipping | 100 | 80 | 0 |
| points_multiplier | number | loyalty | 1 | 2 | 3 |
| in_app_notifications | boolean | notifications | false | true | true |
| email_notifications | boolean | notifications | true | true | true |
| accessory_discount | number | exclusive | 0 | 5 | 10 |
| emergency_contact | boolean | recovery | false | true | true |
| emergency_person_email | boolean | recovery | false | true | true |
| emergency_person_in_app | boolean | recovery | false | false | true |
| medical_alerts | boolean | health | true | true | true |
| pet_health_records | boolean | health | true | true | true |
| pet_recovery | boolean | recovery | true | true | true |
| black_friday_deal | boolean | exclusive | false | false | true |
| tag_limit | number | general | 3 | 10 | 999 |

---

## Files to Create

| File | Phase | Purpose |
|------|-------|---------|
| `packages/db/src/models/MembershipBenefit.ts` | 0 | Benefit definition schema |
| `packages/db/src/models/MembershipTierBenefit.ts` | 0 | Tier value schema |
| `packages/api/src/services/membership-entitlement.service.ts` | 0 | Central entitlement service |
| `packages/api/src/routes/admin-entitlements.ts` | 1 | Admin CRUD API |
| `apps/admin/src/pages/MembershipEntitlements.tsx` | 1 | Admin table UI |
| `scripts/migrate-entitlements.ts` | 0 | Seed from existing data |
| `tests/unit/membership-entitlement.test.ts` | 0 | Service tests |

## Files to Modify

| File | Phase | Change |
|------|-------|--------|
| `checkout.service.ts` | 2 | Replace Gold-only with entitlement lookup |
| `points-earning.service.ts` | 3 | Remove isGoldSubscription, use entitlements |
| `notification-delivery.service.ts` | 4 | Add entitlement channel check |
| `tag-status.service.ts` | 5 | Read tag limit from entitlements |
| `membership.service.ts` | 5 | Use entitlements for tag limit |
| `pawrewards.service.ts` | 5 | Read earning rates from entitlements |
| `customer-guardian.ts` | 5 | Remove old Subscription checks |
| `order-creation.service.ts` | 5 | Remove hardcoded multiplier |
| `apps/admin/src/App.tsx` | 1 | Add entitlements route |
| `apps/admin/src/components/Sidebar.tsx` | 1 | Add entitlements nav |
| `packages/api/src/index.ts` | 1 | Register new routes |
| `packages/db/src/index.ts` | 0 | Export new models |

---

## Decisions

- **Consolidate to UserMembership** — deprecate old Subscription for membership
- **Safety-critical notifications respect entitlements** — consistency over exceptions
- **Guardian tiers stay separate** — but points multiplier driven by paid membership tier from entitlement registry
- **Admin edits propagate immediately** — 60s cache, invalidated on write

---

## Verification Checklist

- [ ] All services use entitlement service (no hardcoded tier checks)
- [ ] Admin can add/edit/delete benefits via table UI
- [ ] Changing a threshold in admin immediately affects checkout
- [ ] Adding a new benefit (e.g., GPS tracking) needs zero code changes
- [ ] All three tiers get correct shipping behavior
- [ ] All three tiers get correct points multiplier
- [ ] Notification channel gating works per tier
- [ ] No `isGoldSubscription()` calls remain
- [ ] No `Subscription.findOne({ planType: 'gold' })` calls remain
- [ ] No hardcoded tier strings in service logic
- [ ] Build passes, tests pass
- [ ] Audit logging for admin benefit changes
