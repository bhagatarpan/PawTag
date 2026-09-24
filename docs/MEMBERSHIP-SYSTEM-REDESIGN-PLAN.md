# PawTag Membership System Redesign — Final Plan

**Created:** 2026-09-24
**Status:** Planning Complete — Awaiting Implementation Approval

---

## Architecture Summary

### Three Product Types (Never Mixed)

| Type | Purchase | Billing | Shipping | Cart |
|------|----------|---------|----------|------|
| **PRODUCT** | One-time | One-time | Yes | Product cart |
| **MEMBERSHIP** | Annual purchase, renew yearly | Annual only | No | Dedicated subscribe flow |
| **DIGITAL** | One-time | One-time | No | Dedicated flow |

### Tag Lifecycle

```
BUY TAG → Tag works for X months (warranty, configurable per tag product)
              ↓
    ┌─────────────────────────────────────────────┐
    │  Customer has active membership?            │
    │  YES → Tag works until membership renewal   │
    │  NO  → Tag STOPS (finder disabled)          │
    └─────────────────────────────────────────────┘
```

**Key rules:**
- Tag warranty is configurable **per tag product** in admin (e.g., Scan=12mo, Classic=12mo, Plus=18mo)
- If customer buys membership within warranty, tag works until membership renewal date
- If membership expires, tag stops **immediately** (no grace period)
- Tag reactivates when membership is paid/activated
- One membership covers ALL tags for that customer (family/multi-pet)

---

## Membership Tiers

### Gold — $89/year (Most Popular)

| Benefit | Value |
|---------|-------|
| Medical Alert to Finder | ✅ |
| Pet Health Records | ✅ |
| Email Notifications | ✅ |
| Free Shipping | Over $100 (admin configurable) |
| Guardian Rewards | 1x points |
| In App Notifications | ❌ |
| Critical Emergency Contact | ❌ |
| Emergency Person Notification Email | ❌ |
| Emergency Person Notification In App | ❌ |
| % OFF Accessories | ❌ |
| Pet Recovery via PawTag | ❌ |
| Exclusive Black Friday Deal | ❌ |

### Platinum — $99/year (Recommended)

| Benefit | Value |
|---------|-------|
| Medical Alert to Finder | ✅ |
| Pet Health Records | ✅ |
| Email Notifications | ✅ |
| Free Shipping | Over $80 (admin configurable) |
| Guardian Rewards | 2x points |
| In App Notifications | ✅ |
| Critical Emergency Contact | ✅ |
| Emergency Person Notification Email | ✅ |
| Emergency Person Notification In App | ❌ |
| % OFF Accessories | 5% |
| Pet Recovery via PawTag | ❌ |
| Exclusive Black Friday Deal | ❌ |

### Black — $199/year (Elite, DISABLED by default)

| Benefit | Value |
|---------|-------|
| Medical Alert to Finder | ✅ |
| Pet Health Records | ✅ |
| Email Notifications | ✅ |
| Free Shipping | LIFETIME (while on Black) |
| Guardian Rewards | 3x points |
| In App Notifications | ✅ |
| Critical Emergency Contact | ✅ |
| Emergency Person Notification Email | ✅ |
| Emergency Person Notification In App | ✅ |
| % OFF Accessories | 10% |
| Pet Recovery via PawTag | ✅ (Premium service) |
| Exclusive Black Friday Deal | ✅ |

---

## Black Member Premium: Pet Recovery via PawTag

This is a premium escalation service exclusive to Black members:

```
FINDER FINDS PET
    ↓ (30 mins, no response from customer)
EMERGENCY CONTACT NOTIFIED
    ↓ (30 mins, no response from emergency contact)
PAWTAG ADMIN NOTIFIED
    ↓
ADMIN CONTACTS FINDER
    ↓
ADMIN COORDINATES RECOVERY
    ↓
ADMIN NOTIFIES CUSTOMER + EMERGENCY CONTACT
    ↓
PET RECOVERED
```

**Escalation paths by tier:**

| Tier | Escalation Path |
|------|-----------------|
| No membership | Customer only (1-hop) |
| Gold | Customer only (1-hop) |
| Platinum | Customer → Emergency Contact (2-hop) |
| Black | Customer → Emergency Contact → PawTag Admin (3-hop) |

