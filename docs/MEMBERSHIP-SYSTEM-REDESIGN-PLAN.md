# PawTag Membership System Redesign — Complete Plan

**Created:** 2026-09-24
**Updated:** 2026-09-24
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

## Design System Reference

All UI/UX changes must follow these design tokens from `docs/DESIGN.md`:

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary-500` | `#14b8a6` | Focus rings, progress bars |
| `primary-600` | `#0d9488` | Primary buttons, links, active nav |
| `primary-700` | `#0f766e` | Hover on primary buttons |
| `gray-50` | `#f9fafb` | Page backgrounds |
| `gray-100` | `#f3f4f6` | Subtle borders |
| `gray-600` | `#4b5563` | Body text |
| `gray-900` | `#111827` | Dark headings |

### Membership Tier Colors

| Tier | Gradient | Icon | Badge |
|------|----------|------|-------|
| Gold | `from-yellow-400 to-amber-500` | Crown | `bg-yellow-100 text-yellow-700` |
| Platinum | `from-gray-300 to-gray-500` | Diamond | `bg-gray-100 text-gray-700` |
| Black | `from-gray-800 to-black` | Shield | `bg-gray-800 text-white` |

### Component Tokens

| Element | Classes |
|---------|---------|
| Primary Button | `bg-primary-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-primary-700` |
| Secondary Button | `border border-primary-600 text-primary-600 rounded-xl font-semibold px-6 py-3 hover:bg-primary-50` |
| Card | `bg-white rounded-2xl shadow-sm p-6 border border-gray-100` |
| Input | `w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500` |
| Badge Success | `inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold` |
| Badge Warning | `inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold` |

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
  userId: ObjectId,
  tierId: ObjectId,
  
  status: 'active' | 'cancelled' | 'expired' | 'pending_payment',
  
  billingCycle: 'annual',
  price: number,
  
  startDate: Date,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelledAt?: Date,
  
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
  
  paymentMethodId?: string,
  cardBrand?: string,
  cardLast4?: string,
  cardExpMonth?: number,
  cardExpYear?: number,
  
  autoRenew: boolean,
  
  adminExtensionGraceUsed: boolean,
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

## Commerce System Changes

### Product Model Changes

**Current:**
```typescript
{
  isTagProduct: boolean,
  isSubscription: boolean,
  stockPolicy: 'deny' | 'allow',
  subscriptionConfig: { type, freePeriodMonths, ... }
}
```

**New:**
```typescript
{
  productType: 'physical' | 'digital' | 'membership',  // NEW
  warrantyMonths: number,                               // NEW (per product)
  // Remove: isSubscription, subscriptionConfig (for products)
  // Keep: isTagProduct, stockPolicy, customizable, etc.
}
```

### Cart Simplification

**Cart item fields to REMOVE:**
- `autoRenew`
- `isSubscription`
- `monthlyPrice`
- `annualPrice`
- `freePeriodMonths`

**Cart item fields to KEEP:**
- `productId`, `productName`, `sku`
- `unitPrice`, `quantity`, `customizationTotal`
- `customisation`, `customisationTexts`
- `image`, `addedAt`

### Checkout Simplification

**Current:**
```
Cart → Calculate totals → Create PaymentIntent → Stripe confirms → Create Order → Create Tag + Subscription
```

**New:**
```
Cart → Calculate totals → Create PaymentIntent → Stripe confirms → Create Order → Create Tag (no subscription)
```

### Tag Lifecycle Update

**Current:**
```
Buy tag → Subscription created → Tag works for 3 months free → Billing starts → Expiry
```

**New:**
```
Buy tag → Tag works for X months (warranty) → If no membership → Tag stops
```

---

## Screens & UI/UX Changes

### Customer-Facing Screens

