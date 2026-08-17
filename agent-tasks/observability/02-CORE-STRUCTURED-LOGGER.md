# Phase 2 — Core Structured Logger

## Objective

Introduce one central, production-quality structured logging abstraction for PawTag.

Do not scatter direct calls to a logging library throughout the codebase.

## Requirements

Choose an appropriate mature structured logger for the existing Node/TypeScript architecture. Prefer a lightweight, high-performance solution and avoid unnecessary abstractions.

The logger must support:

- debug
- info
- warn
- error
- fatal

Every log should be structured rather than concatenated text.

Minimum common fields:

- timestamp
- level
- service/application
- environment
- message
- version/release where available
- requestId when available
- correlationId when available
- traceId/spanId when available
- operation name when available
- feature when available
- workflow when available

## API design

Create a small PawTag-owned logging abstraction so application code does not depend directly on the logger implementation.

It should support:

- child/context loggers
- structured metadata
- errors with stack traces
- safe serialisation
- redaction hooks
- environment-aware configuration

## Environment behaviour

Development:

- readable developer-friendly output
- useful stack traces

Production:

- structured JSON
- machine searchable
- no secrets
- no unnecessary noise

Test:

- deterministic and quiet enough for CI
- ability to capture logs for assertions

## Migration

Migrate obvious high-value server-side logging first.

Do not mechanically replace every `console.*` if doing so creates noise or changes semantics.

Prioritise:

- application startup
- server startup
- configuration errors
- external integrations
- database connection problems
- authentication/authorization failures
- unexpected exceptions
- important background jobs

## Do not

- replace audit events with logs
- log passwords/tokens
- log entire request bodies indiscriminately
- log sensitive headers
- create one logger per module
- introduce multiple logging frameworks

## Documentation

Create/update:

`docs/LOGGING.md`

Document:

- logger API
- severity levels
- fields
- environment behaviour
- examples
- what must never be logged

## Tests

Add tests for:

- level handling
- structured fields
- error serialisation
- environment configuration
- child/context logging
- redaction hook integration

Run existing test suite.

Commit:

`feat(observability): phase 2 - add structured application logger`

Push.

Then mark this file COMPLETE with commit SHA, test result and notes.

```text
STATUS: COMPLETE
COMPLETED_AT: 2026-08-17
COMMIT_SHA: 24bbf06
REMOTE_BRANCH: feat/enterprise-observability
TEST_RESULT: typecheck pass, build pass, 900/901 tests pass (1 pre-existing failure)
NOTES: Enhanced logger with redaction, service metadata, child/scoped loggers. Replaced morgan with pino-http. Migrated ~80 console.* calls to structured logger across services, routes, and jobs. Added process-level exception handlers. Created docs/LOGGING.md. Added logger unit tests.
```