---

## Emergency Contact System

**Onboarding:** Mandatory capture during customer registration (free, stored for future use)

**Notification channels by membership tier:**

| Tier | Emergency Contact Notifications |
|------|--------------------------------|
| No membership | ❌ None |
| Gold | ❌ None |
| Platinum | ✅ Email only |
| Black | ✅ Email + In-App |

---

## New Data Models

### MembershipTier (Configuration)

```typescript
{
  tier: 'gold' | 'platinum' | 'black',
  name: string,                    // "Gold Membership"
  displayName: string,             // "Gold"
  description: string,
  price: number,                   // 89 | 99 | 199 (annual NZD)
  currency: 'NZD',
  
  benefits: {
    medicalAlert: boolean,
    petHealthRecords: boolean,
    emailNotifications: boolean,
    freeShippingThreshold: number,  // 0 = lifetime, null = no free shipping
    pointsMultiplier: number,       // 1, 2, or 3
    inAppNotifications: boolean,
    criticalEmergencyContact: boolean,
    emergencyPersonEmail: boolean,
    emergencyPersonInApp: boolean,
    accessoryDiscount: number,      // percentage (0, 5, 10)
    petRecovery: boolean,
    blackFridayDeal: boolean,
  },
  
  stripeProductId?: string,
  stripePriceId?: string,
  
  isActive: boolean,               // Can users purchase this tier?
  displayOrder: number,            // For landing page ordering
  
  icon: string,                    // Lucide icon name
  color: string,                   // Theme color
  gradient: string,                // CSS gradient
  
  tagWarrantyMonths: number,       // Default 12 (global for this tier)
}
```

### UserMembership

```typescript
{
  userId: ObjectId,                // Reference to User
  tierId: ObjectId,                // Reference to MembershipTier
  
  status: 'active' | 'cancelled' | 'expired' | 'pending_payment',
  
  billingCycle: 'annual',
  price: number,
  
  startDate: Date,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelledAt?: Date,
  
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
  
  // Payment Method (saved locally for display)
  paymentMethodId?: string,
  cardBrand?: string,
  cardLast4?: string,
  cardExpMonth?: number,
  cardExpYear?: number,
  
  autoRenew: boolean,
  
  // Admin extension tracking
  lastAdminExtensionAt?: Date,
  adminExtensionGraceUsed: boolean,  // One-time grace per user/tag
}
```

### User Model Updates

```typescript
// New fields
membershipTier?: 'gold' | 'platinum' | 'black',
membershipId?: ObjectId,
```

### Product Model Updates

```typescript
// New enum
productType: 'physical' | 'digital' | 'membership',

// Existing field - now admin-configurable per product
warrantyMonths: number,             // e.g., 12 for Scan, 12 for Classic, 18 for Plus
```

---

## Complete Notification Matrix

### NEW Membership Notifications

| # | Notification | Channel | Trigger | Recipient |
|---|---|---|---|---|
| M1 | Membership Welcome | Email + In-App | Membership created | Customer |
| M2 | Membership Renewal Reminder 30d | Email | 30 days before renewal | Customer |
| M3 | Membership Renewal Reminder 7d | Email | 7 days before renewal | Customer |
| M4 | Membership Renewed | Email + In-App | Annual renewal successful | Customer |
| M5 | Membership Cancelled | Email + In-App | Customer cancels | Customer |
| M6 | Membership Expired | Email + In-App | Renewal failed, all retries exhausted | Customer |
| M7 | Membership Tier Changed | Email + In-App | Upgrade/downgrade | Customer |
| M8 | Card Expiring 4w | Email | Card expires in 4 weeks | Customer |
| M9 | Card Expired | Email + In-App | Card expired, payment failed | Customer |
| M10 | Payment Failed | Email + In-App | Renewal payment failed | Customer |
| M11 | Payment Retry Success | Email + In-App | Successful retry | Customer |
| M12 | Admin: New Member | In-App + Email | New membership | Admin |
| M13 | Admin: Membership Cancelled | In-App + Email | Customer cancels | Admin |
| M14 | Admin: Payment Failed | In-App + Email | Payment failed after retries | Admin |
| M15 | Admin: Membership Extended | In-App + Email | Admin extends | Admin + Customer |

