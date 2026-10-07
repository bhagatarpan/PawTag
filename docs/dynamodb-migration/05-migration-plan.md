# Phase 11 — Migration Plan (draft order)

**Constraint:** first web customer runs on **MongoDB**. DynamoDB cutovers are incremental and gated by staging proof.

## Principles

1. One authoritative persistence source per domain at all times  
2. Repository interfaces before any DynamoDB adapter  
3. Low-risk domains first  
4. Money/identity/Finder last  
5. Idempotent, resumable migration tooling  
6. Never delete Mongo during tooling; rollback = point back to Mongo

## Proposed order

### Wave 0 — Foundations (Phase 12 start)
- [ ] Repository interface package (domain operations, not Mongo syntax)
- [ ] DynamoDB Local + docker compose service for tests
- [ ] AWS non-prod table IaC (Terraform/CDK or documented CLI)
- [ ] Shared ID strategy (string ids preserved)

### Wave 1 — CMS & configuration (lowest risk)
Settings, FeatureFlag, Cms* pages/templates/nav, SiteContent  

**Migration tool:** read Mongo → write DynamoDB → dual-read compare → flip repository → keep Mongo as backup

### Wave 2 — Catalog & shipping methods
Product (stock later), Category, Brand, Collection, ShippingMethod  

Stock remains Mongo until inventory repository proven.

### Wave 3 — Notifications/support (non-money)
Notification, PushToken, SupportRequest  

### Wave 4 — Email audit / system logs
EmailAudit, SystemLog — high volume; careful partitioning + TTL jobs

### Wave 5 — Identity
User, sessions, RBAC — only after auth tests + cookie refresh still work in staging

### Wave 6 — Recovery
Pet, Tag public lookup, FinderScan, Escalation — Finder is launch-critical; heavy privacy tests

### Wave 7 — Commerce core (HIGH)
Cart, Promo, PendingOrder → Order, Invoice, PaymentTransaction  

Requires Phase 02 inventory/rewards/promo invariants on DynamoDB first (conditional writes proven in DynamoDB Local).

### Wave 8 — Membership & rewards (HIGH)
UserMembership, rewards holds, entitlements — Stripe webhook path must stay idempotent

### Wave 9 — Jobs & webhooks (HIGH)
BackgroundJob leases, WebhookEvent — after Wave 5–7 stable

### Wave 10 — Cleanup
Remove Mongo dependency only after production-like validation + rollback rehearsal + founder sign-off

## What stays on MongoDB until Wave 7+

**Orders, payments, inventory, rewards, identity, Finder** — until staging proves DynamoDB paths equal Mongo behavior.

## Dual-read / shadow strategy

| Domain | Shadow approach |
|---|---|
| CMS/settings | Dual-read compare admin + public pages |
| Catalog | Compare product responses |
| Identity | Compare login/me after Wave 5 |
| Finder | Compare public tag DTO |
| Commerce | Shadow reads only after money rules proven; **no casual dual-write** |

## Migration tool requirements

- Batch export from Mongo (cursor, resumable checkpoint)  
- Transform to DynamoDB items (preserve IDs)  
- Idempotent PutItem (retry-safe)  
- Verification counts + sample field compare  
- Abort without data loss (Mongo remains source until flip)

## Rollback

| Stage | Rollback |
|---|---|
| Dual-read only | Disable dual-read; Mongo still authoritative |
| After flip, before Mongo delete | Point repository back to Mongo adapter |
| After Mongo delete | Restore from backup (must have rehearsed) |

## Explicit non-goals for first customer

- No public store app prerequisite  
- No donation domain in this migration  
- No big-bang cutover weekend without rehearsal
