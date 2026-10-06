# Background Job Inventory (Phase 06)

Each job uses DB-driven config + `createClaimedJob` locking where financially sensitive.

| Job | File | Purpose | Lock | Idempotency notes |
|---|---|---|---|---|
| order-auto-cancel | `jobs/orderAutoCancel.ts` | Cancel stale `pending_payment` orders + release stock | claimed | status transition to cancelled |
| pending-order-expiry | `jobs/pendingOrderExpiry.ts` | Release stock/rewards for expired PendingOrders before TTL | claimed | claim atomically on `status:pending` |
| webhook-retry | `jobs/webhookRetry.ts` | Retry failed Stripe webhooks; recover stranded processing | claimed | WebhookEvent unique eventId |
| privacy-retention | `jobs/privacyRetention.ts` | Anonymize finder contact/GPS/IP/device | claimed | find-and-update old scans |
| audit-retention | `jobs/auditRetention.ts` | Enforce audit retention policies | claimed | retention dates on events |
| orphan-payment-detection | `jobs/orphanPaymentDetection.ts` | Detect orphaned Stripe payments | claimed | order/PendingOrder ownership |
| payment-reconciliation | `jobs/paymentReconciliation.ts` | Reconcile order payment vs Stripe | claimed | PI id matching |
| refund-reconciliation | `jobs/refundReconciliation.ts` | Reconcile refunds | claimed | refund provider IDs |
| membership-activation-reconciliation | `jobs/membershipActivationReconciliation.ts` | Activate paid memberships stuck pending | claimed | Stripe status gate (Phase 03) |
| low-stock-check | `jobs/lowStockCheck.ts` | Low stock alerts | claimed | thresholds |
| pawrewards / reminders / shipping / escalation / pet-milestones | various | Supporting ops | claimed | business-specific |

## Worker runtime

```bash
PAWTAG_WORKER_ROLE=worker node packages/api/dist/worker.js
```

Docker compose already defines `worker` service.

## Deployment evidence state

| Check | Evidence |
|---|---|
| Docker compose api/worker/web/admin/finder | Present |
| Health `/health/ready` + `/health/dependencies` | Present (sanitized) |
| Production fail-closed providers | Phase 01 automated |
| CI workflow | **Added** `.github/workflows/ci.yml` |
| Live staging backup restore rehearsal | **BLOCKED_EXTERNAL** — not executed this session |
