# Autonomous Execution Status

> Working copy: `docs/execution/EXECUTION_STATUS.md`
> Updated: Baseline recovery complete (2026-10-06)
> Source of truth: this file is updated only from executed commands/runtime evidence, not historical checkboxes.

## Evidence states

`PROVEN | CODED_NOT_RUNTIME_VALIDATED | BLOCKED_EXTERNAL | FAILED | NOT_STARTED`

## Phase table

| Phase | Status | Commit/branch | Automated evidence | Runtime/provider evidence | Blockers | Notes |
|---|---|---|---|---|---|---|
| 00 Baseline | **PROVEN** (evidence reset done; baseline quality gates recovered) | `main` @ baseline-recovery commit | typecheck/lint/unit/integration/regression/smoke/build **PASS** | none executed (no provider/staging/device run) | green baseline restored in code; provider/staging/device still unproven | Phase 00 evidence reset complete; Track A baseline recovery complete. See `docs/execution/BASELINE_EVIDENCE.md` |
| 01 Production safety | **CODED_NOT_RUNTIME_VALIDATED** (automated gates green; live providers not run) | `main` @ Phase 01 commit | payment env matrix tests PASS; provider fail-closed tests PASS; browser session tests PASS; Resend/Stripe webhook tests PASS; typecheck/lint/unit/integration/smoke/regression/build PASS | none executed (no live Stripe/Resend/Firebase/courier run) | live provider/staging proof still required | fail-closed + session/webhook hardening implemented; see `verification/PAYMENT_PROVIDER_MODE_MATRIX.md` |
| 02 Financial integrity | **CODED_NOT_RUNTIME_VALIDATED** (automated gates green; live Stripe not run) | `main` @ Phase 02 commit | inventory fail-loud + concurrency tests PASS; PawRewards atomic reservation tests PASS; promo idempotency PASS; shipping method identity PASS; pending-order expiry PASS; typecheck/lint/unit/integration/smoke/regression/build PASS | none executed (no live Stripe run) | live payment/reconciliation still required | quote contract + rewards hold + inventory confirm fail-loud + pending expiry job implemented |
| 03 Communications/auth | **CODED_NOT_RUNTIME_VALIDATED** (automated gates green; live Resend/Stripe not run) | `main` @ Phase 03 commit | email audit idempotency PASS; Resend webhook spoof+dupe PASS; membership activate requires Stripe payable state PASS; finder free-customer email PASS; typecheck/lint/unit/integration/smoke/regression/build PASS | none executed (no live Resend/Stripe run) | live email/Stripe membership paths still required | audit keys + Resend WebhookEvent dedupe + activateMembership payment gate + push provider architecture doc |
| 04 Cart/Checkout web | **CODED_NOT_RUNTIME_VALIDATED** (automated green; no browser manual this session) | `main` @ Phase 04 commit | typecheck PASS; unit 936 PASS; smoke/regression/build PASS; focused integration subset PASS | no interactive browser/staging visual QA | full integration suite flaky under parallel MongoMemoryServer load (pre-existing) | Delivery 8/4 shell, address display/persist, shipping race guard, server quote wiring, mobile sticky checkout bar |
| 05 Finder web | **CODED_NOT_RUNTIME_VALIDATED** (automated green) | `main` @ Phases 05–09 commit | finder integration suites PASS (72); active-only + free-customer email PROVEN automated | live CAPTCHA/staging not run | live providers still required | finder matrix updated; privacy retention job present |
| 06 Ops/deployment | **CODED_NOT_RUNTIME_VALIDATED** | `main` @ Phases 05–09 commit | job inventory doc; CI workflow added; docker worker present | no live staging/backup rehearsal | staging BLOCKED_EXTERNAL | `.github/workflows/ci.yml` + BACKGROUND_JOB_INVENTORY.md |
| 07 E2E/staging | **CODED_NOT_RUNTIME_VALIDATED** | `main` @ Phases 05–09 commit | Playwright config + critical-journeys specs; unit/smoke/regression/build green | Playwright not executed against live app; no staging dress rehearsal | first-customer gate NOT green for public launch | FINAL_FIRST_CUSTOMER_GATE updated honestly |
| 08 Shared mobile web | **CODED_NOT_RUNTIME_VALIDATED** | `main` @ Phases 05–09 commit; + `feat/mobile-ux-phase-a-b` (UX Phases A–B) | platform capability abstraction + browser fallback unit tests PASS; mobile nav suite 9/9 PASS; typecheck/lint/unit/smoke/regression/build green | no device/browser visual matrix this session | app-mode chrome partial; viewport checklist UNVERIFIED | `apps/web/src/platform/*`; route matrix + 5-destination bottom nav → `verification/MOBILE_ROUTE_MATRIX.md` |
| 09 Capacitor bridges | **CODED_NOT_RUNTIME_VALIDATED** | `main` @ Phases 05–09 commit | capacitor.config.ts + native bridge code (dynamic import); finder deep-link exclusion coded | no iOS/Android SDK/device build this session | Phase 10 device/store gate required | CODED_NOT_RUNTIME_VALIDATED until physical devices |
| 10 Store/device gate | NOT_STARTED | | | | physical device evidence absent | checklist is `NOT_STARTED` |
| 11 Dynamo discovery | **PROVEN** (discovery docs complete; no code migration) | `main` @ Phase 11 commit | docs/dynamodb-migration/ 00-07 + FOUNDER_SUMMARY written; models inventoried (73); access patterns mapped | none required for discovery | Phase 12 needs IAM + DynamoDB Local | discovery pack only; MongoDB remains production for first web customer |
| 12 Dynamo low-risk | **PROVEN** (live AWS Settings migrate + compare) | `main` @ Phase 12/13 commit | table `pawtag-dev-settings` created; 271 settings migrated; compare match=271 mismatch=0; unit tests PASS | real AWS ap-southeast-2 (non-prod prefix) | none for Settings proof | reads still default mongo; no money cutover |
| 13 Dynamo high-risk | **CODED_NOT_RUNTIME_VALIDATED** (conditional adapters + tests; **no cutover**) | `main` @ Phase 13 commit | Dynamo inventory + rewards services + failure-injection unit tests PASS | no live inventory/rewards on DynamoDB | staging payments still required before any money cutover | production remains MongoDB for inventory/rewards/orders/identity/Finder |
| 13 Dynamo high-risk | NOT_STARTED | | | | | |
| 14 Donation gate | **PROVEN** (architecture audit complete; no donate UI code) | `main` @ Phase 14 commit | docs/donations/ 00-05 + SETTINGS_CATALOG; Stripe test keys present in .env.local | NZ legal/tax BLOCKED_EXTERNAL | neutral receipts until donee confirmed | settings catalog defined; Phase 15 not started |
| 15 Donation one-time | **CODED_NOT_RUNTIME_VALIDATED** (one-time donate coded + tests; live Stripe webhook not run) | `main` @ Phase 15 commit | donation models/routes/service/webhook/receipt neutral + /donate page; donation integration tests PASS (9); typecheck/unit/build PASS | no live Stripe PI + webhook this session | public flag default false; Phase 16 not started | settings all configurable; no tax-credit claims |
| 16 Donation recurring/portals | NOT_STARTED | | | | depends on Phase 15 | | |
| 17 Donation release | **CODED_NOT_RUNTIME_VALIDATED** (card form + admin UI + security + recon job; public flag still false; live Stripe not run) | `main` @ Phase 17 commit | Stripe Elements on /donate; footer Donate behind publicEnabled; admin Donations page; recon job; security tests PASS; typecheck/unit/build PASS | no live Stripe card this session | NZ tax wording BLOCKED_EXTERNAL; flip publicEnabled after rehearsal | Phase 17 coded; Track D automation complete pending live rehearsal |
| 18 Final reconciliation | NOT_STARTED | | | | | |

## Per-phase evidence record

### Phase 00 — Evidence Reset (complete)

