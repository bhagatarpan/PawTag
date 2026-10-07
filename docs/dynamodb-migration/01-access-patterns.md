# Phase 11 — Access Patterns

Format: Operation | Caller | Domain | Read/Write | Lookup | Frequency | Consistency | Ownership | Atomicity | Candidate key

## Identity

| Operation | Caller | Domain | R/W | Lookup | Freq | Consistency | Ownership | Atomicity | Candidate key |
|---|---|---|---|---|---|---|---|---|---|
| Login by email | auth | identity | R | email | high | strong | n/a | n/a | USER#email GSI |
| Find user by id | auth/routes | identity | R | userId | high | strong | self | n/a | PK USER#id |
| Create/rotate refresh token | auth | identity | W | tokenHash | high | strong | self | insert | RT#hash |
| Verify OTP | auth | identity | R/W | userId+type+hash | med | strong | self | consume | VER#{userId}#{type} |
| RBAC: roles for user | middleware | identity | R | userId | high | strong | n/a | n/a | USER#{id}#ROLE |
| Role→permissions | authz | identity | R | roleId | high | strong | n/a | n/a | ROLE#{id}#PERM |

## Pets & tags (Finder critical)

| Operation | Caller | Domain | R/W | Lookup | Freq | Consistency | Ownership | Atomicity | Candidate key |
|---|---|---|---|---|---|---|---|---|---|
| Public tag lookup | finder API | recovery | R | public tagId | high | strong | public | n/a | TAG#public#{tagId} |
| List customer tags | customer | recovery | R | ownerId | med | eventual ok | owner | n/a | USER#{id}#TAG |
| Tag activate / replace | customer | recovery | W | tagId | med | strong | owner | status transition | TAG#public#{tagId} |
| Finder scan create | finder | recovery | W | tagId, createdAt | high | strong | n/a | insert | SCAN#{tagId}#{ts} |
| Notify owner | finder | recovery | W | tagId + entitlement | high | strong | owner | notify once/5min | PET##{petId}#NOTIF |
| Privacy retention | job | recovery | W | old scans | low | strong | n/a | anonymize | SCAN#{tagId}#{ts} TTL |

## Commerce

| Operation | Caller | Domain | R/W | Lookup | Freq | Consistency | Ownership | Atomicity | Candidate key |
|---|---|---|---|---|---|---|---|---|---|
| Product by sku/slug | shop | commerce | R | sku/slug | high | strong | n/a | n/a | PROD#sku |
| Stock reserve | checkout | commerce | W | productId+qty | high | **strong** | checkout | conditional $inc | PROD#id + version |
| Stock confirm sale | checkout confirm | commerce | W | productId | high | **strong** | order | conditional | PROD#id |
| Cart by active user | cart | commerce | R/W | userId active | high | strong | owner | upsert | CART#{userId}#ACTIVE |
| Create PendingOrder | checkout | commerce | W | PI id | high | strong | owner | insert unique | PEND#pi#{piId} |
| Confirm checkout | webhook/client | commerce | R/W | PI + userId | high | strong | owner | order create + convert | ORDER#number |
| Invoice by number | customer/admin | commerce | R | invoiceNumber | med | strong | owner | n/a | INV#number |
| Promo usage once | finalize | commerce | W | code+orderId | med | strong | order | unique insert | PROMO#{code}#ORD#{id} |
| Refund by provider id | admin/job | commerce | R/W | refundId | med | strong | order | status | REFUND#provider#{id} |

## Membership & rewards

| Operation | Caller | Domain | R/W | Lookup | Freq | Consistency | Ownership | Atomicity | Candidate key |
|---|---|---|---|---|---|---|---|---|---|
| Membership by user | membership | membership | R/W | userId | med | strong | owner | status | MEM#{userId} |
| Activate after Stripe | webhook | membership | W | membershipId | med | strong | Stripe | status gate | MEM#{id} |
| Rewards reserve | checkout | rewards | W | userId+checkoutId | med | **strong** | owner | conditional reserved | USER#{id} + RES#{checkoutId} |
| Rewards commit | finalize | rewards | W | checkoutId | med | **strong** | owner | debit once | RES#{checkoutId} |
| Points award | jobs | rewards | W | userId | low | strong | owner | $inc | USER#{id} |

## Jobs & webhooks

| Operation | Caller | Domain | R/W | Lookup | Freq | Consistency | Ownership | Atomicity | Candidate key |
|---|---|---|---|---|---|---|---|---|---|
| Stripe webhook ingest | API | webhooks | R/W | source+eventId | high | strong | Stripe | unique | WH#{source}#{eventId} |
| Job due query | scheduler | jobs | R | enabled+nextRunAt | med | strong | system | claim lease | JOB#{name} |
| Job claim | worker | jobs | W | name+lock | med | strong | system | conditional | JOB#{name} lease |

## Admin analytics (avoid Scan)

| Operation | Pattern | DynamoDB approach |
|---|---|---|
| Orders by day revenue | Order.aggregate | GSI orderStatus+createdAt or offline aggregate job |
| Guardian tier distribution | User.aggregate | GSI membershipTier + count job |
| Audit buckets | AuditEvent.aggregate | GSIs actor/subject/resource + scheduled rollup |

## Search / regex

- Admin lists use Mongo filters (status, email contains, order number).
- DynamoDB: equality on GSIs; **contains/regex → no default Scan**. Use sparse GSIs for status/date or OpenSearch only if product later requires free-text.

## Pagination

- Existing APIs use page/limit.
- DynamoDB: cursor pagination (ExclusiveStartKey) behind repository; preserve HTTP contract `{ items, total?, page }` where total is optional/expensive — document per endpoint in Phase 12.
