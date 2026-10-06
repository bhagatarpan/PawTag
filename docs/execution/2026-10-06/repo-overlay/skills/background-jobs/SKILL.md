---
name: background-jobs
description: Implement or review PawTag scheduled and background work such as escalations, webhook retries, payment/refund reconciliation, auto-cancellation, subscription processing, notifications, shipment polling, stock alerts, rewards, and reminders. Use whenever code schedules recurring work or performs external side effects outside a request. Enforce idempotency, durable ownership/leases, retry safety, restart recovery, and actionable failure visibility.
---

# Background Jobs

Assume production may eventually run more than one process. Do not rely on `setInterval` plus process memory as proof of single execution.

## For every job answer

- What triggers it?
- How is due work selected?
- Can two workers select the same item?
- How is work atomically claimed or leased?
- Is the operation safe if executed twice?
- What happens if the process dies halfway through?
- How is retry timing stored?
- What is the maximum retry/dead-letter/manual-review behavior?
- How does operations know it failed?
- Can the next run repair an interrupted run?

## MVP architecture

Prefer the simplest safe option:

- one explicitly designated worker process for jobs that are not multi-worker safe, or
- atomic Mongo claim/lease for jobs that may run on multiple workers.

Do not introduce Kafka/RabbitMQ or a complex queue platform solely for theoretical scale.

## External side effects

For email/SMS/Stripe/shipping/refunds:
- persist attempt/result identifiers,
- use provider idempotency where available,
- separate retriable from permanent errors,
- do not mark work complete before required durable state is saved.

## Time

Schedule/store in UTC and use timezone-aware libraries for local business rules. Never hardcode New Zealand as a permanent UTC+12 offset.

## Verification

Test duplicate invocation, overlapping workers where relevant, retry after failure, restart/interruption, and idempotent external side effects for high-risk jobs.
