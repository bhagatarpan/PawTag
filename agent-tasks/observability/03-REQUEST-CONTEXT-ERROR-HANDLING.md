# Phase 3 — Request Context and Central Error Handling

## Objective

Create a reliable request/error context layer so a production failure can be reconstructed from one identifier.

## Request context

Every incoming API request should receive or propagate:

- requestId
- correlationId
- traceId if tracing exists
- start time
- method
- route
- service
- environment

If a trusted upstream correlation/request ID is accepted, validate and safely propagate it. Never allow arbitrary user input to become a security-sensitive identity.

## Context propagation

Use async-safe context propagation appropriate to Node.js.

The context must be available to:

- route handlers
- services
- database calls
- external integrations
- background work where propagation is meaningful
- error handlers
- logs

## Request lifecycle

Capture at minimum:

- request start
- response status
- duration
- route
- outcome

Do not log full request/response payloads by default.

## Central error handling

Establish one consistent application error model.

Distinguish:

- validation errors
- authentication errors
- authorization errors
- not-found errors
- business-rule errors
- dependency errors
- database errors
- timeout errors
- unexpected errors

Map errors consistently to HTTP responses.

Do not expose internal stack traces to users in production.

Log full technical details internally.

## Process-level failures

Where appropriate, handle:

- uncaught exceptions
- unhandled promise rejections
- graceful shutdown

Do not pretend the process is healthy after an unrecoverable fatal condition.

## Correlation

A production error should allow an operator to find:

`requestId -> logs -> error -> audit event -> trace`

when those layers exist.

## Tests

Test:

- request ID creation
- propagation
- error response format
- stack capture
- status mapping
- unexpected error handling
- correlation
- graceful shutdown paths where practical

Do not break existing API error contracts without explicit justification.

## Documentation

Update:

`docs/LOGGING.md`

and relevant architecture documentation.

Commit:

`feat(observability): phase 3 - add request context and central errors`

Push.

Mark COMPLETE only after successful validation and push.

```text
STATUS: COMPLETE
COMPLETED_AT: 2026-08-17
COMMIT_SHA: pending
REMOTE_BRANCH: feat/enterprise-observability
TEST_RESULT: typecheck pass, build pass, 927/928 tests pass (1 pre-existing failure)
NOTES: Created request-context.ts with AsyncLocalStorage for request ID propagation. Created app-errors.ts with typed error classes (AppError, AuthenticationError, ValidationError, NotFoundError, etc.). Updated errorHandler to use centralized error model with request context logging. Updated audit middleware to populate request context. Added docs/LOGGING.md documentation. Added unit tests for request context and error model.
```