#### NEW: Membership Landing Page (`/membership`)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    HERO SECTION                                  │
│  "Protect Your Pet. Join the Pack."                             │
│  Subtitle describing membership benefits                        │
├─────────────────────────────────────────────────────────────────┤
│                    TIER COMPARISON                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │   GOLD   │  │ PLATINUM │  │  BLACK   │                     │
│  │   $89    │  │   $99    │  │  $199    │                     │
│  │  Popular │  │ Recommended│ │  Elite   │                     │
│  │          │  │  ✅ BEST  │  │ (Soon)   │                     │
│  │ [Join]   │  │ [Join]   │  │ [Notify] │                     │
│  └──────────┘  └──────────┘  └──────────┘                     │
├─────────────────────────────────────────────────────────────────┤
│                    BENEFITS MATRIX                               │
│  Feature          │ Gold │ Platinum │ Black                     │
│  ─────────────────┼──────┼──────────┼───────                    │
│  Medical Alert    │  ✅  │    ✅    │  ✅                       │
│  Health Records   │  ✅  │    ✅    │  ✅                       │
│  Free Shipping    │ $100 │   $80    │ LIFETIME                  │
│  Points Multiplier│  1x  │    2x    │  3x                       │
│  ...              │      │          │                           │
├─────────────────────────────────────────────────────────────────┤
│                    FAQ SECTION                                   │
│  - What happens after 12 months?                                │
│  - Can I upgrade/downgrade?                                     │
│  - What payment methods are accepted?                           │
│  - How do I cancel?                                             │
├─────────────────────────────────────────────────────────────────┤
│                    TRUST INDICATORS                              │
│  "Secure payments via Stripe"                                    │
│  "Cancel anytime"                                               │
│  "100% satisfaction guaranteed"                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Design tokens:**
- Gold: `from-yellow-400 to-amber-500` gradient, Crown icon
- Platinum: `from-gray-300 to-gray-500` gradient, Diamond icon, "Recommended" badge
- Black: `from-gray-800 to-black` gradient, Shield icon, "Coming Soon" overlay

#### NEW: Membership Subscribe Flow (`/account/membership/subscribe`)

**Steps:**
1. Select tier (Gold/Platinum, Black disabled)
2. Enter payment method (Stripe Elements)
3. Confirm subscription
4. Success page with benefits summary

**Design:**
- Clean, minimal form
- Progress indicator (Step 1 of 3)
- Clear pricing display
- Trust indicators near payment form
- Success animation with tier badge

#### NEW: Membership Management (`/account/membership`)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  CURRENT MEMBERSHIP                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🏆 Gold Membership                                     │   │
│  │  Active since Jan 1, 2026                               │   │
│  │  Renews: Jan 1, 2027 ($89/year)                         │   │
│  │  [Change Plan] [Cancel]                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  YOUR BENEFITS                                                  │
│  ✅ Medical Alert to Finder                                    │
│  ✅ Pet Health Records                                         │
│  ✅ Email Notifications                                        │
│  ✅ Free Shipping over $100                                    │
│  ✅ 1x Guardian Rewards                                        │
├─────────────────────────────────────────────────────────────────┤
│  PAYMENT METHOD                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  💳 Visa ending in 4242 (expires 12/2027)               │   │
│  │  [Update Payment Method]                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  YOUR TAGS                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🏷️ PT-123456 — PawTag Classic                         │   │
│  │  Warranty: Active until Dec 31, 2026                    │   │
│  │  Status: ✅ Covered by Gold Membership                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### UPDATED: Product Detail Page

**Changes:**
- Remove subscription-related display (monthly/annual pricing)
- Show one-time price only
- Show warranty period (e.g., "12-month warranty")
- Remove auto-renew toggle
- Simplify checkout CTA

#### UPDATED: Cart Page

**Changes:**
- Remove subscription-related fields from cart items
- Simplify order summary (no subscription pricing)
- Remove auto-renew toggle from checkout

#### UPDATED: Checkout Page

**Changes:**
- Remove subscription creation step
- Simplify post-payment flow
- Keep: shipping, payment, order confirmation

### Account Sidebar Updates

**Current:**
```
- Dashboard
- My Pets
- My Tags
- Orders
- Guardian
  - Dashboard
  - Points
  - Rewards
  - Benefits
- Go Gold ← REMOVE
- Subscriptions ← REMOVE
- Settings
```

**New:**
```
- Dashboard
- My Pets
- My Tags
- Orders
- Membership ← NEW (replaces Guardian + Go Gold)
  - Dashboard
  - Manage Membership
  - Payment Methods
- Settings
```

### Admin Screens

