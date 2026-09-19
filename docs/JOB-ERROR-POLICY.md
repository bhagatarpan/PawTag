# Background Job Error Policy

> Every job must answer these questions. This document is the authoritative reference for operational understanding of background job behavior.
>
> Last updated: 2026-09-19

## Infrastructure

### Job Claiming

All critical jobs use `createClaimedJob` from `packages/api/src/lib/job-claim.ts`:

- **Lock collection:** `job_locks` in MongoDB
- **Lease duration:** 120 seconds (2 minutes)
- **Lease expiry reclaim:** Yes - if a worker crashes, the lease expires after 120s and another worker can claim
- **Re-entrant:** Same worker can re-claim its own lock
- **Release:** Lock is released in `finally` block after execution, even on failure

### Error Handling Principles

1. **Per-item isolation:** One bad item must not abort the entire batch
2. **Explicit failure logging:** Every per-item failure must be logged with enough context to diagnose
3. **Idempotency:** Jobs must be safe to run multiple times on the same data
4. **Visible failure:** Operations staff must be able to identify stuck/failed jobs

---

## Job Registry

### 1. Webhook Retry (`jobs/webhookRetry.ts`)

| Dimension | Detail |
|---|---|
| **Interval** | Every 60 seconds |
| **Claimed** | Yes |
| **Idempotent** | Yes. Stripe event deduplication ensures re-processing is safe. |
| **Item processed** | `WebhookEvent` documents with `status: pending/failed` and `nextRetryAt <= now`. Batch: up to 50 per cycle. |
| **After failure** | Per-event: increments `attempts`, sets `status = failed`, computes `nextRetryAt` via exponential backoff. Job continues to next event. |
| **Retries** | Up to `event.maxAttempts` (stored on document). |
| **Retry backoff** | Exponential: `[30s, 60s, 120s, 300s, 900s]` (5 tiers). Falls back to 900s beyond array. |
| **Manual intervention** | When `attempts >= maxAttempts`, status becomes `dead`. Requires manual admin review. |
| **Alert emitted** | `logger.error` for dead events. `logger.warn` per failed retry. |
| **Crashed lease reclaim** | Yes (120s lease) |

### 2. Order Auto-Cancel (`jobs/orderAutoCancel.ts`)

| Dimension | Detail |
|---|---|
| **Interval** | Every 60 seconds |
| **Claimed** | Yes |
| **Idempotent** | Partially. Setting `status = cancelled` on already-cancelled order is safe. |
| **Item processed** | `Order` documents in `status: pending_payment` older than threshold. Batch: up to 50 per cycle. |
| **After failure** | Per-order: logs error and continues to next order. |
| **Retries** | 0 explicit. Next 60s cycle re-queries. |
| **Retry backoff** | N/A - relies on next scheduled cycle (60s). |
| **Manual intervention** | Never - keeps retrying until cancelled. |
| **Alert emitted** | `logger.error` per failed order cancellation. |
| **Crashed lease reclaim** | Yes (120s lease) |

### 3. Payment Reconciliation (`jobs/paymentReconciliation.ts`)

| Dimension | Detail |
|---|---|
| **Interval** | Every 5 minutes |
| **Claimed** | Yes |
| **Idempotent** | Yes. Read-only diagnostic job - no state writes. |
| **Item processed** | `Order` documents with Stripe payment intent ID, last 24h. Batch: up to 100 per cycle. |
| **After failure** | Per-order: Stripe retrieval failure caught silently. Job logs error and exits. |
| **Retries** | 0 - next 5-minute cycle re-checks. |
| **Retry backoff** | N/A. |
| **Manual intervention** | Never. Detects and logs discrepancies for admin review. |
| **Alert emitted** | `logger.warn` per status/amount mismatch. |
| **Crashed lease reclaim** | Yes (120s lease) |

### 4. Refund Reconciliation (`jobs/refundReconciliation.ts`)

| Dimension | Detail |
|---|---|
| **Interval** | Daily at configurable NZ hour (default 2am) |
| **Claimed** | Yes |
| **Idempotent** | Yes. Overwrites order refund fields with latest Stripe state. |
| **Item processed** | Refunds from Stripe (last 7 days, limit 100). Also processes failed refund retry queue. |
| **After failure** | Per-refund: logs error and continues to next. |
| **Retries** | Refund sync: 0 (next daily run). Failed refund retries: configurable `maxAutoRetries` (default 1) with 24h delay. |
| **Retry backoff** | Configurable: 24h between attempts (default). |
| **Manual intervention** | After max retries, admin triggers manual retry via `manualRefundRetry()`. |
| **Alert emitted** | `logger.error` per failed refund sync. Summary with counts. |
| **Crashed lease reclaim** | Yes (120s lease) |

