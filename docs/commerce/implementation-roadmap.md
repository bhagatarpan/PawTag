# PawTag Commerce — Implementation Roadmap

> **Master Plan Reference:** See [PawTag Master Project Plan](../PawTag-Master-Project-Plan.md) for overall project strategy, phasing, and tracking
> **Phase Association:** This document provides historical reference for completed **Phases 0-13 (Commerce Migration)** and the **Revised Subscription-First Implementation Roadmap**
> **Last Updated:** September 2026 — Updated to reference Master Plan and Revised Subscription-First Roadmap

**Date:** 2026-08-30
**Status:** Commercial Migration Complete — Subscription-First Implementation Revised

---

## Implementation Principles

1. **No big-bang rewrite.** Each phase was independent and deployable.
2. **Every phase has tests, documentation, and rollback.**
3. **No hardcoded business values.** All config via CMS settings or environment variables.
4. **PawTag owns all commerce business logic.** No external commerce platform dependency.

---

## Revised Plan: Subscription-First Approach

**Priority Change:** Subscription comes first. Commerce is a future state.

### Revised Plan Principles

1. **Subscription must work independently now**, without requiring the Commerce implementation.
2. **Subscription must work with my own products immediately.**
3. **Avoid architectural decisions that would need to be redesigned** when Commerce is introduced later.
4. **When Commerce is introduced later, Subscription should naturally fit** into the Commerce architecture without requiring a major rewrite.
5. **Commerce should be treated as a future capability**, not a dependency for Subscription.
6. **Build the right foundations now, but do not over-engineer or implement Commerce prematurely.**

---

## Now → Subscription

### Phase S1: Subscription Architecture & Domain Foundation
**Objective:** Define subscription architecture and establish domain foundation for subscription system.

**Changes:**
1. Define Subscription model (extend existing or create new)
2. Create SubscriptionService with core functionality
3. Implement basic subscription lifecycle
4. Establish subscription statuses and transitions
5. Create admin UI for subscription management
6. Set up basic analytics for subscriptions
7. Design subscription to be commerce-agnostic (future-proof)

**Key Deliverables:**
- Enhanced Subscription model with proper fields
- SubscriptionService with CRUD operations
- Basic subscription lifecycle management
- Admin UI for subscription management
- Basic subscription analytics

**Dependencies:** Phase 0 complete (already done)
**Estimated Effort:** 1-2 weeks
**Exit Criteria:** Subscription architecture defined, core service implemented

---

### Phase S2: Subscription Implementation with Own Products
**Objective:** Implement subscription system for PawTag's own products.

**Changes:**
1. Create subscription plans for own products
2. Implement subscription creation and management
3. Build subscription dashboard for customers
4. Set up subscription notifications
5. Implement subscription cancellation
6. Create subscription analytics dashboard

**Key Deliverables:**
- Subscription plans for all PawTag products
- Customer subscription dashboard
- Subscription creation flow
- Subscription management UI
- Subscription notifications
- Subscription analytics

**Dependencies:** Phase S1 complete
**Estimated Effort:** 2-3 weeks
**Exit Criteria:** Subscriptions working with own products, customer dashboard functional

---

### Phase S3: Subscription Admin & Analytics
**Objective:** Enhance subscription administration and analytics capabilities.

**Changes:**
1. Enhance admin UI for subscription management
2. Implement subscription reporting
3. Create subscription analytics dashboard
4. Set up subscription performance metrics
5. Implement subscription admin tools

**Key Deliverables:**
- Enhanced subscription admin dashboard
- Subscription reporting and analytics
- Subscription performance metrics
- Subscription admin tools

**Dependencies:** Phase S2 complete
**Estimated Effort:** 1-2 weeks
**Exit Criteria:** Admin can fully manage subscriptions, analytics functional

---

### Phase S4: Subscription Automation & Reconciliation
**Objective:** Build automation and reconciliation for subscription system.

**Changes:**
1. Build background jobs for subscription processing
2. Implement subscription reconciliation
3. Set up subscription monitoring
4. Create subscription error handling
5. Implement subscription reporting

**Key Deliverables:**
- Background jobs for subscription processing
- Subscription reconciliation system
- Subscription monitoring
- Subscription error handling
- Subscription reporting

**Dependencies:** Phase S3 complete
**Estimated Effort:** 2-3 weeks
**Exit Criteria:** Subscription automation running, reconciliation functional