#### NEW: Membership Tier Configuration (`/admin/membership/tiers`)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  MEMBERSHIP TIERS                                               │
│  [+ Add Tier]                                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │   GOLD   │  │ PLATINUM │  │  BLACK   │                     │
│  │  $89/yr  │  │  $99/yr  │  │  $199/yr │                     │
│  │ Active   │  │ Active   │  │ Disabled │                     │
│  │ 450 members│ │ 120 members│ │ 0 members│                    │
│  │ [Edit]   │  │ [Edit]   │  │ [Edit]   │                     │
│  └──────────┘  └──────────┘  └──────────┘                     │
├─────────────────────────────────────────────────────────────────┤
│  TIER DETAILS (when editing)                                    │
│  - Pricing                                                      │
│  - Benefits configuration                                       │
│  - Stripe product/price linking                                 │
│  - Enable/disable toggle                                        │
│  - Display order                                                │
│  - Branding (icon, color, gradient)                             │
└─────────────────────────────────────────────────────────────────┘
```

#### NEW: Membership Subscribers (`/admin/membership/subscribers`)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  MEMBERSHIP SUBSCRIBERS                                         │
│  Filter: [All Tiers ▼] [All Statuses ▼] [Search...]            │
├─────────────────────────────────────────────────────────────────┤
│  Name        │ Tier     │ Status  │ Renews      │ Actions       │
│  ────────────┼──────────┼─────────┼─────────────┼────────────── │
│  John Smith  │ Gold     │ Active  │ Jan 1, 2027 │ [View] [Edit] │
│  Jane Doe    │ Platinum │ Active  │ Mar 15, 2027│ [View] [Edit] │
│  Bob Wilson  │ Gold     │ Expired │ Dec 31, 2026│ [View]        │
├─────────────────────────────────────────────────────────────────┤
│  Member Detail (when selected)                                  │
│  - Membership info                                              │
│  - Payment method                                               │
│  - Tags covered                                                 │
│  - Billing history                                              │
│  - Admin actions (extend, cancel, change tier)                  │
└─────────────────────────────────────────────────────────────────┘
```

#### NEW: Membership Dashboard (`/admin/membership/dashboard`)

**Metrics:**
- Total members by tier
- MRR/ARR calculations
- Renewal rate
- Churn rate
- Revenue by tier
- New members this month
- Expiring soon (30 days)

### Removed/Gold-Specific Screens

| Screen | Action |
|--------|--------|
| `GoldLanding.tsx` | Replace with `Membership.tsx` |
| `GoldUpgrade.tsx` | Replace with `MembershipSubscribe.tsx` |
| `GoldBenefits.tsx` | Replace with `MembershipManage.tsx` |
| `SubscriptionUpgrade.tsx` | Remove (no more tag subscriptions) |
| `GuardianLanding.tsx` | Update to reference membership |

---

## Notification Updates

### New Email Templates

| Template | Purpose | Theme |
|----------|---------|-------|
| `membership-welcome.ts` | Welcome to tier | Tier gradient |
| `membership-renewal-reminder.ts` | 30d/7d reminder | Default |
| `membership-renewed.ts` | Renewal confirmation | Success |
| `membership-cancelled.ts` | Cancellation confirmation | Warning |
| `membership-expired.ts` | Membership expired | Danger |
| `membership-tier-changed.ts` | Tier change confirmation | Default |
| `membership-card-expiring.ts` | Card expires in 4 weeks | Warning |
| `membership-card-expired.ts` | Card expired | Danger |
| `membership-payment-failed.ts` | Payment failed | Danger |
| `membership-payment-retry-success.ts` | Retry succeeded | Success |
| `membership-extended.ts` | Admin extended membership | Success |
| `tag-warranty-expiring.ts` | Warranty expiring | Warning |
| `tag-warranty-expiring-urgent.ts` | Warranty expires tomorrow | Danger |
| `tag-deactivated.ts` | Tag stopped (no membership) | Danger |
| `tag-reactivated.ts` | Tag reactivated | Success |
| `emergency-contact-notified.ts` | Emergency contact alerted | Warning |
| `emergency-admin-escalation.ts` | Admin escalation | Danger |
| `recovery-confirmed.ts` | Pet recovered | Success |

### Notification Matrix

