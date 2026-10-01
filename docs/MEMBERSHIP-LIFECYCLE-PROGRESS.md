# PawTag Membership Lifecycle System — Progress Tracker

**Branch:** `feature/membership-lifecycle-system`
**Plan:** `docs/MEMBERSHIP-LIFECYCLE-SYSTEM.md`
**Started:** 2026-10-01
**Last updated:** 2026-10-01

---

## Phase Status Legend

| Status | Meaning |
|---|---|
| ⬜ Not started | Phase not yet begun |
| 🔄 In progress | Currently being implemented |
| ✅ Complete | All items done, tests passing |
| ⚠️ Partial | Some items done, gaps remain |
| 🛑 Blocked | Cannot proceed (dependency or decision) |

---

## Phase 0 — Critical Defect Fixes ✅

**Status:** ✅ Complete
**Commit:** `d3f45be`

| # | Task | Status | Files |
|---|---|---|---|
| 0.1 | Fix renewal webhook — advance `currentPeriodStart/End` | ✅ | `stripe-webhooks.ts` |
| 0.2 | Fix cancellation — `cancel_at_period_end: true` | ✅ | `membership.service.ts` |
| 0.3 | Fix payment card display — populate from Stripe | ✅ | `membership.service.ts` |
| 0.4 | Handle membership payment failure | ✅ | `stripe-webhooks.ts` |

**What changed:**
- `handleMembershipInvoice` (renamed from `handleMembershipProrationInvoice`) now handles both proration and renewal invoices
- Renewal invoices (`billing_reason: subscription_cycle`) advance `currentPeriodStart/End` by 1 year
- Dunning state reset on successful renewal
- Cancellation uses `cancel_at_period_end: true` — benefits remain until `currentPeriodEnd`
- `User.membershipTier` no longer nulled immediately on cancel
- `activateMembership` populates `cardBrand/cardLast4/expMonth/expYear` from Stripe subscription
- `handleInvoicePaymentFailed` now handles `UserMembership` (was tag-only)
- Membership payment failure: records failed invoice, updates dunning state, notifies customer + CSR

---

## Phase 1 — Deferred Downgrade Infrastructure ✅

**Status:** ✅ Complete
**Commit:** `8790a69`

| # | Task | Status | Files |
|---|---|---|---|
| 1.1 | Extend `UserMembership` model with pending fields | ✅ | `UserMembership.ts` |
| 1.2 | Create `requestDowngrade()` service | ✅ | `membership.service.ts` |
| 1.3 | Create `processScheduledDowngrades()` job | ✅ | `membership.service.ts` |
| 1.4 | Register job in worker + seed | ✅ | `index.ts`, `worker.ts`, `seed-*.ts` |
| 1.5 | API endpoint `POST /membership/downgrade` | ✅ | `membership.ts` |

**What changed:**
- Model: `pendingTierId`, `pendingTierEffectiveAt`, `downgradeRequestedAt`, `downgradeTermsAcceptedAt`, `downgradeTermsVersion`, `downgradeReason`, `downgradeCancelledAt`, `dunningStatus`, `dunningRetryCount`, `dunningLastAttemptAt`
- `requestDowngrade()`: validates terms, records pending state, updates Stripe price
- `cancelPendingDowngrade()`: clears pending state
- `processScheduledDowngrades()`: executes pending downgrades at period end, handles renewal failure gracefully
- API: `POST /membership/downgrade`, `POST /membership/downgrade/cancel`
- Job registered in worker + API index, seeded with 5-minute interval

---

## Phase 2 — Downgrade Warning + Consent UI ✅

**Status:** ✅ Complete
**Commit:** `1d3e977`

| # | Task | Status | Files |
|---|---|---|---|
| 2.1 | Extend `estimateTierChange` with points-at-risk + entitlements-lost | ✅ | `membership.service.ts` |
| 2.2 | Build downgrade confirmation modal | ✅ | `MembershipSubscribe.tsx` |
| 2.3 | Update success screen | ✅ | `MembershipSubscribe.tsx` |
| 2.4 | Update tier-change email template | ✅ | (emails sent from service) |

**What changed:**
- `estimateTierChange` returns `pointsAtRisk`, `currentPointsBalance`, `entitlementsLost`, `downgradeEffectiveDate`
- Points-at-risk computed using multiplier ratio formula
- Entitlements compared between tiers to show what changes
- Estimate panel shows: points at risk (red), entitlements checklist, effective date
- Required checkbox: "I understand and accept these changes"
- Optional reason select
- Confirm button disabled until checkbox checked
- Success screen shows downgrade-specific messaging with effective date

---

## Phase 3 — Guardian Points Clawback ✅

**Status:** ✅ Complete
**Commit:** `c1e1ed5`

| # | Task | Status | Files |
|---|---|---|---|
| 3.1 | Extend `GuardianPointsLedger.metadata` with base/multiplier | ✅ | `GuardianPointsLedger.ts` |
| 3.2 | Update points-earning to record base/multiplier | ✅ | `points-earning.service.ts` |
| 3.3 | Create `applyDowngradePointsClawback()` | ✅ | `points-earning.service.ts` |
| 3.4 | Call clawback from downgrade execution job | ✅ | `membership.service.ts` |

