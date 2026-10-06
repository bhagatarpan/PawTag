# Phase 00 Baseline Evidence

**Executed:** 2026-10-06  
**Packet:** `docs/execution/2026-10-06/phases/00_EVIDENCE_RESET_AND_BASELINE.md`  
**Rule:** counts below come from commands actually run in this environment, not from historical docs.

---

## 1. Repository state

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `f7027c2` — `PawTag_Autonomous_Execution_Pack_2026-10-06` |
| Upstream | branch reports up to date with `origin/main` (not pulled/fetched by agent) |
| Working tree | **Dirty** — pack overlay installed, not committed |

### Dirty / untracked state (preserved)

Unstaged modifications:
- `AGENTS.md`
- `docs/PawTag_Autonomous_Execution_Pack_2026-10-06.zip` (deleted)
- multiple `skills/*/SKILL.md` and one `skills/mobile-native/agents/openai.yaml`

Untracked:
- `docs/execution/` (execution pack + Phase 00 evidence)
- `skills/donation-domain/`
- `skills/dynamodb-migration/`
- `skills/financial-document-integrity/`
- `skills/web-first-mobile-shell/`

**Git actions performed by Phase 00:** read-only (`status`, `branch`, `log`, `rev-parse`).  
**Git actions not performed:** pull, fetch, reset, stash, clean, commit, push, branch switch.

### Recent commits (context)

```
f7027c2 PawTag_Autonomous_Execution_Pack_2026-10-06
330d709 Merge branch 'feature/payment-methods-visibility' into main
006a865 fix(payments): visible saved cards without membership + honest save banner
0d4339c fix(web): correct api import path in SaveCardBanner
ee224f8 fix(web): correct api import path in SetupPaymentMethodForm
```

---

## 2. Environment assumptions

| Item | Observed |
|---|---|
| OS shell | Windows + bash tool |
| Node | `v24.19.0` |
| pnpm | `11.14.0` |
| engines | `node >=22` |
| packageManager | `pnpm@11.14.0` |
| node_modules | present (install not required for baseline run) |
| Workspace packages | all version `0.1.0` |

### Workspace packages inspected

| Path | Name |
|---|---|
| root | `pawtag` |
| `apps/web` | `@pawtag/web` |
| `apps/admin` | `@pawtag/admin` |
| `apps/finder` | `@pawtag/finder` |
| `apps/mobile` | `@pawtag/mobile` |
| `packages/api` | `@pawtag/api` |
| `packages/db` | `@pawtag/db` |
| `packages/shared` | `@pawtag/shared` |
| `packages/ui` | `@pawtag/ui` |
| `packages/design-tokens` | `@pawtag/design-tokens` |

### Tooling present

- Root scripts: `typecheck`, `lint`, `test`, `test:unit`, `test:integration`, `test:regression`, `test:smoke`, `test:all`, `build` (+ per-package builds)
- Vitest root config: `vitest.config.ts`
- API env example: `packages/api/.env.example`
- API `.env` present on disk (not read for secrets; not printed)
- Docker: `docker/docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web`, `nginx.conf`
- OpenCode config: `opencode.json` → `AGENTS.md` + `skills/`
- Execution pack installed under `docs/execution/2026-10-06/`

### Missing / not found

| Item | Finding |
|---|---|
| Playwright config | **not present** |
| Browser E2E suite (`tests/e2e/`) | **not present** |
| CI workflows (`.github/workflows/`) | **not present** |
| Root-level `EXECUTION_STATUS.md` before Phase 00 | **not present** (created this phase) |

---

## 3. Baseline commands — executed results

### 3.1 `pnpm typecheck` — FAIL

Command: `pnpm typecheck`  
Script expands to: `pnpm run build:shared && pnpm run build:db && pnpm -r typecheck`

Observed:
- Shared/db builds proceed as pre-step for typecheck script.
- Recursive typecheck fails at `@pawtag/ui`.
- Follow-on apps that compile `packages/ui` sources fail with the same root cause.