**Status:** PROVEN — evidence written 2026-10-06.  
**Files:** `docs/execution/EXECUTION_STATUS.md`, `docs/execution/BASELINE_EVIDENCE.md`  
**Result:** Historical claims re-labeled; quality gates initially FAILED on pack overlay state.

### Phase 01 — Production Security, Provider Modes, Webhooks, Session Boundaries (complete for automated evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — implementation + automated tests green; live provider/runtime proof not executed this phase.  
**Started/Completed:** 2026-10-06  

**What changed:**
1. **Payment env contract** — production rejects missing/invalid `PAYMENT_MODE` (must be `stripe_live`), test/demo Stripe keys, placeholder webhook secrets. Env-only resolution; DB settings cannot downgrade payment mode. Health exposes sanitized mode only.
2. **Stripe webhook safety** — raw body preserved; signature failures return 400 (never success); event identity recovered from raw Buffer on failure; unique event ID idempotency; retry job recovers stranded `processing` events after crash.
3. **Browser session contract** — browser login/refresh/MFA/verify set HttpOnly refresh cookie **before** response body; **no refreshToken in browser JSON body**; browser localStorage never stores refresh tokens (legacy copies cleared); native apps (`x-client-platform: ios/android`) still receive refreshToken for SecureStore; email/phone activation no longer puts refresh tokens in redirect URLs.
4. **Provider fail-closed** — production: push without Firebase fails delivery (never “sent”); shipping without API key fails (no fake tracking); SMS without provider fails; email without Resend already failed closed. Resend webhooks: correct mount path + Svix signature verification (production requires `RESEND_WEBHOOK_SECRET`).

**Files changed (material):**
- `packages/api/src/config/validateEnv.ts` (already strong; verified by tests)
- `packages/api/src/commerce/payment-mode.ts` (verified; env-only)
- `packages/api/src/routes/stripe-webhooks.ts` (eventId from raw Buffer; fail closed status)
- `packages/api/src/jobs/webhookRetry.ts` (stranded processing recovery)
- `packages/api/src/routes/resend-webhooks.ts` (route + signature)
- `packages/api/src/index.ts` (resend raw body mount)
- `packages/api/src/routes/auth.ts` (browser-safe auth payloads + cookies)
- `packages/api/src/services/push-notification.service.ts`
- `packages/api/src/services/shipping.service.ts`
- `packages/api/src/services/sms.service.ts`
- `packages/shared/src/api/client-factory.ts` (browser storage never persists refresh)
- `apps/web/src/context/AuthContext.tsx`, `apps/web/src/pages/Login.tsx`, `VerifyAccount.tsx`
- `apps/admin/src/lib/auth.tsx`, `apps/admin/src/pages/Login.tsx`
- Tests: `provider-fail-closed`, `browser-token-storage`, `browser-auth-session`, `resend-webhook-signature`, `stripe-webhook-durability`
- `docs/execution/2026-10-06/verification/PAYMENT_PROVIDER_MODE_MATRIX.md`

**Automated commands actually run:**

| Command | Result |
|---|---|
| `pnpm typecheck` | **PASS** |
| `pnpm lint` | **PASS** (0 errors) |
| `pnpm test:unit` | **PASS** — 84 files / 932 tests |
| `pnpm test:integration` | **PASS** — 65 files / 779 passed / 2 skipped |
| `pnpm test:regression` | **PASS** — 33 tests |
| `pnpm test:smoke` | **PASS** — 6 tests |
| `pnpm build` | **PASS** — api/admin/web/finder |

**Manual/provider/device validation actually performed:** none (no live Stripe/Resend/Firebase/courier).  

**Remaining risks / external blockers:**
- Live Stripe test/live webhooks, Resend outbound+webhook, Firebase push, courier API not runtime-validated
- CAPTCHA production-like finder notify not re-proven this phase
- Real courier shipping API still pending implementation (production fails closed until configured + implemented)

**Rollback:** revert Phase 01 commit; fail-closed provider guards can be temporarily relaxed only in non-production env, never by re-enabling demo success in production.

**Next phase:** `docs/execution/2026-10-06/phases/02_FINANCIAL_STATE_INTEGRITY.md` — **STOP. Do not execute Phase 02 until founder authorizes.**

### Phase 02 — Financial State Integrity (complete for automated evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — implementation + automated tests green; live Stripe/runtime proof not executed.  
**Started/Completed:** 2026-10-06  

**What changed:**
1. **Inventory lifecycle** — `confirmSale()` now **throws** if the atomic stock transition fails (no silent no-op). Multi-line `reserveAll()` already compensated; concurrent reserve test proves no oversell.
2. **PawRewards atomic reservation** — `User.pawRewardsReserved` hold + `PawRewardsReservation` ledger (unique checkoutId). Concurrent checkouts cannot double-spend; commit/release idempotent; commit fails loud if hold missing.
3. **Promo idempotency** — `PromoUsage` unique `{code, orderId}` prevents double-increment on checkout retries; usage limit enforced at finalization.
4. **Checkout quote** — shared `CheckoutQuote` contract; server-only `buildCheckoutQuote` / `GET /api/checkout/quote`; PaymentIntent amount only from server quote; quoteRevision stored on PendingOrder.
5. **Zero-total checkout** — explicit `pi_zero_*` path; no fake Stripe success for non-zero pending orders.
6. **Shipping method identity** — default methods upserted as real ShippingMethod docs; `selectMethod` never trusts client cost; synthetic IDs cannot `findById` and fail closed.
7. **PendingOrder expiry job** — `runPendingOrderExpiryJob` releases stock + rewards **before** Mongo TTL can silently delete abandoned checkouts.

**Files changed (material):**
- `packages/api/src/commerce/services/inventory.service.ts`
- `packages/api/src/commerce/services/checkout.service.ts`
- `packages/api/src/commerce/services/shipping.service.ts`
- `packages/api/src/services/loyalty/pawrewards.service.ts`
- `packages/api/src/routes/checkout.ts`
- `packages/api/src/jobs/pendingOrderExpiry.ts` (new) + index/worker registration
- `packages/db/src/models/User.ts`, `PendingOrder.ts`
- `packages/db/src/models/PawRewardsReservation.ts`, `PromoUsage.ts` (new)
- `packages/shared/src/checkout-quote.ts`
- Tests: `inventory-lifecycle`, `pawrewards-reservation`, `promo-usage-idempotency`, `shipping-method-identity`, `pending-order-expiry`

**Automated commands actually run:**

| Command | Result |
|---|---|
| `pnpm typecheck` | **PASS** |
| `pnpm test:unit` | **PASS** — 84 files / 932 tests |
| `pnpm test:integration` | **PASS** — 70 files / 793 passed / 2 skipped |
| `pnpm test:smoke` | **PASS** — 6 tests |
| `pnpm test:regression` | **PASS** — 33 tests |
| `pnpm build` | **PASS** |

**Manual/provider validation:** none (no live Stripe).  

**Remaining risks:**
- Live Stripe payment + webhook reconciliation not runtime-proven this phase
- Frontend checkout not fully rewired to `GET /api/checkout/quote` (server contract ready; Phase 04 UX)
- Full refund/return matrix verification remains for later packet depth

**Next phase:** `docs/execution/2026-10-06/phases/03_COMMUNICATIONS_DOCUMENTS_SUBSCRIPTIONS.md` — **STOP. Do not execute Phase 03 until founder authorizes.**

### Phase 03 — Email, Invoices, Notifications, Subscription Entitlements (complete for automated evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — implementation + automated tests green; live Resend/Stripe not executed.  
**Started/Completed:** 2026-10-06  
**Commit:** `92fc480`

