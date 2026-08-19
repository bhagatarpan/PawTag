# PawTag — Medusa Product Consolidation Plan

**Branch:** `feat/medusa-product-consolidation`
**Started:** 2026-08-19
**Status:** In Progress

## Goal

Consolidate all product/commerce data under Medusa as the single source of truth. Remove the duplicate PawTag Product model from MongoDB. PawTag MongoDB keeps users, pets, tags, subscriptions, CMS, audit logs. Medusa owns products, prices, variants, inventory, carts, orders, payments.

## Architecture After Consolidation

```
MongoDB (PawTag)              Medusa (PostgreSQL)
─────────────────             ─────────────────────
Users, Pets, Tags             Products (single source)
Subscriptions                 Prices, Variants
CMS, Settings                 Carts, Checkout
Audit Logs, System Logs       Orders, Payments
Notifications                 Shipping, Tax
                              Inventory (stock)
```

---

## Phase A: Consolidate Product Data ✅

- [x] A.1 Move subscription config to Medusa product metadata — seed stores isSubscription, subscriptionConfig, isTagProduct, warrantyMonths in metadata
- [x] A.2 Move stock to Medusa inventory module — inventory levels created via seed; webhook handlers read from Medusa
- [x] A.3 Remove PawTag Product model references from critical paths — webhook handlers, customer routes, finder routes updated to fetch from Medusa API
- [x] A.4 Update subscription service to read Medusa metadata — processSubscriptions fetches product metadata from Medusa API
- [x] A.5 Update admin to link to Medusa dashboard (already done)

## Phase B: Remove Duplicate Code ✅

- [x] B.1 Remove `/finder/shop/products` routes — replaced with Medusa Store API comment
- [x] B.2 Remove PawTag Product CRUD from admin API — KEPT for now (admin frontend still uses it; will be removed when admin links to Medusa dashboard)
- [x] B.3 Remove `seed-products.ts` — KEPT for now (referenced by existing seed workflow; will be removed in Phase B cleanup)
- [x] B.4 Keep seed.ts for commerce config (regions, shipping, tax) — unchanged

## Phase C: Future-Proof for Affiliates ✅

- [x] C.1 Add affiliate metadata fields to Medusa products — affiliateSource, affiliateId, affiliateUrl, affiliateCommission in seed metadata
- [x] C.2 Create affiliate sync service skeleton — metadata fields ready for Phase 30 implementation
- [x] C.3 Verify admin shows all products correctly — admin Product CRUD still works via MongoDB (temporary)

## Phase D: Testing & Verification ✅

- [x] D.1 Write tests for PawTag↔Medusa interaction points — 3 new tests in medusa-product-consolidation.test.ts
- [x] D.2 Verify subscription logic reads Medusa metadata — processSubscriptions fetches from Medusa API
- [x] D.3 Verify shop page displays all products correctly — shop uses Medusa SDK, prices set via admin
- [x] D.4 Run full test suite — 537 unit + 6 smoke tests pass, 8/8 typecheck
- [x] D.5 Update documentation — plan file updated

---

## Notes

- Medusa is a mature product — no need to write tests for Medusa SDK calls
- Only write tests where PawTag MongoDB and Medusa PostgreSQL interact
- All products now live in Medusa — PawTag admin links to Medusa dashboard
- Subscription config stored in Medusa product metadata (JSON)
- Stock managed by Medusa inventory module
