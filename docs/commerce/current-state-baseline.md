# PawTag Commerce — Current-State Baseline

**Date:** 2026-08-28 (updated 2026-09-03)
**Status:** Current baseline — PawTag owns all commerce. Migration complete.

---

## What PawTag Already Has

PawTag is a pet recovery platform with an integrated commerce system for selling QR/NFC tags and subscriptions. The business operates in New Zealand.

### Application Architecture

| Layer | Technology | Location |
|-------|-----------|----------|
| Frontend (public + customer portal) | React 18, Vite, TypeScript, Tailwind | `apps/web/` (port 3000) |
| Admin portal | React 18, Vite, TypeScript, Tailwind | `apps/admin/` (port 3001) |
| Finder portal | React 18, Vite, TypeScript, Tailwind | `apps/finder/` (port 3003) |
| Mobile app | React Native (Expo) | `apps/mobile/` |
| Backend API | Node.js, Express, Mongoose | `packages/api/` (port 5000) |
| Commerce engine | PawTag Commerce (built-in) | `packages/api/src/commerce/` |
| Database | MongoDB Atlas | `packages/db/` |
| Monorepo | pnpm workspaces | Root `package.json` |

### Single Database Architecture

- **MongoDB Atlas** — PawTag's single data store (users, pets, tags, products, prices, carts, customers, orders, payments, shipping, inventory, subscriptions, CMS, audit logs, settings)

---

## What Currently Works

### Products & Pricing

| Component | Status | Implementation |
|-----------|--------|---------------|
| Product catalog | Working (PawTag-native) | PawTag admin UI at `:3001` |
| Product display | Working | `Shop.tsx` fetches via PawTag API |
| Product comparison | Working | Uses PawTag product metadata |
| Pricing | Working (PawTag-native) | PawTag pricing module, NZD only |
| Product images | Working (PawTag-native) | Stored in Cloudflare R2 |
| Subscription config | Working (PawTag metadata) | `isSubscription`, `subscriptionConfig` in product metadata |

**Products managed in PawTag admin.** 3 products: Scan (QR-only), Classic (NFC+QR), Plus (NFC+QR premium).

### Cart

| Component | Status | Implementation |
|-----------|--------|---------------|
| Add/remove items | Working (PawTag-native) | `cart.service.ts` — server-side via `POST /api/cart/items` |
| Quantity updates | Working (PawTag-native) | `PUT /api/cart/items/:id` — server-side validation |
| Cart persistence | Working (PawTag-native) | MongoDB Cart model with unique userId index + TTL expiry |
| Customer sync | Working | Auto-sync guest cart on login (`syncGuestCartToServer`) |
| Cart drawer | Working | Shared `@pawtag/ui` `CartDrawer` component with guest banner + price warnings |
| Price re-validation | Working | `calculateTotals()` re-fetches prices from DB on every cart load |
| Promo codes | Working (PawTag-native) | Server-side validation + application via `POST /api/cart/promo` |
| Guest mode | Working | localStorage cart with visual indicator, merges on login |

**Cart is PawTag-native.** MongoDB Cart model with `unique: true` on userId (one active cart per user). Converted/abandoned carts are reset on next visit.

### Checkout

| Component | Status | Implementation |
|-----------|--------|---------------|
| 4-step wizard | Working | `Checkout.tsx` — Cart → Checkout → Payment → Confirmed |
| Authentication gate | Working | Inline login/register |
| Email/SMS verification | Working | OTP with CMS-configurable settings |
| Address autocomplete | Working | Photon or NZ Post provider |
| Shipping selection | Working (PawTag-native) | `shipping.service.ts` — rates from ShippingMethod model + NZ Post fallback |
| Promo codes | Working (PawTag-native) | Server-side cart promo via `POST /api/cart/promo` (guests validate via public endpoint) |
| Referral codes | Working | Via cart metadata propagation |

### Payments

| Component | Status | Implementation |
|-----------|--------|---------------|
| Stripe integration | Working (PawTag-native) | `stripe/` provider — direct Stripe API |
| Card payments | Working | Stripe Elements (PaymentElement) |
| Apple Pay | Working | Via Stripe PaymentElement |
| Google Pay | Working | Via Stripe PaymentElement |
| Klarna/Afterpay | Working | Via Stripe PaymentElement |
| Demo mode | Working | `commerce.payment.testMode` CMS setting |
| Refunds | Working | Direct Stripe API via `refund.service.ts` |

**Payment sessions created via PawTag checkout API** (`POST /api/checkout/payment-intent`). Stripe webhook handler as backup.

### Orders

| Component | Status | Implementation |
|-----------|--------|---------------|
| Order creation | Working | Dual path: direct API + webhook backup |
| Order numbers | Working | `PT-NNNNNN` format, atomic counter |
| Status state machine | Working | Validated transitions in `orderStatus.service.ts` |
| Activity timeline | Working | Every status change recorded |
| Idempotency | Working | 3-field fallback check |
| Customer notifications | Working | Parallel email + push + in-app |
| Invoice generation | Working | Atomic counter, secure access tokens |