Primary defect classes in `packages/ui`:
1. **React type mismatch:** lucide-react icons fail as JSX components because TypeScript resolves `@types/react@19.1.17` (`ReactNode` includes `bigint` incompatibility path) while package declares React 18 peer/dev types. Both `@types+react@18.3.31` and `@types+react@19.1.17` exist under `node_modules/.pnpm`.
2. **Duplicate property:** `packages/ui/src/types.ts` `OrderData` declares `items` twice (lines ~249 and ~279) with incompatible types.

Per-package re-checks (individual commands):

| Package | typecheck |
|---|---|
| `@pawtag/api` | **PASS** |
| `@pawtag/shared` | **PASS** |
| `@pawtag/db` | **PASS** |
| `@pawtag/ui` | **FAIL** |
| `@pawtag/admin` | **FAIL** (same ui type errors) |
| `@pawtag/web` | **FAIL** (same ui type errors) |
| `@pawtag/finder` | **FAIL** (same ui type errors) |

**Phase 00 treatment:** recorded as pre-existing product/tooling defect. Not fixed (would be unrelated product/type repair outside baseline documentation scope).

### 3.2 `pnpm lint` — FAIL

Command: `pnpm lint` (`pnpm -r lint`)

Observed:
- `@pawtag/shared` — PASS with warnings (11 `no-explicit-any`)
- `@pawtag/db` — PASS with warnings (3 `no-explicit-any`)
- `@pawtag/mobile` — **FAIL**: 81 problems (18 errors, 63 warnings); errors are unused vars (`API`, `useRef`, `user`, `Alert`, `useEffect`, `shadows`, `navigation`, `showAdd`/`setShowAdd`, `getMainPhoto`, `api`, etc.)
- Recursive run stops at first failure (`apps/mobile`), so remaining packages were not fully re-run by root command in this baseline.

### 3.3 `pnpm test:unit` — FAIL

```
Test Files  2 failed | 80 passed (82)
Tests       2 failed | 920 passed (922)
Duration    87.22s
```

Failed tests (pre-existing):

| Test | Expected vs actual |
|---|---|
| `tests/unit/email-templates.test.ts` > Password Changed > includes admin ID when changed by admin | expects HTML to contain `'administrator'`; actual template `packages/api/src/services/email/templates/password-changed.ts` renders `${changedBy} (PawTag)` |
| `tests/unit/orderStatus.test.ts` > getValidTransitions > returns correct transitions for shipped | test expects `['delivered']`; production service `packages/api/src/services/orderStatus.service.ts` allows `shipped: ['delivered','refunded']` |

**Note:** These look like stale tests vs intentional/current code (or incomplete test updates). Phase 00 does **not** decide which side is product-correct; later phases must decide and either fix code or update tests with product justification.

### 3.4 `pnpm test:integration` — FAIL

```
Test Files  11 failed | 51 passed (62)
Tests       47 failed | 719 passed | 2 skipped (768)
Duration    92.97s
```

Failing suites (11):

| Suite | Failed tests | Failure pattern |
|---|---|---|
| `mobile-features.test.ts` | 17 | many 403 vs expected 201/200/404/409; finder notify DB writes null |
| `customer-full.test.ts` | 7 | health records + tag redeem 403 |
| `finder-idempotency.test.ts` | 4 | duplicate notify contract fields/notification counts |
| `tag-redemption.test.ts` | 4 | redeem 403; error message wording; auto-tag creation 400 |
| `finder-full.test.ts` | 3 | `tagActive` undefined; notify notifications length 0 |
| `order-notifications.test.ts` | 3 | `sendMail` mock not called |
| `stripe-webhook-raw-body.test.ts` | 3 | webhook body/`received`/status expectations |
| `subscriptions.test.ts` | 3 | finder subscriptionStatus/tagActive fields undefined |
| `finder-dto-privacy.test.ts` | 1 | `medicalAlerts` undefined |
| `finder.test.ts` | 1 (2 skipped) | notify creates notification for owner |
| `tag-replacement.test.ts` | 1 | replacement transfer redeem 403 |

