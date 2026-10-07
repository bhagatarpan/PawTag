# Phase 11 — Transaction / Atomicity Map

Production code uses **few true multi-document Mongo transactions** (mostly seeds). Money safety relies on **conditional updates + idempotency + state machines**. DynamoDB must preserve those invariants.

## Atomic / conditional operations that MUST map correctly

| Operation | Mongo behavior | DynamoDB equivalent | Failure mode if wrong |
|---|---|---|---|
| Inventory reserve | `findOneAndUpdate` stock-reserved>=qty, `$inc reserved` | `UpdateItem` + ConditionExpression on stock/reserved/version | Oversell |
| Inventory confirm sale | conditional `$inc stock,reserved` | conditional update; throw if condition fails | Silent stock leak (fixed Phase 02) |
| Rewards reserve | conditional available = balance-reserved | UpdateItem + condition on pawRewardsBalance/Reserved | Double-spend points |
| Rewards commit/release | once per checkoutId | conditional + unique RES item status | Double debit |
| Promo usage | PromoUsage unique + conditional count | PutItem conditional / unique PK | Double discount count |
| Webhook ingest | WebhookEvent unique source+eventId | PutItem with attribute_not_exists | Double side effects |
| Sequence counters | `counters` `$inc seq` | `UpdateItem ADD seq :1` | Duplicate order/invoice numbers |
| Job claim | claimed job locks | conditional lease attribute | Duplicate job side effects |
| PendingOrder convert | status pending→converted | conditional status update | Double order create |
| Membership activate | Stripe status gate + status pending→active | conditional on status + verify Stripe first | Free membership |

## Multi-write domains (need explicit design in Phase 12–13)

### Checkout finalize
1. Verify payment (Stripe)  
2. Create Order (unique orderNumber)  
3. Inventory confirm per line  
4. PromoUsage once  
5. Rewards commit once  
6. Mark PendingOrder converted  
7. Invoice create  

**Strategy:** durable state machine + idempotent steps; not one giant DynamoDB transaction across all items unless a single-table design proves item collection boundaries. Prefer: **order document as source of truth** + step markers (`completionCorrelationId` already exists on Order).

### Membership activate
Stripe webhook already gates on subscription status. Local write must stay conditional.

### Refunds
Provider refund first or parallel with local PendingRefundRetry; never mark refunded without provider ID/ARN when Stripe is source of truth.

## Transactions in DynamoDB

| Use | When |
|---|---|
| TransactWriteItems | Same-partition multi-item atomic ops (e.g. order + pending convert if keys colocate) |
| Single-item conditional | Most inventory/rewards/promo/webhook paths |
| App-level saga | Cross-domain checkout finalize |

## Do NOT

- Assume DynamoDB TTL deletes PendingOrder **before** reservation release — keep `pendingOrderExpiry` job.  
- Dual-write money without a single authoritative source per domain.  
- Change public IDs during migration.
