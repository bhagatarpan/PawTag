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
| 02 Financial integrity | NOT_STARTED | | | | depends on baseline + Phase 01 | audit synthesis lists inventory/rewards risks |
| 03 Communications/auth | NOT_STARTED | | | | depends on baseline | email provider coded; not production-validated |
| 04 Cart/Checkout web | NOT_STARTED | | | | depends on baseline | cart/checkout coded |
| 05 Finder web | NOT_STARTED | | | | depends on baseline | finder active-only rule implemented + integration tests green; provider/CAPTCHA runtime still unproven |
| 06 Ops/deployment | NOT_STARTED | | | | depends on baseline | no CI workflows present |
| 07 E2E/staging | NOT_STARTED | | | | no Playwright present | first-customer gate not started |
| 08 Shared mobile web | NOT_STARTED | | | | | |
| 09 Capacitor bridges | NOT_STARTED | | | | | |
| 10 Store/device gate | NOT_STARTED | | | | physical device evidence absent | checklist is `NOT_STARTED` |
| 11 Dynamo discovery | NOT_STARTED | | | | | |
| 12 Dynamo low-risk | NOT_STARTED | | | | | |
| 13 Dynamo high-risk | NOT_STARTED | | | | | |
| 14 Donation gate | NOT_STARTED | | | | | |
| 15 Donation one-time | NOT_STARTED | | | | | |
| 16 Donation recurring/portals | NOT_STARTED | | | | | |
| 17 Donation release | NOT_STARTED | | | | | |
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
