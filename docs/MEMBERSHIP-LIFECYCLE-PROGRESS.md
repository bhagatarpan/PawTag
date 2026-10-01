# PawTag Membership Lifecycle System — Progress Tracker

**Branch:** `feature/membership-lifecycle-system`
**Plan:** `docs/MEMBERSHIP-LIFECYCLE-SYSTEM.md`
**Started:** 2026-10-01

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

## Phase 0 — Critical Defect Fixes

**Status:** ⬜ Not started
**Goal:** Fix defects that cause customer harm.

| # | Task | Status | Files | Tests |
|---|---|---|---|---|
| 0.1 | Fix renewal webhook — advance `currentPeriodStart/End` | ⬜ | `stripe-webhooks.ts` | ⬜ |
| 0.2 | Fix cancellation — `cancel_at_period_end: true` | ⬜ | `membership.service.ts` | ⬜ |
| 0.3 | Fix payment card display — populate from Stripe | ⬜ | `membership.service.ts` | ⬜ |
| 0.4 | Handle membership payment failure | ⬜ | `stripe-webhooks.ts` | ⬜ |

**Acceptance criteria:**
- [ ] Renewal webhook extends period by 1 year, idempotent by `stripeInvoiceId`
- [ ] Cancellation uses `cancel_at_period_end`, DB tier stays active until `currentPeriodEnd`
- [ ] `UserMembership.cardBrand/cardLast4` populated after payment
- [ ] `invoice.payment_failed` for memberships creates record + notifies customer

---

## Phase 1 — Deferred Downgrade Infrastructure

**Status:** ⬜ Not started
**Goal:** Build data model and service logic for deferred downgrades.

| # | Task | Status | Files | Tests |
|---|---|---|---|---|
| 1.1 | Extend `UserMembership` model with pending fields | ⬜ | `UserMembership.ts` | ⬜ |
| 1.2 | Create `requestDowngrade()` service | ⬜ | `membership.service.ts` | ⬜ |
| 1.3 | Create `processScheduledDowngrades()` job | ⬜ | new job | ⬜ |
| 1.4 | Register job in worker + seed | ⬜ | `worker.ts`, `seed-*.ts` | ⬜ |
| 1.5 | API endpoint `POST /membership/downgrade` | ⬜ | `membership.ts` | ⬜ |

**Acceptance criteria:**
- [ ] `pendingTierId`, `pendingTierEffectiveAt`, `downgradeTermsAcceptedAt` fields exist
- [ ] `requestDowngrade()` records pending state without changing current tier
- [ ] Job flips tier at `currentPeriodEnd`, applies points clawback
- [ ] Job handles renewal failure gracefully (keeps current tier)
- [ ] API validates `termsAccepted: true`

---

## Phase 2 — Downgrade Warning + Consent UI

**Status:** ⬜ Not started
**Goal:** Customer sees exact consequences before confirming downgrade.

| # | Task | Status | Files | Tests |
|---|---|---|---|---|
| 2.1 | Extend `estimateTierChange` with points-at-risk + entitlements-lost | ⬜ | `membership.service.ts` | ⬜ |
| 2.2 | Build downgrade confirmation modal | ⬜ | `MembershipSubscribe.tsx` | ⬜ |
| 2.3 | Update success screen | ⬜ | `MembershipSubscribe.tsx` | ⬜ |
| 2.4 | Update tier-change email template | ⬜ | `membership-tier-changed.ts` | ⬜ |

**Acceptance criteria:**
- [ ] Estimate returns `pointsAtRisk`, `entitlementsLost`, `creditAmount`, `downgradeEffectiveDate`
- [ ] Modal shows points lost, entitlements checklist, requires checkbox
- [ ] Success screen shows effective date and summary
- [ ] Email mentions downgrade timing and points impact

---

## Phase 3 — Guardian Points Clawback

**Status:** ⬜ Not started
**Goal:** Implement points-based clawback on downgrade execution.

| # | Task | Status | Files | Tests |
|---|---|---|---|---|
| 3.1 | Extend `GuardianPointsLedger.metadata` with base/multiplier | ⬜ | `GuardianPointsLedger.ts` | ⬜ |
| 3.2 | Update points-earning to record base/multiplier | ⬜ | `points-earning.service.ts` | ⬜ |
| 3.3 | Create `applyDowngradePointsClawback()` | ⬜ | service | ⬜ |
| 3.4 | Call clawback from downgrade execution job | ⬜ | job | ⬜ |