**What changed:**
1. **Email audit durability** — `EmailAudit.idempotencyKey` (sparse unique); `recordEmailAudit` idempotent; `updateEmailAuditStatus` does not duplicate timeline entries; `sendMail` accepts `idempotencyKey`; order confirmation uses `order-confirmation:{orderNumber}`.
2. **Resend webhook idempotency** — `WebhookEvent.source` includes `resend`; dedupe by Svix event id; spoofed events still rejected.
3. **Membership entitlement gate** — `activateMembership` in real Stripe mode refuses activation unless Stripe status is `active`/`trialing`. Frontend `/membership/activate` cannot activate unpaid memberships.
4. **Invoice access** — hashed tokens, expiry, OTP; ownership-scoped customer invoice routes retained.
5. **Push provider architecture** — documented Expo ≠ FCM; production fail-closed preserved; native push **DEFERRED** Phase 09/10.

**Automated commands actually run:**

| Command | Result |
|---|---|
| `pnpm typecheck` | **PASS** |
| `pnpm test:unit` | **PASS** — 85 files / 934 tests |
| `pnpm test:integration` | **PASS** — 71 files / 796 passed / 2 skipped |
| `pnpm test:smoke` | **PASS** — 6 tests |
| `pnpm test:regression` | **PASS** — 33 tests |
| `pnpm build` | **PASS** |

**Manual/provider validation:** none (no live Resend/Stripe).  

**Remaining risks:**
- Live Resend outbound + delivery webhooks
- Live Stripe membership activate/renew/fail
- Physical-device push deferred Phase 09/10

**Next phase:** `docs/execution/2026-10-06/phases/04_PREMIUM_CART_CHECKOUT_CUSTOMER_WEB.md` — **STOP. Do not execute Phase 04 until founder authorizes.**

### Phase 04 — Premium Cart, Persistent Checkout Shell, Customer Web (complete for automated evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — automated gates green; no interactive browser/staging visual QA this session.  
**Started/Completed:** 2026-10-06  
**Commit:** `7466bd6`

**What changed (Checkout business logic not rewritten):**
1. Delivery step: persistent 8/4 shell + sticky OrderSummaryCard (was `max-w-2xl`)
2. Saved address cards show each address’s own lines
3. Save-address checkbox controlled + persisted when leaving Delivery
4. Shipping rates: AbortController + request sequence (no stale overwrite)
5. `GET /api/checkout/quote` wired into Delivery summary
6. Mobile sticky total/CTA on checkout; Review/Payment sticky right columns
7. Cart already 8/4 + mobile sticky (verified)

**Automated commands actually run:**

| Command | Result |
|---|---|
| web/shared typecheck | **PASS** |
| `pnpm test:unit` | **PASS** — 86 files / 936 tests |
| smoke / regression / build | **PASS** |
| Focused integration subset | **PASS** — 10 files / 31 tests |

**Manual/browser validation:** not performed this session.  

**Pre-existing:** full integration suite intermittently fails MongoMemoryServer setup under parallel load; individual suites pass.

**Remaining risks:** visual QA on real viewports (Phase 07); live Stripe UI not proven; Checkout.tsx still large (layout improved only).

**Next phase:** `docs/execution/2026-10-06/phases/05_FINDER_WEB_RECOVERY.md` — **STOP. Do not execute Phase 05 until founder authorizes.**

### Phases 05–09 — Finder, Ops, E2E, Mobile Foundation, Capacitor (authorized batch)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` overall — automated gates green; live staging/devices/providers not executed.  
**Authorized by founder:** “go ahead with next 5 phases autonomously without stopping”  
**Commits:** batch on `main` after Phase 04 (`7466bd6`/`63bac6d`)

#### Phase 05 — Finder web
- Active-only finder + free-customer email already in place (Track A0 / earlier phases)
- Finder integration suites: **PASS** (72 tests)
- Privacy retention job present (`privacyRetention`)
- CAPTCHA frontend/backend coded — production live path not run
- Evidence: `verification/FINDER_WEB_RECOVERY_MATRIX.md`

#### Phase 06 — Admin/ops/deployment
- CI workflow added: `.github/workflows/ci.yml` (typecheck/lint/unit/integration/regression/smoke/build + optional Playwright)
- Job inventory: `verification/BACKGROUND_JOB_INVENTORY.md`
- Docker compose already defines API + worker
- Live backup/restore rehearsal: **BLOCKED_EXTERNAL** (not run against live DB)

#### Phase 07 — E2E/CI/a11y/perf/staging
- Playwright config + `tests/e2e/critical-journeys.spec.ts` (finder/cart/a11y smoke)
- Playwright not executed against a running app this session
- Staging dress rehearsal / real-person UX: **NOT_STARTED**
- First-customer gate: **NOT green for public launch** — see `verification/FINAL_FIRST_CUSTOMER_GATE.md`

#### Phase 08 — Shared web mobile foundation
- `apps/web/src/platform/` capability contract + browser fallbacks
- Unit tests: browser scan fails closed; no refresh token in JS storage; finder path exclusion
- App-aware chrome/nav shell not fully rebuilt this session (Cart/Checkout already mobile-responsive from Phase 04)

#### Phase 09 — Capacitor shell
- `apps/web/capacitor.config.ts` + `src/platform/capacitor.ts` bridges (QR/NFC/push/secure storage/deep links)
- Finder public URLs explicitly excluded from customer-app deep links
- Native modules load dynamically (web typecheck does not require Capacitor packages)
- **Physical iOS/Android build/device proof: NOT_STARTED (Phase 10)**

**Automated commands actually run (batch):**

| Command | Result |
|---|---|
| web/shared/finder typecheck | **PASS** |
| `pnpm test:unit` | **PASS** — 87 files / 940 tests |
| `pnpm test:smoke` | **PASS** — 6 |
| `pnpm test:regression` | **PASS** — 33 |
| `pnpm build` | **PASS** |
| Finder integration subset | **PASS** — 72 tests |

**Manual/provider/device validation:** none this batch (no live Stripe/Resend/Firebase/staging/iOS/Android).

**Next phase:** Phase 10 store/device gate — **STOP. Do not execute Phase 10 until founder authorizes.**

### Phase 08 packet — Mobile UX Phases A–B: route inventory + responsive account nav (complete for automated evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — all automated gates green; **no browser/viewport/device run executed** (manual checklist in `verification/MOBILE_ROUTE_MATRIX.md` §4 remains UNVERIFIED).  
**Branch:** `feat/mobile-ux-phase-a-b` (from `main` @ `152361e`)  
**Started/Completed:** 2026-10-24  
**Scope:** mobile UX spec Phases A–B only (`docs/ux/PawTag_Mobile_Review_Package/…Spec.md` §8) as Phase 08 tasks A + C. Presentation, route availability and accessibility only — no API/auth/payment/business-rule changes; no React Native screens; `apps/mobile` untouched.

**What changed:**
1. **Route matrix (Phase A)** — `verification/MOBILE_ROUTE_MATRIX.md`: every `App.tsx` route → page/layout/phone-width evidence/nav coverage + gaps register with dispositions (HealthRecords orphan `FLAG_FOR_FOUNDER`; `PlatformProvider` unwired → `DEFER_PHASE_09`; Playwright mobile projects → `DEFER`).
2. **Single nav config** — `apps/web/src/components/account/navigation.ts`: destinations/labels/icons declared once; sidebar, drawer and tab bar all read it.
3. **Bottom tab bar (Phase B)** — `account/BottomNav.tsx` mounted in `AccountLayout` (`md:hidden`): Home | Pets | Activate | Activity→`/account/notifications` (founder decision) | Account→`/account/profile`; `aria-current`, ≥56px targets, unread badge + sr-only count; content wrapper padded so last row clears the bar.
4. **Safe-area/stacking contract** — `.safe-area-pb` **actually defined** in `index.css` (was a dead class already referenced by Cart/Checkout); `--app-bottom-nav-height` scoped to `.app-bottom-nav-scope` below `md`; `InvoiceDetail` sticky bar repositioned to `bottom-[var(--app-bottom-nav-height)]`.
5. **Touch accessibility** — account header dropdown was hover-only → explicit toggle with `aria-expanded`, backdrop click, Escape + focus return; `Navbar` mobile menu got `aria-label`/`aria-expanded`/`aria-controls` + Escape with focus return; sidebar/drawer links expose `aria-current`.
6. **Docs** — `docs/DESIGN.md` new "Mobile customer navigation" section (tab model, one-config rule, CSS stacking contract).
7. **Tests** — `tests/unit/mobile-account-nav.test.tsx`: 9 tests covering tab config/order, destination uniqueness, `aria-current` behavior, unread badge, shell coexistence, menu open/Escape.