---

### Phase S5: Subscription Growth & Optimization
**Objective:** Optimize subscription system for growth and customer experience.

**Changes:**
1. Optimize subscription conversion
2. Implement subscription upsell/cross-sell
3. Enhance subscription customer experience
4. Implement subscription retention strategies
5. Optimize subscription pricing

**Key Deliverables:**
- Subscription conversion optimization
- Subscription upsell/cross-sell
- Enhanced customer experience
- Subscription retention strategies
- Pricing optimization

**Dependencies:** Phase S4 complete
**Estimated Effort:** 1-2 weeks
**Exit Criteria:** Subscription growth metrics improving, customer satisfaction high

---

### Phase S6: Production Hardening (Subscription)
**Objective:** Ensure subscription system is production-ready.

**Changes:**
1. Security audit and hardening
2. Performance optimization and load testing
3. Comprehensive error handling
4. Data backup and recovery procedures
5. Disaster recovery plan
6. Final documentation completion
7. Knowledge transfer and training

**Key Deliverables:**
- Security audit results
- Performance test results
- Error handling improvements
- Backup and recovery procedures
- Documentation completion

**Dependencies:** Phase S5 complete
**Estimated Effort:** 2-3 weeks
**Exit Criteria:** Subscription system production-ready, all tests passing

---

## Later → Commerce

### Phase C1: Commerce Architecture & Domain Foundation
**Objective:** Design target architecture and establish data models for supplier/product ownership.

**Key Deliverables:**
- Commerce architecture document
- Enhanced Product model with commerceModel, supplierId, supplierPrice fields
- New Supplier, SupplierProduct, SupplierOrder models
- ISupplierProvider interface definition
- Supplier CRUD service skeleton
- Database migration scripts

**Dependencies:** Subscription system complete (Phase S6)
**Estimated Effort:** 1-2 weeks
**Exit Criteria:** Architecture document approved, data models defined

---

### Phase C2: Supplier + Product Source Engine
**Objective:** Build infrastructure for bringing external products into PawTag.

**Key Deliverables:**
- SupplierService (CRUD operations)
- SupplierProductService (mapping and synchronization)
- Product feed parsers (XML/CSV/JSON)
- SupplierOrderService (order submission and tracking)
- Background job for product feed sync
- Admin supplier management UI
- Feed import/upload interface

**Dependencies:** Phase C1 complete
**Estimated Effort:** 2-3 weeks
**Exit Criteria:** Supplier onboarding workflow functional

---

### Phase C3: Product Catalogue & Shop
**Objective:** Enable customer-facing product discovery and shopping.

**Key Deliverables:**
- Product search and filtering enhancements
- Supplier badges on product cards
- "Ships from NZ/AU/China" indicators
- Cross-sell recommendations
- Product reviews and ratings system
- Shop page enhancements for multi-source products

**Dependencies:** Phase C2 complete
**Estimated Effort:** 1-2 weeks
**Exit Criteria:** Customer can browse and filter products by source

---

### Phase C4: Orders + Supplier Fulfilment
**Objective:** Implement order splitting and supplier fulfilment engine.

**Key Deliverables:**
- Order splitting logic (group items by supplier)
- Supplier order creation/submission service
- Tracking synchronization from suppliers
- Order detail enhancements for multi-supplier tracking
- Return routing to original supplier
- Supplier order management UI

**Dependencies:** Phase C3 complete
**Estimated Effort:** 2-3 weeks
**Exit Criteria:** Orders correctly split and forwarded to suppliers

---

### Phase C5: Affiliate Commerce
**Objective:** Implement affiliate tracking as another commerce source.

**Key Deliverables:**
- AffiliateService (click tracking, conversion attribution)
- CommissionService (lifecycle management)
- Affiliate link generation
- Affiliate dashboard (clicks, conversions, commissions)
- Integration with existing referral system
- Affiliate payout management

**Dependencies:** Phase C4 complete
**Estimated Effort:** 2-3 weeks
**Exit Criteria:** Affiliate clicks and conversions tracked accurately

---

## Future Integration → Subscription + Commerce

### Phase I1: Subscription-Commerce Integration
**Objective:** Integrate subscription system with commerce capabilities.

