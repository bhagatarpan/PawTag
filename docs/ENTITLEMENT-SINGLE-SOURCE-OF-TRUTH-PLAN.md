# Entitlement Registry: Single Source of Truth

**Created:** 2026-09-29
**Branch:** `feature/entitlement-single-source-of-truth`
**Status:** In Progress

---

## Goal

Make the admin entitlements page (`/membership/entitlements`) the **only** source of truth for all membership benefits. Delete the old `MembershipTier.benefits` embedded object system.

## Confirmed Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | MembershipManage.tsx | Option A — Full benefit list from entitlement registry |
| 2 | Admin Tier Configuration | Option B — READ-ONLY benefit summary + editable name/price/status |
| 3 | Public tiers endpoint | Option B — Modify existing endpoint to enrich server-side |
| 4 | Dynamic Tiers | Yes — System must ENFORCE entitlements, not just display |
| 5 | Dynamic Benefits | Yes — System must ENFORCE entitlements, not just display |

## Target Architecture

```
Admin: Entitlements page (/membership/entitlements)
  │  SINGLE SOURCE OF TRUTH
  │  • Add/remove benefits dynamically
  │  • Configure per tier (Gold/Platinum/Black/Diamond/...)
  │  • Toggle on/off, set values
  │
  │  All data flows FROM here
  │
  ├─► (a) Public /membership landing page
  ├─► (b) Admin Tier Configuration page
  ├─► (c) Subscribe page
  ├─► (d) Manage page
  ├─► (e) Cart service (discounts)
  ├─► (f) Checkout service (shipping)
  ├─► (g) Escalation service (tier gating)
  ├─► (h) Finder route (medical alerts)
  ├─► (i) Notification service (delivery)
  └─► (j) Points service (multiplier)
```

## Progress Tracker

| Phase | Description | Status | Files Changed |
|-------|-------------|--------|---------------|
| P1 | Make entitlement service dynamic (no hardcoded tier lists) | ✅ Complete | membership-entitlement.service.ts, admin-entitlements.ts |
| P2 | Enrich tier endpoints with entitlement registry | ✅ Complete | membership-public.ts, membership.ts |
| P3 | Update frontend to be fully dynamic | ✅ Complete | Membership.tsx, MembershipSubscribe.tsx, MembershipManage.tsx, Dashboard.tsx |
| P4 | Update admin Tier Configuration page | ✅ Complete | MembershipTiers.tsx |
| P5 | Make admin entitlements page dynamic | ✅ Complete | MembershipEntitlements.tsx |
| P6 | Migrate backend hardcoded tier checks | ✅ Complete | escalation.service.ts, finder.ts |
| P7 | Remove old MembershipTier.benefits system | ✅ Complete | MembershipTier.ts, seed-memberships.ts, db/index.ts |
| P8 | Add Add Tier functionality | ✅ Complete | admin-membership.ts, MembershipTiers.tsx |
| P9 | Remove enum constraints from models | ✅ Complete | MembershipTierBenefit.ts |
| P10 | Documentation & Skills | ✅ Complete | SKILL.md, PLAN.md |

---

## Phase 1: Make Entitlement Service Dynamic

**Problem:** Entitlement service hardcodes `['gold', 'platinum', 'black']` in 3 places.

### Changes:
1. `getBenefitsMatrix()` line 171: Replace hardcoded list with `MembershipTier.find({}).select('tier')`
2. `upsertBenefit()` line 226: Replace hardcoded list with dynamic query
3. `admin-entitlements.ts` lines 180, 222, 263: Replace validation with dynamic lookup

### Files:
- `packages/api/src/services/membership-entitlement.service.ts`
- `packages/api/src/routes/admin-entitlements.ts`

---

## Phase 2: Enrich Tier Endpoints

**Problem:** Tier endpoints return hardcoded `MembershipTier.benefits`, not entitlement registry.

### Changes:
1. `GET /public/membership/tiers`: Enrich with `getTierEntitlements(tier.tier)` for each tier
2. `GET /membership/tiers`: Same enrichment
3. `GET /membership/status`: Add `entitlements` to response

### Files:
- `packages/api/src/routes/membership-public.ts`
- `packages/api/src/routes/membership.ts`
- `packages/api/src/services/membership.service.ts`

