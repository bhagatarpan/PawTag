---
name: production-readiness-review
description: Review a PawTag feature or change for the gap between implemented and production-ready. Use when validating a completed feature, reviewing launch readiness, checking whether an existing route/screen/service is actually safe for real customers, or before marking a work packet complete. Trace end-to-end behavior, failure paths, production configuration, authorization, persistence, external integrations, recovery, observability, and tests.
---

# Production Readiness Review

`AGENTS.md` overrides this skill if guidance conflicts.

## Core principle

Feature existence is not production readiness. A route, screen, model, test, or successful happy path is evidence only of partial implementation.

## Trace the real path

For the feature under review, inspect as applicable:

1. User action / frontend state.
2. Shared client / request contract.
3. API route and middleware ordering.
4. Authentication and authorization.
5. Input validation and normalization.
6. Service/business rules.
7. Database reads/writes and concurrency.
8. External integrations.
9. Response and UI success/error handling.
10. Retry, idempotency, restart, and partial-failure behavior.
11. Production-only configuration and environment differences.
12. Logging, audit events, metrics, and actionable alerts.
13. Unit/integration/E2E coverage at the appropriate layer.

## Production-specific checks

Actively look for behavior hidden by development/test conditions:

- CAPTCHA bypasses.
- fake/demo provider fallbacks.
- missing credentials tolerated locally.
- local-only URLs.
- in-memory state that changes under multiple processes.
- middleware ordering differences.
- test mocks that bypass real contracts.
- debug/admin bypasses.

## Output classification

Use factual states:

- `Ready`
- `Needs work`
- `MVP blocker`
- `Needs validation`
- `Post-MVP`

Do not invent numerical readiness scores.

For every material finding provide: evidence path/function, failure scenario, severity, required action, and whether it is a problem today, risk soon, or future-scale concern.