Important observation for later phases:
- Many 403s align with recent auth work (`requireVerifiedChannels` / `verificationGuard` returning `REQUIRES_VERIFICATION` / 403). Recent commits explicitly added “require verified email+phone before complete”. Integration fixtures may not set `emailVerified`/`phoneVerified` the same way current production rules require. This is a **contract/fixture/authorization alignment** issue for later phases — **do not weaken verification** to green tests.
- Finder notify/idempotency failures are launch-critical; treat as Phase 05/02 evidence debt.
- Stripe webhook raw-body failures are financially critical; treat as Phase 01/02 evidence debt.

Integration logs also showed validateEnv warnings under test runs (missing Firebase/Resend/PAYMENT_MODE etc.). That is expected for unit/integration isolation but confirms provider runtime proof is absent.

### 3.5 `pnpm test:regression` — PASS

```
Test Files  2 passed (2)
Tests       33 passed (33)
Duration    3.33s
```

Suites: `tests/regression/auth.regression.test.ts`, `tests/regression/security.regression.test.ts`.

### 3.6 `pnpm test:smoke` — FAIL

```
FAIL tests/smoke/api.smoke.test.ts
Error: [vitest] No "Subscription" export is defined on the "@pawtag/db" mock.
  packages/api/src/routes/admin-test-data-reset.ts imports Subscription from @pawtag/db
Test Files  1 failed | no tests executed
```

### 3.7 `pnpm build` — FAIL

Script: `build:shared && build:db && concurrently(api, admin, web, finder)`

| Step | Result |
|---|---|
| `build:shared` | PASS (pre-step) |
| `build:db` | PASS (pre-step) |
| `build:api` | **PASS** (exit 0) |
| `build:admin` | **FAIL** (exit 1) — packages/ui type errors |
| `build:web` | **FAIL** (exit 1) — packages/ui type errors |
| `build:finder` | **FAIL** (exit 1) — packages/ui type errors |

---

## 4. Evidence inventories

### 4.1 Browser E2E / Playwright

| Check | Result |
|---|---|
| `playwright.config.*` | not found |
| `tests/e2e/` | not found |
| Root package scripts for Playwright | none |
| Historical docs mentioning Playwright | plans/markdown only (e.g. enterprise roadmap, verification gate) |

**State:** `NOT_STARTED` for actual browser E2E execution and enforcement.  
`docs/MVP_IMPLEMENTATION_STATUS.md` Phase 7.1/7.2 already unchecked; reconfirmed by repo search.

### 4.2 Mobile physical-device evidence

| Check | Result |
|---|---|
| `docs/MOBILE-REAL-DEVICE-VALIDATION.md` | exists |
| Checklist items | **all unchecked** |
| CI device artifacts | none found |

**State:** `NOT_STARTED`.  
**Contradiction:** `docs/MVP_IMPLEMENTATION_STATUS.md` marks Phase 8.4 real-device validation and Phase 8 “Complete”. That claim is **not supported** by executed evidence and must not be treated as PROVEN.

### 4.3 Production-provider modes and fallbacks (code inventory, not runtime proof)

