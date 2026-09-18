# MVP Implementation Status

> Created: 2026-09-18 — Work Packet 0.1 Baseline

## Baseline (2026-09-18)

- [x] install — PASS (pnpm 11.14.0, Node v24.19.0)
- [ ] typecheck — FAIL (22 TS errors in `apps/mobile/src/screens/guardian/GuardianDashboardScreen.tsx`)
- [x] unit — PARTIAL (55/56 files pass; 770/772 tests pass; 2 pre-existing failures in `subscription.service.test.ts`)
- [ ] integration — PARTIAL (27/35 files pass; 513/531 tests pass; 8 files fail — see pre-existing failures)
- [x] regression — PASS (2/2 files, 33/33 tests)
- [x] smoke — PASS (1/1 file, 6/6 tests)
- [ ] build — PARTIAL (shared/db/admin/finder PASS; api/web FAIL — pre-existing TS errors)

### Baseline Fix Applied

- Added `uuid` and `@types/uuid` to `packages/api` (was missing from dependencies, blocking test imports)

## Pre-existing Failures

### Typecheck (22 errors)
- `apps/mobile/src/screens/guardian/GuardianDashboardScreen.tsx` — design token property mismatches (`emerald`, `teal`, `violet`, `2xl`, `sm`, `md`, `xl`, `xs`, `lg`, `base`, `3xl` not in token types)

### Unit Tests (2 failures)
- `tests/unit/subscription.service.test.ts` — free period expects 12 months, gets 3; plan price expects 1.99, gets 0.99

### Integration Tests (16 failures across 8 files)
- `guardian-api.test.ts`, `loyalty-api.test.ts`, `subscriptions-api.test.ts` — cannot find `express` (missing root dependency)
- `low-stock-check.test.ts` — Product validation: `slug` path required (5 failures)
- `admin-analytics.test.ts` — low stock product query failure (1 failure)
- `tag-redemption.test.ts` — auto-tag creation slug validation (1 failure)
- `admin-full.test.ts` — product CRUD slug validation (5 failures)
- `upload-r2.test.ts` — R2 not configured, falls back to local storage (4 failures)

### Build (2 failures)
- `packages/api` — TS error in `email.service.ts` (type mismatch with `GuardianWelcomeEmailData`)
- `apps/web` — TS errors in `CartContext.tsx` (string|undefined) and `VerifyAccount.tsx` (undefined `setSearchParams`)

## Work Packets

- [x] 0.1 Baseline repository health
- [x] 1.1 Finder production CAPTCHA
- [x] 1.2 Stripe raw-body webhook
- [x] 1.3 Checkout ownership bypass
- [x] 1.4 Production payment config guardrails
- [x] 1.5 Checkout consistency/recovery state machine
- [x] 1.6 Inventory reservation compensation
- [x] 2.1 Public Finder DTO
- [x] 2.2 Recovery state semantics
- [x] 2.3 Finder idempotency
- [x] 2.4 Finder degraded-network UX
- [x] 2.5 Finder privacy retention
- [x] 3.1 Payment/order idempotency
- [x] 3.2 Webhook state/claiming
- [x] 3.3 Refund correctness
- [x] 3.4 Cancellation correctness
- [x] 3.5 Subscription entitlement integrity
- [x] 3.6 NZ timezone assumptions
- [ ] 4.1 Browser refresh-token hardening (HttpOnly cookies — deferred)
- [x] 4.2 Session invalidation matrix
- [x] 4.3 Proxy/rate-limit correctness
- [x] 4.4 Input validation consistency
- [x] 4.5 Object-level authorization audit
- [x] 4.6 Upload/storage security
- [ ] 5.1-5.9 Premium cart redesign
- [ ] 6.1-6.3 Checkout/customer critical UX
- [ ] 7.1 Critical web E2E
- [ ] 7.2 CI quality gates
- [ ] 8.1 Async token storage
- [ ] 8.2 QR scanner fix
- [ ] 8.3 NFC NDEF decoding
- [ ] 8.4 Real-device validation
- [ ] 8.5 Mobile release gate
- [ ] 9.1-9.4 Admin operational safety
- [ ] 10.1-10.3 Background jobs/worker
- [ ] 11.1-11.5 Deployment/production config
- [ ] 12.1-12.3 Observability/incident readiness
- [ ] 13.1-13.3 Accessibility/UX consistency
- [ ] 14.1-14.3 Design system/web-mobile reuse
- [ ] 15.1-15.3 Performance hardening
- [ ] 16.1-16.3 Code quality cleanup
- [ ] 17.1-17.3 Production rehearsal
- [ ] 18.1 First real customer launch

## Known Pre-existing Failures

| Category | Count | Root Cause |
|----------|-------|------------|
| Typecheck | 22 errors | Mobile design token type mismatches |
| Unit tests | 2 failures | Subscription service assertion mismatches |
| Integration tests | 16 failures | Missing express dep, Product slug validation, R2 config |
| Build | 2 failures | API email service type error, web CartContext/VerifyAccount TS errors |
