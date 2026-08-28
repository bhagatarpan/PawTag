# PawTag Commerce — Current-State Baseline

**Date:** 2026-08-28
**Status:** Phase 0 Complete — Verified from actual codebase

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
| Commerce engine | MedusaJS v2.19.0 (PostgreSQL) | `apps/medusa/` (port 9000) |
| Primary database | MongoDB Atlas | `packages/db/` |
| Commerce database | PostgreSQL (Neon) | Medusa |
| Monorepo | pnpm workspaces | Root `package.json` |

### Dual Database Architecture

- **MongoDB Atlas** — PawTag's primary data store (users, pets, tags, subscriptions, CMS, audit logs, orders, invoices)
- **PostgreSQL (Neon)** — MedusaJS commerce engine (products, prices, carts, customers, orders, payments, shipping, inventory)

---

## What Currently Works

### Products & Pricing

| Component | Status | Implementation |
|-----------|--------|---------------|
| Product catalog | Working (Medusa) | Medusa admin UI at `:9000/app` |
| Product display | Working | `Shop.tsx` fetches via Medusa SDK |
| Product comparison | Working | Uses Medusa product metadata |
| Pricing | Working (Medusa) | Medusa pricing module, NZD only |
| Product images | Working (Medusa) | Stored in Medusa |
| Subscription config | Working (Medusa metadata) | `isSubscription`, `subscriptionConfig` in product metadata |

**Products managed in Medusa admin.** 3 products: Scan (QR-only), Classic (NFC+QR), Plus (NFC+QR premium).

### Cart

| Component | Status | Implementation |
|-----------|--------|---------------|
| Add/remove items | Working (Medusa) | `CartContext.tsx` via Medusa SDK |
| Quantity updates | Working (Medusa) | Optimistic UI + server reconciliation |
| Cart persistence | Working (Medusa) | Cart ID in localStorage |
| Customer sync | Working | Auto-sync on first cart add |
| Cart drawer | Working | Shared `@pawtag/ui` `CartDrawer` component |

**Cart lives entirely in Medusa.** MongoDB Cart model is deprecated with no active routes.

### Checkout

| Component | Status | Implementation |
|-----------|--------|---------------|
| 4-step wizard | Working | `Checkout.tsx` — Cart → Checkout → Payment → Confirmed |
| Authentication gate | Working | Inline login/register |
| Email/SMS verification | Working | OTP with CMS-configurable settings |
| Address autocomplete | Working | Photon or NZ Post provider |
| Shipping selection | Working | From Medusa fulfillment options |
| Promo codes | Working | Via Medusa SDK |
| Referral codes | Working | Via cart metadata propagation |

### Payments

| Component | Status | Implementation |
|-----------|--------|---------------|
| Stripe integration | Working (via Medusa) | `pp_stripe_stripe` payment module |
| Card payments | Working | Stripe Elements (PaymentElement) |
| Apple Pay | Working | Via Stripe PaymentElement |
| Google Pay | Working | Via Stripe PaymentElement |
| Klarna/Afterpay | Working | Via Stripe PaymentElement |
| Demo mode | Working | `pp_system_default` auto-succeeds |
| Refunds | Working | Direct Stripe API (`stripe.service.ts`) |

**Payment sessions created via Medusa.** Refunds bypass Medusa (direct Stripe API).

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

**Order creation uses `createOrderFromMedusa()` — shared by both API and webhook paths.**

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
| Free NZ-wide shipping | Working (Medusa) | Configured in Medusa |
| Shipping option selection | Working | From Medusa fulfillment |
| Shipment creation | Demo mode | `shipping.service.ts` generates fake tracking |
| Carrier tracking URLs | Working | NZ Post, CourierPost, Aramex, DHL, FedEx, UPS |
| Customer notifications | Working | Email + push + in-app with tracking links |

**Shipping is demo-only.** No real courier API integration exists.

### Inventory

| Component | Status | Implementation |
|-----------|--------|---------------|
| Stock levels | Working (Medusa) | Medusa inventory module |
| Low stock alerts | Partial | Checks deprecated MongoDB Product model |
| Stock on product cards | Working | From Medusa `inventory_quantity` |
| Stock restoration | No-op | `restoreOrderStock()` does nothing |

**Low stock check job has a disconnect** — queries MongoDB Product, not Medusa inventory.

### Tax

