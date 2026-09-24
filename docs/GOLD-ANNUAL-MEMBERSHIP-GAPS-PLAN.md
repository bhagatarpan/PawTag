# Gold Membership & Annual Membership — Gap Fix Plan

**Created:** 2026-09-24
**Branch:** `feat/gold-annual-membership-gaps`
**Status:** In Progress

---

## Progress Tracker

| Packet | Description | Status | Completed |
|--------|-------------|--------|-----------|
| 1 | Gold Plan Change Backend | ✅ Complete | 2026-09-24 |
| 1B | Plan Change Email Template | ✅ Complete | 2026-09-24 |
| 2 | Fix Stripe Price Update on Plan Change | ✅ Complete | 2026-09-24 |
| 3 | Gold Creation Failure Handling | ✅ Complete | 2026-09-24 |
| 4 | Consistent Gold Detection | ✅ Complete | 2026-09-24 |
| 5 | Gold Landing Page + Checkout Upsell | ✅ Complete | 2026-09-24 |
| 6 | Subscription Detail UX Fixes | ✅ Complete | 2026-09-24 |
| 6B | Gold Cancellation Email Template | ✅ Complete | 2026-09-24 |
| 7 | Admin MRR + Gold SKU Cleanup | ✅ Complete | 2026-09-24 |
| 8 | Auto-Renew Resume Email | ✅ Complete | 2026-09-24 |
| 9 | Shared Enum Sync + In-App Notifications | ✅ Complete | 2026-09-24 |
| — | Update AGENTS.md, README.md, Design.md | ⬜ Pending | — |
| — | Extract Reusable Skills | ⬜ Pending | — |
| — | Verify Monitoring (Logs/Audit) | ⬜ Pending | — |

---

## Identified Gaps

### Backend Gaps
1. **Gold plan change not implemented** — Customers cannot switch Gold between monthly and annual billing
2. **Plan changes don't update Stripe price** — `changeSubscriptionPlan()` updates PawTag DB but not Stripe
3. **Gold creation silently falls back on Stripe failure** — In production, Gold could be free if Stripe fails
4. **Gold subscription has no `planId` link** — Falls back to hardcoded defaults
5. **No email for plan changes** — Customer gets no confirmation when switching billing cycle
6. **No Gold-specific cancellation email** — Generic email doesn't mention lost Gold benefits
7. **No email when auto-renew is resumed** — Pause sends email, resume doesn't
8. **Shared `NotificationType` enum is stale** — Missing 6 types from DB model

### Frontend Gaps
9. **Gold detection inconsistent across codebase** — 5+ different detection mechanisms
10. **Gold landing page missing annual pricing** — Only shows monthly price
11. **Checkout upsell only shows monthly price** — No annual option presented
12. **`Subscriptions.tsx` uses `alert()`/`prompt()`** — Not accessible, not styled
13. **Gold members see generic upgrade CTA** — Should be hidden for Gold
14. **No Gold-specific cancel flow** — No benefits-loss messaging
15. **Admin MRR calculation inaccurate** — Only uses monthly Gold price
16. **Gold SKU hard-coded** — `PT-GOLD-001` magic string in frontend
17. **No Gold subscription tests** — Gold flows untested

---

## Work Packet Details

### Packet 1: Gold Plan Change Backend

**Problem:** Customers cannot switch Gold between monthly and annual billing.

**Files to change:**
- `packages/api/src/services/subscription.service.ts` — Add `changeGoldPlan()` function
- `packages/api/src/routes/customer-subscriptions.ts` — Add `POST /gold/change-plan` route
- `packages/shared/src/api/endpoints.ts` — Add shared endpoint

**Business rules:**
- Only allowed on active Gold subscriptions (`planType === 'gold'`, `status === 'active'`)
- Read new price from CMS settings (`guardian.goldPrice` / `guardian.goldAnnualPrice`)
- If Stripe subscription exists: cancel old, create new with correct price/interval
- Update PawTag subscription: `planType`, `price`, `renewalMethod`
- Create invoice record for plan change
- Send plan-change confirmation email
- Full audit logging with before/after state

---

### Packet 1B: Plan Change Email Template

**Problem:** No email confirmation when plan changes.

**Files to create:**
- `packages/api/src/services/email/templates/subscription-plan-changed.ts`

**Files to change:**
- `packages/api/src/services/email/templates/index.ts` — Export
- `packages/api/src/services/subscription.service.ts` — Send email

**Template:** `renderSubscriptionPlanChangedEmail`
- Theme: `default` (teal)
- Shows old plan → new plan with pricing
- Next billing date
- CTA: "View Your Subscription"

---

### Packet 2: Fix Stripe Price Update on Plan Change

**Problem:** `changeSubscriptionPlan()` doesn't update Stripe subscription price.

**Files to change:**
- `packages/api/src/services/subscription.service.ts` — Update `changeSubscriptionPlan()`

