# Monetary Precision Audit & Fix

**Status:** Complete  
**Branch:** `feature/monetary-precision-audit`  
**Date:** 2026-10-10  
**Priority:** Critical — financial correctness  

## Problem

Order `WO-000494` has a total of `20.34` but the refund amount shows `20.337652173913042`. This is one symptom of systemic monetary precision issues across the application.

### Root Cause (traced end-to-end)

The raw float is created at **checkout**, not at refund:

1. **Unrounded percentage discount** — `PromoCode.calculateDiscount` (`packages/db/src/models/PromoCode.ts:121`): `subtotal * (discountValue / 100)` → `19.99 × 0.10 = 1.999` (3 decimals, no rounding)
2. **GST extracted via `/1.15`** — `cart.service.ts:544`: `tax = 17.991 × 0.15/1.15 = 2.3466521739130433` (repeating decimal, denominator 23)
3. **THE BUG: checkout adds extracted GST on top of GST-inclusive prices** — `checkout.service.ts:358`: `total = subtotal - discount + shipping + tax` → `17.991 + 2.3466… = 20.337652173913042`
4. Raw float persisted to `Order.payment.amount`, `PaymentTransaction.amount`, `Invoice.amount`
5. Stripe rounds to 2034 cents ($20.34) at charge time — customer pays correctly, but internal bookkeeping stores the raw float
6. Refund paths default to `order.payment.amount` → the raw float shows up in admin UI

The checkout total **disagrees with the cart's own correct total** at `cart.service.ts:549` which properly does `subtotal - discount - accessoryDiscount + shipping + (taxInclusive ? 0 : tax)`.

## Audit Findings

### Critical

| # | Issue | Location | Impact |
|---|---|---|---|
| 1 | Checkout GST double-count — adds extracted GST on inclusive prices | `checkout.service.ts:358` | Customer overcharged by ~13% on tax-inclusive orders |
| 2 | PawRewards double-subtraction — rewards subtracted from total twice | `checkout.service.ts:252-256` vs `355-358` | Stripe charge ≠ Order.payment.amount when rewards used |
| 3 | `accessoryDiscount` dropped in checkout quote | `checkout.service.ts:355` | Cart shows discount; checkout doesn't charge it |
| 4 | Stale tax when shipping is overridden | `checkout.service.ts:325-356` | Tax computed on old shipping, not new |

### High

| # | Issue | Location |
|---|---|---|
| 5 | Three refund-balance implementations (floats vs cents vs inline) | `refund.service.ts`, `return-refund.service.ts`, `admin.ts` |
| 6 | Unrounded tax in cart totals | `cart.service.ts:544-547` |
| 7 | Unrounded discount in PromoCode model | `PromoCode.ts:121` |
| 8 | Unrounded discount in pricing service | `pricing.service.ts:157` |

### Medium

| # | Issue | Location |
|---|---|---|
| 9 | Two duplicate dollar↔cent helper pairs | `return-refund.service.ts` vs `donation.ts` |
| 10 | Duplicate GST logic (cart inlines vs provider) | `cart.service.ts:536-549` vs `simple-gst/index.ts` |
| 11 | Invoice/email line totals omit `customizationTotal` | `invoice-html.service.ts:95`, `order-confirmation.ts:28` |
| 12 | Hardcoded GST back-calculation in confirmation UI | `CheckoutConfirmationStep.tsx:150,155` |
| 13 | Unrounded shipping tax in GST provider | `simple-gst/index.ts:68` |

### Low

