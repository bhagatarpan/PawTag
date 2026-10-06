# Autonomous Execution Status — Template

> Keep a working copy in the repository, for example `docs/execution/EXECUTION_STATUS.md`.

## Evidence states

`PROVEN | CODED_NOT_RUNTIME_VALIDATED | BLOCKED_EXTERNAL | FAILED | NOT_STARTED`

## Phase table

| Phase | Status | Commit/branch | Automated evidence | Runtime/provider evidence | Blockers | Notes |
|---|---|---|---|---|---|---|
| 00 Baseline | NOT_STARTED | | | | | |
| 01 Production safety | NOT_STARTED | | | | | |
| 02 Financial integrity | NOT_STARTED | | | | | |
| 03 Communications/auth | NOT_STARTED | | | | | |
| 04 Cart/Checkout web | NOT_STARTED | | | | | |
| 05 Finder web | NOT_STARTED | | | | | |
| 06 Ops/deployment | NOT_STARTED | | | | | |
| 07 E2E/staging | NOT_STARTED | | | | | |
| 08 Shared mobile web | NOT_STARTED | | | | | |
| 09 Capacitor bridges | NOT_STARTED | | | | | |
| 10 Store/device gate | NOT_STARTED | | | | | |
| 11 Dynamo discovery | NOT_STARTED | | | | | |
| 12 Dynamo low-risk | NOT_STARTED | | | | | |
| 13 Dynamo high-risk | NOT_STARTED | | | | | |
| 14 Donation gate | NOT_STARTED | | | | | |
| 15 Donation one-time | NOT_STARTED | | | | | |
| 16 Donation recurring/portals | NOT_STARTED | | | | | |
| 17 Donation release | NOT_STARTED | | | | | |
| 18 Final reconciliation | NOT_STARTED | | | | | |

## Per-phase evidence record

### Phase X — Name

**Status:**  
**Started:**  
**Completed:**  
**Files changed:**  
**Migrations/backfills:**  
**Environment/config changes:**  
**Automated commands actually run:**  
**Results:**  
**Manual/provider/device validation actually performed:**  
**Results:**  
**Known pre-existing failures:**  
**New unresolved failures:**  
**Rollback procedure:**  
**External blockers:**  
**Next phase:**

Do not write `PROVEN` if the required real-provider/device/staging validation has not actually been executed.
