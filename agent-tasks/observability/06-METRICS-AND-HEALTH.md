# Phase 6 — Metrics and Health Signals

## Objective

Add operational metrics that answer "Is PawTag healthy?" without requiring an engineer to read logs.

## Metrics

Implement a standards-based metrics approach appropriate to the Node/TypeScript stack.

Prefer OpenTelemetry-compatible metrics so the system remains vendor-neutral.

Track useful measurements such as:

- request count
- request error count
- request duration
- HTTP status distribution
- dependency latency
- dependency failures
- database failures
- external integration failures
- background job failures
- authentication failures
- authorization failures
- notification failures
- rate limiting
- queue/job backlog where applicable

Avoid high-cardinality labels such as:

- user ID
- pet ID
- email
- phone
- request ID

Use bounded dimensions such as:

- service
- route template
- method
- status class
- operation
- environment

## Health endpoints

Separate:

### Liveness

Is the process alive?

### Readiness

Can the service safely accept traffic?

### Dependency health

Are required dependencies available?

Do not make liveness depend on every external service.

Do not expose sensitive diagnostic information publicly.

## Baselines

Document expected/normal behaviour where known.

If no baseline exists, state that it must be established after deployment.

## Dashboards

Do not build a huge custom dashboard yet.

Create the metrics foundation and document recommended dashboards.

## Tests

Test metric creation, labels, health responses and failure conditions.

Commit:

`feat(observability): phase 6 - add metrics and health signals`

Push.

Mark COMPLETE.
