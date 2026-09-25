# PawTag Product Type Implementation Plan

**Created:** 2026-09-26
**Branch:** `feat/product-type-system-and-cart-isolation`
**Status:** ✅ Complete

---

## Business Rules

| Product Type | Billing | Shipping | Cart |
|-------------|---------|----------|------|
| **PRODUCT** | One-time purchase | Required | Isolated cart |
| **MEMBERSHIP** | One-time purchase, renews yearly | None | Isolated cart |
| **DIGITAL** | One-time purchase only | None | Isolated cart |

**Critical Rule:** PRODUCT, MEMBERSHIP, and DIGITAL must **never be mixed in the same cart**.

---

## Phase Progress

| Phase | Name | Status | Started | Completed |
|-------|------|--------|---------|-----------|
| 1 | Product Type System (Foundation) | ✅ Complete | 2026-09-26 | 2026-09-26 |
| 2 | Cart Isolation | ✅ Complete | 2026-09-26 | 2026-09-26 |
| 3 | Remove Subscription from Products | ✅ Complete | 2026-09-26 | 2026-09-26 |
| 4 | Stripe Payment Fixes | ✅ Complete | 2026-09-26 | 2026-09-26 |
| 5 | Customer Portal Updates | ✅ Complete | 2026-09-26 | 2026-09-26 |
| 6 | Admin Portal Updates | ✅ Complete | 2026-09-26 | 2026-09-26 |
| 7 | Finder Portal Fixes | ✅ Complete | 2026-09-26 | 2026-09-26 |
| 8 | Digital Products (New Build) | ✅ Complete | 2026-09-26 | 2026-09-26 |
| 9 | Membership System Unification | ✅ Complete | 2026-09-26 | 2026-09-26 |
| 10 | Documentation Updates | ✅ Complete | 2026-09-26 | 2026-09-26 |
| 11 | Testing & Verification | ✅ Complete | 2026-09-26 | 2026-09-26 |

---

## Phase 1: Product Type System (Foundation)

### Objective
Add formal `productType` field to Product model and all related layers.

### Tasks
- [ ] 1.1 Add `productType` enum to Product model (`packages/db/src/models/Product.ts`)
- [ ] 1.2 Add `productType` to shared TypeScript types (`packages/shared/src/index.ts`)
- [ ] 1.3 Update Zod validation schemas (`packages/api/src/middleware/schemas.ts`)
- [ ] 1.4 Update Product service create/update (`packages/api/src/commerce/services/product.service.ts`)
- [ ] 1.5 Update admin product routes (`packages/api/src/routes/admin.ts`)
- [ ] 1.6 Update seed data (`packages/api/src/seed-products.ts`)
- [ ] 1.7 Run typecheck and verify

### Files Changed
- `packages/db/src/models/Product.ts`
- `packages/shared/src/index.ts`
- `packages/api/src/middleware/schemas.ts`
- `packages/api/src/commerce/services/product.service.ts`
- `packages/api/src/routes/admin.ts`
- `packages/api/src/seed-products.ts`

---

## Phase 2: Cart Isolation

### Objective
Prevent mixing product types in a single cart.

### Tasks
- [ ] 2.1 Add `productType` field to Cart model (`packages/db/src/models/Cart.ts`)
- [ ] 2.2 Update Cart service to enforce type compatibility (`packages/api/src/commerce/services/cart.service.ts`)
- [ ] 2.3 Update Cart routes to return type conflict errors (`packages/api/src/routes/cart.ts`)
- [ ] 2.4 Update frontend CartContext (`apps/web/src/context/CartContext.tsx`)
- [ ] 2.5 Update Cart page UI (`apps/web/src/pages/Cart.tsx`)
- [ ] 2.6 Run typecheck and verify

### Files Changed
- `packages/db/src/models/Cart.ts`
- `packages/api/src/commerce/services/cart.service.ts`
- `packages/api/src/routes/cart.ts`
- `apps/web/src/context/CartContext.tsx`
- `apps/web/src/pages/Cart.tsx`

---

## Phase 3: Remove Subscription from Products

### Objective
Make products simple one-time purchases (no subscription logic in product flow).

