# HYBRID 2 Model - Implementation Plan

**Last Updated:** 2026-09-27
**Status:** In Progress
**Branch:** `feature/hybrid2-tag-membership`

---

## Executive Summary

This plan implements the HYBRID 2 model for PawTag, introducing a two-phase tag lifecycle with membership-optional finder functionality.

### Key Changes
1. **Tag ID Creation**: Moved from checkout time to fulfillment time
2. **Active Period**: Configurable per product (default 3 months) - full functionality
3. **Warranty Period**: Configurable per product (default 12 months) - tag expires
4. **Limited Mode**: After Active Period, finder notifications stop unless membership purchased
5. **Membership Tiers**: Gold (3 tags), Platinum (10 tags), Black (unlimited tags)

---

## Business Rules

### Tag Lifecycle
| Phase | Duration | Finder Status | Notification Status |
|-------|----------|---------------|---------------------|
| Active Period | 3 months (configurable) | Full access | Enabled |
| After Active Period (no membership) | Until warranty expires | Limited (no notify) | Disabled |
| After Active Period (with membership) | 12 months from membership | Full access | Enabled |
| After Warranty Period | N/A | Expired | Disabled |

### Membership Tier Limits
| Tier | Tag Limit | Price |
|------|-----------|-------|
| Gold | 3 tags | $89/year |
| Platinum | 10 tags | $99/year |
| Black | Unlimited | $199/year |

### Tag Replacement Rules
- **Damaged/Lost Tag**: Remaining Active Period transfers to replacement
- **Expired Tag**: Fresh Active Period (customer must buy new tag)

---

## Timeline Scenarios

### Scenario 1: Customer buys membership BEFORE Active Period expires (Month 1)
```
Month 0:     Buy PawTag Classic ($19.99)
Month 0-3:   ✅ Tag ACTIVE - everything works (finder, notifications, scans)
Month 1:     Customer buys Platinum Membership ($99/year)
Month 3:     ✅ Tag still ACTIVE - membership kicks in
Month 3-15:  ✅ Tag ACTIVE with finder (12 months from membership start)
             Total active period: 15 months (3 months + 12 months membership)
```

### Scenario 2: Customer buys membership AFTER Active Period expires (Month 10)
```
Month 0:     Buy PawTag Classic ($19.99)
Month 0-3:   ✅ Tag ACTIVE - everything works (finder, notifications, scans)
Month 3:     ⚠️ Active Period ends
Month 3-10:  ⚠️ Tag works but FINDER NOTIFICATIONS STOPPED
Month 10:    Customer buys Platinum Membership ($99/year)
Month 10-22: ✅ Tag works with finder (12 months from membership start)
             Total: 22 months (10 months + 12 months membership)
```

### Scenario 3: Customer NEVER buys membership
```
Month 0:     Buy PawTag Classic ($19.99)
Month 0-3:   ✅ Tag ACTIVE - everything works (finder, notifications, scans)
Month 3:     ⚠️ Active Period ends
Month 3-12:  ⚠️ Tag works but FINDER NOTIFICATIONS STOPPED
Month 12:    Tag EXPIRED - need to buy new tag
```

---

## Implementation Phases

### Phase 1: Database Schema Changes
**Status:** Pending
**Files:**
- `packages/db/src/models/Product.ts`
- `packages/db/src/models/Tag.ts`
- `packages/db/src/models/MembershipTier.ts`
- `packages/db/src/models/UserMembership.ts`

**Changes:**
- Add `activePeriodMonths` to Product (default 3)
- Add `activePeriodEndsAt`, `warrantyEndsAt`, `membershipStartsAt` to Tag
- Add `limited` status to Tag status enum
- Add `tagLimit` to MembershipTier
- Add `extendedTagIds` to UserMembership

---

### Phase 2: API Service Changes
**Status:** Pending
**Files:**
- `packages/api/src/commerce/services/checkout.service.ts`
- `packages/api/src/routes/admin-fulfilments.ts`
- `packages/api/src/services/tag-status.service.ts` (new)
- `packages/api/src/services/membership.service.ts`
- `packages/api/src/routes/finder.ts`
- `packages/api/src/routes/customer.ts`

**Changes:**
- Remove tag/subscription creation from checkout
- Add tag assignment endpoint to fulfillment
- Create tag status calculation service
- Update membership purchase to extend tags
- Update finder to handle limited mode
- Update tag activation to remove subscription check

---

### Phase 3: Notification System
**Status:** Pending
**Files:**
- `packages/api/src/services/email/templates/tag-active-period-expiring.ts` (new)
- `packages/db/src/models/Notification.ts`
- `packages/api/src/services/subscription.service.ts`

**Changes:**
- Create email templates for Active Period warnings
- Add new notification types
- Add background job for Active Period checks

---

### Phase 4: Admin Portal Changes
**Status:** Pending
**Files:**
- `apps/admin/src/pages/Products.tsx`
- `apps/admin/src/pages/OrderDetail.tsx`
- `apps/admin/src/pages/Fulfilment.tsx`
- `apps/admin/src/pages/WriteNfcTag.tsx`

