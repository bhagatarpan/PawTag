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
| 08 Shared mobile web | **CODED_NOT_RUNTIME_VALIDATED** | `main` @ Phases 05–09 commit | platform capability abstraction + browser fallback unit tests PASS | no device/browser visual matrix this session | app-mode chrome partial | `apps/web/src/platform/*` |
| 09 Capacitor bridges | **CODED_NOT_RUNTIME_VALIDATED** | `main` @ Phases 05–09 commit | capacitor.config.ts + native bridge code (dynamic import); finder deep-link exclusion coded | no iOS/Android SDK/device build this session | Phase 10 device/store gate required | CODED_NOT_RUNTIME_VALIDATED until physical devices |
| 10 Store/device gate | NOT_STARTED | | | | physical device evidence absent | checklist is `NOT_STARTED` |
| 11 Dynamo discovery | **PROVEN** (discovery docs complete; no code migration) | `main` @ Phase 11 commit | docs/dynamodb-migration/ 00-07 + FOUNDER_SUMMARY written; models inventoried (73); access patterns mapped | none required for discovery | Phase 12 needs IAM + DynamoDB Local | discovery pack only; MongoDB remains production for first web customer |
| 12 Dynamo low-risk | **PROVEN** (live AWS Settings migrate + compare) | `main` @ Phase 12/13 commit | table `pawtag-dev-settings` created; 271 settings migrated; compare match=271 mismatch=0; unit tests PASS | real AWS ap-southeast-2 (non-prod prefix) | none for Settings proof | reads still default mongo; no money cutover |
| 13 Dynamo high-risk | **CODED_NOT_RUNTIME_VALIDATED** (conditional adapters + tests; **no cutover**) | `main` @ Phase 13 commit | Dynamo inventory + rewards services + failure-injection unit tests PASS | no live inventory/rewards on DynamoDB | staging payments still required before any money cutover | production remains MongoDB for inventory/rewards/orders/identity/Finder |
| 13 Dynamo high-risk | NOT_STARTED | | | | | |
| 14 Donation gate | **PROVEN** (architecture audit complete; no donate UI code) | `main` @ Phase 14 commit | docs/donations/ 00-05 + SETTINGS_CATALOG; Stripe test keys present in .env.local | NZ legal/tax BLOCKED_EXTERNAL | neutral receipts until donee confirmed | settings catalog defined; Phase 15 not started |
| 15 Donation one-time | NOT_STARTED | | | | depends on Phase 14 + founder go | | |
| 16 Donation recurring/portals | NOT_STARTED | | | | depends on Phase 15 | | |
| 17 Donation release | NOT_STARTED | | | | depends on 15–16 + live rehearsal | | |
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
