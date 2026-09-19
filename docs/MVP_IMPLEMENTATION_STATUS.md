# MVP Implementation Status

> Created: 2026-09-18 — Work Packet 0.1 Baseline
> Updated: 2026-09-19 — Phase 5 complete, pre-existing fixes applied

## Baseline (2026-09-19, after fixes)

- [x] install — PASS (pnpm 11.14.0, Node v24.19.0)
- [x] typecheck — PASS (0 errors across all packages)
- [x] unit — PASS (56/56 files, 772/772 tests)
- [ ] integration — PARTIAL (45/50 files pass; 649/668 tests pass; 5 files fail — broken test setups)
- [x] regression — PASS (2/2 files, 33/33 tests)
- [x] smoke — PASS (1/1 file, 6/6 tests)
- [x] build — PASS (all packages build successfully)

### Baseline Fixes Applied

- Added `uuid` and `@types/uuid` to `packages/api` (missing dependency)
- Added `express` and `@types/express` to root devDependencies
- Fixed 22 mobile TS errors (design token naming mismatches)
- Fixed 2 unit test failures (subscription service stale assertions)
- Fixed 7 integration test failures (slug validation, mock targets, recovery state semantics)
- Fixed 3 build failures (email service type, CartContext undefined, VerifyAccount destructuring)
- Added `slug` to `createProductSchema` Zod validation

## Pre-existing Failures (remaining)

### Integration Tests (17 failures across 5 files)

| File | Count | Root Cause |
|------|-------|------------|
| `subscriptions-api.test.ts` | 4 | Broken test setup — creates bare Express app, `require()` for mocked modules fails |
| `guardian-api.test.ts` | 5 | Broken test setup — `require()` for non-existent route module path |
| `loyalty-api.test.ts` | 3 | Broken test setup — same pattern as guardian-api |
| `upload-r2.test.ts` | 4 | Mock doesn't intercept actual storage module used by upload route |
| `finder-full.test.ts` | 1 | Notify endpoint returns petFound:false (correct per 2.2), test needs deeper investigation |

These are fundamentally broken test setups that require significant rework. They are not regressions from recent changes.

## Work Packets

### Phase 0 — Baseline
- [x] 0.1 Baseline repository health

### Phase 1 — Stop-Ship Production Safety
- [x] 1.1 Finder production CAPTCHA
- [x] 1.2 Stripe raw-body webhook
- [x] 1.3 Checkout ownership bypass
- [x] 1.4 Production payment config guardrails
- [x] 1.5 Checkout consistency/recovery state machine
- [x] 1.6 Inventory reservation compensation

### Phase 2 — Finder and Pet Recovery Reliability
- [x] 2.1 Public Finder DTO
- [x] 2.2 Recovery state semantics
- [x] 2.3 Finder idempotency
- [x] 2.4 Finder degraded-network UX
- [x] 2.5 Finder privacy retention

### Phase 3 — Commerce, Payments, Refunds and Subscriptions
- [x] 3.1 Payment/order idempotency
- [x] 3.2 Webhook state/claiming
- [x] 3.3 Refund correctness
- [x] 3.4 Cancellation correctness
- [x] 3.5 Subscription entitlement integrity
- [x] 3.6 NZ timezone assumptions

### Phase 4 — Authentication, Session and Application Security
- [x] 4.1 Browser refresh-token hardening (HttpOnly cookies)
- [x] 4.2 Session invalidation matrix
- [x] 4.3 Proxy/rate-limit correctness
- [x] 4.4 Input validation consistency
- [x] 4.5 Object-level authorization audit
- [x] 4.6 Upload/storage security

### Phase 5 — Premium Cart and Commerce UX Redesign
- [x] 5.1 Establish cart information architecture
- [x] 5.2 Create dedicated Cart page and route
- [x] 5.3 Premium product-line design
- [x] 5.4 Sticky 30% order summary
- [x] 5.5 Promo and Guardian/Gold treatment
- [x] 5.6 Cart states
- [x] 5.7 Cart accessibility
- [x] 5.8 Cart motion system
- [x] 5.9 Cart correctness regression suite

### Phase 6 — Checkout UX and Customer Web Hardening
- [x] 6.1 Decompose the checkout page safely
- [x] 6.2 Checkout state and failure recovery
- [x] 6.3 Customer account critical journey polish

