# Phase 11 — MongoDB -> DynamoDB Discovery Only

## Agent directive

**Do not change application behavior or migrate data in this phase.** This is repository discovery and design evidence only.

## Objective

Create a complete persistence/access-pattern map so DynamoDB design follows actual PawTag usage rather than mechanically translating ~60+ Mongoose models.

## Required skills

`work-packet-executor`, `dynamodb-migration`, `database-integrity`, `security-boundary-review`, `production-readiness-review`

## Search the entire repository

Inventory:
- every Mongoose model/schema/index/unique constraint/TTL;
- virtuals/hooks/validators;
- `find`, `findOne`, `findById`, `findOneAndUpdate`, upsert, bulk writes;
- `$inc`, `$push`, `$pull`, `$addToSet`, conditional/status updates;
- transactions/sessions;
- aggregation/populate;
- regex/text/search/filter/sort/pagination;
- raw Mongo/Mongoose access outside `packages/db`;
- direct model imports in routes/services/jobs;
- background-job claims/locks;
- webhook event/idempotency persistence;
- auth/session/token persistence;
- cart/order/payment/refund/inventory/subscription/rewards state;
- Finder/public lookup and privacy data;
- audit/system logs/CMS/settings.

## Required output files

Create under `docs/dynamodb-migration/`:

```text
00-inventory.md
01-access-patterns.md
02-entity-map.md
03-transaction-map.md
04-index-design.md
05-migration-plan.md
06-risk-register.md
07-local-and-aws-environments.md
```

## Access-pattern table

For every persistence operation record:

```text
Operation | Caller | Domain | Read/Write | Lookup/Sort | Frequency | Consistency | Ownership | Atomicity | Retention | Candidate key/index
```

## Domain grouping

Verify real model membership rather than trusting old counts. At minimum consider identity, pet/recovery, commerce, membership, rewards, administration, CMS, jobs, integrations/webhooks/reconciliation, documents/email/audit.

## Design decisions to make

1. Simplest viable table count; do not force one-table or table-per-model ideology.
2. PK/SK patterns and sparse GSIs for proven access patterns.
3. Stable application ID strategy: preserve current IDs as strings unless an explicit compatibility plan says otherwise.
4. Uniqueness strategy for email/phone/public tag/receipt/payment identifiers.
5. Conditional-write/optimistic-lock/transaction map.
6. Cursor pagination strategy and compatibility with existing API contracts.
7. Search/regex/aggregation replacements; avoid defaulting to scans or OpenSearch without demonstrated need.
8. TTL semantics and cases requiring explicit cleanup jobs.
9. Audit/log retention and high-volume partition considerations.
10. Exactly how each frontend remains database-agnostic.

## Required recommendation at end

- proposed tables/keys/GSIs;
- repository interfaces required;
- low-risk migration order;
- high-risk migrations requiring redesign;
- dual-read/shadow strategy per domain;
- data migration tool requirements;
- rollback strategy;
- AWS/local setup requirements.

## Acceptance gate

No production code changed. Every current persistence behavior relevant to migration is mapped sufficiently to design DynamoDB without guessing.

Stop. Do not start Phase 12 automatically.
