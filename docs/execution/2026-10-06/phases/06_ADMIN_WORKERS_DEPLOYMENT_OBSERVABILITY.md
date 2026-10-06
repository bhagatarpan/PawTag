# Phase 06 — Admin Safety, Background Workers, Deployment, Observability, Backup, and Rollback

## Objective

Make PawTag operable by a small team without accidental financial/security damage and without relying on one API process staying alive forever.

## Required skills

`work-packet-executor`, `background-jobs`, `security-boundary-review`, `release-readiness`, `database-integrity`, `testing-regression`

## A. Admin operational safety

Inspect high-risk actions for permissions, confirmation, previous/new state, reason, actor, provider result and audit trail:

- refunds/returns;
- subscription cancellation/activation/change;
- payment/provider settings;
- role/permission changes;
- CMS publish/unpublish;
- user disable/delete/merge/impersonation if any;
- shipment/fulfilment overrides;
- production feature flags/settings;
- exports containing PII.

Admin is desktop-first; do not spend this phase building a native admin app.

## B. Worker architecture

Review every job in `packages/api/src/jobs` and worker/scheduler code.

For each job document:
- trigger/schedule;
- due-work query;
- atomic claim/lease;
- duplicate execution behavior;
- external side effects/idempotency;
- crash after claim / crash after provider call;
- retry/backoff/dead-letter/manual review;
- alert/metric;
- graceful shutdown.

For MVP, a dedicated worker plus durable claim/lease is acceptable. Do not introduce Kafka/RabbitMQ merely for prestige.

## C. Deployment configuration

Prove:
- deterministic workspace Docker builds;
- frontend build-time env handling;
- API vs worker runtime env validation;
- no production demo fallbacks;
- health/readiness/liveness semantics;
- graceful shutdown;
- secrets not baked into images;
- production origin/CORS/proxy behavior;
- migration/index creation policy is explicit.

## D. Observability

Critical correlation IDs should connect request -> payment/order -> webhook -> email/document -> job/reconciliation. Alerts must be actionable for:

- payment succeeded/order missing;
- reconciliation mismatch;
- refund failure;
- webhook stuck/retrying;
- email critical failure;
- worker/job repeated failure;
- inventory/reservation anomaly;
- backup failure;
- elevated auth abuse.

Do not log secrets, raw tokens, card data, unnecessary PII/location.

## E. Backup and rollback

Execute—not merely document—backup/restore rehearsal for the current database and private document storage where feasible. Validate rollback procedure for application deployment and provider/configuration mistakes.

## Acceptance gate

- high-risk admin actions are permissioned/audited/confirmed;
- externally significant jobs cannot duplicate uncontrolled side effects;
- production images/env validation are reproducible;
- alert paths and backup restore have real evidence or explicit external blocker;
- rollback steps are executable and honest about data divergence.

Stop before Phase 07.
