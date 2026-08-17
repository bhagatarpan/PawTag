# Phase 5 — Service, Database and Integration Logging

## Objective

Make failures diagnosable across PawTag's major internal and external boundaries.

## Principle

Log meaningful transitions, not every line of code.

## Services

For important business services capture:

- operation start where useful
- completion
- duration
- outcome
- entity identifiers that are safe to log
- feature
- workflow
- business operation
- error category

Do not create excessive duplicate logs for every helper function.

## Database

Instrument meaningful database operations.

Capture where practical:

- operation type
- model/collection
- duration
- success/failure
- error category
- query identifier if safe

Never log sensitive query values indiscriminately.

Do not log entire queries containing user data or secrets.

Avoid logging every successful low-value database operation in production.

Provide configurable thresholds, such as slow-query logging.

## External integrations

Instrument major providers/services.

Capture:

- provider
- operation
- duration
- HTTP status/result
- retry count
- timeout
- error category
- request/correlation/trace identifiers

Never log:

- authorization headers
- API keys
- raw provider credentials
- sensitive payloads

## Retry visibility

Where retries exist, log:

- attempt number
- maximum attempts
- reason
- delay if relevant
- final outcome

Do not accidentally create duplicate business/audit events simply because an integration was retried.

## Background jobs

Where PawTag has jobs/queues:

- job ID
- job type
- attempt
- start/end
- duration
- outcome
- error
- correlation context where available

## Audit relationship

A business event may be audited once while generating several technical logs.

That is expected.

Do not equate log count with audit coverage.

## Tests

Add representative integration/service tests.

Verify sensitive payloads are not logged.

Verify failures preserve correlation IDs.

Commit:

`feat(observability): phase 5 - instrument service and integration boundaries`

Push.

Mark COMPLETE.
