# Phase 7 — OpenTelemetry Distributed Tracing

## Objective

Add vendor-neutral distributed tracing so a PawTag request can be followed across application, database and external-service boundaries.

## Principles

Use OpenTelemetry where appropriate.

Do not make tracing required for the application to function.

Tracing failure must never cause a business request to fail.

## Trace structure

Aim for:

```text
HTTP request
  ├─ middleware
  ├─ route/controller
  ├─ business service
  ├─ database
  ├─ external provider
  └─ response
```

Use semantic, low-cardinality attributes.

## Correlation

Connect:

- traceId
- spanId
- requestId
- correlationId

Do not replace PawTag identifiers unnecessarily.

## Sampling

Use environment-appropriate sampling.

Development may use high sampling.

Production should use configurable sampling.

Errors and important operations may be sampled more aggressively where supported.

## Sensitive data

Never put:

- passwords
- tokens
- private messages
- raw sensitive payloads
- precise sensitive location

into span attributes.

## External boundaries

Trace major external integrations when supported.

Record:

- operation
- provider
- status
- duration
- error

## Database tracing

Instrument safely without exposing sensitive query parameters.

## Audit relationship

A trace is technical evidence.

An audit event is business/security evidence.

Link them when possible through IDs/context but do not merge their responsibilities.

## Tests

Verify trace creation, propagation, error recording and graceful behaviour when telemetry export is unavailable.

Commit:

`feat(observability): phase 7 - add OpenTelemetry tracing`

Push.

Mark COMPLETE.

```text
STATUS: COMPLETE
COMPLETED_AT: 2026-08-17
COMMIT_SHA: 83a9129
REMOTE_BRANCH: feat/enterprise-observability
TEST_RESULT: typecheck pass, build pass, 1010/1011 tests pass (1 pre-existing failure)
NOTES: Created tracing module with OpenTelemetry SDK integration. Added tracing middleware for trace context propagation. Integrated with existing request context and audit middleware. Added trace helpers for database and integration operations. Graceful shutdown handling. Comprehensive unit tests.
```