| Domain | Code location / mechanism | Mode/fallback observed | Evidence state |
|---|---|---|---|
| Payments / Stripe | `packages/api/src/commerce/payment-mode.ts`, `packages/api/src/config/validateEnv.ts`, `packages/api/src/lib/stripe-client.ts`, provider under `commerce/providers/stripe/` | `PAYMENT_MODE`: `fake` \| `stripe_test` \| `stripe_live`; production requires `stripe_live`; fake demo IDs exist in provider; production validates test keys/placeholders | `CODED_NOT_RUNTIME_VALIDATED` |
| Stripe webhooks | `packages/api/src/routes/stripe-webhooks.ts` | raw-body + signature path; fake-mode webhook special-cased; production fake mode logs error | `CODED_NOT_RUNTIME_VALIDATED` (integration raw-body tests currently failing) |
| Email | `packages/api/src/services/email.service.ts`, `validateEnv.ts` feature email | Resend (`RESEND_API_KEY`); production missing key → failure (not success); dev demo logs/simulates | `CODED_NOT_RUNTIME_VALIDATED` |
| SMS | Twilio feature flags in validateEnv | optional provider path present | `CODED_NOT_RUNTIME_VALIDATED` |
| Storage | `STORAGE_DRIVER` (`local` \| `r2`), R2 env keys, `r2.service.ts` / `storage/*` | local default; R2 requires keys when selected | `CODED_NOT_RUNTIME_VALIDATED` |
| Shipping | `packages/api/src/services/shipping.service.ts`, NZ Post provider notes | **demo fallback** when no/`demo_key` API key returns fake tracking; real courier API path incomplete (TODO comment) | `CODED_NOT_RUNTIME_VALIDATED` + demo fallback remains |
| Push | `packages/api/src/services/push-notification.service.ts` | Firebase Admin when env set; **demo mode logs success-like DEMO PUSH when unconfigured** | `CODED_NOT_RUNTIME_VALIDATED`; production risk if unconfigured |
| CAPTCHA | `packages/api/src/middleware/captcha.ts`, finder `NotifyOwnerForm.tsx` | math JWT CAPTCHA; skipped in `development`/`test`; required otherwise; finder UI loads challenge | `CODED_NOT_RUNTIME_VALIDATED` for production-like notify |
| Rate limiting | `packages/api/src/lib/rate-limiter.ts`, seeds `rateLimit.*` keys, finder/auth route limiters | DB-configured maxima (global/auth/finder/guardian/etc.) | `CODED_NOT_RUNTIME_VALIDATED` |

### 4.4 CI / deployment inventory

| Item | Finding |
|---|---|
| GitHub Actions workflows | none |
| Docker files | present (`docker/`) |
| Worker role env | `PAWTAG_WORKER_ROLE` documented in API `.env.example` |
| Backup/restore rehearsal evidence | not executed in Phase 00 |

---

## 5. Gaps and next-phase blockers

### Hard blockers for trusting “green production readiness”

1. **Baseline is red.** typecheck/lint/unit/integration/smoke/build are not green on current `main` + pack overlay working tree.
2. **No browser E2E.** Critical journeys are not proven end-to-end in a browser.
3. **No CI gates.** Nothing automatically enforces baseline.
4. **No provider/staging/device validation executed** this phase (and historical docs overclaimed some of these).
5. **Finder notify/idempotency + Stripe webhook integration tests currently fail** — launch-critical debt for Phases 01/02/05.
6. **Authorization verification rules vs fixtures** appear misaligned (403s). Fix by aligning fixtures to real rules or fixing real authorization defects — never by removing verification.
7. **`packages/ui` type breakage blocks admin/web/finder builds** — must be repaired in an appropriate early phase (tooling/types, not by weakening product types blindly).
8. **Demo/fallback paths remain** in shipping and push; Phase 01 must decide production policy and fail-closed behavior.

### Recommended sequencing note (not executed)

Per execution pack: stabilize Track A first. Do **not** start Phase 01 until founder authorizes next packet. Do **not** mix DynamoDB/donations into baseline repair.

---

## 6. What Phase 00 did not do

- Did not change product/business code
- Did not weaken auth/authz/payment/privacy controls
- Did not delete or skip failing tests
- Did not reseed/reset any database
- Did not commit/push/reset Git
- Did not run Stripe/Resend/Firebase/AWS/Apple real integrations
- Did not claim production readiness

---

## 7. Rollback

Phase 00 only created documentation:

```text
docs/execution/EXECUTION_STATUS.md
docs/execution/BASELINE_EVIDENCE.md
```

If these should not be retained, delete those two files. The execution-pack overlay changes already present in the working tree remain as the founder left them (uncommitted).