| Component | Status | Implementation |
|-----------|--------|---------------|
| NZ GST | Working (Medusa) | 15% tax-inclusive via Medusa tax module |
| GST on invoices | Working | Registration number displayed |

**Tax entirely delegated to Medusa.** No PawTag-side calculation.

### Referrals

| Component | Status | Implementation |
|-----------|--------|---------------|
| Referral code generation | Working | `ReferralCode` model |
| Referral tracking | Working | `Referral` model |
| Reward processing | Working | On order placement |
| Referral propagation | Working | Via cart metadata |

---

## What Medusa Currently Does

Medusa is the **commerce engine** responsible for:

1. **Product catalog** — Products, variants, prices, images, metadata
2. **Cart management** — Create, update, line items, promotions, shipping
3. **Checkout orchestration** — Shipping address, shipping methods, payment sessions
4. **Payment processing** — Stripe payment intent creation, PaymentElement client secrets
5. **Order creation** — Creates Medusa orders on cart completion
6. **Tax calculation** — 15% NZ GST via system tax provider
7. **Shipping calculation** — Free NZ-wide shipping via manual fulfillment
8. **Inventory management** — Stock levels, reservation, deduction
9. **Promotion engine** — Discount codes, automatic promotions
10. **Customer management** — Medusa customer records (synced from PawTag User)
11. **Event forwarding** — `pawtag-webhook.ts` forwards 6 event types to PawTag

---

## What PawTag Owns vs What Medusa Owns

| Domain | Source of Truth | Notes |
|--------|----------------|-------|
| Users/Customers | **PawTag (MongoDB)** | Medusa gets a synced copy |
| Products | **Medusa (PostgreSQL)** | MongoDB Product model deprecated |
| Prices | **Medusa (PostgreSQL)** | PawTag has no pricing system |
| Cart | **Medusa (PostgreSQL)** | MongoDB Cart model deprecated |
| Checkout | **Shared** | Frontend orchestrates, Medusa handles payment/shipping |
| Payment | **Stripe** | Medusa creates sessions, Stripe is authority |
| Orders | **PawTag (MongoDB)** | PawTag is business record owner |
| Invoices | **PawTag (MongoDB)** | Created on order placement |
| Subscriptions | **PawTag (MongoDB)** | PawTag-native lifecycle |
| Shipping | **Medusa (PostgreSQL)** | PawTag stores tracking numbers |
| Inventory | **Medusa (PostgreSQL)** | PawTag low-stock check is stale |
| Tax | **Medusa (PostgreSQL)** | 15% NZ GST |
| Promos/Discounts | **Medusa (PostgreSQL)** | No PawTag-side management |
| Tags (physical) | **PawTag (MongoDB)** | Core product entity |
| Referrals | **PawTag (MongoDB)** | PawTag-native |
| Fulfilment | **Shared** | Admin action syncs to Medusa |
| Tracking | **PawTag (MongoDB)** | Stored on Order model |

---

## What External Providers Currently Do

| Provider | Purpose | PawTag Dependency |
|----------|---------|------------------|
| **Stripe** | Payment processing, refunds, billing portal | Payment authority |
| **Medusa** | Commerce engine (products, cart, checkout, shipping, tax, inventory) | Commerce orchestrator |
| **MongoDB Atlas** | Primary database | Data store |
| **Neon** | PostgreSQL for Medusa | Commerce database |
| **Resend** | Transactional email | Email delivery |
| **Photon/NZ Post** | Address autocomplete | Address validation |
| **Expo** | Mobile push notifications | Push delivery |

---

## What Functionality Is Missing

### Critical for PawTag Commerce

1. **No PawTag-native product management** — Products live only in Medusa
2. **No PawTag-native cart** — Cart lives only in Medusa
3. **No PawTag-native payment session creation** — Medusa creates Stripe payment sessions
4. **No server-side price validation** — Relies on Medusa to resolve prices
5. **No orphan payment detection** — If payment succeeds but order creation fails, no recovery
6. **Stripe webhook signature verification is stubbed** — Security vulnerability
7. **Invoice counter race condition** — Non-atomic counter in `webhooks.ts`
8. **Subscription pricing hardcoded** — `$0.99/month` and `$1.99/month` in `subscription.service.ts`

### Important for Production