| Category | Count | Change |
|---|---|---|
| Membership emails | 19 | NEW |
| Tag warranty emails | 5 | NEW |
| Emergency emails | 3 | NEW |
| Existing order emails | 10 | No change |
| Existing finder emails | 4 | No change |
| Existing system emails | 9 | No change |
| Guardian/loyalty emails | 9 | Update multiplier refs |

---

## Audit Trail Updates

### New Audit Events

| Event | Category | Severity |
|---|---|---|
| `membership.created` | FINANCIAL | HIGH |
| `membership.renewed` | FINANCIAL | HIGH |
| `membership.cancelled` | FINANCIAL | HIGH |
| `membership.expired` | FINANCIAL | HIGH |
| `membership.tier_changed` | UPDATE | HIGH |
| `membership.extended` | UPDATE | HIGH |
| `membership.payment_failed` | FINANCIAL | HIGH |
| `tag.warranty_check` | SYSTEM | LOW |
| `tag.deactivated` | SYSTEM | HIGH |
| `tag.reactivated` | SYSTEM | HIGH |
| `emergency.customer_notified` | SYSTEM | HIGH |
| `emergency.contact_notified` | SYSTEM | HIGH |
| `emergency.admin_notified` | SYSTEM | CRITICAL |
| `recovery.confirmed` | SYSTEM | HIGH |

---

## Background Jobs

### New Jobs

| Job | Frequency | Lock | Purpose |
|---|---|---|---|
| `membership-renewal-check` | 24 hours | `membership` | Send renewal reminders (30d, 7d) |
| `membership-renewal-process` | 24 hours | `membership` | Process annual renewals via Stripe |
| `membership-payment-retry` | 1 hour | `membership` | Retry failed membership payments |
| `membership-expiry-check` | 24 hours | `membership` | Expire memberships, deactivate tags |
| `tag-warranty-check` | 24 hours | `tag-warranty` | Check warranties, send reminders, deactivate |
| `card-expiry-check` | 24 hours | `card-expiry` | Check cards expiring in 4 weeks |

### Existing Jobs (Modify)

| Job | Change |
|---|---|
| `subscription-service` | 🔄 Remove tag subscription logic |
| `pawrewards` | 🔄 Update to use tier-specific multipliers (1x/2x/3x) |
| `escalation-service` | 🔄 Add membership-tier-aware escalation paths |

### Existing Jobs (No Change)

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

## Implementation Phases

### Phase 1: Foundation (Week 1)

| # | Packet | Files | Skills |
|---|--------|-------|--------|
| 1.1 | MembershipTier model | `packages/db/src/models/MembershipTier.ts` | database-integrity |
| 1.2 | UserMembership model | `packages/db/src/models/UserMembership.ts` | database-integrity |
| 1.3 | Update User model | `packages/db/src/models/User.ts` | database-integrity |
| 1.4 | Update Product model | `packages/db/src/models/Product.ts` | database-integrity |
| 1.5 | Seed membership tiers | `packages/api/src/seeds/seed-memberships.ts` | background-jobs |
| 1.6 | Remove existing Gold subscribers | Script | database-integrity |

### Phase 2: Backend Services (Week 1-2)

| # | Packet | Files | Skills |
|---|--------|-------|--------|
| 2.1 | Membership service | `packages/api/src/services/membership.service.ts` | commerce-safety, api-architecture |
| 2.2 | Membership routes (customer) | `packages/api/src/routes/membership.ts` | api-architecture |
| 2.3 | Membership routes (public) | `packages/api/src/routes/membership-public.ts` | api-architecture |
| 2.4 | Membership routes (admin) | `packages/api/src/routes/admin-membership.ts` | api-architecture |
| 2.5 | Stripe integration | Update `stripe.service.ts` | commerce-safety |
| 2.6 | Tag lifecycle update | Update `finder.ts`, `customer.ts` | commerce-safety |
| 2.7 | Membership benefits middleware | `packages/api/src/middleware/membership-benefits.ts` | commerce-safety |
| 2.8 | Emergency escalation update | Update `escalation.service.ts` | background-jobs |
| 2.9 | Background jobs | 6 new jobs | background-jobs |

### Phase 3: Email Templates (Week 2)

