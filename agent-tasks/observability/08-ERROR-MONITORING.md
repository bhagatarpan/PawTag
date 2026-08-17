# Phase 8 — Central Error Monitoring

## Objective

Introduce production-grade exception aggregation and release-aware error monitoring.

## Provider decision

Evaluate the current deployment environment and choose an appropriate error-monitoring provider.

A managed provider such as Sentry may be suitable, but do not blindly add a provider if an existing one is already present.

Keep the application abstraction vendor-neutral where practical.

## Capture

Capture:

- unhandled exceptions
- unhandled promise rejections
- API errors
- background job failures
- external integration failures
- important client-side exceptions if the architecture supports them

Include:

- release/version
- environment
- service
- requestId
- correlationId
- traceId
- operation
- feature
- workflow

## Do not capture

- passwords
- tokens
- secrets
- unnecessary personal data
- raw sensitive payloads

Configure filtering/scrubbing centrally.

## Release tracking

If deployment supports release identifiers, attach them.

This should allow:

`error -> release -> commit -> code`

## Alerts

Do not create alert noise.

Define sensible initial alerting for:

- sudden 5xx increase
- repeated fatal errors
- dependency outage
- authentication abuse
- job failure spikes

Document thresholds and assumptions.

## Tests

Verify monitoring is disabled or safely mocked in tests.

Verify intentional test errors do not pollute production monitoring.

Verify redaction.

Commit:

`feat(observability): phase 8 - add production error monitoring`

Push.

Mark COMPLETE.

```text
STATUS: COMPLETE
COMPLETED_AT: 2026-08-17
COMMIT_SHA: 1830431
REMOTE_BRANCH: feat/enterprise-observability
TEST_RESULT: typecheck pass, build pass, 1013/1014 tests pass (1 pre-existing failure)
NOTES: Created vendor-neutral monitoring module wrapping Sentry. Added sensitive data redaction, request/trace context enrichment, graceful shutdown with event flushing. Integrated with process-level exception handlers. Comprehensive unit tests.
```