9. **No real shipping integration** — Demo mode with fake tracking
10. **No inventory reservation during checkout** — Stock could be oversold
11. **Low stock check queries deprecated MongoDB Product** — Stale data
12. **No admin product management in PawTag** — Products managed in Medusa admin
13. **No admin shipping management** — Shipping configured in Medusa
14. **No admin discount/promo management** — Promos configured in Medusa
15. **No admin tax configuration** — Tax configured in Medusa

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

## Which Components Should Be Replaced or Refactored

| Component | Action | Why |
|-----------|--------|-----|
| Medusa product catalog | Replace with PawTag-native | Eliminate Medusa dependency |
| Medusa cart | Replace with PawTag-native | Eliminate Medusa dependency |
| Medusa payment session creation | Replace with direct Stripe | Eliminate Medusa dependency |
| Medusa shipping | Replace with PawTag-native | Eliminate Medusa dependency |
| Medusa tax | Replace with PawTag-native | NZ GST is simple enough |
| Medusa inventory | Replace with PawTag-native | Eliminate Medusa dependency |
| Medusa promo codes | Replace with PawTag-native | Eliminate Medusa dependency |
| `medusa-sync.service.ts` | Remove | No Medusa customer sync needed |
| `medusa-admin.service.ts` | Remove | No Medusa admin API needed |
| `orderSyncReconciliation.ts` | Remove | Single system, no drift |
| `webhookRetry.ts` (Medusa) | Remove | No Medusa webhooks |
| `medusa-webhooks.ts` | Remove | No Medusa events |
| Low stock check job | Refactor to query PawTag inventory | Currently queries deprecated model |
| `inventory.service.ts` | Refactor to real inventory | Currently a no-op |

---

## Every Known Medusa Dependency

### Environment Variables (14)

| Variable | Used By |
|----------|---------|
| `MEDUSA_BACKEND_URL` | API: medusa-sync, medusa-admin, order-creation, reconciliation, webhooks |
| `MEDUSA_ADMIN_TOKEN` | API: medusa-sync, medusa-admin, order-creation, reconciliation |
| `MEDUSA_PUBLISHABLE_KEY` | API: order-creation, webhooks; Web frontend |
| `MEDUSA_WEBHOOK_SECRET` | API: medusa-webhooks |
| `MEDUSA_DATABASE_URL` | Medusa app |
| `MEDUSA_DASHBOARD_URL` | Medusa app |
| `MEDUSA_ADMIN_EMAIL` | Medusa app |
| `MEDUSA_ADMIN_PASSWORD` | Medusa app |
| `PAWTAG_WEBHOOK_URL` | Medusa subscriber |
| `PAWTAG_WEBHOOK_SECRET` | Medusa subscriber |
| `STRIPE_API_KEY` | Medusa config |
| `VITE_MEDUSA_BACKEND_URL` | Web frontend |
| `VITE_MEDUSA_PUBLISHABLE_KEY` | Web frontend |
| `VITE_MEDUSA_ADMIN_URL` | Admin frontend |

### Source Files (52+)

See `COMMERCE-MIGRATION-BLUEPRINT.md` Section 2.3 for the complete categorized list.

### Package Dependencies

- `@medusajs/js-sdk` in `packages/api/package.json` and `apps/web/package.json`
- `@medusajs/types` in `apps/web/package.json`
- 7 `@medusajs/*` packages in `apps/medusa/package.json`
- 50+ `@medusajs/*` packages in `pnpm-lock.yaml`

---

## Safest High-Level Migration Path

```
Phase 0: Fix critical gaps (signature verification, orphan detection, invoice counter)
    ↓
Phase 1: Build PawTag-native product catalog + pricing
    ↓
Phase 2: Build PawTag-native cart
    ↓
Phase 3: Build PawTag-native checkout + payment (direct Stripe)
    ↓
Phase 4: Build PawTag-native shipping (NZ domestic)
    ↓
Phase 5: Build PawTag-native inventory
    ↓
Phase 6: Build PawTag-native tax (NZ GST)
    ↓
Phase 7: Build PawTag-native promos/discounts
    ↓
Phase 8: Build admin commerce management
    ↓
Phase 9: Shadow validation (both systems parallel)
    ↓
Phase 10: Switch traffic to PawTag Commerce
    ↓
Phase 11: Remove Medusa
```

Each phase is independent and deployable. Medusa remains active until Phase 11.