**Key Deliverables:**
- Extended subscription system for commerce products
- Subscription upsell for commerce products
- Enhanced subscription analytics for commerce products
- Admin UI for managing both subscription types
- Subscription reporting for commerce products

**Dependencies:** Commerce system complete (Phase C5)
**Estimated Effort:** 2-3 weeks
**Exit Criteria:** Subscription system supports both own products and commerce products

---

### Phase I2: Final Production Hardening
**Objective:** Ensure complete system is production-ready.

**Key Deliverables:**
- Security audit and hardening
- Performance optimization and load testing
- Comprehensive error handling
- Data backup and recovery procedures
- Disaster recovery plan
- Final documentation completion
- Knowledge transfer and training

**Dependencies:** Phase I1 complete
**Estimated Effort:** 2-3 weeks
**Exit Criteria:** Complete system production-ready, all tests passing

---

## How Subscription Works with Own Products (Without Commerce)

### Current Approach (Subscription-First)

**Product Management:**
- PawTag's own products are managed directly in the admin portal
- Products are created with subscription configuration
- Subscription plans are linked to products
- Pricing is managed directly in the subscription system

**Subscription Lifecycle:**
- Customers subscribe to PawTag products directly
- Subscription billing is managed by the subscription system
- Subscription status transitions are handled by SubscriptionService
- Subscription analytics track performance

**Key Features:**
- Subscription creation and management
- Subscription billing and renewals
- Subscription cancellation and pausing
- Subscription notifications
- Subscription analytics and reporting

**Benefits of This Approach:**
1. **Immediate Value:** Subscription system works immediately with own products
2. **No External Dependencies:** No dependency on commerce system
3. **Clear Separation:** Subscription and commerce are separate domains
4. **Future-Proof:** Design allows easy integration when commerce is introduced
5. **Lower Risk:** Simpler implementation, easier to test and debug

---

## How Subscription Will Integrate with Commerce (Future State)

### When Commerce is Introduced

**Architecture Integration:**
- Subscription system remains unchanged
- Commerce products are added as additional subscription options
- Subscription system handles both PawTag products and commerce products
- Subscription analytics include both subscription types

**Data Model Extension:**
- Subscription model extended with optional commerce fields
- New subscription types for commerce products
- Extended subscription management for both types
- Enhanced analytics for both subscription types

**Admin UI Integration:**
- Admin UI extended to manage both subscription types
- Subscription dashboard shows both PawTag and commerce subscriptions
- Analytics include both subscription types
- Reporting covers both subscription types

**Benefits of This Design:**
1. **Minimal Changes:** Subscription system requires minimal changes
2. **Backward Compatible:** Existing subscriptions continue working
3. **Progressive Enhancement:** Commerce adds new capabilities without breaking existing
4. **Clear Separation:** Subscription and commerce remain separate domains
5. **Maintainability:** Easier to maintain and debug separate systems

---

## Timeline Estimate

### Completed Commercial Migration (Historical Reference)

| Phase | Status | Duration | Dependencies |
|-------|--------|----------|-------------|
| Phase 0 | ✅ Complete | — | — |
| Phase 1 | ✅ Complete | 1 week | Phase 0 |
| Phase 2 | ✅ Complete | 2 weeks | Phase 1 |
| Phase 3 | ✅ Complete | 1 week | Phase 2 |
| Phase 4 | ✅ Complete | 2 weeks | Phase 3 |
| Phase 5 | ✅ Complete | 1 week | Phase 4 |
| Phase 6 | ✅ Complete | 1 week | Phase 5 |
| Phase 7 | ✅ Complete | 1 week | Phase 6 |
| Phase 8 | ✅ Complete | 1 week | Phase 7 |
| Phase 9 | ✅ Complete | 2 weeks | Phase 8 |
| Phase 10 | ✅ Complete | 1 week | Phase 9 |
| Phase 11 | ✅ Complete | 1 week | Phase 10 |
| Phase 12 | ✅ Complete | 1 week | Phase 11 |
| Phase 13 | ✅ Complete | 1 week | Phase 12 |
| **Total Commercial** | **13/13 complete** | **~16 weeks** | |

### Revised Subscription-First Implementation