---

## Phase 3: Update Frontend to Be Dynamic

**Problem:** Frontend has hardcoded benefit lists and tier-specific rendering.

### Changes:
1. Membership.tsx: Dynamic benefit rendering from `tier.entitlements`
2. MembershipSubscribe.tsx: Same dynamic rendering
3. MembershipManage.tsx: Fetch entitlements from `GET /membership/entitlements`
4. Dashboard.tsx: Read from enriched membership data
5. Remove hardcoded `BENEFIT_LABELS` and `MembershipTier` interface with `benefits`

### Files:
- `apps/web/src/pages/Membership.tsx`
- `apps/web/src/pages/account/MembershipSubscribe.tsx`
- `apps/web/src/pages/account/MembershipManage.tsx`
- `apps/web/src/pages/account/Dashboard.tsx`

---

## Phase 4: Update Admin Tier Configuration

**Problem:** Admin Tier Configuration shows hardcoded benefits.

### Changes:
1. Add READ-ONLY benefit summary from entitlements to each tier card
2. Keep editable: name, description, price, active, displayOrder, tagLimit
3. Add link to Entitlements page for benefit management

### Files:
- `apps/admin/src/pages/MembershipTiers.tsx`

---

## Phase 5: Make Admin Entitlements Page Dynamic

**Problem:** Entitlements page hardcodes tier list for column rendering.

### Changes:
1. Replace `(['gold', 'platinum', 'black'] as const).map(...)` with `matrix.tiers.map(...)`

### Files:
- `apps/admin/src/pages/MembershipEntitlements.tsx`

---

## Phase 6: Migrate Backend Hardcoded Checks

**Problem:** 3 service calls use hardcoded tier strings.

### Changes:
1. escalation.service.ts line 138: `emergency_contact` entitlement
2. escalation.service.ts line 263: `pet_recovery` entitlement
3. finder.ts line 379: `medical_alerts` entitlement

### Files:
- `packages/api/src/services/escalation.service.ts`
- `packages/api/src/routes/finder.ts`

---

## Phase 7: Remove Old Benefits System

**Problem:** Old `MembershipTier.benefits` embedded object is no longer needed.

### Changes:
1. Remove `IMembershipTierBenefits` interface from MembershipTier model
2. Remove `benefits` field from schema
3. Update seed data
4. Clean up frontend types

### Files:
- `packages/db/src/models/MembershipTier.ts`
- `packages/api/src/seeds/seed-memberships.ts`
- Frontend type files

---

## Phase 8: Add "Add Tier" Functionality

**Problem:** No way to create new tiers at runtime.

### Changes:
1. Add `POST /admin/membership/tiers` endpoint
2. Add "Add Tier" button and modal in admin UI
3. Auto-create `MembershipTierBenefit` entries for new tier

### Files:
- `packages/api/src/routes/admin-membership.ts`
- `apps/admin/src/pages/MembershipTiers.tsx`
- `packages/api/src/services/membership-entitlement.service.ts`

---

## Phase 9: Remove Enum Constraints

**Problem:** `MembershipTier.tier` and `MembershipTierBenefit.tier` are hardcoded enums.

### Changes:
1. Change `enum: ['gold', 'platinum', 'black']` to open string type
2. Update TypeScript interfaces

### Files:
- `packages/db/src/models/MembershipTier.ts`
- `packages/db/src/models/MembershipTierBenefit.ts`

---

## Phase 10: Documentation & Skills

### Changes:
1. Update AGENTS.md with entitlement registry rules
2. Update README.md with new architecture
3. Update/create skills for entitlement management
4. Update DESIGN.md if needed

---

## Verification

After each phase:
1. `pnpm typecheck`
2. `pnpm lint`
3. Manual testing per phase

## Dynamic Tier Example (After Implementation)

```
1. Admin creates "Diamond" tier in Tier Configuration
   → MembershipTier document created

2. Admin goes to Entitlements page
   → Diamond column appears automatically
   → Admin configures benefits for Diamond

3. Customer visits /membership
   → Diamond tier card appears with configured benefits
   → Zero code changes

4. Customer subscribes to Diamond
   → Cart/Checkout/Escalation/Finder/Notifications all read from registry
   → Correct behavior for Diamond tier
   → Zero code changes
```