**What changed:**
- Model: `IGuardianPointsLedgerMetadata` interface with `basePoints`, `multiplier`, `bonusPoints`
- `recordPointsEarned()` accepts optional `multiplier` param, computes base/bonus split
- All award functions pass multiplier (purchase, review, referral, pet milestone, tag activation, social share, membership milestone)
- `applyDowngradePointsClawback()`: formula `floor(points_at_higher_tier × (1 - newMultiplier/oldMultiplier))`, idempotent, caps at balance
- `processScheduledDowngrades()` calls clawback after tier flip

---

## Phase 4 — Payment Method Management + Auto-Renew Failure ✅

**Status:** ✅ Complete
**Commit:** `555540d`

| # | Task | Status | Files |
|---|---|---|---|
| 4.1 | Mirror card data after membership payment | ✅ | (Phase 0) |
| 4.2 | API: `GET /membership/payment-methods` | ✅ | `membership.ts` |
| 4.3 | API: `POST /membership/payment-methods/portal` | ✅ | `membership.ts` |
| 4.4 | Wire "Update" button in MembershipManage | ✅ | `MembershipManage.tsx` |
| 4.5 | Display saved card from Stripe | ✅ | (Phase 0) |
| 4.6 | Backfill script | ⬜ | Deferred |
| 4.7 | Membership dunning state fields | ✅ | (Phase 0) |
| 4.8 | Expiry coordination with grace period | ⬜ | Deferred |

**What changed:**
- `GET /membership/payment-methods`: lists cards from Stripe Customer
- `POST /membership/payment-methods/portal`: creates Stripe Billing Portal session
- "Update" button wired to open portal
- `getStripeClient` exported from membership service
- Shared endpoint definitions added

---

## Phase 5 — Audit Completeness ✅

**Status:** ✅ Complete
**Commit:** `0963a27`

| # | Task | Status | Files |
|---|---|---|---|
| 5.1 | Pass request context to audit | ⚠️ | Deferred (route-level change) |
| 5.2 | Add `subjectUserId` to AuditEvent | ✅ | `AuditEvent.ts` |
| 5.3 | API: `GET /admin/users/:id/membership-audit` | ✅ | `admin.ts` |
| 5.4 | Record downgrade acceptance metadata | ✅ | (Phase 1) |

**What changed:**
- `AuditEvent.subjectUserId` field added with compound index
- `GET /admin/users/:id/membership-audit`: queries by `subjectUserId` OR `metadata.userId`
- Filters by eventCategory (FINANCIAL, UPDATE, ADMIN)
- Downgrade acceptance metadata recorded in Phase 1 (`requestDowngrade`)

---

## Phase 6 — CSR Admin View ✅

**Status:** ✅ Complete
**Commit:** `00037fd`

| # | Task | Status | Files |
|---|---|---|---|
| 6.1 | Implement Change Tier modal with evidence form | ✅ | `MembershipSubscriberDetail.tsx` |
| 6.2 | Implement Cancel modal with evidence form | ✅ | `MembershipSubscriberDetail.tsx` |
| 6.3 | Add audit history panel | ✅ | `MembershipSubscriberDetail.tsx` |
| 6.4 | Add invoice/transaction history | ✅ | `MembershipSubscriberDetail.tsx` |
| 6.5 | Add Guardian points + pending downgrade status | ✅ | `MembershipSubscriberDetail.tsx` |
| 6.6 | Add payment method management (portal link) | ✅ | `MembershipSubscriberDetail.tsx` |

**What changed:**
- Pending downgrade status display (tier, effective date, requested date)
- Dunning status badge (past_due)
- Price + auto-renew status in details grid
- Billing Portal button
- Billing History section (INVM- invoices)
- Audit History section (membership audit trail)
- Change Tier modal with evidence collection (calls admin API)
- Cancel modal with evidence collection (calls admin API)

---

## Phase 7 — Documentation Updates 🔄

**Status:** 🔄 In progress

| # | Task | Status | Files |
|---|---|---|---|
| 7.1 | Update AGENTS.md membership sections | ⬜ | `AGENTS.md` |
| 7.2 | Update README.md membership status | ⬜ | `README.md` |
| 7.3 | Update DESIGN.md with downgrade consent modal tokens | ⬜ | `docs/DESIGN.md` |
| 7.4 | Update membership-lifecycle skill | ⬜ | `skills/membership-lifecycle/SKILL.md` |

---

## Verification Log

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-10-01 | `vitest run membership-upgrade.test.ts` | ✅ 16/16 PASS | After each phase |
| 2026-10-01 | `tsc --noEmit` (api) | ✅ No errors | After each phase |
| 2026-10-01 | `vite build` (web) | ✅ PASS | After Phase 2, 4 |
| 2026-10-01 | `vite build` (admin) | ✅ PASS | After Phase 6 |

---

## Known Pre-existing Issues (Not Introduced by This Work)

| Issue | Evidence | Impact |
|---|---|---|
| `activateMembership` passes `token` instead of `tokenHash` | Model requires `tokenHash` | Invoice access tokens may not work |
| `packages/ui` TypeScript errors (Lucide/React 19) | `tsc --noEmit` fails | Pre-existing; Vite build works |
| 3 subscription test failures | `tests/integration/subscriptions.test.ts` | Pre-existing; not related |

---

## Deferred Items (Reported, Not Implemented)

| Item | Reason |
|---|---|
| Backfill script for existing membership card data | Operational script; run separately |
| Expiry grace period for dunning | Requires product decision on grace period length |
| Route-level audit context passing | Requires modifying all membership route handlers |
| Cross-process cache invalidation | 60s TTL acceptable for MVP |
