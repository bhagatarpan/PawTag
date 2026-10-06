---
name: database-integrity
description: Implement or review PawTag persistence correctness across current MongoDB/Mongoose and the planned incremental DynamoDB migration. Use for schema/repository changes, queries, indexes, transactions, TTL, uniqueness, soft deletion, pagination, concurrency, financial multi-write workflows, background-job claims, migration adapters, or data backfills.
---

# Database Integrity

Follow `dynamodb-migration` whenever work is part of the MongoDB -> DynamoDB program.

## Universal rules

- Preserve ownership/security predicates in persistence operations.
- Use bounded pagination for unbounded collections.
- Protect concurrency-sensitive state with atomic/conditional operations, optimistic versioning, or transactions where required.
- Do not use database TTL for business cleanup that must execute compensating side effects first.
- Do not auto-reseed, drop, truncate, or destructively migrate data.
- Every migration/backfill needs environment guardrails, idempotency/resume where relevant, verification, and rollback/repair notes.

## Mongo current-state work

Inspect actual query/filter/sort patterns before adding indexes. Use Mongo transactions only for local writes that truly require atomicity; external providers remain outside the transaction and need persistent repair states.

## Dynamo target work

Do not expose DynamoDB `AttributeValue`/key design to services. Use access-pattern repository contracts. Avoid normal request-path scans, preserve stable IDs, and map Mongo atomic/transaction semantics deliberately rather than mechanically.