### NEW Tag Warranty Notifications

| # | Notification | Channel | Trigger | Recipient |
|---|---|---|---|---|
| T1 | Tag Warranty Expiring 30d | Email | Warranty expires in 30 days | Customer |
| T2 | Tag Warranty Expiring 7d | Email | Warranty expires in 7 days | Customer |
| T3 | Tag Warranty Expiring 1d | Email | Warranty expires in 1 day | Customer |
| T4 | Tag Deactivated (No Membership) | Email + In-App | Tag stopped, no membership | Customer |
| T5 | Tag Reactivated | Email + In-App | Membership activated, tag reactivated | Customer |
| T6 | Admin: Tag Warranty Expiring | In-App + Email | Tags expiring within N days | Admin |

### NEW Emergency Escalation Notifications

| # | Notification | Channel | Trigger | Recipient |
|---|---|---|---|---|
| E1 | Emergency Contact Notified | Email + In-App | Finder can't reach customer (30min) | Emergency Contact |
| E2 | Admin: Emergency Escalation | Email + In-App | Emergency contact can't reach finder (30min) | Admin |
| E3 | Recovery Confirmed | Email + In-App | Admin confirms pet recovered | Customer + Emergency Contact |

### EXISTING Notifications (No Change)

| Category | Count | Status |
|---|---|---|
| Finder/Recovery | 4 | ✅ No change |
| Order/Commerce | 10 | ✅ No change |
| System/Auth | 9 | ✅ No change |

### EXISTING Notifications (Update References)

| Category | Count | Change |
|---|---|---|
| Guardian/Loyalty | 9 | 🔄 Update multiplier/tier references |

---

## Complete Audit Trail Matrix

### NEW Membership Audit Events

| Action | Event Type | Category | Severity |
|---|---|---|---|
| `membership_created` | `membership.created` | FINANCIAL | HIGH |
| `membership_renewed` | `membership.renewed` | FINANCIAL | HIGH |
| `membership_cancelled` | `membership.cancelled` | FINANCIAL | HIGH |
| `membership_expired` | `membership.expired` | FINANCIAL | HIGH |
| `membership_tier_changed` | `membership.tier_changed` | UPDATE | HIGH |
| `membership_extended` | `membership.extended` | UPDATE | HIGH |
| `membership_payment_failed` | `membership.payment_failed` | FINANCIAL | HIGH |
| `membership_payment_retry_success` | `membership.payment_retry_success` | FINANCIAL | HIGH |
| `membership_card_expiring_reminder` | `membership.card_expiring` | SYSTEM | MEDIUM |
| `tag_warranty_check` | `tag.warranty_check` | SYSTEM | LOW |
| `tag_deactivated_no_membership` | `tag.deactivated` | SYSTEM | HIGH |
| `tag_reactivated_membership` | `tag.reactivated` | SYSTEM | HIGH |
| `tag_warranty_extended` | `tag.warranty_extended` | UPDATE | HIGH |
| `emergency_escalation_customer` | `emergency.customer_notified` | SYSTEM | HIGH |
| `emergency_escalation_contact` | `emergency.contact_notified` | SYSTEM | HIGH |
| `emergency_escalation_admin` | `emergency.admin_notified` | SYSTEM | CRITICAL |
| `pet_recovery_confirmed` | `recovery.confirmed` | SYSTEM | HIGH |

---

## Complete Background Jobs Matrix

### NEW Jobs

| Job | Frequency | Lock | Purpose |
|---|---|---|---|
| `membership-renewal-check` | 24 hours | `membership` | Send renewal reminders (30d, 7d) |
| `membership-renewal-process` | 24 hours | `membership` | Process annual renewals via Stripe |
| `membership-payment-retry` | 1 hour | `membership` | Retry failed membership payments |
| `membership-expiry-check` | 24 hours | `membership` | Expire memberships, deactivate tags |
| `tag-warranty-check` | 24 hours | `tag-warranty` | Check warranties, send reminders, deactivate |
| `card-expiry-check` | 24 hours | `card-expiry` | Check cards expiring in 4 weeks |

