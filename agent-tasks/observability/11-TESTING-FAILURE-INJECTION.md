# Phase 11 — Testing and Failure Injection

## Objective

Prove that the observability system actually works when PawTag is failing.

A logging system that works only during successful requests is not enterprise-grade.

## Test layers

Add/maintain:

- unit tests
- integration tests
- API tests
- observability tests
- redaction tests
- correlation tests
- telemetry tests

## Failure scenarios

Where safe, simulate:

- database unavailable
- database timeout
- external provider timeout
- external provider 4xx
- external provider 5xx
- malformed response
- network error
- authentication failure
- authorization failure
- validation failure
- business-rule failure
- unexpected exception
- background job failure
- retry exhaustion
- telemetry exporter failure

## Verify

For each failure:

1. Correct user-facing response.
2. Correct structured log.
3. Correct severity.
4. Correct error classification.
5. Stack trace captured internally.
6. Sensitive data redacted.
7. Request/correlation/trace IDs preserved.
8. Audit event preserved where appropriate.
9. Metrics updated.
10. Trace records error where applicable.
11. Monitoring captures the incident where applicable.

## Regression

Run the full existing test suite.

The existing audit system must continue functioning.

Do not weaken assertions just to make tests pass.

## Failure injection

Prefer test-only dependency injection/mocks rather than dangerous production switches.

Do not create a production endpoint that can deliberately break dependencies.

## Documentation

Create:

`docs/OBSERVABILITY-TESTING.md`

Explain how the system is verified.

Commit:

`feat(observability): phase 11 - harden observability with failure testing`

Push.

Mark COMPLETE.

```text
STATUS: COMPLETE
COMPLETED_AT: 2026-08-17
COMMIT_SHA: 5155a4a
REMOTE_BRANCH: feat/enterprise-observability
TEST_RESULT: typecheck pass, build pass, 1052/1053 tests pass (1 pre-existing failure)
NOTES: Created comprehensive failure injection tests covering database, external provider, authentication, authorization, validation, unexpected exception, and background job failures. Created OBSERVABILITY-TESTING.md documentation. Tests verify error propagation, metrics tracking, trace context preservation, and monitoring capture.
```