| # | Packet | Files | Skills |
|---|--------|-------|--------|
| 3.1 | Membership email templates | 19 new templates | pawtag-ui-ux |
| 3.2 | Tag warranty email templates | 5 new templates | pawtag-ui-ux |
| 3.3 | Emergency escalation templates | 3 new templates | pawtag-ui-ux |
| 3.4 | Update existing templates | Update tier/multiplier refs | coding-practice |

### Phase 4: Frontend — Customer (Week 2-3)

| # | Packet | Files | Skills |
|---|--------|-------|--------|
| 4.1 | Membership landing page | `apps/web/src/pages/Membership.tsx` | pawtag-ui-ux |
| 4.2 | Membership subscribe flow | `apps/web/src/pages/account/MembershipSubscribe.tsx` | pawtag-ui-ux |
| 4.3 | Membership management | `apps/web/src/pages/account/MembershipManage.tsx` | pawtag-ui-ux |
| 4.4 | Payment method management | `apps/web/src/components/PaymentMethodManager.tsx` | pawtag-ui-ux |
| 4.5 | Update routing | `apps/web/src/App.tsx` | coding-practice |
| 4.6 | Update account sidebar | `apps/web/src/components/AccountLayout.tsx` | pawtag-ui-ux |
| 4.7 | Simplify product pages | Update product detail, cart, checkout | pawtag-ui-ux |

### Phase 5: Frontend — Admin (Week 3)

| # | Packet | Files | Skills |
|---|--------|-------|--------|
| 5.1 | Membership tier config | `apps/admin/src/pages/MembershipTiers.tsx` | pawtag-ui-ux |
| 5.2 | Subscriber management | `apps/admin/src/pages/MembershipSubscribers.tsx` | pawtag-ui-ux |
| 5.3 | Membership dashboard | `apps/admin/src/pages/MembershipDashboard.tsx` | pawtag-ui-ux |
| 5.4 | Admin extension dialog | `apps/admin/src/components/MembershipExtendDialog.tsx` | pawtag-ui-ux |

### Phase 6: Cleanup (Week 3-4)

| # | Packet | Files | Skills |
|---|--------|-------|--------|
| 6.1 | Remove Gold code | Multiple files | coding-practice |
| 6.2 | Remove subscription from products | `checkout.service.ts`, `order-creation.service.ts` | coding-practice |
| 6.3 | Remove old subscription lifecycle | `subscription.service.ts` | coding-practice |
| 6.4 | Update tests | New + updated tests | testing-regression |
| 6.5 | Update documentation | README, AGENTS, DESIGN | coding-practice |

---

## Skills to Create

### Skill 1: `membership-system`
**Purpose:** Guide for implementing and maintaining the membership tier system
**Content:**
- MembershipTier configuration
- UserMembership lifecycle
- Tier benefits configuration
- Stripe integration for memberships
- Payment method management
- Tag warranty + membership gating
- Emergency escalation by tier

### Skill 2: `membership-ui-ux`
**Purpose:** UI/UX patterns for membership screens
**Content:**
- Membership landing page design
- Tier comparison component
- Subscription flow UX
- Management page layout
- Payment method management UX
- Admin tier configuration UX

### Skill 3: `tag-warranty`
**Purpose:** Tag warranty lifecycle management
**Content:**
- Warranty configuration per product
- Warranty expiry tracking
- Membership gating logic
- Admin extension flow
- Warranty reminder notifications

---

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `packages/db/src/models/MembershipTier.ts` | Tier configuration |
| `packages/db/src/models/UserMembership.ts` | User membership |
| `packages/api/src/services/membership.service.ts` | Membership logic |
| `packages/api/src/routes/membership.ts` | Customer API |
| `packages/api/src/routes/membership-public.ts` | Public API |
| `packages/api/src/routes/admin-membership.ts` | Admin API |
| `packages/api/src/middleware/membership-benefits.ts` | Benefits middleware |
| `packages/api/src/jobs/membership-*.ts` | 6 background jobs |
| `packages/api/src/services/email/templates/membership-*.ts` | 19 email templates |
| `packages/api/src/services/email/templates/tag-*.ts` | 5 email templates |
| `packages/api/src/services/email/templates/emergency-*.ts` | 3 email templates |
| `apps/web/src/pages/Membership.tsx` | Landing page |
| `apps/web/src/pages/account/MembershipSubscribe.tsx` | Subscribe flow |
| `apps/web/src/pages/account/MembershipManage.tsx` | Management |
| `apps/web/src/components/PaymentMethodManager.tsx` | Payment methods |
| `apps/admin/src/pages/MembershipTiers.tsx` | Tier config |
| `apps/admin/src/pages/MembershipSubscribers.tsx` | Subscribers |
| `apps/admin/src/pages/MembershipDashboard.tsx` | Dashboard |
| `apps/admin/src/components/MembershipExtendDialog.tsx` | Extension dialog |

