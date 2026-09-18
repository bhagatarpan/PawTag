---
name: database-integrity
description: Implement or review PawTag MongoDB/Mongoose models, queries, indexes, transactions, relationships, TTL, uniqueness, soft deletion, pagination, aggregation, denormalization, and concurrency. Use when changing packages/db, persistence logic, financial multi-document writes, job claiming, or high-volume query patterns. Focus on correctness first and evidence-based indexing rather than speculative optimization.
---

# Database Integrity

Inspect actual query patterns before changing schema/indexes.

## Schema/model checks

- Required fields and defaults represent domain invariants.
- Uniqueness has the correct scope.
- References and denormalized snapshots have a clear source of truth.
- Timestamps and status transitions are consistent.
- Soft deletion is applied consistently to reads where relevant.
- TTL behavior matches retention requirements and is not used for data that needs explicit archival/audit.

## Query safety

- Constrain by ownership/tenant/user where required.
- Paginate unbounded collections.
- Avoid N+1 population/query loops on hot paths.
- Select only fields needed for public/Finder responses.
- Use atomic conditional updates for concurrency-sensitive state.

## Transactions

Use Mongo transactions when one business operation requires multiple database writes to commit consistently and the deployment supports transactions.

Do not wrap external calls inside a transaction and pretend the external system is atomic with Mongo. Persist repairable intermediate states instead.

## Indexes

Do not add an index merely because a field appears in a query.

Consider:
- actual filter/sort shape,
- selectivity,
- compound-index prefix order,
- uniqueness needs,
- write cost,
- redundant indexes,
- TTL behavior.

## Concurrency

For stock, job claims, counters, status transitions, or idempotency use conditional atomic operations or transactions rather than read-modify-write assumptions.

## Data changes

Never automatically reseed, drop collections, or perform destructive migration steps. Provide a migration/backfill plan, safety checks, rollback/repair approach, and explicit environment guard for destructive operations.
