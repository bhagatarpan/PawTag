# Phase 04 — Premium Cart/Checkout UX Evidence

**Executed:** 2026-10-06  
**Status:** `CODED_NOT_RUNTIME_VALIDATED` for browser visual/manual checks; automated typecheck/build/unit green.

## What was implemented

| Area | Evidence |
|---|---|
| Desktop cart 8/4 sticky summary | Already present in `Cart.tsx` (`lg:grid-cols-12`, col-span-8/4, sticky summary) — verified in code |
| Mobile cart one-column + sticky CTA | Already present — verified in code |
| Checkout Delivery step 70/30 shell | **Fixed** — replaced `max-w-2xl` with 12-col grid + sticky `OrderSummaryCard` |
| Checkout Review/Payment 8/4 shell | Review already 12-col + sticky; Payment right column now sticky |
| Saved address cards show own lines | **Fixed** — `formatSavedAddressLines(addr)` not shared form state |
| Save-address checkbox | **Fixed** — controlled + persisted via `POST /customer/addresses` when leaving Delivery |
| Shipping quote races | **Fixed** — AbortController + request sequence ignore stale responses |
| Server-authoritative quote | `GET /api/checkout/quote` endpoint + web client fetch into Delivery summary |
| Mobile sticky total/CTA on checkout | **Added** — bottom bar with step-aware primary action |

## Automated verification

| Command | Result |
|---|---|
| `pnpm --filter @pawtag/web typecheck` | **PASS** |
| `pnpm --filter @pawtag/shared typecheck` | **PASS** |
| `pnpm test:unit` | **PASS** — 86 files / 936 tests (includes `checkout-address-display`) |
| `pnpm test:smoke` | **PASS** |
| `pnpm test:regression` | **PASS** |
| `pnpm build` | **PASS** (api/admin/web/finder) |
| Focused integration subset | **PASS** (webhook durability, auth session, Resend, membership gate, inventory, rewards, promo, shipping IDs, pending expiry) |

## Known limitation

Full `pnpm test:integration` under singleFork showed intermittent **file-level setup timeouts** (MongoMemoryServer resource contention). Individually re-run suites pass. Treated as **environmental flakiness**, not a Phase 04 product regression. Targeted suites covering touched paths pass.

## Manual browser checks

**Not performed** this session (no interactive browser). Founder/staging visual QA still required for:
- Cart product-card hierarchy on real viewport sizes
- Checkout Delivery sticky summary usability
- Mobile keyboard/safe-area behavior

## What this phase did NOT do

- Rewrite `Checkout.tsx` business logic (promo, engraving, auto-renew, rewards preserved)
- Add browser E2E (Phase 07)
- Live Stripe payment UI proof
