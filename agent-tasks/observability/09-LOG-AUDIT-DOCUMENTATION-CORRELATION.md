# Phase 9 — Correlate Logs, Audit and Documentation

## Objective

Connect the three evidence systems without confusing their responsibilities:

1. Application logs = technical evidence.
2. Audit trail = business/security evidence.
3. Documentation = intended behaviour.

Add traceability between them.

## Core model

Use:

```text
INTENT
  ↓
IMPLEMENTATION
  ↓
TEST
  ↓
RUNTIME LOG/TRACE
  ↓
AUDIT EVENT
  ↓
ASSURANCE
```

## Stable identifiers

Where the repository's documentation layer already defines IDs, reuse them.

Examples:

- FEATURE-*
- WORKFLOW-*
- BR-*
- AUDIT-CONTROL-*

Do not duplicate identifiers.

## Logging context

Allow important application operations to carry:

- feature ID/name
- workflow ID/name
- business operation
- audit event type
- requestId
- correlationId
- traceId

Only attach metadata when it is known.

Never fabricate business IDs.

## Audit correlation

When an audit event is emitted from an operation with a request/trace context, preserve the relationship.

Do not change audit integrity mechanisms.

## Intent vs implementation

Create tooling/reporting that can identify:

- documented operation with no implementation evidence
- implementation with no documentation
- expected audit event not observed
- important operation with weak logging
- documented workflow inconsistent with implementation
- stale documentation

Do not automatically "fix" discrepancies.

## Human-readable evidence

An operator should eventually be able to see:

```text
Feature
Workflow
Business operation
Audit event
Request ID
Trace ID
Relevant logs
Outcome
```

## Tests

Test correlation across the layers.

Test missing context.

Test that correlation does not leak sensitive data.

Commit:

`feat(observability): phase 9 - correlate logs audit and documentation`

Push.

Mark COMPLETE.

```text
STATUS: COMPLETE
COMPLETED_AT: 2026-08-17
COMMIT_SHA: de6a0c8
REMOTE_BRANCH: feat/enterprise-observability
TEST_RESULT: typecheck pass, build pass, 1021/1022 tests pass (1 pre-existing failure)
NOTES: Created correlation module with feature registry, correlation context creation, log-audit correlation, and evidence building. Added feature/workflow context to logging and audit events. Comprehensive unit tests.
```