**Acceptance criteria:**
- [ ] New ledger entries include `basePoints`, `multiplier`, `bonusPoints`
- [ ] Clawback formula: `floor(points_at_higher_tier × (1 - newMultiplier/oldMultiplier))`
- [ ] Idempotent (won't double-clawback)
- [ ] Ledger entry with reason `membership_downgrade_clawback`

---

## Phase 4 — Payment Method Management + Auto-Renew Failure

**Status:** ⬜ Not started
**Goal:** Customer can manage cards. Auto-renew failures handled gracefully.

| # | Task | Status | Files | Tests |
|---|---|---|---|---|
| 4.1 | Mirror card data after membership payment | ⬜ | `membership.service.ts` | ⬜ |
| 4.2 | API: `GET /membership/payment-methods` | ⬜ | `membership.ts` | ⬜ |
| 4.3 | API: `POST /membership/payment-methods/portal` | ⬜ | `membership.ts` | ⬜ |
| 4.4 | Wire "Update" button in MembershipManage | ⬜ | `MembershipSubscribe.tsx` | ⬜ |
| 4.5 | Display saved card from Stripe | ⬜ | `MembershipSubscribe.tsx` | ⬜ |
| 4.6 | Backfill script for existing memberships | ⬜ | `scripts/` | ⬜ |
| 4.7 | Membership dunning state fields | ⬜ | `UserMembership.ts` | ⬜ |
| 4.8 | Expiry coordination with dunning grace period | ⬜ | `membership.service.ts` | ⬜ |

**Acceptance criteria:**
- [ ] Card data populated after payment
- [ ] Portal endpoint returns Stripe Billing Portal URL
- [ ] "Update" button opens portal
- [ ] Dunning state transitions: active → past_due → expired
- [ ] Expiry respects grace period (default 14 days)

---

## Phase 5 — Audit Completeness

**Status:** ⬜ Not started
**Goal:** Every membership action fully audited and CSR-visible.

| # | Task | Status | Files | Tests |
|---|---|---|---|---|
| 5.1 | Pass request context to audit | ⬜ | routes + service | ⬜ |
| 5.2 | Add `subjectUserId` to AuditEvent | ⬜ | `AuditEvent.ts` | ⬜ |
| 5.3 | API: `GET /admin/users/:id/membership-audit` | ⬜ | admin route | ⬜ |
| 5.4 | Record downgrade acceptance metadata | ⬜ | `membership.service.ts` | ⬜ |

**Acceptance criteria:**
- [ ] Audit events include real IP/user-agent
- [ ] `subjectUserId` field exists and is indexed
- [ ] Customer-scoped audit query works
- [ ] Downgrade acceptance recorded with terms version

---

## Phase 6 — CSR Admin View

**Status:** ⬜ Not started
**Goal:** CSR can see full membership history and perform actions.

| # | Task | Status | Files | Tests |
|---|---|---|---|---|
| 6.1 | Implement Change Tier modal with evidence form | ⬜ | `MembershipSubscriberDetail.tsx` | ⬜ |
| 6.2 | Implement Cancel modal with evidence form | ⬜ | `MembershipSubscriberDetail.tsx` | ⬜ |
| 6.3 | Add audit history panel | ⬜ | `MembershipSubscriberDetail.tsx` | ⬜ |
| 6.4 | Add invoice/transaction history | ⬜ | `MembershipSubscriberDetail.tsx` | ⬜ |
| 6.5 | Add Guardian points + pending downgrade status | ⬜ | `MembershipSubscriberDetail.tsx` | ⬜ |
| 6.6 | Add payment method management (portal link) | ⬜ | `MembershipSubscriberDetail.tsx` | ⬜ |

**Acceptance criteria:**
- [ ] Change Tier modal submits with evidence fields
- [ ] Cancel modal works
- [ ] Audit panel renders membership events
- [ ] Invoice history visible
- [ ] Points balance + pending downgrade shown
- [ ] Portal link button works

---

## Phase 7 — Documentation Updates

**Status:** ⬜ Not started
**Goal:** Update AGENTS.md, README.md, DESIGN.md with current facts.

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
| | | | |

---

## Known Pre-existing Issues

| Issue | Evidence | Impact |
|---|---|---|
| `activateMembership` passes `token` instead of `tokenHash` to InvoiceAccessToken | Model requires `tokenHash` | Invoice access tokens may not work for membership invoices |
| `packages/ui` TypeScript errors (Lucide/React 19) | `tsc --noEmit` fails | Pre-existing; Vite build works |
| 3 subscription test failures | `tests/integration/subscriptions.test.ts` | Pre-existing; not related to membership lifecycle |