### 5. Shipping Tracking Poll (`jobs/shippingTrackingPoll.ts`)

| Dimension | Detail |
|---|---|
| **Interval** | Every 5 minutes |
| **Claimed** | Yes |
| **Idempotent** | Yes. Updates shipment status to latest carrier state. |
| **Item processed** | Active shipments (delegated to `shipmentService.pollTrackingUpdates()`). |
| **After failure** | Delegated to shipment service. Job logs error and exits. |
| **Retries** | 0 - next 5-minute cycle re-polls. |
| **Retry backoff** | N/A. |
| **Manual intervention** | Never - keeps polling until terminal status. |
| **Alert emitted** | `logger.info` with updated/error counts. |
| **Crashed lease reclaim** | Yes (120s lease) |

### 6. Orphan Payment Detection (`jobs/orphanPaymentDetection.ts`)

| Dimension | Detail |
|---|---|
| **Interval** | Every 60 seconds |
| **Claimed** | **No** - uses plain `setInterval` |
| **Idempotent** | Yes. `confirmCheckout` is idempotent per Stripe PI. |
| **Item processed** | `PendingOrder` documents: `status: pending`, created 5-24h ago, with Stripe PI. Batch: up to 50. |
| **After failure** | Per-item: logs error and continues to next. |
| **Retries** | 0 - next 60s cycle re-checks. |
| **Retry backoff** | N/A. |
| **Manual intervention** | Never - items >24h are ignored. |
| **Alert emitted** | `logger.warn` for orphan detection/recovery. Audit `orphan_payment_recovered` severity HIGH. |
| **Crashed lease reclaim** | **No** |

### 7. Low Stock Check (`jobs/lowStockCheck.ts`)

| Dimension | Detail |
|---|---|
| **Interval** | Every 24 hours (1-hour initial delay) |
| **Claimed** | **No** - uses plain `setInterval` |
| **Idempotent** | Partially. Creates notifications and emails - duplicates possible. |
| **Item processed** | All `Product` documents where `stock <= threshold`. |
| **After failure** | Logs error. Does not retry. |
| **Retries** | 0. Next 24h cycle runs regardless. |
| **Retry backoff** | N/A. |
| **Manual intervention** | Never. |
| **Alert emitted** | Email to `ADMIN_ALERT_EMAIL`. In-app `Notification` to admin. Audit log with severity HIGH/MEDIUM. |
| **Crashed lease reclaim** | **No** |

### 8. Pet Milestones (`jobs/pet-milestones.ts`)

| Dimension | Detail |
|---|---|
| **Interval** | Every 24 hours (runs immediately on startup) |
| **Claimed** | **No** - uses plain `setInterval` |
| **Idempotent** | Partially. Points awarding and emails may duplicate. |
| **Item processed** | Pet documents with `dateOfBirth` or `adoptionDate` matching today. |
| **After failure** | Per-milestone: logs error and continues to next. |
| **Retries** | 0. Next 24h cycle runs regardless. |
| **Retry backoff** | N/A. |
| **Manual intervention** | Never. |
| **Alert emitted** | `logger.error` per failed milestone. |
| **Crashed lease reclaim** | **No** |

### 9. PawRewards (`jobs/pawrewards.ts`)

| Dimension | Detail |
|---|---|
| **Interval** | Every 24 hours |
| **Claimed** | **No** - uses plain `setInterval` |
| **Idempotent** | Partially. Four sub-jobs with per-user iteration and try/catch. |
| **Item processed** | Subscriptions (active) for allocation/membership. Users for tier re-qualification. Rewards for expiration. |
| **After failure** | Per-user: logs error and continues to next user. |
| **Retries** | 0. Failed users skipped, retried next cycle. |
| **Retry backoff** | N/A. |
| **Manual intervention** | Never. |
| **Alert emitted** | `logger.error` per failed user. `logger.info` summary counts. |
| **Crashed lease reclaim** | **No** |

### 10. Reminder Service (`services/reminder.service.ts`)

| Dimension | Detail |
|---|---|
| **Interval** | Every 1 hour |
| **Claimed** | **No** - uses plain `setInterval` |
| **Idempotent** | Yes by design. Finder reminders check for existing notification within 23h (dedup window). Onboarding nudges are one-time per user. |
| **Item processed** | (a) Pets in `status: found` >24h. (b) Users with incomplete onboarding >3 days. |
| **After failure** | Push failures silently absorbed. Per-pet failures not individually caught at loop level. |
| **Retries** | 0. Dedup windows prevent duplicate notifications. |
| **Retry backoff** | N/A. |
| **Manual intervention** | Never. |
| **Alert emitted** | Audit log entries (fire-and-forget). `logger.error` for job-level failures. |
| **Crashed lease reclaim** | **No** |