**Files changed (material):** `apps/web/src/components/account/{navigation.ts,BottomNav.tsx}` (new), `AccountLayout.tsx`, `Navbar.tsx`, `index.css`, `pages/account/InvoiceDetail.tsx`, `tests/unit/mobile-account-nav.test.tsx` (new), `docs/DESIGN.md`, `verification/MOBILE_ROUTE_MATRIX.md` (new), this file.

**Automated commands actually run:**

| Command | Result |
|---|---|
| `pnpm typecheck` (baseline) / `pnpm --filter @pawtag/web typecheck` (final) | **PASS** / **PASS** |
| `pnpm lint` | **PASS** — 0 errors |
| `pnpm test:unit` | 1252 passed; 1 pre-existing failure (below) |
| focused `mobile-account-nav.test.tsx` | **PASS** — 9/9 |
| `pnpm test:smoke` | **PASS** — 6/6 |
| `pnpm test:regression` | **PASS** — 33/33 |
| `pnpm build` | **PASS** — api/admin/web/finder |

**Manual/viewport/device validation:** none — checklist rows in the matrix remain UNVERIFIED. No browser/device claim.

**Pre-existing (unchanged):** `tests/unit/donation-receipt-prefix.test.ts` timeout under parallel full-suite load — identical at baseline (captured before edits), passes in isolation.

**Remaining risks:** real viewport behavior 320–430px, safe-area on a notched device, toast-over-tab-bar layering, and Capacitor app-mode rendering remain unverified (Phases C–G + 09/10).

**Next:** mobile UX Phase C only when separately authorized. Phase 10 store/device gate remains NOT_STARTED. **STOP.**

### Packet — Customer portal full visual redesign, mobile-first (complete for automated evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — all automated gates green; **no browser/viewport/device run executed** (checklist in `verification/MOBILE_VISUAL_REDESIGN_MATRIX.md` §3 remains UNVERIFIED).  
**Branch:** `feat/mobile-visual-redesign` (stacked on `feat/mobile-ux-phase-a-b`).  
**Started/Completed:** 2026-10-24  
**Scope:** presentation-only redesign of the customer portal to the founder-approved concept boards (`docs/ux/PawTag_Mobile_Review_Package/images/`). Founder decisions: full visual redesign; teal header chrome; elevated center Activate tab; packets = customer first, Finder second. No API/auth/payment/entitlement changes; no new features; `apps/mobile`/Finder untouched.

**What changed (per batch, commits on branch):**
1. **Batch 0 `7392cee`** — shared primitives in `@pawtag/ui`: `Button`+`buttonClassName()`, `InfoCard`, `MetaRow`, `PhotoHero`, `SelectChips`; teal header/sidebar/drawer chrome; elevated center Activate tab (4.5rem row synced to `--app-bottom-nav-height`); DESIGN.md "Mobile visual language" + updated nav contract; `redesign-primitives.test.tsx` (8 tests).
2. **Batch 1 `ff4299d`** — Dashboard rebuilt (photo greeting hero, lost banner immediate, escalations above the fold, "Your pets" card, QuickActions row removed per spec §6.3, InfoCard conversions, `rounded-2xl` panels); PetCard flat semantic tints + `Button` action grid + dead hover CSS removed; MyPets gradient CTAs → tokens, touch-visible photo overlay, focusable breed tooltip.
3. **Batch 2 `c719534`** — Orders cards `rounded-2xl` + rounded wells; Order detail/Invoices/Invoice detail audited already board-compliant (documented, not churned).
4. **Batch 3 `8d55345`** — Subscriptions' 6 gradient CTA buttons unified on `buttonClassName()`; Donations/Membership/Guardian audited clean (tier/status gradients sanctioned in DESIGN.md).
5. **Batch 4 `2d69a23`** — Notifications `SelectChips` All/Unread/Read filter with live counts + filtered empty state + `rounded-2xl` cards; Profile/Settings audited zero defects.

**Automated commands actually run:**

| Command | Result |
|---|---|
| `pnpm typecheck` (full workspace) | **PASS** |
| `pnpm lint` | **PASS** — 0 errors repo-wide |
| focused unit (nav + primitives suites) | **PASS** — 17/17 |
| `pnpm test:unit` | **PASS** — 121 files / 1261 tests |
| `pnpm test:smoke` | **PASS** — 6/6 |
| `pnpm test:regression` | **PASS** — 33/33 |
| `pnpm build` | **PASS** — api/admin/web/finder exit 0 |

**Manual/viewport/device validation:** none — matrix §3 UNVERIFIED. No browser/device claim.  
**Pre-existing:** `tests/unit/donation-receipt-prefix.test.ts` has historically timed out under parallel full-suite load (passes in isolation) — **it passed in this packet's full unit run**, so no failure is attributable to this change.  
**Remaining risks:** rendered look at real viewports, tier-gradient visual balance, chip behavior on 320px, toast/tab layering — all need the human browser pass.  
**Next packet:** Finder portal redesign (Packet 2) only when separately authorized. **STOP.**

### Packet 1b — Pets journey board parity: pet detail + Lost Mode + horizontal cards (complete for automated evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — automated gates green; viewport checklist rows (matrix §4) UNVERIFIED.  
**Branch:** `feat/mobile-visual-redesign` (continued).  
**Started/Completed:** 2026-10-24  
**Scope:** founder-directed parity pass for image 1 of the concept boards, after review confirmed Packet 1 delivered the design *language* but missed three structural screens. Presentation only; capability audit ran first.

**What changed:**
1. **Capability audit (Step 0)** — confirmed real before building: `GET /customer/pets/:id`, mark-lost/found, `LocationEvent` sightings (`gps|qr_scan|manual`), tag join via `GET /tags` (detail endpoint does NOT join), finder-link origin conventions, `timeToFoundMs`. Board items without backing data (GPS toggle, care reminders, tag photo) were omitted/flagged, never faked.
2. **Horizontal pet cards** — `PetCard` rebuilt to board structure (photo left, status pill, meta rows, whole-card link to new detail, menu keeps Edit/Health/Unlink/Delete); mark-lost/found + found-timer moved off the list (detail owns them per board); MyPets gained the "Adding another pet?" InfoCard + `?edit=<id>` round-trip; dead found-timer/reunion machinery removed from MyPets.
3. **New `/account/pets/:id`** — PhotoHero identity, status pills, tag status card (real tagId + status + honest last-seen), **entitlement-gated** health summary (locked → upsell, never counts), health-records row, Mark Lost/Found with real endpoints + reunion time.
4. **New `/account/pets/:id/lost`** — calm lost hero, truthful finder/sightings steps, real shared-location list, escalation contact card (resolve/forward), recovery-link copy (3-branch origin logic), Mark Found; **non-lost guard view** so the lost state can never render falsely.
5. **DRY** — new `apps/web/src/lib/pet-display.ts` (status labels/variants, age, photo, timeAgo) replaced three drifting copies; shared endpoint `API.customer.pets.detail` added; `PhotoHero` title now a real `h1` (a11y defect found by tests).

**Automated evidence:**

| Command | Result |
|---|---|
| `pnpm typecheck` (full workspace) | **PASS** |
| `pnpm lint` | **PASS** (0 errors) |
| focused suites (detail/lost + primitives + nav + hero) | **PASS** — 41/41 |
| `pnpm test:unit` / `smoke` / `regression` / `build` | **PASS** — recorded in matrix §5 |