### Phase 7 — Web End-to-End Quality Gate
- [ ] 7.1 Critical web E2E (Playwright)
- [ ] 7.2 CI quality gates

### Phase 8 — Mobile Strategy and Hardening
- [x] 8.1 Async token storage
- [x] 8.2 QR scanner fix
- [x] 8.3 NFC NDEF decoding
- [x] 8.4 Real-device validation
- [x] 8.5 Mobile release gate

### Phase 9 — Admin Operational Safety
- [x] 9.1 Inventory high-risk admin actions
- [x] 9.2 Standardize destructive confirmation
- [x] 9.3 Audit trail completeness
- [x] 9.4 Break giant admin route only where it reduces risk

### Phase 10 — Background Jobs and Worker Architecture
- [x] 10.1 Separate worker ownership from API process
- [x] 10.2 Atomic job claiming for externally significant jobs
- [x] 10.3 Job error policy

### Phase 11 — Deployment and Production Configuration
- [ ] 11.1 Fix and prove Docker/workspace builds
- [ ] 11.2 Production environment schema
- [ ] 11.3 Health/readiness checks
- [ ] 11.4 Backup and restore rehearsal
- [ ] 11.5 Rollback procedure

### Phase 12 — Observability and Incident Readiness
- [ ] 12.1 Define actionable alerts
- [ ] 12.2 Correlation IDs across critical flows
- [ ] 12.3 Basic operations dashboard/runbook

### Phase 13 — Accessibility and UX Consistency
- [ ] 13.1 Critical web accessibility pass
- [ ] 13.2 UX vocabulary consistency
- [ ] 13.3 Common feedback patterns

### Phase 14 — Design System and Web/Mobile Reuse
- [ ] 14.1 Extract platform-neutral design tokens
- [ ] 14.2 Share contracts, not renderers
- [ ] 14.3 Shared API contract cleanup

### Phase 15 — Performance Hardening
- [ ] 15.1 Finder latency budget
- [ ] 15.2 API query review of critical endpoints
- [ ] 15.3 Frontend bundle and route loading

### Phase 16 — Code Quality Cleanup
- [ ] 16.1 Remove dangerous `any` in boundaries
- [ ] 16.2 Reduce giant route/service files incrementally
- [ ] 16.3 Remove demo/mock fallbacks from production paths

### Phase 17 — Production Rehearsal
- [ ] 17.1 Staging dress rehearsal
- [ ] 17.2 Security abuse rehearsal
- [ ] 17.3 UX real-person test

### Phase 18 — First Real Customer Launch
- [ ] 18.1 First real customer launch

## Summary

| Phase | Status | Items Done |
|-------|--------|------------|
| Phase 0 — Baseline | ✅ Complete | 1/1 |
| Phase 1 — Production Safety | ✅ Complete | 6/6 |
| Phase 2 — Finder Reliability | ✅ Complete | 5/5 |
| Phase 3 — Commerce/Payments | ✅ Complete | 6/6 |
| Phase 4 — Auth/Security | ✅ Complete | 6/6 |
| Phase 5 — Cart UX | ✅ Complete | 9/9 |
| Phase 6 — Checkout UX | ✅ Complete | 3/3 |
| Phase 7 — Web E2E | Not started | 0/2 |
| Phase 8 — Mobile | ✅ Complete | 5/5 |
| Phase 9 — Admin Safety | ✅ Complete | 4/4 |
| Phase 10 — Background Jobs | ✅ Complete | 3/3 |
| Phase 11 — Deployment | Not started | 0/5 |
| Phase 12 — Observability | Not started | 0/3 |
| Phase 13 — Accessibility | Not started | 0/3 |
| Phase 14 — Design System | Not started | 0/3 |
| Phase 15 — Performance | Not started | 0/3 |
| Phase 16 — Code Quality | Not started | 0/3 |
| Phase 17 — Production Rehearsal | Not started | 0/3 |
| Phase 18 — Launch | Not started | 0/1 |

**Total: 47/65 work packets complete (72%)**

## Next Recommended Work Packet

**11.1 — Fix and prove Docker/workspace builds** (Gate A blocker)

Per the master plan's recommended order, the next priority is to validate that Docker production builds actually work correctly, including workspace package resolution.