### 11. Subscription Service (`services/subscription.service.ts`)

| Dimension | Detail |
|---|---|
| **Interval** | Every 1 hour |
| **Claimed** | **No** - uses plain `setInterval` |
| **Idempotent** | Partially. State-machine transitions are idempotent. Payment retries are idempotent per Stripe invoice. |
| **Item processed** | Subscriptions with various statuses. 8 sub-checks + payment retry processing. |
| **After failure** | Per-subscription: try/caught per sub in retry loop. Logs error and continues. |
| **Retries** | Payment retries: configurable `maxRetries` (default 4) with delays `[0, 1, 24, 72]` hours. After max retries, moves to grace period. |
| **Retry backoff** | Configurable: `[0, 1, 24, 72]` hours (default). |
| **Manual intervention** | After 4 retries, subscription enters grace period (configurable weeks, default 4). Eventually expires. |
| **Alert emitted** | Email to user on each payment failure/retry/success. Audit log for financial events (severity HIGH). Metrics counters. |
| **Crashed lease reclaim** | **No** |

### 12. Escalation Service (`services/escalation.service.ts`)

| Dimension | Detail |
|---|---|
| **Interval** | Every 1 minute |
| **Claimed** | Yes |
| **Idempotent** | Yes. Checks for `status: pending` and no `escalatedAt`. After processing, sets `status: escalated`. |
| **Item processed** | `EscalationRecord` documents with `status: pending` and `escalationDeadline <= now`. |
| **After failure** | Per-record: try/caught. Logs error and continues to next. Push failures silently absorbed. |
| **Retries** | 0 explicit - next 1-minute cycle re-queries. Records stay `pending` until escalated. |
| **Retry backoff** | N/A - retries every 60 seconds. |
| **Manual intervention** | `forwardToEmergencyContact` API allows manual admin retry. |
| **Alert emitted** | In-app notification + push + email to emergency contact. `logger.error` per failed escalation. |
| **Crashed lease reclaim** | Yes (120s lease) |

---

## Summary Table

| # | Job | Interval | Claimed | Idempotent | Retries | Manual Escalation | Crash Reclaim |
|---|---|---|---|---|---|---|---|
| 1 | webhookRetry | 60s | Yes | Yes | Up to maxAttempts | Dead events | Yes |
| 2 | orderAutoCancel | 60s | Yes | Partially | Infinite (re-picks) | Never | Yes |
| 3 | paymentReconciliation | 5min | Yes | Yes | Infinite (re-checks) | Never | Yes |
| 4 | refundReconciliation | Daily | Yes | Yes | Configurable (default 1) | Admin manual retry | Yes |
| 5 | shippingTrackingPoll | 5min | Yes | Yes | Infinite (re-polls) | Never | Yes |
| 6 | orphanPaymentDetection | 60s | No | Yes | Infinite (re-checks) | Never | No |
| 7 | lowStockCheck | 24h | No | Partially | 0 | Never | No |
| 8 | pet-milestones | 24h | No | Partially | 0 | Never | No |
| 9 | pawrewards | 24h | No | Partially | 0 (per-user skip) | Never | No |
| 10 | reminder.service | 1h | No | Yes (dedup) | 0 | Never | No |
| 11 | subscription.service | 1h | No | Partially | 4 (configurable) | Grace period -> expiry | No |
| 12 | escalation.service | 1min | Yes | Yes | Infinite (re-escalates) | Manual forward API | Yes |

---

## Key Findings

### Claimed vs Unclaimed

- 6 jobs use claiming (1-5, 12) - safe for multi-process deployment
- 6 jobs do NOT use claiming (6-11) - vulnerable to duplicate execution

### Jobs with Retry/Backoff

- webhookRetry: Exponential backoff with dead-letter after maxAttempts
- subscription.service: Configurable retry delays with grace period escalation
- refundReconciliation: Configurable retry via processFailedRefundRetries

### Jobs that Swallow Notification Failures

- orderAutoCancel: `.catch(() => {})` on notification and audit
- escalation.service: `.catch(() => {})` on push to emergency contact
- reminder.service: `.catch(() => {})` on push notifications

### Jobs with No Escalation Path on Failure

- lowStockCheck, pet-milestones, pawrewards, reminder.service - failures logged but no admin notified
- orphanPaymentDetection - failures logged, no admin notification
- subscription.service - financial failures emailed to user but no admin notification