**Changes:**
- Add Active Period and Warranty Period fields to product form
- Add tag assignment section to order detail
- Update fulfillment page for tag assignment
- Update NFC writer for new flow

---

### Phase 5: Customer Portal Changes
**Status:** Pending
**Files:**
- `apps/web/src/pages/account/Tags.tsx`
- `apps/web/src/components/TagExpiryBanner.tsx` (new)
- `apps/web/src/pages/account/Membership.tsx` (new)
- `apps/web/src/components/MembershipPrompt.tsx` (new)

**Changes:**
- Update tag cards to show Active/Warranty period status
- Create warning banner component
- Create membership purchase page
- Create membership prompt component

---

### Phase 6: Finder App Changes
**Status:** Pending
**Files:**
- `apps/finder/src/App.tsx`
- `apps/finder/src/components/LimitedModeBanner.tsx` (new)

**Changes:**
- Handle three states: active, limited, expired
- Create limited mode banner component

---

### Phase 7: Background Jobs
**Status:** Pending
**Files:**
- `packages/api/src/services/active-period-check.service.ts` (new)
- `packages/api/src/worker.ts`
- `packages/api/src/seeds/seed-background-jobs.ts`

**Changes:**
- Create Active Period check service
- Register new background job
- Add job configuration

---

### Phase 8: Data Migration
**Status:** Pending
**Files:**
- `scripts/migrate-hybrid2.ts` (new)

**Changes:**
- Delete existing subscriptions, orders, invoices for tag products
- Delete existing tags
- Add new fields to models
- Update MembershipTier with tag limits

**Warning:** Destructive migration. Must be run in controlled environment with backups.

---

### Phase 9: Shared Types
**Status:** Pending
**Files:**
- `packages/shared/src/index.ts`

**Changes:**
- Update Product interface with new fields
- Update MembershipTier interface with tagLimit

---

## Testing Strategy

### Unit Tests
- `calculateTagStatus()` - All status scenarios
- Tag assignment during fulfillment
- Membership purchase updates tags
- Tag limit enforcement

### Integration Tests
- Checkout flow without tag/subscription creation
- Fulfillment flow with tag assignment
- Finder behavior for limited mode
- Active period expiration notifications
- Membership purchase extends tags

### E2E Tests
- Complete customer journey
- Finder journey with limited tag
- Admin fulfillment workflow
- Membership purchase flow

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Existing customer data deletion | Backup before migration, controlled environment |
| Fulfillment staff need training | Clear UI with step-by-step instructions |
| Tag assignment errors | Validation, confirmation steps, audit trail |
| Membership tier limit confusion | Clear UI showing limits and current usage |
| Notification spam | Use reminderStates for dedup |

---

## Progress Tracking

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1: Database | Pending | - | - | - |
| Phase 2: API Services | Pending | - | - | - |
| Phase 3: Notifications | Pending | - | - | - |
| Phase 4: Admin Portal | Pending | - | - | - |
| Phase 5: Customer Portal | Pending | - | - | - |
| Phase 6: Finder App | Pending | - | - | - |
| Phase 7: Background Jobs | Pending | - | - | - |
| Phase 8: Data Migration | Pending | - | - | - |
| Phase 9: Shared Types | Pending | - | - | - |

---

## Key Design Decisions

| Question | Answer |
|----------|--------|
| What is "Active Period"? | 3 months from purchase (configurable per product) |
| What happens after Active Period? | Tag works but finder notifications stop |
| When does membership kick in? | 12 months from membership start date |
| Can customer buy membership early? | Yes, but membership starts from purchase date |
| What if customer buys membership at Month 1? | Tag active for 3 + 12 = 15 months total |
| What if customer buys membership at Month 10? | Tag works for 10 months, then finder stops, then membership kicks in |
| Tag replacement (damaged/lost)? | Remaining Active Period transfers |
| Tag replacement (expired)? | Fresh Active Period (buy new tag) |
| Multiple tags per order? | Each tag assigned separately during fulfillment |
| Membership tag limits? | Gold: 3, Platinum: 10, Black: unlimited |
| Grace period after Active Period? | Immediate |
| Membership purchasable from customer portal? | Yes |

---

## Monitoring & Observability

### Audit Logging
All critical operations are audit logged:
- Tag creation during fulfillment
- Tag activation by customer
- Membership purchase and tag extension
- Status changes (active → limited → expired)

### System Logging
Structured logging via Pino:
- Tag status calculations
- Membership purchase flow
- Finder access decisions
- Background job execution

### Metrics
Track via OpenTelemetry:
- Tags created per day
- Membership purchases
- Limited mode activations
- Active period expirations

---

## Documentation Updates

After implementation, update:
- `README.md` - New business model description
- `AGENTS.md` - Updated rules for tag lifecycle
- `docs/DESIGN.md` - New status colors for limited mode
- `docs/BUSINESS-RULES.md` - HYBRID 2 business rules