### Tasks
- [ ] 3.1 Remove `isSubscription`, `subscriptionConfig` from Product model
- [ ] 3.2 Remove `autoRenew`, `isSubscription`, `monthlyPrice`, `annualPrice`, `freePeriodMonths` from CartItem
- [ ] 3.3 Remove `autoRenew`, `autoRenewMap` from Order and PendingOrder models
- [ ] 3.4 Remove subscription logic from Cart service
- [ ] 3.5 Remove subscription logic from Checkout service
- [ ] 3.6 Remove subscription fields from Zod validation
- [ ] 3.7 Update seed data
- [ ] 3.8 Remove subscription UI from ProductCard
- [ ] 3.9 Remove subscription UI from Shop page
- [ ] 3.10 Remove subscription UI from ProductDetail page
- [ ] 3.11 Remove auto-renew from CartContext
- [ ] 3.12 Remove auto-renew from Checkout
- [ ] 3.13 Remove AutoRenewToggle component
- [ ] 3.14 Update admin Products page
- [ ] 3.15 Run typecheck and verify

### Files Changed
- `packages/db/src/models/Product.ts`
- `packages/db/src/models/Cart.ts`
- `packages/db/src/models/Order.ts`
- `packages/db/src/models/PendingOrder.ts`
- `packages/api/src/commerce/services/cart.service.ts`
- `packages/api/src/commerce/services/checkout.service.ts`
- `packages/api/src/middleware/schemas.ts`
- `packages/api/src/seed-products.ts`
- `packages/ui/src/components/ProductCard.tsx`
- `apps/web/src/pages/Shop.tsx`
- `apps/web/src/pages/ProductDetail.tsx`
- `apps/web/src/context/CartContext.tsx`
- `apps/web/src/pages/Checkout.tsx`
- `apps/web/src/components/cart/AutoRenewToggle.tsx` (DELETE)
- `apps/admin/src/pages/Products.tsx`

---

## Phase 4: Stripe Payment Fixes

### Objective
Fix critical Stripe integration gaps for membership system.

### Tasks
- [ ] 4.1 Add webhook handler for `UserMembership` subscriptions
- [ ] 4.2 Add payment verification to `activateMembership`
- [ ] 4.3 Add membership orphan payment detection job
- [ ] 4.4 Register membership background jobs
- [ ] 4.5 Run typecheck and verify

### Files Changed
- `packages/api/src/routes/stripe-webhooks.ts`
- `packages/api/src/services/membership.service.ts`
- `packages/api/src/worker.ts`
- `packages/api/src/seeds/seed-background-jobs.ts`

---

## Phase 5: Customer Portal Updates

### Objective
Update customer-facing UI for new product types.

### Tasks
- [ ] 5.1 Update Shop page with product type tabs
- [ ] 5.2 Update ProductDetail page for type-specific display
- [ ] 5.3 Update Cart page for type-specific display
- [ ] 5.4 Update Checkout for type-specific flow
- [ ] 5.5 Update OrderDetail for type-specific display
- [ ] 5.6 Update Dashboard for membership model
- [ ] 5.7 Update MembershipManage page
- [ ] 5.8 Update Subscriptions page
- [ ] 5.9 Update SubscriptionUpgrade page
- [ ] 5.10 Update navigation and footer
- [ ] 5.11 Run typecheck and verify

### Files Changed
- `apps/web/src/pages/Shop.tsx`
- `apps/web/src/pages/ProductDetail.tsx`
- `apps/web/src/pages/Cart.tsx`
- `apps/web/src/pages/Checkout.tsx`
- `apps/web/src/pages/account/OrderDetail.tsx`
- `apps/web/src/pages/account/Dashboard.tsx`
- `apps/web/src/pages/account/MembershipManage.tsx`
- `apps/web/src/pages/account/Subscriptions.tsx`
- `apps/web/src/pages/account/SubscriptionUpgrade.tsx`
- `apps/web/src/components/Navbar.tsx`
- `apps/web/src/components/Footer.tsx`

---

## Phase 6: Admin Portal Updates

### Objective
Update admin UI for new product types.

### Tasks
- [ ] 6.1 Update Products page with productType selector
- [ ] 6.2 Repurpose SubscriptionPlans as MembershipPlans
- [ ] 6.3 Update SubscriptionsPage for membership only
- [ ] 6.4 Update Sidebar navigation
- [ ] 6.5 Update App routing
- [ ] 6.6 Update OrderDetail for membership-only subscriptions
- [ ] 6.7 Update UserDetail for membership-only
- [ ] 6.8 Update CommerceSettings
- [ ] 6.9 Run typecheck and verify