### EXISTING Jobs (Modify)

| Job | Change |
|---|---|
| `subscription-service` | 🔄 Remove tag subscription logic |
| `pawrewards` | 🔄 Update to use tier-specific multipliers (1x/2x/3x) |
| `escalation-service` | 🔄 Add membership-tier-aware escalation paths |

### EXISTING Jobs (No Change)

| Job | Status |
|---|---|
| `reminder-service` | ✅ |
| `pet-milestones` | ✅ |
| `low-stock-check` | ✅ |
| `payment-reconciliation` | ✅ |
| `orphan-payment-detection` | ✅ |
| `order-auto-cancel` | ✅ |
| `webhook-retry` | ✅ |
| `refund-reconciliation` | ✅ |

---

## Admin Extension Flow

When admin extends tag warranty or membership:

```
Admin selects user/tag/membership
    ↓
Choose extension type:
┌─────────────────────────────────────────┐
│  Option A: Charge Credit Card           │
│  → Stripe PaymentIntent                 │
│  → Extend period on success             │
│  → Audit log with charge amount         │
├─────────────────────────────────────────┤
│  Option B: 1-Month Grace               │
│  → Extend period by 1 month             │
│  → No charge                            │
│  → Mark as "grace used"                 │
│  → CANNOT use grace again for           │
│    same user/tag combination            │
└─────────────────────────────────────────┘
```

**Constraint:** Only one grace period per member per tag (tracked via `adminExtensionGraceUsed` on UserMembership).

---

## Design Tokens for Landing Page

| Tier | Gradient | Icon | Color |
|------|----------|------|-------|
| Gold | `from-yellow-400 to-amber-500` | Crown | `#F59E0B` |
| Platinum | `from-gray-300 to-gray-500` | Diamond | `#9CA3AF` |
| Black | `from-gray-800 to-black` | Shield | `#1F2937` |

---

## Work Packets

### Phase 1: Foundation (Database)

| # | Packet | Files |
|---|--------|-------|
| 1.1 | MembershipTier model | `packages/db/src/models/MembershipTier.ts` |
| 1.2 | UserMembership model | `packages/db/src/models/UserMembership.ts` |
| 1.3 | Update User model | `packages/db/src/models/User.ts` |
| 1.4 | Update Product model | `packages/db/src/models/Product.ts` (add productType, warrantyMonths) |
| 1.5 | Seed membership tiers | `packages/api/src/seeds/seed-memberships.ts` |
| 1.6 | Remove existing Gold subscribers | Script to clean slate |

### Phase 2: Backend Services

| # | Packet | Files |
|---|--------|-------|
| 2.1 | Membership service | `packages/api/src/services/membership.service.ts` |
| 2.2 | Membership routes (customer) | `packages/api/src/routes/membership.ts` |
| 2.3 | Membership routes (public) | `packages/api/src/routes/membership-public.ts` |
| 2.4 | Membership routes (admin) | `packages/api/src/routes/admin-membership.ts` |
| 2.5 | Stripe integration | Update `stripe.service.ts` |
| 2.6 | Tag lifecycle update | Update `finder.ts`, `customer.ts` |
| 2.7 | Membership benefits middleware | `packages/api/src/middleware/membership-benefits.ts` |
| 2.8 | Emergency escalation update | Update `escalation.service.ts` for tier-aware paths |
| 2.9 | Background jobs | 6 new jobs in `packages/api/src/jobs/` |

### Phase 3: Email Templates

| # | Packet | Files |
|---|--------|-------|
| 3.1 | Membership email templates | 15 new templates |
| 3.2 | Tag warranty email templates | 6 new templates |
| 3.3 | Emergency escalation templates | 3 new templates |
| 3.4 | Update existing templates | Update tier/multiplier refs |

### Phase 4: Frontend