**Implementation:**
- After saving PawTag subscription, if `stripeSubscriptionId` exists:
  - Look up/create new Stripe Price for new interval
  - Update Stripe subscription: `stripe.subscriptions.update()`
  - Cache new price ID in Settings
  - If Stripe fails, log error (don't rollback local change)

---

### Packet 3: Gold Creation Failure Handling

**Problem:** Gold creation silently falls back on Stripe failure.

**Files to change:**
- `packages/api/src/services/subscription.service.ts` — Fail explicitly in production
- `apps/web/src/pages/account/GoldUpgrade.tsx` — Show error
- `apps/web/src/components/OnboardingWizard.tsx` — Don't swallow errors
- `apps/web/src/pages/VerifyAccount.tsx` — Don't swallow errors

---

### Packet 4: Consistent Gold Detection

**Problem:** Gold detected via 5+ different mechanisms.

**Files to change:**
- `apps/web/src/pages/Cart.tsx` — Use tier API, not `rbacRoles`
- Audit all detection points

**Single source of truth:** Backend `/customer/guardian/tier` endpoint returns `isGoldMember`.

---

### Packet 5: Gold Landing Page + Checkout Upsell

**Problem:** Public `/gold` page and checkout only show monthly pricing.

**Files to change:**
- `apps/web/src/pages/GoldLanding.tsx` — Add annual pricing
- `apps/web/src/pages/Checkout.tsx` — Show annual option

---

### Packet 6: Subscription Detail UX Fixes

**Problem:** `alert()`/`prompt()` usage, wrong upgrade CTA for Gold.

**Files to change:**
- `apps/web/src/pages/account/Subscriptions.tsx` — Multiple UX fixes

**Fixes:**
- Replace `alert()`/`prompt()` with proper React modals
- Hide upgrade CTA for Gold members
- Add Gold plan change button
- Gold-specific cancel flow

---

### Packet 6B: Gold Cancellation Email Template

**Problem:** Gold cancellation uses generic email without benefits list.

**Files to create:**
- `packages/api/src/services/email/templates/gold-cancellation.ts`

**Files to change:**
- `packages/api/src/services/email/templates/index.ts` — Export
- `packages/api/src/services/subscription.service.ts` — Use Gold-specific template

**Template:** `renderGoldCancellationEmail`
- Theme: `warning` (amber)
- Lists lost benefits (2x points, free shipping, priority support, etc.)
- CTA: "Resubscribe to Gold"

---

### Packet 7: Admin MRR + Gold SKU Cleanup

**Problem:** MRR calculation inaccurate; Gold SKU hard-coded.

**Files to change:**
- `apps/admin/src/pages/GuardianAnalytics.tsx` — Fix MRR
- `apps/web/src/pages/account/SubscriptionUpgrade.tsx` — Remove hard-coded SKU
- `packages/api/src/services/subscription.service.ts` — Link Gold to `planId`

---

### Packet 8: Auto-Renew Resume Email

**Problem:** Resume after pause sends no email.

**Files to create:**
- `packages/api/src/services/email/templates/subscription-resumed.ts`

**Files to change:**
- `packages/api/src/services/email/templates/index.ts` — Export
- `packages/api/src/routes/customer-subscriptions.ts` — Send email on resume
- `packages/api/src/routes/admin-subscriptions.ts` — Send email on admin resume

**Template:** `renderSubscriptionResumedEmail`
- Theme: `success` (green)
- Next billing date
- CTA: "View Your Subscription"

---

### Packet 9: Shared Enum Sync + In-App Notifications

**Problem:** Shared enum stale; missing in-app notifications.

**Files to change:**
- `packages/shared/src/index.ts` — Add missing notification types
- `packages/api/src/services/subscription.service.ts` — Add in-app notification for Gold creation

**Missing types:** `SUBSCRIPTION_AUTO_RENEW_PAUSED`, `NEW_ORDER`, `ONBOARDING_REMINDER`, `REFUND_FAILED`, `EMERGENCY_CONTACT_ESCALATION`, `ORDER`

---

## Design Tokens Reference

Per `docs/DESIGN.md`:
- Gold badge: `bg-yellow-100 text-yellow-700`
- Gold gradient: `from-amber-500 to-orange-500`
- Primary button: `bg-primary-600 text-white rounded-xl font-semibold px-6 py-3`
- Secondary button: `border border-primary-600 text-primary-600 rounded-xl`
- Cards: `bg-white rounded-2xl shadow-sm border border-gray-100 p-6`
- Warning alert: `bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 p-4`
- Email themes: `default` (teal), `warning` (amber), `danger` (red), `success` (green)

---

## Verification Checklist

After all packets:
- [ ] Gold members can switch between monthly and annual billing
- [ ] Stripe price updates correctly on all plan changes
- [ ] Gold creation fails explicitly in production (no silent fallback)
- [ ] Gold detection is consistent across all pages
- [ ] Gold landing page shows annual pricing
- [ ] Checkout shows annual Gold option
- [ ] No `alert()` or `prompt()` dialogs in subscription flow
- [ ] Gold members don't see generic upgrade CTA
- [ ] Admin MRR accounts for annual subscribers
- [ ] Gold SKU is not hard-coded
- [ ] Plan change sends confirmation email
- [ ] Gold cancellation sends benefits-specific email
- [ ] Auto-renew resume sends confirmation email
- [ ] Shared NotificationType enum matches DB model
- [ ] All changes have tests
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] Audit logging covers all new operations