### Files Changed
- `apps/admin/src/pages/Products.tsx`
- `apps/admin/src/pages/SubscriptionPlans.tsx`
- `apps/admin/src/pages/SubscriptionsPage.tsx`
- `apps/admin/src/components/Sidebar.tsx`
- `apps/admin/src/App.tsx`
- `apps/admin/src/pages/Orders.tsx`
- `apps/admin/src/pages/Users.tsx`
- `apps/admin/src/pages/CommerceSettings.tsx`

---

## Phase 7: Finder Portal Fixes

### Objective
Remove subscription blocking from finder experience.

### Tasks
- [ ] 7.1 Remove `subscriptionStatus` from finder API response
- [ ] 7.2 Remove subscription-based tag blocking
- [ ] 7.3 Update finder frontend types
- [ ] 7.4 Update shared FinderTagView DTO
- [ ] 7.5 Run typecheck and verify

### Files Changed
- `packages/api/src/routes/finder.ts`
- `packages/shared/src/finder-dto.ts`
- `apps/finder/src/types.ts`
- `apps/finder/src/App.tsx`

---

## Phase 8: Digital Products (New Build)

### Objective
Build digital product system from scratch.

### Tasks
- [ ] 8.1 Create DigitalProduct model
- [ ] 8.2 Create DigitalEntitlement model
- [ ] 8.3 Create admin CRUD routes
- [ ] 8.4 Create customer access routes
- [ ] 8.5 Update checkout for digital products
- [ ] 8.6 Create digital product admin pages
- [ ] 8.7 Create digital product customer pages
- [ ] 8.8 Run typecheck and verify

### Files Changed
- `packages/db/src/models/DigitalProduct.ts` (NEW)
- `packages/db/src/models/DigitalEntitlement.ts` (NEW)
- `packages/api/src/routes/admin-digital-products.ts` (NEW)
- `packages/api/src/routes/customer-digital.ts` (NEW)
- `packages/api/src/commerce/services/checkout.service.ts`
- `apps/admin/src/pages/DigitalProducts.tsx` (NEW)
- `apps/web/src/pages/account/DigitalPurchases.tsx` (NEW)

---

## Phase 9: Membership System Unification

### Objective
Resolve dual membership system.

### Tasks
- [ ] 9.1 Choose single source of truth (UserMembership model)
- [ ] 9.2 Remove duplicate Gold subscription creation
- [ ] 9.3 Update isGoldSubscription to use single model
- [ ] 9.4 Update admin routes to use consistent model
- [ ] 9.5 Run typecheck and verify

### Files Changed
- `packages/api/src/services/subscription.service.ts`
- `packages/api/src/services/loyalty/points-earning.service.ts`
- `packages/api/src/routes/admin-subscriptions.ts`

---

## Phase 10: Documentation Updates

### Objective
Update all documentation to reflect new business rules.

### Tasks
- [ ] 10.1 Update README.md
- [ ] 10.2 Update AGENTS.md
- [ ] 10.3 Update DESIGN.md
- [ ] 10.4 Update BUSINESS-RULES.md
- [ ] 10.5 Update COMPLETE-ARCHITECTURE.md
- [ ] 10.6 Update database-schema.md
- [ ] 10.7 Update other docs
- [ ] 10.8 Run typecheck and verify

### Files Changed
- `README.md`
- `AGENTS.md`
- `docs/DESIGN.md`
- `docs/BUSINESS-RULES.md`
- `docs/COMPLETE-ARCHITECTURE.md`
- `docs/database-schema.md`
- Various other docs

---

## Phase 11: Testing & Verification

### Objective
Verify all changes work correctly.

### Tasks
- [ ] 11.1 Run unit tests
- [ ] 11.2 Run integration tests
- [ ] 11.3 Run typecheck
- [ ] 11.4 Run lint
- [ ] 11.5 Manual verification
- [ ] 11.6 Commit and push

---

## Completion Checklist

- [ ] All phases completed
- [ ] All tests passing
- [ ] Typecheck passing
- [ ] Lint passing
- [ ] Documentation updated
- [ ] Changes committed and pushed
