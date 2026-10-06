---
name: dynamodb-migration
description: Plan, implement, or review PawTag's incremental MongoDB/Mongoose to Amazon DynamoDB migration. Use for persistence discovery, repository interfaces, access-pattern design, DynamoDB keys/GSIs, local/integration AWS setup, migration tools, shadow validation, domain cutovers, concurrency, TTL, jobs, commerce, rollback, or Mongoose removal. Never perform a big-bang database rewrite.
---

# DynamoDB Migration

Follow `AGENTS.md` and the current execution phase first.

## Core invariants

- This is a persistence migration, not a product rewrite.
- Preserve API contracts, authentication, authorization, business rules, external IDs, and client behavior unless a separately approved change requires otherwise.
- Do not mechanically create one DynamoDB table per Mongoose model.
- Do not build a fake Mongoose query layer over DynamoDB.
- Model from verified access patterns.
- Use repository/domain operations such as `getUserByEmail()` rather than database syntax such as `find()`.
- Keep exactly one authoritative persistence source per domain during cutover; shadow reads/writes must be explicitly safe and observable.

## Required sequence

1. Inventory all Mongo/Mongoose usage across the repository.
2. Document access patterns, ownership, indexes, TTL, transactions, atomic updates, aggregation/search, and external identifiers.
3. Design repositories independent of DynamoDB types.
4. Design tables/keys/GSIs from access patterns.
5. Establish DynamoDB Local plus a real AWS integration environment.
6. Create reproducible infrastructure as code.
7. Migrate low-risk domains first.
8. Shadow/compare normalized domain results where safe.
9. Build resumable/idempotent migration tooling.
10. Migrate concurrency/financial/job domains only after their conditional-write/transaction strategy is proven.
11. Remove Mongo/Mongoose only after production-like validation and rollback evidence exist.

## Never do

- Never expose AWS credentials to web/admin/finder/customer-app code.
- Never use unbounded `Scan` as a normal request-path substitute for Mongo queries.
- Never replace atomic Mongo behavior with read-modify-write without conditional expressions/optimistic locking.
- Never assume DynamoDB TTL is immediate.
- Never silently change identifier formats.
- Never dual-write financial state casually.
- Never delete Mongo data during migration tooling.

## High-risk domains

Treat these as separate guarded migrations: inventory, orders, payments/refunds, subscriptions, rewards, webhook ledger/reconciliation, background-job leases, audit records.

For each high-risk operation document: provider side effect, local state transition, idempotency key, retry behavior, failure injection, reconciliation, rollback.

## Verification output

Every migration phase must report changed files, access-pattern decisions, tests, normalized-data comparison, unresolved mismatches, rollback procedure, and the exact next phase. Stop after the requested phase.