| Phase | Status | Duration | Dependencies | Priority |
|-------|--------|----------|-------------|----------|
| Phase S1 | 🔲 Pending | 1-2 weeks | Phase 0 | HIGH |
| Phase S2 | 🔲 Pending | 2-3 weeks | Phase S1 | HIGH |
| Phase S3 | 🔲 Pending | 1-2 weeks | Phase S2 | HIGH |
| Phase S4 | 🔲 Pending | 2-3 weeks | Phase S3 | HIGH |
| Phase S5 | 🔲 Pending | 1-2 weeks | Phase S4 | MEDIUM |
| Phase S6 | 🔲 Pending | 2-3 weeks | Phase S5 | HIGH |
| **Total Subscription** | **0/6 complete** | **~9-13 weeks** | | **IMMEDIATE** |

### Future Commerce Implementation

| Phase | Status | Duration | Dependencies | Priority |
|-------|--------|----------|-------------|----------|
| Phase C1 | 🔲 Pending | 1-2 weeks | Phase S6 | FUTURE |
| Phase C2 | 🔲 Pending | 2-3 weeks | Phase C1 | FUTURE |
| Phase C3 | 🔲 Pending | 1-2 weeks | Phase C2 | FUTURE |
| Phase C4 | 🔲 Pending | 2-3 weeks | Phase C3 | FUTURE |
| Phase C5 | 🔲 Pending | 2-3 weeks | Phase C4 | FUTURE |
| **Total Commerce** | **0/5 complete** | **~8-13 weeks** | | **FUTURE** |

### Future Integration Implementation

| Phase | Status | Duration | Dependencies | Priority |
|-------|--------|----------|-------------|----------|
| Phase I1 | 🔲 Pending | 2-3 weeks | Phase C5 | FUTURE |
| Phase I2 | 🔲 Pending | 2-3 weeks | Phase I1 | FUTURE |
| **Total Integration** | **0/2 complete** | **~4-6 weeks** | | **FUTURE** |

### Complete Revised Timeline Summary

| Category | Phases | Duration | Priority |
|----------|--------|----------|----------|
| **Completed Commercial Migration** | Phases 0-13 | ~16 weeks | HISTORICAL |
| **Subscription-First Implementation** | Phases S1-S6 | ~9-13 weeks | IMMEDIATE |
| **Future Commerce Implementation** | Phases C1-C5 | ~8-13 weeks | FUTURE |
| **Future Integration Implementation** | Phases I1-I2 | ~4-6 weeks | FUTURE |
| **Complete Revised Project** | Phases 0-13, S1-S6, C1-C5, I1-I2 | ~37-48 weeks | OVERALL |

**Note:** Subscription system is the immediate priority. Commerce is a future capability that will integrate naturally when introduced.

---

## Dependencies to Avoid

1. **Avoid making commerce decisions that would require subscription redesign**
   - Don't create subscription models that assume commerce products exist
   - Don't create subscription services that depend on commerce services
   - Don't create subscription UIs that assume commerce features

2. **Avoid implementing commerce features that would conflict with subscription**
   - Don't create product models that assume multiple suppliers
   - Don't create order models that assume order splitting
   - Don't create cart models that assume multi-supplier carts

3. **Avoid creating dependencies between subscription and commerce systems**
   - Keep subscription system independent
   - Keep commerce system independent
   - Design interfaces that allow future integration

4. **Avoid making architectural decisions that would limit future commerce integration**
   - Design subscription system to be extensible
   - Use provider patterns where appropriate
   - Maintain clear domain boundaries

5. **Avoid implementing features that would require major redesign when commerce is introduced**
   - Start with simple subscription models
   - Add complexity only when needed
   - Design for extensibility from the start

---

## Decisions to Make Now vs. Later

### Decisions to Make Now

1. **Subscription Architecture:**
   - How to model subscription plans
   - How to handle subscription billing
   - How to manage subscription lifecycle
   - How to implement subscription analytics

2. **Subscription Implementation with Own Products:**
   - How to create subscription plans for own products
   - How to implement subscription creation flow
   - How to build subscription dashboard
   - How to handle subscription notifications

3. **Subscription Admin and Analytics:**
   - How to design subscription admin UI
   - How to implement subscription reporting
   - How to create subscription analytics dashboard
   - How to set up subscription performance metrics

4. **Subscription Automation and Reconciliation:**
   - How to build background jobs for subscription processing
   - How to implement subscription reconciliation
   - How to set up subscription monitoring
   - How to create subscription error handling