| # | Issue | Location |
|---|---|---|
| 14 | 3 divergent admin currency formatters | `Orders.tsx`, `OrderRefunds.tsx`, `SubscriptionPlans.tsx` |
| 15 | ~274 `toFixed(2)` display sites (mostly fine) | apps/* |

## Architecture / Data Flow

```
Product.price (float dollars)
  → cart.service.calculateTotals()
    ├── lineTotal = (unitPrice + customizationTotal) × qty  [FP, needs rounding]
    ├── subtotal = Σ lineTotal                              [FP, needs rounding]
    ├── discount = promoDiscount                            [needs rounding]
    ├── accessoryDiscount = round(subtotal × pct)           [already rounded]
    ├── tax = (subtotal - discount - accessoryDiscount + shipping) × rate/(1+rate)  [needs rounding]
    └── total = subtotal - discount - accessoryDiscount + shipping + (taxInclusive ? 0 : tax)  [needs rounding]
  → checkout.service.buildCheckoutQuote()
    ├── MUST align with cart.service total formula
    ├── MUST include accessoryDiscount
    ├── MUST recompute tax when shipping changes
    └── MUST NOT add extracted GST on inclusive prices
  → stripePaymentProvider.createPaymentIntent({ amount: total })
    └── Math.round(total × 100) → Stripe cents
  → PendingOrder (total)
  → Order.payment.amount (needs rounding to cents)
  → PaymentTransaction.amount (needs rounding to cents)
  → Invoice.amount (needs rounding to cents)
  → Refund paths (must use integer cents for balance math)
```

## Decision Tree: Where to Round

```
Is the value sent to Stripe?
  ├── Yes → Convert to cents with Math.round(amount × 100) at the Stripe boundary
  └── No → Is it persisted to DB?
            ├── Yes → Round to 2dp (cents) at the persistence boundary: Math.round(x × 100) / 100
            └── No → Is it an intermediate calculation?
                      ├── Yes → Do NOT round intermediate steps (avoid cumulative error)
                      └── No → Is it displayed?
                                ├── Yes → formatCurrency() handles 2dp display
                                └── No → Leave as-is
```

## Shared Money Utilities Design

**File:** `packages/shared/src/money.ts`

```typescript
// Core conversions
toCents(amount: number): number          // Math.round(amount * 100)
fromCents(cents: number): number         // cents / 100
roundToCents(amount: number): number     // Math.round(amount * 100) / 100

// Safe arithmetic (operates in cents internally)
addMoney(...values: number[]): number    // Sum in cents, return dollars
subtractMoney(a: number, b: number): number
multiplyMoney(amount: number, factor: number): number
allocateCents(totalCents: number, weights: number[]): number[]  // Largest-remainder allocation

// Currency-aware
getCurrencyDecimals(currency: string): number  // 2 for NZD, 0 for JPY, etc.
toStripeAmount(amount: number, currency: string): number  // Currency-aware cents conversion
```

## Implementation Phases

### Phase 1: Shared money utilities ✅
- [x] Create `packages/shared/src/money.ts`
- [x] Export from `packages/shared/src/index.ts`
- [x] Update `return-refund.service.ts` to import from shared
- [x] Unit tests for money utilities (31 tests)

### Phase 2: Fix checkout total bugs ✅
- [x] Fix `checkout.service.ts:358` — align with cart total formula, include accessoryDiscount, respect tax-inclusive
- [x] Fix `checkout.service.ts:252-256` — PawRewards single subtraction
- [x] Fix `checkout.service.ts:129-131` — free shipping total recalc includes accessoryDiscount, respects tax-inclusive
- [x] Round `cart.service.ts` tax, total, lineTotal, subtotal to cents
- [x] Round `PromoCode.calculateDiscount` to cents
- [x] Round `pricing.service.calculateDiscount` to cents
- [x] Fix `simple-gst/index.ts:68` — round shipping tax

### Phase 3: Unify refund paths ✅
- [x] `refund.service.ts` — convert float validation to integer cents
- [x] `admin.ts` refund route — use shared `toCents`/`roundToCents`

### Phase 4: Round at persistence boundaries ✅
- [x] `Order.payment.amount`, `subtotal`, `shippingCost`, `tax`, `discount.amount`
- [x] `Order.items[].unitPrice`, `totalPrice`, `customizationTotal`
- [x] `PaymentTransaction.amount`
- [x] `Invoice.amount`
- [x] `Return.refundAmount` (via return-refund.service rounding)
- [x] `PendingOrder.total`, `subtotal`, `discount`, `shipping`, `tax`

### Phase 5: Fix display issues ✅
- [x] `CheckoutConfirmationStep.tsx` — removed hardcoded 0.85/0.15, use server values
- [x] `invoice-html.service.ts:95,452` — include customizationTotal in line totals
- [x] `order-confirmation.ts:28` — include customizationTotal in line totals
- [x] Replace 3 divergent admin formatters with shared `formatCurrency`
- [x] `Returns.tsx` — format refundAmount with 2dp

### Phase 6: Tests & verification ✅
- [x] `tests/unit/money-utilities.test.ts` — 16 tests
- [x] `tests/unit/checkout-total-precision.test.ts` — 15 tests (regression for WO-000494)
- [x] `pnpm test:unit` — 1005 tests PASS
- [x] `pnpm typecheck` — PASS
- [x] `pnpm lint` — 0 errors (890 pre-existing warnings)
- [x] `pnpm build` — PASS

## Monitoring & Audit

- Checkout totals are logged via `logger.info` in `checkout.service.ts`
- Refund amounts are logged via `logger.info` in refund services
- Order activity records include refund amounts (`$${refundAmount.toFixed(2)}`)
- PaymentTransaction records persist amount snapshots
- Invoice.amount persists the charged amount
- After fix: all persisted amounts will be 2dp; Stripe cents remain authoritative

## Risks

1. **Existing orders with raw floats** — not migrating historical data (per founder decision). Stripe already charged correct cents.
2. **Cart/checkout behavior change** — GST-inclusive totals will change for new orders. This is a bug fix, not a behavior change.
3. **Refund validation change** — moving from float to cents may reject previously-accepted borderline amounts. This is intentional safety improvement.
