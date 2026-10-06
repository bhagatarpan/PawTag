# FINAL FIRST CUSTOMER GATE (Track A — web)

**Updated:** 2026-10-06 (Phases 00–09 automated evidence session)

> Founder may proceed only when this gate is honestly green. DynamoDB/Donations/native store are not prerequisites unless explicitly promoted.

| Gate item | Status | Evidence |
|---|---|---|
| Baseline quality gates green | **PROVEN** | typecheck/lint/unit/integration/smoke/regression/build (Track A0 + later phases) |
| Production payment config fail-closed | **PROVEN (automated)** | Phase 01 validateEnv + provider tests |
| Stripe webhook signature + idempotency | **CODED_NOT_RUNTIME_VALIDATED** (automated) | raw body + tests; live Stripe not run |
| Inventory/rewards/promo concurrency | **PROVEN (automated)** | Phase 02 tests |
| Membership cannot activate without Stripe payable state | **PROVEN (automated)** | Phase 03 tests |
| Finder only-active + free-customer email | **PROVEN (automated)** | finder + email tests |
| Browser session cookie-only refresh | **PROVEN (automated)** | Phase 01 auth tests |
| Cart/Checkout 70/30 structure | **CODED_NOT_RUNTIME_VALIDATED** (browser visual) | Phase 04 code + unit; no interactive browser this session |
| Browser E2E harness | **CODED_NOT_RUNTIME_VALIDATED** | Playwright config + smoke specs added; needs running app + staging |
| CI quality gates | **CODED_NOT_RUNTIME_VALIDATED** | workflow added; not executed on GitHub Actions this session |
| Live Resend/Stripe/Firebase/courier | **CODED_NOT_RUNTIME_VALIDATED** | no provider credentials used |
| Staging dress rehearsal | **NOT_STARTED / BLOCKED_EXTERNAL** | requires staging env + test providers |
| Real-person UX test | **NOT_STARTED** | founder/staff non-developer run required |
| Backup restore rehearsal | **BLOCKED_EXTERNAL** | not executed against live DB this session |
| Native store/device gate | **NOT_STARTED** | Phase 10 |

## Recommendation

**Do not open to public first customers yet.**  
Safe next steps for a **controlled founder/staff test customer**:

1. Configure `stripe_test` + Resend test key on a staging host  
2. Run Playwright + manual cart/checkout/Finder on that host  
3. Complete real-person UX test  
4. Revisit this gate  

**Track A automated foundation is strong; external provider/staging proof is the remaining launch blocker.**