### Decisions to Make Later (When Commerce is Introduced)

1. **Commerce Architecture:**
   - How to model supplier/product ownership
   - How to handle product feeds and synchronization
   - How to implement order splitting and fulfilment
   - How to manage affiliate tracking

2. **Commerce Implementation:**
   - How to implement supplier management
   - How to build product source engine
   - How to create product catalogue and shop
   - How to handle orders and supplier fulfilment

3. **Subscription-Commerce Integration:**
   - How to extend subscription system for commerce products
   - How to integrate subscription analytics for commerce products
   - How to extend admin UI for both subscription types
   - How to handle subscription reporting for commerce products

---

## Recommended Approach: Simplest, Safest Path to Subscription

### Step 1: Start with Subscription Architecture
- Define the subscription model and service
- Implement basic subscription lifecycle
- Create admin UI for subscription management

### Step 2: Implement Subscription with Own Products
- Create subscription plans for own products
- Build subscription dashboard for customers
- Set up subscription notifications and cancellation

### Step 3: Enhance Subscription Admin and Analytics
- Implement subscription reporting and analytics
- Create subscription performance metrics
- Build subscription admin tools

### Step 4: Add Subscription Automation and Reconciliation
- Implement background jobs for subscription processing
- Set up subscription monitoring and error handling

### Step 5: Optimize Subscription Growth and Experience
- Implement subscription upsell/cross-sell
- Enhance customer experience and retention strategies

### Step 6: Prepare for Future Commerce Integration
- Design subscription system to be commerce-agnostic
- Maintain clear separation between subscription and commerce domains
- Build extensible admin UI for future commerce features

**Benefits of This Approach:**
1. **Immediate Value:** Subscription system works immediately
2. **Lower Risk:** Simpler implementation, easier to test
3. **Clear Separation:** Subscription and commerce are separate domains
4. **Future-Proof:** Design allows easy integration when commerce is introduced
5. **Maintainability:** Easier to maintain and debug separate systems

---

## Summary

This revised plan prioritizes Subscription while keeping Commerce as a future capability. The architecture is designed to accommodate future Commerce integration without requiring major redesigns. The plan clearly separates what should be built now for Subscription and what should be postponed until Commerce is introduced.

**Key Takeaways:**
1. **Subscription is the immediate priority**
2. **Commerce is a future capability**
3. **Architecture is designed for future integration**
4. **Implementation is phased and manageable**
5. **Risk is minimized with clear separation**

---

## Phase 0 — Repository Discovery and Current-State Baseline ✅

**Objective:** Establish the actual current state of the codebase.

**Completed:**
- [x] Inspected all 52+ commerce-dependent files
- [x] Verified Product, Cart, Order, Invoice, Subscription models
- [x] Traced complete checkout flow (4-step wizard)
- [x] Mapped all Stripe integration points
- [x] Identified critical gaps (signature verification, orphan detection, hardcoded pricing)
- [x] Created `docs/commerce/current-state-baseline.md`
- [x] Created `docs/commerce/implementation-roadmap.md`

---

## Phase 1 — Commerce Foundation and Core Domain ✅

**Objective:** Establish clean domain boundaries and provider interfaces for PawTag Commerce.

**Changes:**
1. Create `packages/api/src/commerce/` directory structure
2. Define provider interfaces (Payment, Shipping, Inventory, Tax)
3. Create commerce configuration service (CMS-driven settings)
4. Establish consistent error handling patterns
5. Create commerce audit logging helpers
6. Document architecture in `docs/commerce/architecture.md`

**Files created:**
```
packages/api/src/commerce/
├── index.ts                    # Commerce module exports
├── config.ts                   # Commerce configuration (CMS-driven)
├── interfaces/
│   ├── payment-provider.ts     # Payment provider interface
│   ├── shipping-provider.ts    # Shipping provider interface
│   ├── inventory-provider.ts   # Inventory provider interface
│   └── tax-provider.ts         # Tax provider interface
├── providers/
│   ├── stripe/
│   │   ├── index.ts            # Stripe payment provider
│   │   └── README.md           # Provider documentation
│   ├── nz-post/
│   │   ├── index.ts            # NZ Post shipping provider
│   │   └── README.md           # Provider documentation
│   └── simple-gst/
│       ├── index.ts            # Simple NZ GST tax provider
│       └── README.md           # Provider documentation
├── errors.ts                   # Commerce-specific error types
├── audit.ts                    # Commerce audit logging helpers
└── README.md                   # Commerce module documentation
```

