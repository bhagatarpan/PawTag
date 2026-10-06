# Phase 18 — Final Program Reconciliation and Ongoing Technical-Lead Gate

## Objective

Reconcile source, tests, docs, skills, operational evidence, mobile/store state, persistence migration, and donation state so PawTag does not regress into “documentation says complete” while runtime evidence disagrees.

## Required skills

`work-packet-executor`, `release-readiness`, `production-readiness-review`, `feature-completeness`, `testing-regression`

## Tasks

1. Re-run full baseline suite and browser E2E.
2. Re-run critical production-like provider tests.
3. Verify first-customer web gate remains green after mobile/database/donation work.
4. Verify iOS/Android store/device matrix for currently released native capability scope.
5. Verify DynamoDB migration/cutover matrix for domains actually migrated; ensure no undocumented Mongo runtime dependencies remain if Mongo retirement was claimed.
6. Verify donation release matrix if donation is public.
7. Review security boundaries/IDOR/RBAC again after repository/persistence changes.
8. Review environment examples/validators/CI/Docker/deployment scripts.
9. Review background jobs/leases/retries after Dynamo changes.
10. Reconcile `README.md`, `AGENTS.md`, skills, architecture/database/deployment docs and remove/supersede misleading historical instructions.
11. Update a single current status document with evidence links/commands/date, not just percentages.
12. Create a concise outstanding-risk register split into:
   - current blocker;
   - needs validation;
   - post-MVP improvement;
   - future scale concern.

## Documentation cleanup rule

Do not delete historical plans solely because they are old. Mark them superseded/archive them when retaining them has audit value. Active docs must clearly point to the current architecture: customer web + Capacitor shell, Finder web only, Admin web, current persistence source, donation state.

## Final launch questions

Before calling PawTag production-ready for a given capability, answer with evidence:

- Can a customer pay without client-controlled money state?
- Can provider/local partial failures recover?
- Can stock/rewards/refunds remain correct under concurrency/retry?
- Can customer receive/find order/invoice/communication?
- Can a stranger recover a pet through browser Finder with no install?
- Can staff operate high-risk actions safely?
- Can we detect/repair failure?
- Can we restore/rollback?
- Does installed mobile app use shared UI and proven native bridges?
- If DynamoDB is authoritative, is data/behavior parity proven?
- If Donations are enabled, are payment/receipt/refund/reconciliation and legal wording proven?

## Output

Create/update:

```text
docs/execution/FINAL_PROGRAM_STATUS.md
docs/execution/OUTSTANDING_RISK_REGISTER.md
```

Use factual evidence states, not a marketing readiness score.
