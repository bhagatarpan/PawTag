# DynamoDB Migration Verification Matrix

Create one row per domain discovered in Phase 11.

| Domain | Access patterns documented | Repo interface | Mongo adapter | Dynamo adapter | Migration dry-run | Normalized compare | Concurrency/failure tests | Non-prod cutover | Rollback tested | Production source |
|---|---|---|---|---|---|---|---|---|---|---|
| Settings/config | | | | | | | | | | |
| CMS/supporting | | | | | | | | | | |
| Identity/session | | | | | | | | | | |
| Pets/tags | | | | | | | | | | |
| Finder/recovery | | | | | | | | | | |
| Catalog/cart | | | | | | | | | | |
| Orders/payments/refunds | | | | | | | | | | |
| Inventory/reservations | | | | | | | | | | |
| Membership/subscriptions | | | | | | | | | | |
| Rewards/referrals | | | | | | | | | | |
| Invoices/doc access | | | | | | | | | | |
| Webhook/reconciliation | | | | | | | | | | |
| Background jobs/leases | | | | | | | | | | |
| Audit/system logs | | | | | | | | | | |

## Per-domain mandatory cutover record

```text
Current source of truth:
New source of truth:
Cutover timestamp/window:
Shadow validation period:
Rollback trigger:
Rollback steps:
How writes are reconciled if rollback occurs:
Maximum rollback window:
Owner:
```

## Global gates

- [ ] No normal request-path unbounded Scan.
- [ ] Existing IDs/external references preserved or compatibility plan proven.
- [ ] IAM least privilege.
- [ ] local/test/staging/prod resources separated.
- [ ] PITR/backup/recovery configured as required.
- [ ] migration tools resumable/idempotent.
- [ ] Mongoose removed only after no runtime dependency remains.