**Order creation uses `createOrderFromPendingOrder()` — shared by both API and webhook paths.**

### Subscriptions

| Component | Status | Implementation |
|-----------|--------|---------------|
| Subscription lifecycle | Working | Create → Active → Expiring → Grace → Expired |
| Auto-renewal | Working | Hourly cron job |
| Customer self-service | Working | Renew, cancel, change plan |
| Admin management | Working | Status override, extend |
| Email reminders | Working | 30d, 7d, 1d expiry + weekly grace |
| Stripe billing portal | Working | Portal link creation |
| Invoice generation | Working | On renewal and order placement |

**Subscription renewals are PawTag-native (cron-based), not mediated by Stripe Billing.**

### Shipping

| Component | Status | Implementation |
|-----------|--------|---------------|
| Free NZ-wide shipping | Working (PawTag-native) | `shipping.service.ts` — ShippingMethod model + NZ Post fallback |
| Shipping option selection | Working | From PawTag shipping service |
| Shipment creation | Working | `shipping.service.ts` with demo mode and real API stub |
| Carrier tracking URLs | Working | NZ Post, CourierPost, Aramex, DHL, FedEx, UPS |
| Customer notifications | Working | Email + push + in-app with tracking links |

**Shipping is PawTag-native.** ShippingMethod model with admin CRUD. NZ Post integration via `nz-shipping` provider.

### Inventory

| Component | Status | Implementation |
|-----------|--------|---------------|
| Stock levels | Working (PawTag-native) | `inventory.service.ts` with reservation |
| Low stock alerts | Working | Background job checks PawTag inventory |
| Stock on product cards | Working | From PawTag inventory |
| Stock restoration | Working | `inventory.service.ts` restores on cancel/refund |

**Inventory is PawTag-native.** Stock tracking with reservation during checkout.

### Tax

| Component | Status | Implementation |
|-----------|--------|---------------|
| NZ GST | Working (PawTag-native) | 15% tax-inclusive via `simple-gst` provider |
| GST on invoices | Working | Registration number displayed |

**Tax is PawTag-native.** 15% NZ GST via `simple-gst` provider with CMS configuration.

### Referrals

| Component | Status | Implementation |
|-----------|--------|---------------|
| Referral code generation | Working | `ReferralCode` model |
| Referral tracking | Working | `Referral` model |
| Reward processing | Working | On order placement |
| Referral propagation | Working | Via cart metadata |

---

## PawTag Commerce Engine

All commerce functionality is PawTag-native:

1. **Product catalog** — Products, variants, prices, images, metadata
2. **Cart management** — Create, update, line items, promotions, shipping
3. **Checkout orchestration** — Shipping address, shipping methods, payment sessions
4. **Payment processing** — Direct Stripe payment intent creation
5. **Order creation** — Creates PawTag orders on checkout confirmation
6. **Tax calculation** — 15% NZ GST via `simple-gst` provider
7. **Shipping calculation** — Free NZ-wide shipping via `shipping.service.ts`
8. **Inventory management** — Stock levels, reservation, deduction
9. **Promotion engine** — Discount codes via `PromoCode` model
10. **Customer management** — PawTag user records
11. **Refunds** — Direct Stripe API via `refund.service.ts`

---

## What PawTag Owns

All commerce data is owned by PawTag in MongoDB:

| Domain | Source of Truth | Notes |
|--------|----------------|-------|
| Users/Customers | **PawTag (MongoDB)** | Sole owner |
| Products | **PawTag (MongoDB)** | Admin manages via PawTag admin at `:3001` |
| Prices | **PawTag (MongoDB)** | Per-variant, per-region pricing |
| Cart | **PawTag (MongoDB)** | PawTag-native `cart.service.ts` with unique userId index |
| Checkout | **PawTag (MongoDB)** | PawTag-native `checkout.service.ts` — payment-intent + confirm |
| Payment | **PawTag → Stripe** | Direct Stripe integration, PawTag-native provider |
| Orders | **PawTag (MongoDB)** | PawTag is business record owner |
| Invoices | **PawTag (MongoDB)** | Created on order placement |
| Subscriptions | **PawTag (MongoDB)** | PawTag-native lifecycle |
| Shipping | **PawTag (MongoDB)** | PawTag-native `shipping.service.ts` — ShippingMethod model + NZ Post |
| Inventory | **PawTag (MongoDB)** | PawTag-native `inventory.service.ts` with reservation |
| Tax | **PawTag (MongoDB)** | 15% NZ GST, tax-inclusive via `simple-gst` provider |
| Promos/Discounts | **PawTag (MongoDB)** | PawTag-native `PromoCode` model with admin CRUD |
| Tags (physical) | **PawTag (MongoDB)** | Core product entity |
| Referrals | **PawTag (MongoDB)** | PawTag-native |
| Tracking | **PawTag (MongoDB)** | Stored on Order model |

---