**Dependencies:** Phase 0 complete.
**Tests:** Unit tests for provider interfaces and config service.
**Rollback:** New files only — no existing code modified.

---

## Phase 2 — Product, Catalogue, Pricing and Inventory Foundation ✅

**Objective:** Build PawTag-native product management as the single source of truth.

**Changes:**
1. Revive and enhance MongoDB Product model (add missing fields)
2. Create product service with CRUD operations
3. Create pricing service (base price, sale price, compare-at)
4. Create inventory service (stock levels, reservations, adjustments)
5. Create product admin routes and UI
6. Create product API for frontend (`GET /api/products`, `GET /api/products/:id`)
7. Seed products from initial data

**Database changes:**
- Enhance `Product` model with: `compareAtPrice`, `salePrice`, `inventoryQuantity`, `inventoryReserved`, `inventoryPolicy` (deny/allow), `lowStockThreshold`, `stockStatus` (in_stock/out_of_stock/low_stock)
- Add `ProductVariant` model if needed (or keep embedded)
- Add `InventoryAdjustment` model for stock movement history

**Admin pages to create/update:**
- `apps/admin/src/pages/Products.tsx` — Enhanced with inventory, pricing
- `apps/admin/src/pages/ProductDetail.tsx` — Product detail with variants
- `apps/admin/src/pages/Inventory.tsx` — Inventory management dashboard

**Dependencies:** Phase 1 complete.
**Tests:** Unit tests for pricing calculations, inventory concurrency, stock reservation.
**Rollback:** Feature flag to switch back to legacy products.

---

## Phase 3 — Shopping Cart ✅

**Objective:** Build a robust PawTag-native cart.

**Changes:**
1. Create/enhance MongoDB Cart model with TTL
2. Create cart service (add, remove, update, validate, calculate totals)
3. Create cart API routes (`/api/cart/*`)
4. Create CartContext replacement (PawTag API instead of external SDK)
5. Implement cart merging after login
6. Implement cart expiry/cleanup

**Database changes:**
- Enhance `Cart` model: `items[].priceAtTime`, `items[].productSnapshot`, `totals` (computed), `expiresAt` (TTL index), `status` (active/abandoned/converted)

**Admin pages:**
- View active carts (read-only, for monitoring)

**Dependencies:** Phase 2 complete.
**Tests:** Unit tests for cart calculations, concurrency, price validation.
**Rollback:** Feature flag to switch back to legacy cart.

---

## Phase 4 — Checkout and Order Creation ✅

**Objective:** Build reliable checkout orchestration with failure recovery.

**Changes:**
1. Create checkout service (orchestrates payment, inventory, order creation)
2. Create pending order model (stores cart contents before payment)
3. Create orphan payment detection job
4. Create order creation from Stripe payment intent
5. Enhance order state model (separate payment/fulfilment status)
6. Update Checkout.tsx to use PawTag API

**Database changes:**
- Create `PendingOrder` model: `userId`, `items`, `totals`, `stripePaymentIntentId`, `status`, `expiresAt`
- Enhance `Order` model: separate `paymentStatus` and `fulfilmentStatus` fields

**Admin pages:**
- Enhanced order management with payment/fulfilment status

**Dependencies:** Phase 3 complete.
**Tests:** Integration tests for checkout flow, idempotency, orphan detection, failure recovery.
**Rollback:** Feature flag to switch back to legacy checkout.

---

## Phase 5 — Payments and Express Wallet Checkout ✅

**Objective:** Build direct Stripe integration.

**Changes:**
1. Create Stripe payment provider (implements payment interface)
2. Create Stripe webhook handler with proper signature verification
3. Create payment intent creation endpoint
4. Create payment confirmation endpoint
5. Create refund service (full and partial)
6. Update StripePaymentForm to use PawTag API
7. Ensure Apple Pay, Google Pay work via Stripe PaymentElement

**Security fixes:**
- Implement `stripe.webhooks.constructEvent()` for signature verification
- Use `express.raw()` for webhook route body parsing
- Add `STRIPE_WEBHOOK_SECRET` configuration

**Admin pages:**
- Payment management dashboard
- Refund processing UI

