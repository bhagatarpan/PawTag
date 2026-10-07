# DynamoDB Migration Verification Matrix

**Phase 12 update (2026-10-06):** Settings domain boundary + migration tooling implemented. Live AWS table create/migrate **not executed** this session (no IAM verification run).

| Domain | Access patterns documented | Repo interface | Mongo adapter | Dynamo adapter | Migration dry-run | Normalized compare | Concurrency/failure tests | Non-prod cutover | Rollback tested | Production source |
|---|---|---|---|---|---|---|---|---|---|---|
| Settings/config | Yes (Phase 11) | **Yes** | **Yes** | **Yes** | **PASS** (271) | **PASS live AWS** match=271 mismatch=0 | n/a | **Not flipped** — `DYNAMODB_SETTINGS_READS` defaults `mongo` | Rollback = env `mongo` | **MongoDB** |
| CMS/supporting | Yes | Not yet | No | No | Not started | No | No | No | No | MongoDB |
| Identity/session | Yes | No | No | No | No | No | No | No | No | MongoDB |
| Pets/tags | Yes | No | No | No | No | No | No | No | No | MongoDB |
| Finder/recovery | Yes | No | No | No | No | No | No | No | No | MongoDB |
| Catalog/cart | Yes | Partial (inventory Dynamo service coded) | No | Conditional writes coded | No live migrate | No | **Unit tests PASS** | **No cutover** | Mongo remains | **MongoDB** |
| Orders/payments/refunds | Yes | No | No | No | No | No | No | No | No | MongoDB |
| Inventory/reservations | Yes | Dynamo service Phase 13 | Mongo still live | Conditional reserve/release/confirmSale | Not migrated | No | **Unit tests PASS** | **No cutover** | Mongo remains | **MongoDB** |
| Membership/subscriptions | Yes | No | No | No | No | No | No | No | No | MongoDB |
| Rewards/referrals | Yes | Dynamo rewards service Phase 13 | Mongo still live | Conditional reserve/commit/release | Not migrated | No | **Unit tests PASS** | **No cutover** | Mongo remains | **MongoDB** |
| Invoices/doc access | Yes | No | No | No | No | No | No | No | No | MongoDB |
| Webhook/reconciliation | Yes | No | No | No | No | No | No | No | No | MongoDB |
| Background jobs/leases | Yes | No | No | No | No | No | No | No | No | MongoDB |
| Audit/system logs | Yes | No | No | No | No | No | No | No | No | MongoDB |

## Phase 12 live AWS proof (2026-10-06/07)

| Step | Result |
|---|---|
| Table create | **PASS** — `pawtag-dev-settings` in `ap-southeast-2` |
| Migrate dry-run | **PASS** — 271 settings |
| Migrate write | **PASS** — migrated=271 |
| Compare after normalize fix | **PASS** — match=271 mismatch=0 missing=0 |
| DynamoDB reads in API | **Not flipped** — still `mongo` default |

## Phase 13 high-risk (coded, not cut over)

| Domain | Artifact | Production source |
|---|---|---|
| Inventory conditional writes | `packages/db/src/dynamodb/inventory.service.ts` | **MongoDB** |
| Rewards hold/commit/release | `packages/db/src/dynamodb/rewards.service.ts` | **MongoDB** |
| Failure-injection unit tests | `tests/unit/dynamodb-high-risk-conditional-writes.test.ts` | PASS |

**Not migrated:** orders, payments, identity, Finder, jobs, webhooks.

## Phase 12 artifacts

| Artifact | Path |
|---|---|
| DynamoDB client factory | `packages/db/src/dynamodb/client.ts` |
| Setting repository contract | `packages/db/src/repositories/setting.ts` |
| Mongo adapter | `packages/db/src/dynamodb/mongo-setting.repository.ts` |
| Dynamo adapter | `packages/db/src/dynamodb/dynamo-setting.repository.ts` |
| Read-mode switch | `DYNAMODB_SETTINGS_READS=mongo\|dynamodb\|dual` |
| Migration tool | `packages/api/src/dynamodb/migrate-settings.ts` |
| Table create tool | `packages/api/src/dynamodb/create-settings-table.ts` |
| DynamoDB Local | `docker/docker-compose.yml` service `dynamodb-local` :8000 |
| Unit tests | `tests/unit/dynamodb-settings-*.test.ts` |

## Per-domain mandatory cutover record

### Settings (current)

```text
Current source of truth: MongoDB
New source of truth: (not flipped yet)
Cutover timestamp/window: n/a
Shadow validation period: planned after migrate + compare
Rollback trigger: any setting mismatch / API errors
Rollback steps: DYNAMODB_SETTINGS_READS=mongo (or unset)
How writes are reconciled if rollback occurs: Mongo remains write path in default mode
Maximum rollback window: immediate (env flip)
Owner: founder/engineer
```

## Global gates

- [x] No normal request-path unbounded Scan (settings by key)
- [x] Existing IDs/keys preserved (`SETTING#{key}`)
- [ ] IAM least privilege (founder uses FullAccess non-prod — tighten later)
- [x] local/test resources separated via table prefix `pawtag-dev-`
- [ ] PITR/backup for real AWS tables (Phase 12 follow-up when creating tables)
- [x] migration tools resumable/idempotent (checkpoint file + upsert by key)
- [ ] Mongoose removed only after no runtime dependency remains — **not started**

## How to run migration (when IAM + Docker ready)

```bash
# 1. Start DynamoDB Local (optional for local) OR use real AWS with .env.local
docker compose -f docker/docker-compose.yml up dynamodb-local -d

# 2. Set env in packages/api/.env.local
# AWS_REGION=ap-southeast-2
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# DYNAMODB_ENDPOINT=http://localhost:8000   # or empty for real AWS
# DYNAMODB_TABLE_PREFIX=pawtag-dev-

# 3. Create table + migrate + compare
pnpm --filter @pawtag/api exec tsx src/dynamodb/create-settings-table.ts
pnpm --filter @pawtag/api exec tsx src/dynamodb/migrate-settings.ts --dry-run
pnpm --filter @pawtag/api exec tsx src/dynamodb/migrate-settings.ts
pnpm --filter @pawtag/api exec tsx src/dynamodb/migrate-settings.ts --compare

# 4. Only after compare clean: flip reads (non-prod)
# DYNAMODB_SETTINGS_READS=dynamodb
```

