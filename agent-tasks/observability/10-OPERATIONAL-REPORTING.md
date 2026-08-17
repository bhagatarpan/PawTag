# Phase 10 — Operational Reporting

## Objective

Turn raw logs, traces, metrics and audit events into useful operational reports.

Do not replace the existing audit UI. Extend it where appropriate.

## Reporting principles

Reports must distinguish:

- FACT
- OBSERVATION
- INFERENCE
- RECOMMENDATION

Do not present AI inference as fact.

## Required report views

### Incident view

Answer:

- What happened?
- When?
- Which service?
- Which request?
- Which user/actor, if safely known?
- What failed?
- What was affected?
- What happened immediately before?
- What happened immediately after?
- What is the likely root cause?
- What evidence supports that conclusion?
- What should be done?

### Request timeline

Show:

- request
- logs
- trace spans
- audit events
- errors
- duration
- outcome

### Feature health

For major features:

- error rate
- latency
- workflow failures
- audit coverage
- test coverage where available
- documentation status
- open incidents

### Dependency health

Show:

- provider
- success rate
- latency
- errors
- timeout/retry behaviour

## Severity

Use deterministic severity rules.

Do not let an LLM arbitrarily decide that something is "critical".

## Human readability

Technical evidence must remain available behind a detail/technical view.

The first view should be understandable by a product owner or support person.

## Export

If existing audit export exists, preserve it.

Add operational report export only if useful and safe.

Never export secrets.

## Tests

Test report generation from known fixtures.

Test sorting, grouping, filtering and redaction.

Commit:

`feat(observability): phase 10 - add operational reporting`

Push.

Mark COMPLETE.