### Modified Files

| File | Changes |
|------|---------|
| `packages/db/src/models/User.ts` | Add membershipTier, membershipId |
| `packages/db/src/models/Product.ts` | Add productType, warrantyMonths |
| `packages/db/src/models/Tag.ts` | Add warrantyEndsAt |
| `packages/api/src/routes/finder.ts` | Warranty + membership check |
| `packages/api/src/routes/customer.ts` | Tag activation update |
| `packages/api/src/services/stripe.service.ts` | Membership Stripe integration |
| `packages/api/src/services/escalation.service.ts` | Tier-aware escalation |
| `apps/web/src/App.tsx` | New routes |
| `apps/web/src/components/AccountLayout.tsx` | Sidebar update |
| `apps/web/src/pages/product/ProductDetail.tsx` | Simplify (no subscriptions) |
| `apps/web/src/pages/Cart.tsx` | Simplify (no subscriptions) |
| `apps/web/src/pages/Checkout.tsx` | Simplify (no subscriptions) |
| `apps/admin/src/App.tsx` | New admin routes |

### Removed Files

| File | Reason |
|------|--------|
| `apps/web/src/pages/GoldLanding.tsx` | Replaced by Membership.tsx |
| `apps/web/src/pages/account/GoldUpgrade.tsx` | Replaced by MembershipSubscribe.tsx |
| `apps/web/src/pages/account/GoldBenefits.tsx` | Replaced by MembershipManage.tsx |
| `packages/api/src/middleware/gold-benefits.ts` | Replaced by membership-benefits.ts |
| `packages/api/src/services/email/templates/gold-welcome.ts` | Replaced by membership emails |
| `packages/api/src/services/email/templates/gold-cancellation.ts` | Replaced by membership emails |

---

## Design Specifications

### Membership Landing Page

**Hero Section:**
- Background: Gradient from teal-600 to teal-700
- Headline: `text-4xl font-bold text-white` (display scale)
- Subtitle: `text-xl text-teal-100` (body-lg)
- CTA: Primary button with white text

**Tier Cards:**
- Gold: `bg-gradient-to-br from-yellow-400 to-amber-500 text-white`
- Platinum: `bg-gradient-to-br from-gray-300 to-gray-500 text-white` with "Recommended" badge
- Black: `bg-gradient-to-br from-gray-800 to-black text-white` with "Coming Soon" overlay
- Card style: `rounded-2xl shadow-xl p-8`
- Price: `text-4xl font-bold`
- Features: Checkmark list with `text-sm`

**Benefits Matrix:**
- Table with alternating row colors (`gray-50` / white)
- Checkmarks: `text-green-500`
- Crosses: `text-gray-300`
- Headers: `font-semibold text-gray-900`

### Membership Management Page

**Current Membership Card:**
- Tier gradient background
- White text
- Status badge
- Renewal date
- Action buttons

**Benefits List:**
- Checkmark icons with tier color
- Grouped by category

**Payment Method Card:**
- Card brand icon
- Last 4 digits
- Expiry
- Update button

### Admin Tier Configuration

**Tier Card:**
- Compact card with tier gradient header
- Member count
- Revenue contribution
- Enable/disable toggle
- Edit button

**Edit Form:**
- Two-column layout
- Pricing fields
- Benefits checkboxes (grouped)
- Stripe integration fields
- Branding fields (icon, color, gradient preview)

---

## Summary Statistics

| Category | Count |
|---|---|
| New database models | 2 |
| Modified database models | 3 |
| New API routes | 3 |
| New services | 1 |
| New email templates | 27 |
| New background jobs | 6 |
| New admin pages | 4 |
| New frontend pages | 4 |
| New components | 1 |
| Files to remove | ~10 |
| Files to modify | ~15 |
| New audit event types | 14 |
| New skills to create | 3 |

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
