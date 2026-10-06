# Phase 13 — DynamoDB High-Risk Domains, Failure Injection, Cutover, and Mongo Retirement Gate

## Objective

Migrate the concurrency/financial/security-sensitive domains only after the low-risk DynamoDB architecture is proven.

## Required skills

`work-packet-executor`, `dynamodb-migration`, `database-integrity`, `commerce-safety`, `background-jobs`, `security-boundary-review`, `testing-regression`, `release-readiness`

## Domains requiring explicit sub-plans

- identity/refresh/verification/MFA if not already migrated;
- pets/tags/Finder recovery;
- cart/catalog as applicable;
- orders/payment/refunds/returns;
- inventory/reservations;
- subscriptions/membership/entitlements;
- rewards/points/referrals;
- webhook event ledger/reconciliation;
- background jobs/leases;
- invoices/document metadata/access tokens;
- audit/system logs where retained in DynamoDB.

Do not migrate all of these in one commit/phase run. Treat this phase as an ordered set of domain packets derived from Phase 11's migration plan.

## For every financial/concurrent operation document and test

```text
provider/external side effect
-> local expected state transition
-> conditional/transactional write
-> idempotency identifier
-> retry behavior
-> duplicate behavior
-> crash after claim
-> crash after provider success
-> reconciliation
-> rollback/cutover impact
```

## DynamoDB techniques

Use the minimum correct tool per invariant:
- conditional writes;
- optimistic version attributes;
- transactional writes where true multi-item atomicity is required;
- dedicated uniqueness-lock items where necessary;
- durable state machines/idempotency/reconciliation for cross-system operations.

Do not translate every Mongo transaction to `TransactWriteItems` mechanically.

## Job leases

Claims must be atomic (`no lease OR expired lease`) and resilient to worker crash. Do not read-then-write a lock.

## TTL

DynamoDB TTL is asynchronous. Any reservation/account/security state requiring deterministic cleanup/side effects needs an explicit worker/state transition before eventual TTL deletion.

## Failure injection

Must include:
- conditional failure;
- transaction failure;
- provider succeeds/local write fails;
- local write succeeds/HTTP response fails;
- duplicate request/webhook;
- worker crash after claim;
- worker crash after external side effect;
- concurrent stock/reward/subscription transition.

## Cutover

For each domain record:
- current source of truth;
- new source of truth;
- shadow/validation window;
- cutover time;
- rollback trigger;
- data reconciliation required if writes diverge;
- maximum rollback window.

## Mongo retirement gate

Do **not** remove Mongoose/Mongo runtime until:
- all required domains are migrated;
- no runtime reads/writes remain;
- production-like E2E passes;
- data migration validation passes;
- rollback/retention requirements are satisfied;
- backups retained as required;
- CI/Docker/docs/env are updated.

## Acceptance gate

DynamoDB is the proven authoritative persistence layer for the intended migrated scope with preserved API behavior, security, concurrency, idempotency and recoverability.

Stop before donation implementation.
