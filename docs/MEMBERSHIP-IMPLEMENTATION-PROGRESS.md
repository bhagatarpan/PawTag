# Membership System Implementation — Progress Tracker

**Branch:** `feat/membership-system`
**Started:** 2026-09-24
**Plan:** `docs/MEMBERSHIP-SYSTEM-REDESIGN-PLAN.md`

---

## Phase 1: Foundation (Database Models)

| # | Packet | Status | Files | Notes |
|---|--------|--------|-------|-------|
| 1.1 | MembershipTier model | ⬜ Pending | `packages/db/src/models/MembershipTier.ts` | |
| 1.2 | UserMembership model | ⬜ Pending | `packages/db/src/models/UserMembership.ts` | |
| 1.3 | Update User model | ⬜ Pending | `packages/db/src/models/User.ts` | |
| 1.4 | Update Product model | ⬜ Pending | `packages/db/src/models/Product.ts` | |
| 1.5 | Seed membership tiers | ⬜ Pending | `packages/api/src/seeds/seed-memberships.ts` | |
| 1.6 | Remove existing Gold subscribers | ⬜ Pending | Script | |

## Phase 2: Backend Services

| # | Packet | Status | Files | Notes |
|---|--------|--------|-------|-------|
| 2.1 | Membership service | ⬜ Pending | `packages/api/src/services/membership.service.ts` | |
| 2.2 | Membership routes (customer) | ⬜ Pending | `packages/api/src/routes/membership.ts` | |
| 2.3 | Membership routes (public) | ⬜ Pending | `packages/api/src/routes/membership-public.ts` | |
| 2.4 | Membership routes (admin) | ⬜ Pending | `packages/api/src/routes/admin-membership.ts` | |
| 2.5 | Stripe integration | ⬜ Pending | Update `stripe.service.ts` | |
| 2.6 | Tag lifecycle update | ⬜ Pending | Update `finder.ts`, `customer.ts` | |
| 2.7 | Membership benefits middleware | ⬜ Pending | `packages/api/src/middleware/membership-benefits.ts` | |
| 2.8 | Emergency escalation update | ⬜ Pending | Update `escalation.service.ts` | |
| 2.9 | Background jobs | ⬜ Pending | 6 new jobs | |

## Phase 3: Email Templates

| # | Packet | Status | Files | Notes |
|---|--------|--------|-------|-------|
| 3.1 | Membership email templates | ⬜ Pending | 19 new templates | |
| 3.2 | Tag warranty email templates | ⬜ Pending | 5 new templates | |
| 3.3 | Emergency escalation templates | ⬜ Pending | 3 new templates | |
| 3.4 | Update existing templates | ⬜ Pending | Update tier/multiplier refs | |

## Phase 4: Frontend — Customer

| # | Packet | Status | Files | Notes |
|---|--------|--------|-------|-------|
| 4.1 | Membership landing page | ⬜ Pending | `apps/web/src/pages/Membership.tsx` | |
| 4.2 | Membership subscribe flow | ⬜ Pending | `apps/web/src/pages/account/MembershipSubscribe.tsx` | |
| 4.3 | Membership management | ⬜ Pending | `apps/web/src/pages/account/MembershipManage.tsx` | |
| 4.4 | Payment method management | ⬜ Pending | `apps/web/src/components/PaymentMethodManager.tsx` | |
| 4.5 | Update routing | ⬜ Pending | `apps/web/src/App.tsx` | |
| 4.6 | Update account sidebar | ⬜ Pending | `apps/web/src/components/AccountLayout.tsx` | |
| 4.7 | Simplify product pages | ⬜ Pending | Update product detail, cart, checkout | |

## Phase 5: Frontend — Admin

| # | Packet | Status | Files | Notes |
|---|--------|--------|-------|-------|
| 5.1 | Membership tier config | ⬜ Pending | `apps/admin/src/pages/MembershipTiers.tsx` | |
| 5.2 | Subscriber management | ⬜ Pending | `apps/admin/src/pages/MembershipSubscribers.tsx` | |
| 5.3 | Membership dashboard | ⬜ Pending | `apps/admin/src/pages/MembershipDashboard.tsx` | |
| 5.4 | Admin extension dialog | ⬜ Pending | `apps/admin/src/components/MembershipExtendDialog.tsx` | |

## Phase 6: Cleanup

| # | Packet | Status | Files | Notes |
|---|--------|--------|-------|-------|
| 6.1 | Remove Gold code | ⬜ Pending | Multiple files | |
| 6.2 | Remove subscription from products | ⬜ Pending | `checkout.service.ts`, `order-creation.service.ts` | |
| 6.3 | Remove old subscription lifecycle | ⬜ Pending | `subscription.service.ts` | |
| 6.4 | Update tests | ⬜ Pending | New + updated tests | |
| 6.5 | Update documentation | ⬜ Pending | README, AGENTS, DESIGN | |

## Additional Tasks

| Task | Status | Notes |
|------|--------|-------|
| Extract reusable skills | ⬜ Pending | membership-system, membership-ui-ux, tag-warranty |
| Update AGENTS.md | ⬜ Pending | |
| Update README.md | ⬜ Pending | |
| Update Design.md | ⬜ Pending | |
| Verify monitoring | ⬜ Pending | |