| # | Packet | Files |
|---|--------|-------|
| 4.1 | Membership landing page | `apps/web/src/pages/Membership.tsx` |
| 4.2 | Membership subscribe flow | `apps/web/src/pages/account/MembershipSubscribe.tsx` |
| 4.3 | Membership management | `apps/web/src/pages/account/MembershipManage.tsx` |
| 4.4 | Payment method management | `apps/web/src/components/PaymentMethodManager.tsx` |
| 4.5 | Update routing | `apps/web/src/App.tsx` |
| 4.6 | Update account sidebar | `apps/web/src/components/AccountLayout.tsx` |

### Phase 5: Admin Portal

| # | Packet | Files |
|---|--------|-------|
| 5.1 | Membership tier config | `apps/admin/src/pages/MembershipTiers.tsx` |
| 5.2 | Subscriber management | `apps/admin/src/pages/MembershipSubscribers.tsx` |
| 5.3 | Membership dashboard | `apps/admin/src/pages/MembershipDashboard.tsx` |
| 5.4 | Admin extension dialog | `apps/admin/src/components/MembershipExtendDialog.tsx` |

### Phase 6: Cleanup

| # | Packet | Files |
|---|--------|-------|
| 6.1 | Remove Gold code | Multiple files |
| 6.2 | Remove subscription from products | `checkout.service.ts`, `order-creation.service.ts` |
| 6.3 | Remove old subscription lifecycle | `subscription.service.ts` |
| 6.4 | Update tests | New + updated tests |
| 6.5 | Update documentation | README, AGENTS, DESIGN |

---

## Summary Statistics

| Category | Count |
|---|---|
| New database models | 2 |
| Modified database models | 2 |
| New API routes | 3 |
| New services | 1 |
| New email templates | 24 |
| New background jobs | 6 |
| New admin pages | 4 |
| New frontend pages | 4 |
| Files to remove | ~10 |
| Files to modify | ~20 |
| New audit event types | 17 |
| New notification types | 24 |

---

## Files to Remove (Dead Code After Redesign)

| File | Reason |
|------|--------|
| `apps/web/src/pages/GoldLanding.tsx` | Replaced by Membership.tsx |
| `apps/web/src/pages/account/GoldUpgrade.tsx` | Replaced by MembershipSubscribe.tsx |
| `apps/web/src/pages/account/GoldBenefits.tsx` | Replaced by MembershipManage.tsx |
| `packages/api/src/routes/customer-subscriptions.ts` (gold sections) | Gold routes removed |
| `packages/api/src/services/subscription.service.ts` (gold sections) | Gold service removed |
| `packages/api/src/middleware/gold-benefits.ts` | Replaced by membership-benefits.ts |
| `packages/api/src/services/email/templates/gold-welcome.ts` | Replaced by membership emails |
| `packages/api/src/services/email/templates/gold-cancellation.ts` | Replaced by membership emails |
| `packages/api/src/services/email/templates/subscription-plan-changed.ts` | No longer needed |
| `packages/api/src/services/email/templates/subscription-resumed.ts` | No longer needed |

---

## Critical Design Decisions (Finalized)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tag warranty | Per product, configurable in admin | Different tags may have different warranty periods |
| Grace period on membership expiry | None (immediate) | Clean separation, no ambiguity |
| Tag after 12 months without membership | Stops working | Drives membership conversion |
| Tag with membership | Works until membership renewal | Simple, predictable |
| Multi-pet/family | One membership covers all tags | Customer-friendly, simpler billing |
| Monthly billing | Not available (annual only) | Simpler, clearer value proposition |
| Black tier | Disabled by default | Not finalized yet |
| Emergency contact | Mandatory at onboarding | Future-proofing, free |
| Emergency notifications | Per-tier gated | Platinum+: email, Black: email + in-app |
| Pet Recovery via PawTag | Black only | Premium escalation service |
| Points multiplier | 1x Gold, 2x Platinum, 3x Black | Clear tier differentiation |
| Free shipping | Admin configurable per tier | Flexible, can adjust without code |
| Payment method management | PawTag-hosted (not Stripe portal) | Better UX, more control |
| Card expiry reminder | 4 weeks before expiry | Proactive, prevents failed renewals |
| Admin extension | Charge or 1-month grace (one-time) | Flexible support options |