**Manual/viewport/device:** none — matrix §4 checklist UNVERIFIED.  
**Remaining risks:** ?edit round-trip in real browser, recovery-link per deployment proxying (`/finder/:tagId`), visual parity judgment on device.  
**Next:** Packet 1c (Profile segmented tabs) per queue. **STOP.**

### Packet 1c — Profile segmented tabs: Profile / Security / Preferences (complete for automated evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — automated gates green; matrix §4 rows 10–13 UNVERIFIED.  
**Branch:** `feat/mobile-visual-redesign` (continued).  
**Started/Completed:** 2026-10-25  
**Scope:** board 2 screen 1 — presentation only; **MFA/authenticator UI permanently excluded** (founder decision); verification *display* uses existing `emailVerified`/`phoneVerified` state only.

**What changed:**
1. **Identity row** — avatar (existing upload) + name + email as the page header (board structure).
2. **Segmented tabs** — underline tab nav built as real links (`/account/profile`, `?tab=security`, `?tab=preferences`) with `aria-current="page"`: deep-linkable, back/forward-safe, no client-only state.
3. **Security tab** — "Account security" section with Email/Mobile cards showing `StatusBadge` Verified pills (or Verify links → existing `/verify-account`); Change Password form moved here; **no two-step/authenticator content**.
4. **Preferences tab** — embeds the existing `NotificationPreferences` page component via a new `hideHeader` prop; standalone route `/account/notification-preferences` unchanged for old links.
5. **Profile tab** — existing form (personal info + addresses + emergency contact) intact; cards `rounded-2xl`, CTAs on `buttonClassName()` tokens.
6. **Crash guard** — `NotificationPreferences` now falls back to defaults if the API returns empty instead of crashing on `prefs.channels` (found by the new test's first failing run).

**Debugging note:** initial test run *hung* — root cause was my mock returning a fresh `user` object per render, looping Profile's `useEffect([user])` (real context keeps identity stable). Fixed the mock; bisect files removed.

**Automated evidence:**

| Command | Result |
|---|---|
| `pnpm typecheck` (full workspace) | **PASS** |
| `pnpm lint` | **PASS** — 0 errors |
| focused `profile-tabs` suite | **PASS** — 3/3 (tab URLs/aria-current, security state, MFA-absence guard, prefs embed) |
| `pnpm test:unit` | **PASS** — 123 files / 1271 tests |
| `pnpm test:smoke` | **PASS** — 6/6 |
| `pnpm test:regression` | **PASS** — 33/33 |
| `pnpm build` | **PASS** — api/admin/web/finder exit 0 |

**Manual/viewport/device:** none — matrix §4 rows 10–13 UNVERIFIED.  
**Next per queue:** 1d (notification category chips) → commerce (Packet 3) → Finder (Packet 2). **STOP.**

### Packet 1d — Notification category chips: All / Orders / Pets / Account (complete for automated evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — automated gates green; matrix §4 rows 14–15 UNVERIFIED.  
**Branch:** `feat/mobile-visual-redesign` (continued).  
**Started/Completed:** 2026-10-25  
**Scope:** board 2 screen 2 — replaces Packet 1's interim All/Unread/Read chips with the board's category taxonomy. Presentation only.

**What changed:**
1. **Category mapping grounded in the Notification model's real 22-type enum** (packages/db) — Orders: order/refund/returns/card types; Pets: lost/found/finder/tag-lifecycle/escalation/activation types; Account = documented **complement** (system/onboarding/referral/subscription + anything new), so `All = Orders + Pets + Account` always holds.
2. **Chips** — All/Orders/Pets/Account with live counts computed from loaded notifications; filtered empty-state copy retained; unread dots, mark-all-read and clear-read untouched.
3. New `tests/unit/notification-category-chips.test.tsx` pins representative real types (`order_update`, `pet_lost`, `finder_scan`, `system`) to their buckets and verifies filter switching both ways.

**Automated evidence:**

| Command | Result |
|---|---|
| `pnpm typecheck` (full workspace) | **PASS** |
| `pnpm lint` | **PASS** — 0 errors |
| focused `notification-category-chips` suite | **PASS** — 4/4 |
| `pnpm test:unit` | **PASS** — 124 files / 1275 tests |
| `pnpm test:smoke` | **PASS** — 6/6 |
| `pnpm test:regression` | **PASS** — 33/33 |
| `pnpm build` | **PASS** — api/admin/web/finder exit 0 |

**Manual/viewport/device:** none — matrix §4 rows 14–15 UNVERIFIED.  
**Customer board-parity queue complete for 1b–1d.** Next per queue: Packet 3 (commerce: product/Cart/Checkout boards) → Packet 2 (Finder). **STOP.**

### Packet 3 — Commerce board parity: Product, Cart, Checkout (images 3 & 4) (complete for automated evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — automated gates green; matrix §4c rows 16–18 UNVERIFIED.  
**Branch:** `feat/mobile-visual-redesign` (continued).  
**Started/Completed:** 2026-10-25  
**Scope:** presentation only on the money surfaces — zero changes to pricing, cart payloads, payment flow, totals or server authority (commerce-safety reviewed per element; audit-first).

**Capability audit outcome (Step 0):** most board elements already existed — multi-image gallery, engraving w/ counter, stock, qty stepper, Edit/Remove, GST + Estimated total, step indicator, secure-payment chip. Only true deltas were built.

**What changed:**
1. **Product** — mobile sticky "Add to Cart" bar (`lg:hidden`, `safe-area-pb`, live display price = effective price + per-unit customisation × qty, disabled out of stock); desktop inline button moved to `buttonClassName`; page bottom padding clears the bar.
2. **Cart** — new `FreeShippingBanner`: server-resolved `freeShippingThreshold` + existing `lib/cart-progress` math, remaining/unlocked states + progress bar + sr-only percent; renders nothing when no threshold applies (display-only — shipping authority unchanged). 3 tests pin the honesty rules (`$12.34` remaining exact, unlocked state, null-threshold → nothing).
3. **Checkout** — "Your information is safe" `InfoCard` on the payment step with deliberately truthful copy (provider's encrypted form; PawTag never stores card numbers) — no security claims beyond reality.

**Deliberately NOT built (documented in matrix §4c):** 4.9★ ratings (no review system — faking social proof), colour swatches (variant selection touches cart/price/stock contract → separate commerce-safety packet), "Back style" segmented option (no such product data), public Home/Shop/Cart/Profile bottom bar (conflicts with locked account-only tab navigation + would crowd checkout chrome), collapsible order summary (always-visible totals are safer and spec §6.7-compliant).

**Automated evidence:**

| Command | Result |
|---|---|
| `pnpm typecheck` (full workspace) | **PASS** |
| `pnpm lint` | **PASS** — 0 errors |
| focused `free-shipping-banner` suite | **PASS** — 3/3 |
| `pnpm test:unit` | **PASS** — 125 files / 1278 tests |
| `pnpm test:smoke` | **PASS** — 6/6 |
| `pnpm test:regression` | **PASS** — 33/33 |
| `pnpm build` | **PASS** — api/admin/web/finder exit 0 |

**Manual/viewport/device:** none — matrix §4c rows 16–18 UNVERIFIED.  
**Next:** Packet 2 (Finder portal, image 2 panel 4) — only when separately authorized. **STOP.**

### Packet 2 — Finder portal board parity (image 2, panel 4) (complete for automated evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — automated gates green; matrix §4d rows 19–20 UNVERIFIED.  
**Branch:** `feat/mobile-visual-redesign` (continued).  
**Started/Completed:** 2026-10-25  
**Scope:** presentation only on the public Finder flow. Finder rules held throughout: no login, no install prompt, CAPTCHA/rate-limit/privacy logic untouched, every visible field driven by the existing safe DTO.

**Capability audit (Step 0):** finder API surface = `GET /:tagId`, `POST /:tagId/notify` (CAPTCHA+limiter), `POST /:tagId/share-location`, `GET /:tagId/found-timer` — no report-found endpoint; all states (maintenance, safe-pet masking, limited-mode, notify success, found timer) already exist and were preserved.

**What changed:**
1. **Edge-to-edge photo hero** — carousel moved from inside the info card to full-column top; status banner now reads directly below the hero.
2. **Identity header (board 2)** — name + "Helping me get home" pill + trait chips (breed/gender/age/color); the old stacked detail rows were **removed, not duplicated** — favourite-food and owner rows kept in place.
3. **"Is this my pet?" section** — heading + "Contact my owner through {company}…" copy, guarded by the exact same conditions as the actions below it.
4. Contact CTA + location consent: audited already board-compliant (full-width primary submit; consent states) — untouched; consent stays before the form because location attaches to the notify (functional dependency beats board ordering).
5. **"Report found" row NOT built** — no such endpoint exists; inventing it would misrepresent the system (flagged for a Finder-domain decision).

**New test** — `finder-pet-details.test.tsx` (4 tests): chips from real data, optional-field omission, **owner box never renders when the safe DTO omits owner data**, renders when present.

**Automated evidence:**

| Command | Result |
|---|---|
| `pnpm typecheck` (full workspace) | **PASS** |
| `pnpm lint` | **PASS** — 0 errors |
| focused `finder-pet-details` suite | **PASS** — 4/4 |
| `pnpm test:unit` | **PASS** — 126 files / 1282 tests |
| `pnpm test:smoke` | **PASS** — 6/6 |
| `pnpm test:regression` | **PASS** — 33/33 |
| `pnpm build` | **PASS** — api/admin/web/finder exit 0 |

**Manual/viewport/device:** none — matrix §4d rows 19–20 UNVERIFIED.  
**ALL QUEUED PACKETS COMPLETE (1b, 1c, 1d, 3, 2).** Remaining human step: viewport checklists (matrix rows 1–20). **STOP.**

### Visual verification pass + FAB fix (2026-10-25, founder-requested "fix, commit and push")

**Status:** agent-run browser verification at Chromium 390×844 against the founder's running dev servers; results recorded in `verification/MOBILE_VISUAL_REDESIGN_MATRIX.md` §3.1 (9 surfaces VERIFIED incl. account shell, finder pet page via mocked safe DTO, and all redesigned public commerce screens).

**Defect found and fixed:** Emergency FAB overlapped sticky bottom bars (screenshot evidence on the product page). Fix in `EmergencyLostPet.tsx`: reserved `STICKY_BAR_BAND_PX = 96` bottom band in `clampToViewport` (covers stored/dragged/resized positions) + default position `bottom-6 → bottom-24`; **re-verified by screenshot**. Pre-existing scroll-fade blank-capture artifact on Home disproven with incremental scrolling (no code change needed).

**Remaining for a human:** widths 320/360/430 + tablet, authenticated screens with real data, notched safe-area, real login/checkout journeys (matrix §3.1 footnote).

### Per-screen visual fidelity pass (2026-10-25, founder-directed: "complete all")

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — full element-level review of all 4 concept images (12 panels) completed in `verification/MOBILE_VISUAL_FIDELITY_MATRIX.md`; all queued presentation fixes implemented; 3 after-fix screenshots verified. Viewport/device checklist rows remain for the human pass.

**What changed:** every `DEVIATES` row fixed — Dashboard (stats strip removed, board trust trio, tag-active dots, tag-usage relocated), MyPets (subtitle, larger meta rows), Pet detail (hero-overlay back/Edit, chip icons), Lost Mode (outlined share + board label), Profile (tab icons, identity chevron), Notifications (board title/copy, icon tiles, relative time), Finder (brand bar, circle avatar, neutral consent card — copy/handlers untouched), Product (full-bleed hero, title/price row, price-in-button sticky), Cart sticky price-in-button, teal Estimated Total, checkout step labels at all widths. Supporting type: optional server-joined `Pet.linkedTag?`.

**Not changed (documented, flippable):** public tab bar, collapsible checkout summary, 4-vs-2 checkout steps, ratings/swatches/back-style, finder "Report found", MFA UI, header search, care-reminders row, lost-mode GPS/team cards, static-row chevrons.

**New evidence:** guest cart + checkout-delivery captures (checkout requires sign-in — existing rule), after-fix screenshots for product/dashboard/finder; free-shipping banner absence proven correct (API threshold `null`).

**Next:** full gates run recorded at close; then human checks (§3.1 footnote). **STOP.**

**Gates actually run at close (2026-10-25):** `pnpm typecheck` PASS · `pnpm lint` PASS (0 errors) · `pnpm test:unit` PASS 126 files/1282 tests · `pnpm test:smoke` PASS 6/6 · `pnpm test:regression` PASS 33/33 · `pnpm build` PASS (api/admin/web/finder). One test updated by design: share-button label expectation now matches the board-approved "Share {name}'s lost pet profile".

### Packet — Order detail header + stepper per founder mock (2026-10-26, founder: "implement all", mobile-first)

**Status:** complete for automated evidence — founder-supplied order-detail mock implemented in the shared `OrderDetailView` (customer-only; mobile-first, desktop consistent). **No hardcoded one-offs:** every value goes through existing tokens/primitives or config, and the pattern is documented in `docs/DESIGN.md` → "Order detail header".

**What changed:** `OrderHeader` → card (48px brand-neutral icon tile + "ORDER" eyebrow + number-only h1 + existing `formatDateTime` line + stacked `StatusBadge size="md"` payment/status pills right; Back button above card); `FullStepper` → mock states (completed `bg-gray-500`+check, current `bg-primary-600`+ring, upcoming `bg-gray-100`) with the visible "Order Progress" title replaced by `role="group" aria-label="Order progress"`; breadcrumb/header titles for detail routes resolve from new `DETAIL_LABELS` config in `apps/web/src/components/account/navigation.ts` (`Order Details` / `Invoice Details`).

**Deliberate deviations (documented in DESIGN.md):** tile is brand-neutral primary, not always-green (a green tile would read "confirmed" on refunded orders); stepper accessible group name replaces a visible title the mock omits.

**Tests updated by design (contract changed to the approved mock, never weakened):** `tests/unit/order-detail-view.test.tsx` (eyebrow + number-only heading, gray completed/current-ring stepper contract, group-role queries) and `tests/unit/mobile-account-nav.test.tsx` (new `DETAIL_LABELS` breadcrumb-label test).

**Remaining for a human:** visual check of the header/stepper on the founder's logged-in phone after push (order detail requires an authenticated session with a real order; agent has no credentials). Viewport/device checklist footnote unchanged.

**Gates actually run at close (2026-10-26):** `pnpm typecheck` PASS · `pnpm lint` PASS (0 errors, 970 pre-existing warnings) · `pnpm test:unit` PASS 126 files/1283 tests · `pnpm test:smoke` PASS 6/6 · `pnpm test:regression` PASS 2 files/33 · `pnpm build` PASS (api/admin/web/finder exit 0). Focused pre-gate run: order-detail + mobile-account-nav suites 20/20 PASS.

### Phase 11 — DynamoDB Discovery Only (complete)

**Status:** **PROVEN** — discovery documentation complete. **No application code changed. No data migrated.**  
**Started/Completed:** 2026-10-06  
**Founder decision:** Option A — website first on MongoDB; AWS region `ap-southeast-2`; DynamoDB cutovers after staging.

**What was produced:**

| File | Content |
|---|---|
| `docs/dynamodb-migration/00-inventory.md` | 73 Mongoose models + critical patterns |
| `01-access-patterns.md` | Operation-level access map |
| `02-entity-map.md` | Domain grouping + draft tables |
| `03-transaction-map.md` | Atomic/conditional operations |
| `04-index-design.md` | PK/SK/GSI draft |
| `05-migration-plan.md` | Wave order (CMS first, money last) |
| `06-risk-register.md` | Risks + mitigations |
| `07-local-and-aws-environments.md` | DynamoDB Local + AWS ap-southeast-2 |
| `FOUNDER_SUMMARY.md` | Plain-English summary |

**Discovery findings (summary):**
- ~73 models; heavy unique keys (email, tagId, orderNumber, invoiceNumber, Stripe IDs)
- Critical atomic ops: inventory reserve/confirm, rewards hold, promo usage, webhook idempotency, counters
- Production money safety uses conditional updates + state machines (not many Mongo transactions)
- Frontends are already database-agnostic (HTTP APIs only)

**Automated commands:** none required for pure docs phase (no code change).  
**Application tests:** unchanged; last full green gates remain Phase 04–09 session.

**Manual/provider validation:** none (discovery only).

**Remaining risks:** all listed in `06-risk-register.md` — require Phase 12–13 implementation + staging.

**Next phase:** Phase 12 DynamoDB low-risk — **STOP. Do not execute Phase 12 until founder authorizes + AWS non-prod IAM keys exist.**

### Phase 12 — DynamoDB Boundary, Infra, Settings Migration Tools (complete for coded evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — repository pattern + migration tools implemented and unit-tested. **Live AWS/DynamoDB Local create+migrate+compare not executed this session.**  
**Started/Completed:** 2026-10-06  
**Founder auth:** IAM keys in `packages/api/.env.local` (gitignored); region `ap-southeast-2`; Settings-first.

**What changed (no product behavior change; Mongo remains default source of truth):**
1. **DynamoDB client factory** — `packages/db/src/dynamodb/client.ts` (server-only; endpoint/prefix from env)
2. **Setting repository** — contract + Mongo adapter + DynamoDB adapter (`SETTING#{key}` PK/SK)
3. **Read mode switch** — `DYNAMODB_SETTINGS_READS=mongo|dynamodb|dual` (default **mongo**)
4. **Migration tool** — `migrate-settings.ts` dry-run / migrate / compare + checkpoint
5. **Table tool** — `create-settings-table.ts` idempotent CreateTable
6. **Docker** — `dynamodb-local` service on port 8000
7. **Env example** — documented AWS/Dynamo vars (secrets stay in `.env.local`)
8. **commerce config** — `getSetting` uses repository when mode ≠ mongo; write dual-ups when enabled

**Files changed (material):**
- `packages/db/src/dynamodb/*`, `packages/db/src/repositories/*`
- `packages/db/src/index.ts`, `packages/db/package.json` (AWS SDK)
- `packages/api/src/commerce/config.ts`
- `packages/api/src/dynamodb/*` (tools)
- `packages/api/.env.example`, `packages/api/package.json`
- `docker/docker-compose.yml`
- Tests: `tests/unit/dynamodb-settings-*.test.ts`
- `verification/DYNAMODB_MIGRATION_MATRIX.md`

**Automated commands actually run:**

| Command | Result |
|---|---|
| `pnpm --filter @pawtag/db typecheck` | **PASS** |
| `pnpm --filter @pawtag/api typecheck` | **PASS** |
| `pnpm typecheck` | **PASS** |
| `pnpm test:unit` | **PASS** (includes DynamoDB settings tests) |
| `pnpm test:smoke` | **PASS** |
| `pnpm build` | **PASS** |

**Manual/provider validation:** none (no live DynamoDB table create/migrate against AWS this session).

**Remaining risks / founder actions for live proof:**
1. Start DynamoDB Local **or** use real AWS with IAM keys  
2. Run `create-settings-table.ts`  
3. Run `migrate-settings.ts --dry-run` then migrate then `--compare`  
4. Only after compare clean: set `DYNAMODB_SETTINGS_READS=dynamodb` on non-prod  
5. Tighten IAM before production  

**Rollback:** `DYNAMODB_SETTINGS_READS=mongo` (default). Mongo remains write path.

**Next phase:** Phase 13 DynamoDB high-risk cutover — **STOP. Do not execute Phase 13 until founder authorizes after Settings live proof + staging payments.**

### Phase 12 live proof + Phase 13 high-risk adapters (complete for coded/proven-settings evidence)

**Status:**  
- Phase 12 Settings: **PROVEN** on real AWS non-prod (`pawtag-dev-settings`, 271/271 compare clean).  
- Phase 13 inventory/rewards: **CODED_NOT_RUNTIME_VALIDATED** — adapters + tests only; **production still MongoDB**.  
- **No money/identity/Finder cutover.**  

**Started/Completed:** 2026-10-06/07  
**Tech Master executed** (founder cannot run commands locally).

**Live AWS evidence (Settings):**

| Step | Result |
|---|---|
| `create-settings-table.ts` | Created `pawtag-dev-settings` (region ap-southeast-2) |
| `migrate-settings.ts --dry-run` | 271 settings |
| `migrate-settings.ts` | migrated=271 |
| `migrate-settings.ts --compare` | **match=271 mismatch=0 missing=0** |
| API read mode | Still **`mongo`** (safe default) |

**Phase 13 coded (not cut over):**
- `packages/db/src/dynamodb/inventory.service.ts` — conditional reserve/release/confirmSale
- `packages/db/src/dynamodb/rewards.service.ts` — conditional reserve/commit/release + checkout RES items
- `tests/unit/dynamodb-high-risk-conditional-writes.test.ts` — PASS

**Automated commands:**

| Command | Result |
|---|---|
| typecheck | **PASS** |
| unit (incl. DynamoDB tests) | **PASS** |
| smoke / build | **PASS** |
| Live Settings migrate/compare | **PASS** (AWS non-prod) |

**Rollback:** `DYNAMODB_SETTINGS_READS=mongo`. Inventory/rewards never left Mongo.

**Next phase:** Donation Track D / staging first-customer path — **STOP. Do not start Phase 14 or money cutover without founder authorization + staging payments proof.**

### Phase 14 — Donation External Gate & Architecture Audit (complete)

**Status:** **PROVEN** — architecture documentation complete. **No donation UI/payment implementation in this phase.**  
**Started/Completed:** 2026-10-07  
**Founder decisions:** Stripe test keys in `.env.local`; defaults OK; **all donation settings configurable**.

**What was produced:**
- `docs/donations/00-architecture-audit.md` — reusable vs gaps
- `01-domain-model.md` — Donation/Payment/Receipt/identity
- `02-payment-webhook-matrix.md` — flows + security
- `03-receipt-rules.md` — neutral receipts until legal confirmed
- `04-security-privacy.md` — abuse/privacy
- `05-implementation-plan.md` — Phase 15–17 plan
- `SETTINGS_CATALOG.md` — **all product values configurable** (no hardcode)

**External gate:** NZ legal/tax items marked **BLOCKED_EXTERNAL**. No IRD tax-credit claims coded.

**Stripe env observed (not printed secrets):** `PAYMENT_MODE=stripe_test`, Stripe secret + webhook secret + Resend key present in `packages/api/.env.local`.

**Automated commands:** none required for pure docs phase.

**Next phase:** Phase 15 donation one-time core — **STOP. Do not execute Phase 15 until founder says go.**

### Phase 15 — Donation Core One-Time (complete for coded evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — one-time donate implemented + automated tests green; **live Stripe webhook not run** this session.  
**Started/Completed:** 2026-10-07  
**Scope:** NZD one-time only; monthly deferred to Phase 16; **all product values configurable**; neutral receipts.

**What was built:**
1. Models: `Donation`, `DonationPayment`, `DonationReceipt`
2. Shared types/endpoints: `packages/shared/src/donation.ts`, `API.donations.*`
3. Settings catalog implemented (`donation-config.ts`) — no hardcoded UI amounts
4. Service: create idempotent one-time donation + PI; webhook success → receipt + email
5. Routes: `GET /api/donations/settings`, `POST /api/donations`, `GET /api/donations/:id`
6. Stripe webhook: donation metadata branch for PI succeeded/failed
7. Public `/donate` page (configurable copy/amounts)
8. Seed script `seed-donations.ts`
9. Tests: `tests/integration/donation-one-time.test.ts` — **9 passed**

**Receipt rule:** `taxClassification=neutral`; statement has **no IRD/tax-credit claims**.

**Automated commands:**

| Command | Result |
|---|---|
| typecheck (db/api/web) | **PASS** |
| donation integration tests | **PASS** — 9 |
| unit / smoke / build | **PASS** |

**Manual/provider validation:** none (no live Stripe PI confirm + webhook this session).

**Remaining risks:**
- Stripe Elements full card UI not mounted in `/donate` (creates PI; payment confirm UI can be Phase 16 polish)
- Public CTA should stay off until Phase 17 rehearsal (`donation.publicEnabled` default false)
- Recurring/monthly not implemented yet

**Next phase:** Phase 16 recurring + portals — **STOP. Do not execute Phase 16 until founder says go.**

### Phase 16 — Recurring Donations, Portal, Admin, Receipts (complete for coded evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — monthly + portal + admin implemented + tests green; live Stripe Billing not run.  
**Started/Completed:** 2026-07-07 → 2026-10-07 session (Phase 16 coding).

**What changed:**
1. **Monthly donations** — Stripe Billing `price_data` (configurable amount, no hardcoded price IDs); fake-mode local sub for tests
2. **Invoice webhooks** — paid → DonationPayment + neutral receipt (idempotent); failed → past_due
3. **Subscription deleted** → cancelled idempotent
4. **Cancel recurring** — supporter + Stripe cancel
5. **Customer portal** — `/account/donations` My Donations + receipt HTML view + cancel
6. **Admin** — `GET/POST /api/admin/donations` list/refund/resend/receipts (RBAC)
7. **Receipt HTML** — neutral wording; ownership-scoped
8. **Endpoints** — `donations.me`, cancel, receiptHtml

**Automated commands:**

| Command | Result |
|---|---|
| typecheck | **PASS** |
| donation integration | **PASS** — 15 tests |
| unit / smoke / build | **PASS** |

**Remaining risks:** live Stripe monthly + webhook not run; admin UI is API-level (full admin page polish later); public `/donate` still flag-off until Phase 17.

**Next phase:** Phase 17 donation reconciliation/security/controlled launch — **STOP. Do not execute Phase 17 until founder says go.**

### Phase 17 — Donation Card Form, Admin UI, Security, Reconciliation (complete for coded evidence)

**Status:** `CODED_NOT_RUNTIME_VALIDATED` — Phase 17 coded + automated tests green; **live Stripe card charge not run**. Public Donate menu **still off** until you flip the setting after rehearsal.  
**Started/Completed:** 2026-10-07  

**What changed:**
1. **`/donate` Stripe card form** — after amount/email, Stripe Elements collects payment (server owns amount)
2. **Footer Donate link** — appears only when `donation.publicEnabled=true` (default **false**)
3. **Admin Donations UI** — list/search/filter/refund (`/admin/donations`, permission `donation.read`)
4. **Reconciliation job** — flags pending donations and succeeded payments missing receipts
5. **Security tests** — min/max amount, no card data in status, ownership on cancel, recon job runs
6. **Neutral tax wording** preserved (no IRD claims)

**Automated commands:**

| Command | Result |
|---|---|
| typecheck (api/web/admin/shared) | **PASS** |
| donation tests (all Phase 15–17) | **PASS** — 21 |
| unit / smoke / build | **PASS** |

**What you still need for live proof:**
1. Stripe **live** keys + webhook URL in Stripe dashboard  
2. Small real card charge (e.g. NZ$5) after you are ready  
3. Then set `donation.publicEnabled=true` (admin settings) to show Donate in footer  

**NZ tax wording:** still **BLOCKED_EXTERNAL** until accountant/legal — receipts stay neutral.

**Next phase:** Suggested next tracks (staging first web customer / more DynamoDB / phone app) — **STOP. Do not start a new phase until founder chooses.**

### Track A0 — Baseline Recovery (complete)

**Status:** PROVEN — quality gates recovered on `main` working tree.  
**Product rules applied (founder decisions):**
1. **Finder can only find ACTIVE tags** — public finder pet-info/notify only when HYBRID 2 status is active. Limited/expired/replaced/returned/inactive → not findable (`tagActive: false`, no pet info).
2. **Tag replacement** — customer activates new tag again; old tag status → `replaced`; new tag `activatedAt` inherits from old tag; remaining active/warranty period transfers when still valid; fresh period when original already expired.
3. **Finder email for any customer** — when a finder notifies on an active tag, email the owner regardless of membership. Free customers get this for the 3-month Active Period; after that membership is required to keep the tag finder-active.
4. **Commit and push** baseline recovery to `origin/main`.

**Automated commands actually run (post-recovery):**

| Command | Result | Summary |
|---|---|---|
| `pnpm typecheck` | **PASS** | all workspace packages |
| `pnpm lint` | **PASS** | 0 errors; warnings only (`no-explicit-any`) |
| `pnpm test:unit` | **PASS** | 82 files, 923 tests |
| `pnpm test:integration` | **PASS** | 62 files, 767 passed, 2 skipped |
| `pnpm test:regression` | **PASS** | 2 files, 33 tests |
| `pnpm test:smoke` | **PASS** | 1 file, 6 tests |
| `pnpm build` | **PASS** | api/admin/web/finder exit 0 |

**Product code changes in recovery:**
- `packages/api/src/routes/finder.ts` — only active tags are findable
- `packages/api/src/routes/customer.ts` — replacement redeem: old → `replaced`, start-date inheritance
- Test fixtures/helpers aligned to HYBRID 2 + entitlement rules (no safety weakened)

**Manual/provider/device validation actually performed:** none (no Stripe/Resend/staging/device run this recovery).  
**Remaining risk (not baseline blockers):**
- **Resolved for free-customer finder email:** any customer with an active tag gets finder email (3-month Active Period; membership required after). Regression test added.
- Paid members can still have `in_app_notifications` disabled via entitlement registry; email remains the guaranteed recovery channel for active tags.
- Demo shipping/push fallbacks, CAPTCHA production path, Stripe live modes remain `CODED_NOT_RUNTIME_VALIDATED`.
- No Playwright E2E; no CI; mobile real-device checklist unchecked.

**Git:** commit + push authorized by founder and performed for baseline recovery.

**Next phase:** `docs/execution/2026-10-06/phases/01_PRODUCTION_SECURITY_AND_PROVIDER_MODES.md` — **STOP. Do not execute Phase 01 until founder authorizes.**

---

## Historical claim re-labeling (evidence-based)

| Historical claim | Evidence state after baseline recovery |
|---|---|
| V2 baseline green (2026-09-20) | **PROVEN again** as of 2026-10-06 re-run on recovered tree (typecheck/lint/unit/integration/regression/smoke/build PASS) |
| Phase 8 mobile “real-device validation complete” | **NOT_STARTED** — checklist unchecked |
| Phase 7 Web E2E | **NOT_STARTED** — no Playwright |
| CI quality gates | **NOT_STARTED** — no workflows |
| Finder production CAPTCHA | **CODED_NOT_RUNTIME_VALIDATED** |
| Payment mode system | **CODED_NOT_RUNTIME_VALIDATED** |
| Email production requires Resend | **CODED_NOT_RUNTIME_VALIDATED** |
| Docker/worker readiness | **CODED_NOT_RUNTIME_VALIDATED** |
| Finder only-active product rule | **PROVEN** in integration tests (active findable; limited/expired not findable) |
| Tag replacement start-date inheritance | **PROVEN** in `tag-replacement.test.ts` |
