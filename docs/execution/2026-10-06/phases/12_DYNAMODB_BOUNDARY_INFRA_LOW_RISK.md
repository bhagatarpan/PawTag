# Phase 12 — DynamoDB Persistence Boundary, AWS Environments, Migration Tooling, and Low-Risk Domains

## Objective

Build the database-agnostic persistence architecture and prove DynamoDB safely on low-risk domains before touching commerce/payment/job-locking state.

## Depends on

Phase 11 discovery approved/green and non-production AWS access available for real integration validation.

## Required skills

`work-packet-executor`, `dynamodb-migration`, `database-integrity`, `testing-regression`, `security-boundary-review`

## A. Repository boundary

Evolve `packages/db` conceptually toward:

```text
packages/db/src/
  domain/
  repositories/
  mongo/          temporary/current adapters
  dynamodb/
  transactions/
  errors/
  infrastructure/
```

Actual structure should follow current repo conventions; do not reorganize unrelated files just to match the diagram.

Services consume repository/domain interfaces, never AWS `AttributeValue` or generic fake-Mongoose APIs.

## B. DynamoDB infrastructure

- AWS SDK v3 central client factory/document client;
- local mode via DynamoDB Local;
- real AWS non-production integration mode;
- production resources separate;
- environment-safe table prefix/naming;
- least-privilege IAM;
- repeatable IaC for tables/keys/GSIs/TTL/PITR/encryption/deletion protection/tags;
- no frontend AWS credentials.

## C. Migration tool

Create a resumable/idempotent migration framework with:
- domain selection;
- dry run;
- batches/checkpoints;
- retry/rate limit;
- counts and validation report;
- resume capability;
- no Mongo deletion.

## D. Low-risk domain migration

Use the Phase 11 evidence to choose the actual safest order. Candidate domains may include settings/configuration and bounded CMS/supporting data before identity/pets.

For each domain:

1. implement repository contract + Mongo adapter tests;
2. implement Dynamo adapter;
3. migrate a test dataset;
4. shadow read/compare normalized domain objects where safe;
5. run ownership/contract tests;
6. cut non-production reads to Dynamo;
7. define rollback trigger/procedure;
8. only then consider the next domain.

Do not casually dual-write state with external financial side effects.

## E. Validation

Use both DynamoDB Local and real AWS integration environment. Local alone does not prove IAM, real transaction/index/TTL/network behavior.

## Acceptance gate

- repository pattern is proven on at least one low-risk real domain;
- IaC and local environment are reproducible;
- migration tool is resumable/idempotent;
- normalized comparison is clean;
- API/client behavior unchanged;
- rollback tested in non-production.

Stop before Phase 13.