**Dependencies:** Phase 4 complete.
**Tests:** Integration tests for payment success, failure, duplicate, webhook processing.
**Rollback:** Feature flag to switch back to legacy payment.

---

## Phase 6 — Shipping ✅

**Objective:** Build PawTag-native shipping for NZ domestic.

**Changes:**
1. Create shipping provider interface
2. Create NZ Post shipping adapter (or simple flat-rate)
3. Create shipping service (rate calculation, method selection)
4. Create shipping configuration (CMS settings: zones, methods, rates)
5. Connect shipping to checkout flow
6. Remove legacy shipping dependency

**Database changes:**
- Create `ShippingZone` model (or use CMS settings)
- Create `ShippingMethod` model (or use CMS settings)
- Create `ShippingRate` model (or use CMS settings)

**Admin pages:**
- Shipping configuration page (zones, methods, rates)

**Dependencies:** Phase 5 complete.
**Tests:** Unit tests for rate calculation, zone matching.
**Rollback:** Feature flag to switch back to legacy shipping.

---

## Phase 7 — Fulfilment and Real-Time Tracking ✅

**Objective:** Build fulfilment workflow.

**Changes:**
1. Create fulfilment service (create, update, track)
2. Create shipment model (carrier, tracking, status, events)
3. Create admin fulfilment dashboard
4. Create customer tracking page
5. Integrate with real courier API (or enhance demo mode)

**Database changes:**
- Create `Shipment` model: `orderId`, `carrier`, `trackingNumber`, `status`, `events[]`, `labelUrl`
- Enhance `Order` model: link to `Shipment` references

**Admin pages:**
- Fulfilment dashboard (pending shipments, tracking, delivery status)

**Dependencies:** Phase 6 complete.
**Tests:** Unit tests for status transitions, tracking URL generation.
**Rollback:** N/A (new functionality).

---

## Phase 8 — Refunds, Cancellations and Returns Foundation ✅

**Objective:** Build comprehensive refund and cancellation handling.

**Changes:**
1. Create refund service (full, partial, item-level)
2. Create refund model (amount, reason, status, Stripe reference)
3. Create cancellation workflow (with inventory restoration)
4. Create return foundation (RMA model, basic workflow)
5. Ensure audit trail for all financial operations

**Database changes:**
- Create `Refund` model: `orderId`, `amount`, `reason`, `status`, `stripeRefundId`, `processedBy`
- Enhance `Order` model: `refunds[]` references

**Admin pages:**
- Refund processing UI (with reason, amount, confirmation)
- Cancellation workflow UI
- Returns dashboard (basic)

**Dependencies:** Phase 7 complete.
**Tests:** Integration tests for full/partial refund, cancellation, idempotency.
**Rollback:** N/A (new functionality).

---

## Phase 9 — Commerce Administration ✅

**Objective:** Full-featured admin section for all commerce entities.

**Changes:**
1. Create commerce admin dashboard (overview metrics)
2. Create product management pages (CRUD, inventory, pricing)
3. Create order management pages (list, detail, status, fulfilment)
4. Create customer management pages (orders, subscriptions)
5. Create payment dashboard (transactions, refunds)
6. Create shipping configuration pages
7. Create tax configuration pages
8. Create discount/promo management pages
9. Create commerce settings pages (all commerce config)
10. Seed admin permissions for all commerce operations

**Admin pages to create/update:**
- `apps/admin/src/pages/CommerceDashboard.tsx` — Overview metrics
- `apps/admin/src/pages/Products.tsx` — Product CRUD
- `apps/admin/src/pages/ProductDetail.tsx` — Product detail
- `apps/admin/src/pages/Inventory.tsx` — Inventory management
- `apps/admin/src/pages/Orders.tsx` — Order list
- `apps/admin/src/pages/OrderDetail.tsx` — Order detail
- `apps/admin/src/pages/Payments.tsx` — Payment dashboard
- `apps/admin/src/pages/Shipping.tsx` — Shipping config
- `apps/admin/src/pages/Tax.tsx` — Tax config
- `apps/admin/src/pages/Discounts.tsx` — Discount management
- `apps/admin/src/pages/CommerceSettings.tsx` — Commerce settings

**Dependencies:** Phase 8 complete.
**Tests:** Integration tests for admin CRUD operations.
**Rollback:** N/A (new admin pages).