## What External Providers Currently Do

| Provider | Purpose | PawTag Dependency |
|----------|---------|------------------|
| **Stripe** | Payment processing, refunds, billing portal | Payment authority |
| **MongoDB Atlas** | Primary database | Data store |
| **Resend** | Transactional email | Email delivery |
| **Photon/NZ Post** | Address autocomplete | Address validation |
| **Expo** | Mobile push notifications | Push delivery |
| **Cloudflare R2** | File storage | Pet photos, product images |

---

## What Functionality Is Missing

### Resolved

1. ~~No PawTag-native product management~~ — **Done.** Products managed via PawTag admin
2. ~~No PawTag-native cart~~ — **Done.** PawTag-native `cart.service.ts` with MongoDB Cart model
3. ~~No PawTag-native payment session creation~~ — **Done.** Direct Stripe via `checkout.service.ts`
4. ~~No server-side price validation~~ — **Done.** `calculateTotals()` re-fetches prices from DB
5. ~~No orphan payment detection~~ — **Done.** Background job detects stale pending payments
6. ~~Stripe webhook signature verification is stubbed~~ — **Done.** Production-grade verification
7. ~~Invoice counter race condition~~ — **Done.** Atomic counters
8. ~~Subscription pricing hardcoded~~ — **Done.** CMS-driven pricing
9. ~~No real shipping integration~~ — **Done.** NZ Post integration via `nz-shipping` provider
10. ~~No inventory reservation during checkout~~ — **Done.** `inventory.service.ts` with reservation
11. ~~Low stock check queries deprecated MongoDB Product~~ — **Done.** PawTag-native inventory
12. ~~No admin product management in PawTag~~ — **Done.** Products managed via PawTag admin
13. ~~No admin shipping management~~ — **Done.** ShippingMethod model with admin CRUD
14. ~~No admin discount/promo management~~ — **Done.** PromoCode model with admin CRUD
15. ~~No admin tax configuration~~ — **Done.** Simple GST via CMS settings

### Nice to Have

16. No billing address (only shipping)
17. No saved payment methods
18. No order editing after placement
19. No partial shipment support
20. No return/RMA management

---

## Which Components Should Be Kept

| Component | Why Keep |
|-----------|----------|
| Order model + creation service | Production-ready, well-tested, idempotent |
| Invoice model + generation | Production-ready, atomic counters |
| Subscription lifecycle | Production-ready, PawTag-native |
| Referral system | Production-ready, PawTag-native |
| WebhookEvent model | Production-ready, idempotent |
| Webhook retry mechanism | Production-ready, exponential backoff |
| Audit logging | Enterprise-grade, hash chain integrity |
| Email templates | Production-ready, parallel delivery |
| Order notification service | Production-ready, multi-channel |
| Checkout OTP | Production-ready, CMS-configurable |
| AddressAutocomplete | Production-ready, multi-provider |
| Tag ID generation | Production-ready, crypto-based |
| Rate limiting | Production-ready, DB-driven |
| CAPTCHA | Production-ready, custom math-problem |
| All existing tests | Production-ready coverage |

---

## Components — All PawTag-Native

| Component | Implementation | Notes |
|-----------|---------------|-------|
| Product catalog | PawTag admin UI at `:3001` | Products managed natively |
| Cart | `cart.service.ts` — MongoDB Cart model | Unique userId index, TTL expiry |
| Payment sessions | `checkout.service.ts` — direct Stripe | No intermediary |
| Shipping | `shipping.service.ts` — ShippingMethod model | NZ Post integration |
| Tax | `simple-gst` provider — 15% NZ GST | CMS-configurable |
| Inventory | `inventory.service.ts` — stock + reservation | Atomic updates |
| Promo codes | `PromoCode` model — admin CRUD | Server-side validation |
| Order sync | Single system — `PendingOrder` → `Order` | No reconciliation needed |
| Webhooks | `WebhookEvent` model — idempotent | Stripe-only |
| Refunds | `refund.service.ts` — direct Stripe API | Full + partial |

---

---

## Migration Path — COMPLETED

The migration has been fully executed:

```
Phase 0: Fix critical gaps ✅
    ↓
Phase 1: Build PawTag-native product catalog + pricing ✅
    ↓
Phase 2: Build PawTag-native cart ✅
    ↓
Phase 3: Build PawTag-native checkout + payment (direct Stripe) ✅
    ↓
Phase 4: Build PawTag-native shipping (NZ domestic) ✅
    ↓
Phase 5: Build PawTag-native inventory ✅
    ↓
Phase 6: Build PawTag-native tax (NZ GST) ✅
    ↓
Phase 7: Build PawTag-native promos/discounts ✅
    ↓
Phase 8: Build admin commerce management ✅
    ↓
Phase 9: Shadow validation (both systems parallel) ✅
    ↓
Phase 10: Switch traffic to PawTag Commerce ✅
    ↓
Phase 11: Remove legacy dependencies ✅
```

**Result:** PawTag owns all commerce. Migration complete.
