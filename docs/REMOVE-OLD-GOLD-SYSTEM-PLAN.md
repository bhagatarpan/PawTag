# Remove Old Gold System + Build Admin Membership Management

**Created:** 2026-09-25
**Branch:** `feat/remove-old-gold-system`
**Status:** In Progress

---

## Progress Tracker

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1 | Delete old Gold files | ✅ Complete | 6 files deleted |
| 2 | Remove old Gold API routes | ✅ Complete | 3 routes removed, 1 updated |
| 3 | Remove old Gold service functions | ✅ Complete | 2 functions removed, 1 updated |
| 4 | Remove old Gold CMS settings + seeds | ⬜ Pending | 17 settings + 2 seeds |
| 5 | Update shared endpoints + enums | ⬜ Pending | 5 items |
| 6 | Update isGoldMember in API | ⬜ Pending | 10 files |
| 7 | Update isGoldMember in frontend | ⬜ Pending | 19 components |
| 8 | Update admin portal | ⬜ Pending | 6 components |
| 9 | Build admin membership pages | ⬜ Pending | 3 new pages + routes + sidebar |

---

## Phase 1: Delete Old Gold Files

| # | File | Action |
|---|------|--------|
| 1 | `apps/web/src/pages/GoldLanding.tsx` | DELETE |
| 2 | `apps/web/src/pages/account/GoldUpgrade.tsx` | DELETE |
| 3 | `apps/web/src/pages/account/GoldBenefits.tsx` | DELETE |
| 4 | `packages/api/src/middleware/gold-benefits.ts` | DELETE |
| 5 | `packages/api/src/services/email/templates/gold-welcome.ts` | DELETE |
| 6 | `packages/api/src/services/email/templates/gold-cancellation.ts` | DELETE |

---

## Phase 2: Remove Old Gold API Routes

| # | Route | File | Action |
|---|-------|------|--------|
| 1 | `POST /customer/subscriptions/gold/subscribe` | `customer-subscriptions.ts` | Remove |
| 2 | `POST /customer/subscriptions/gold/change-plan` | `customer-subscriptions.ts` | Remove |
| 3 | `POST /admin/subscriptions/gold/subscribe` | `admin-subscriptions.ts` | Remove |
| 4 | `GET /public/points/gold-content` | `points-estimate.ts` | Remove |
| 5 | Update `/benefits` | `customer-guardian.ts` | Rewrite |

---

## Phase 3: Remove Old Gold Service Functions

| # | Function | File | Action |
|---|----------|------|--------|
| 1 | `createGoldSubscription()` | `subscription.service.ts` | Remove |
| 2 | `changeGoldPlan()` | `subscription.service.ts` | Remove |
| 3 | `sendGoldWelcomeEmail()` | `subscription.service.ts` | Remove |
| 4 | `isGoldSubscription()` | `points-earning.service.ts` | Replace |
| 5 | `getGoldPrice()` | `points-earning.service.ts` | Remove |
| 6 | Gold constants | `points-earning.service.ts` | Remove |

---

## Phase 4: Remove Old Gold CMS Settings + Seeds

| # | Item | File | Action |
|---|------|------|--------|
| 1 | 17 Gold CMS settings | `seed-cms.ts` | Remove |
| 2 | Gold Membership product | `seed-products.ts` | Remove |
| 3 | Gold hero slides | `seed-cms.ts` | Remove |
| 4 | Gold marketing defaults | `guardian-config.ts` | Remove |
| 5 | Gold validation | `validation/loyalty.ts` | Remove |

---

## Phase 5: Update Shared Endpoints + Enums

| # | Item | File | Action |
|---|------|------|--------|
| 1 | `SubscriptionPlanType.GOLD` | `shared/src/index.ts` | Remove |
| 2 | `goldSubscribe` endpoints | `shared/src/api/endpoints.ts` | Remove |
| 3 | `goldContent` endpoint | `shared/src/api/endpoints.ts` | Remove |

---

## Phase 6: Update isGoldMember in API (10 files)

Replace old `isGoldSubscription()` / `Subscription.planType === 'gold'` checks with new `UserMembership` model queries.

---

## Phase 7: Update isGoldMember in Frontend (19 components)

Replace old Gold references with new membership tier system.

---

## Phase 8: Update Admin Portal (6 components)

Remove old Gold settings, update Gold member counts, update analytics.

---

## Phase 9: Build Admin Membership Pages

| # | Page | Route | Purpose |
|---|------|-------|---------|
| 1 | `MembershipTiers.tsx` | `/membership/tiers` | Edit tier config |
| 2 | `MembershipSubscribers.tsx` | `/membership/subscribers` | List members |
| 3 | `MembershipSubscriberDetail.tsx` | `/membership/subscribers/:id` | View member |

Plus: Register routes, add sidebar entry, wire MembershipDashboard.