---

## Phase 10 — Webhooks, Background Processing and Reliability ✅

**Objective:** Consolidate all external event handling into reliable patterns.

**Changes:**
1. Create webhook handler framework (signature verification, idempotency, retry)
2. Create Stripe webhook handler (payment events)
3. Create orphan payment detection job
4. Create price reconciliation job (verify orders match Stripe)
5. Create inventory reconciliation job
6. Consolidate background job infrastructure

**Dependencies:** Phase 9 complete.
**Tests:** Integration tests for webhook processing, idempotency, retry.
**Rollback:** N/A (infrastructure improvement).

---

## Phase 11 — NZ Tax, Addresses and Customer Experience

**Objective:** Ensure tax and address handling is correct for NZ.

**Changes:**
1. Create tax calculation service (15% GST, tax-inclusive)
2. Create tax configuration (CMS settings)
3. Ensure address validation works
4. Create tax invoice format (NZ compliant)
5. Document tax requirements for accountant review

**Dependencies:** Phase 10 complete.
**Tests:** Unit tests for GST calculation, tax-inclusive pricing.
**Rollback:** N/A (new functionality).

---

## Phase 12 — External Commerce Removal ✅ COMPLETE

**Objective:** Safely remove external commerce platform from the codebase.

**Completed:**
- [x] All commerce functionality working via PawTag Commerce
- [x] Shadow validation period complete (both systems parallel)
- [x] No production issues during transition
- [x] All dependent tests updated or removed
- [x] External database archived

**Removal completed:**
1. ✅ Removed external commerce app directory
2. ✅ Removed external SDK imports from all files
3. ✅ Removed external commerce environment variables
4. ✅ Removed sync routes and webhook handlers
5. ✅ Removed sync services and admin clients
6. ✅ Removed reconciliation and retry jobs
7. ✅ Removed external references from Docker Compose
8. ✅ Removed external dependencies from package.json files
9. ✅ Updated pnpm workspace config
10. ✅ Ran `pnpm install` to clean lockfile
11. ✅ Verified `pnpm build` succeeds
12. ✅ Verified `pnpm typecheck` succeeds
13. ✅ All tests pass
14. ✅ Documentation updated

**Dependencies:** All previous phases complete.
**Tests:** Full regression test suite.
**Rollback:** Keep external database backup for 90 days.
**Status:** Decommissioned.

---

## Phase 13 — Security, Observability and Production Hardening ✅ COMPLETE

**Objective:** Final production readiness review.

**Completed:**
1. ✅ Security audit (auth, authz, validation, CSRF, XSS, injection)
2. ✅ Payment security audit (PCI compliance, no card storage)
3. ✅ Webhook security audit (signature verification, rate limiting)
4. ✅ Performance testing
5. ✅ Error tracking verification (Sentry)
6. ✅ Audit logging verification
7. ✅ Monitoring and alerting setup
8. ✅ Documentation finalization

**Dependencies:** Phase 12 complete.
**Tests:** Full security test suite, load tests.
**Rollback:** N/A (review and hardening phase).

---

## Timeline Estimate

| Phase | Status | Duration | Dependencies |
|-------|--------|----------|-------------|
| Phase 0 | ✅ Complete | — | — |
| Phase 1 | ✅ Complete | 1 week | Phase 0 |
| Phase 2 | ✅ Complete | 2 weeks | Phase 1 |
| Phase 3 | ✅ Complete | 1 week | Phase 2 |
| Phase 4 | ✅ Complete | 2 weeks | Phase 3 |
| Phase 5 | ✅ Complete | 1 week | Phase 4 |
| Phase 6 | ✅ Complete | 1 week | Phase 5 |
| Phase 7 | ✅ Complete | 1 week | Phase 6 |
| Phase 8 | ✅ Complete | 1 week | Phase 7 |
| Phase 9 | ✅ Complete | 2 weeks | Phase 8 |
| Phase 10 | ✅ Complete | 1 week | Phase 9 |
| Phase 11 | ✅ Complete | 1 week | Phase 10 |
| Phase 12 | ✅ Complete | 1 week | Phase 11 |
| Phase 13 | ✅ Complete | 1 week | Phase 12 |
| **Total** | **13/13 complete** | **~16 weeks** | |

**Note:** All phases complete. PawTag owns all commerce directly.
