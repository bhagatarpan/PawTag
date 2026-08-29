# PawTag Commerce — Implementation Roadmap

**Date:** 2026-08-30
**Status:** Phases 0-10 Partially Complete — In Active Development

---

## Implementation Principles

1. **No big-bang rewrite.** Each phase is independent and deployable.
2. **Medusa stays active** until its responsibilities are safely replaced.
3. **Feature flags** control which path is active (Medusa vs PawTag Commerce).
4. **Shadow validation** runs both systems in parallel before switchover.
5. **Every phase has tests, documentation, and rollback.**
6. **No hardcoded business values.** All config via CMS settings or environment variables.

---

## Phase 0 — Repository Discovery and Current-State Baseline ✅

**Objective:** Establish the actual current state of the codebase.

**Completed:**
- [x] Inspected all 52+ Medusa-dependent files
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
**Medusa status:** Remains fully active.

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
7. Seed products from Medusa data

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
**Rollback:** Feature flag to switch back to Medusa products.
**Medusa status:** Remains active. Products can be seeded from Medusa.

---

## Phase 3 — Shopping Cart ✅

**Objective:** Build a robust PawTag-native cart.

**Changes:**
1. Create/enhance MongoDB Cart model with TTL
2. Create cart service (add, remove, update, validate, calculate totals)
3. Create cart API routes (`/api/cart/*`)
4. Create CartContext replacement (PawTag API instead of Medusa SDK)
5. Implement cart merging after login
6. Implement cart expiry/cleanup

**Database changes:**
- Enhance `Cart` model: `items[].priceAtTime`, `items[].productSnapshot`, `totals` (computed), `expiresAt` (TTL index), `status` (active/abandoned/converted)

**Admin pages:**
- View active carts (read-only, for monitoring)

**Dependencies:** Phase 2 complete.
**Tests:** Unit tests for cart calculations, concurrency, price validation.
**Rollback:** Feature flag to switch back to Medusa cart.
**Medusa status:** Remains active. Cart can be synced during transition.

---

## Phase 4 — Checkout and Order Creation ✅

**Objective:** Build reliable checkout orchestration with failure recovery.

**Changes:**
1. Create checkout service (orchestrates payment, inventory, order creation)
2. Create pending order model (stores cart contents before payment)
3. Create orphan payment detection job
4. Create order creation from Stripe payment intent (no Medusa dependency)
5. Enhance order state model (separate payment/fulfilment status)
6. Update Checkout.tsx to use PawTag API

**Database changes:**
- Create `PendingOrder` model: `userId`, `items`, `totals`, `stripePaymentIntentId`, `status`, `expiresAt`
- Enhance `Order` model: separate `paymentStatus` and `fulfilmentStatus` fields

**Admin pages:**
- Enhanced order management with payment/fulfilment status

**Dependencies:** Phase 3 complete.
**Tests:** Integration tests for checkout flow, idempotency, orphan detection, failure recovery.
**Rollback:** Feature flag to switch back to Medusa checkout.
**Medusa status:** Remains active. Both paths parallel during shadow period.

---

## Phase 5 — Payments and Express Wallet Checkout ✅

**Objective:** Build direct Stripe integration (bypassing Medusa).

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
**Rollback:** Feature flag to switch back to Medusa payment.
**Medusa status:** Remains active during shadow period.

---

## Phase 6 — Shipping without Medusa ✅

**Objective:** Build PawTag-native shipping for NZ domestic.

**Changes:**
1. Create shipping provider interface
2. Create NZ Post shipping adapter (or simple flat-rate)
3. Create shipping service (rate calculation, method selection)
4. Create shipping configuration (CMS settings: zones, methods, rates)
5. Connect shipping to checkout flow
6. Remove Medusa shipping dependency

**Database changes:**
- Create `ShippingZone` model (or use CMS settings)
- Create `ShippingMethod` model (or use CMS settings)
- Create `ShippingRate` model (or use CMS settings)

**Admin pages:**
- Shipping configuration page (zones, methods, rates)

**Dependencies:** Phase 5 complete.
**Tests:** Unit tests for rate calculation, zone matching.
**Rollback:** Feature flag to switch back to Medusa shipping.
**Medusa status:** Remains active during shadow period.

---

## Phase 7 — Fulfilment and Real-Time Tracking ✅

**Objective:** Build fulfilment workflow independent of Medusa.

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
**Rollback:** N/A (new functionality, no Medusa dependency to revert).
**Medusa status:** Medusa fulfilment sync removed.

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
**Medusa status:** Medusa refund sync removed.

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
**Medusa status:** Medusa admin dashboard link removed.

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
**Medusa status:** Medusa webhook infrastructure removed.

---

## Phase 11 — NZ Tax, Addresses and Customer Experience

**Objective:** Ensure tax and address handling is correct for NZ.

**Changes:**
1. Create tax calculation service (15% GST, tax-inclusive)
2. Create tax configuration (CMS settings)
3. Ensure address validation works without Medusa
4. Create tax invoice format (NZ compliant)
5. Document tax requirements for accountant review

**Dependencies:** Phase 10 complete.
**Tests:** Unit tests for GST calculation, tax-inclusive pricing.
**Rollback:** N/A (new functionality).
**Medusa status:** Medusa tax module removed.

---

## Phase 12 — Medusa Migration and Removal

**Objective:** Safely remove MedusaJS from the codebase.

**Pre-removal checklist:**
- [ ] All commerce functionality working via PawTag Commerce
- [ ] Shadow validation period complete (both systems parallel)
- [ ] No production issues for 2+ weeks
- [ ] All Medusa-dependent tests updated or removed
- [ ] Medusa PostgreSQL database archived

**Removal steps:**
1. Remove `apps/medusa/` directory
2. Remove Medusa SDK imports from all files
3. Remove Medusa environment variables
4. Remove `medusa-sync.ts`, `medusa-webhooks.ts` routes
5. Remove `medusa-sync.service.ts`, `medusa-admin.service.ts`
6. Remove `orderSyncReconciliation.ts`, `webhookRetry.ts` jobs
7. Remove Medusa from Docker Compose
8. Remove `@medusajs/*` from package.json files
9. Update pnpm workspace config
10. Run `pnpm install` to clean lockfile
11. Verify `pnpm build` succeeds
12. Verify `pnpm typecheck` succeeds
13. Run all tests
14. Update documentation

**Dependencies:** All previous phases complete.
**Tests:** Full regression test suite.
**Rollback:** Keep Medusa PostgreSQL backup for 90 days.
**Medusa status:** Decommissioned.

---

## Phase 13 — Security, Observability and Production Hardening

**Objective:** Final production readiness review.

**Changes:**
1. Security audit (auth, authz, validation, CSRF, XSS, injection)
2. Payment security audit (PCI compliance, no card storage)
3. Webhook security audit (signature verification, rate limiting)
4. Performance testing (load, stress, concurrency)
5. Error tracking verification
6. Audit logging verification
7. Monitoring and alerting setup
8. Documentation finalization

**Dependencies:** Phase 12 complete.
**Tests:** Full security test suite, load tests.
**Rollback:** N/A (review and hardening phase).
**Medusa status:** Fully removed.

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
| Phase 11 | 🔲 Pending | 1 week | Phase 10 |
| Phase 12 | 🔲 Pending | 1 week | Phase 11 |
| Phase 13 | 🔲 Pending | 1 week | Phase 12 |
| **Total** | **11/13 complete** | **~16 weeks** | |

**Note:** Phases can be partially parallelised. Some phases (7, 8, 11) can be deferred if not needed for launch.
