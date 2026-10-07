# Phase 11 — Index / Key Design (draft)

Design from access patterns only. **Not implemented in Phase 11.**

## Naming

- Partition key: `PK`  
- Sort key: `SK`  
- Common attributes: `id`, `entity`, `gsi1PK`, `gsi1SK`, `ownerId`, `status`, `createdAt`, `updatedAt`  
- Entity types use prefixes: `USER#`, `TAG#`, `ORD#`, etc.

## Draft PK/SK per logical table

### pawtag-core (identity)
| Entity | PK | SK | Uniqueness |
|---|---|---|---|
| User | `USER#{id}` | `PROFILE` | |
| User by email (GSI1) | `USER#EMAIL#{email}` | `PROFILE` | unique GSI |
| RefreshToken | `RT#{tokenHash}` | `SESSION` | unique |
| VerificationToken | `VER#{userId}` | `{type}#{hash}` | consume once |
| UserRole | `USER#{userId}` | `ROLE#{roleId}` | |
| RolePermission | `ROLE#{roleId}` | `PERM#{permId}` | |

### pawtag-recovery
| Entity | PK | SK | Notes |
|---|---|---|---|
| Tag | `TAG#{id}` | `META` | store publicTagId attribute + GSI |
| Tag by public code | GSI `TAG#PUBLIC#{tagId}` | `META` | **Finder primary lookup** |
| Pet | `PET#{id}` | `META` | |
| Pet by owner | GSI `USER#{ownerId}` | `PET#{petId}` | |
| FinderScan | `SCAN#{tagId}` | `{createdAt}#{scanId}` | privacy TTL attrs |
| LocationEvent | `LOC#{tagId}` | `{ts}#{id}` | |

### pawtag-commerce
| Entity | PK | SK | Notes |
|---|---|---|---|
| Product | `PROD#{id}` | `META` | sku attribute + GSI |
| Product by sku | GSI `PROD#SKU#{sku}` | `META` | unique |
| Cart | `CART#{userId}` | `ACTIVE` | |
| PendingOrder | `PEND#{id}` | `META` | piId attribute + GSI `PEND#PI#{pi}` |
| Order | `ORD#{id}` | `META` | orderNumber GSI unique |
| Invoice | `INV#{id}` | `META` | invoiceNumber unique GSI |
| PromoCode | `PROMO#{code}` | `META` | |
| PromoUsage | `PROMO#{code}` | `ORD#{orderId}` | unique SK |
| Stock item (on Product) | `PROD#{id}` | `STOCK` | reserved/version attrs |
| StockMovement | `MOV#{productId}` | `{ts}#{id}` | |

### pawtag-membership
| Entity | PK | SK |
|---|---|---|
| UserMembership | `MEM#{userId}` | `ACTIVE` or `TIER#{tierId}` |
| PawRewardsReservation | `RES#{checkoutId}` | `META` |
| Rewards ledger | `RWR#{userId}` | `{ts}#{id}` |
| Points ledger | `PTS#{userId}` | `{ts}#{id}` |

### pawtag-cms
| Entity | PK | SK |
|---|---|---|
| Setting | `SETTING#{key}` | `META` |
| CmsPage | `CMS#PAGE#{slug}` | `META` |
| FeatureFlag | `FLAG#{key}` | `META` |
| Email template | `CMS#EMAIL#{slug}` | `META` |

### pawtag-ops
| Entity | PK | SK | Notes |
|---|---|---|---|
| BackgroundJob | `JOB#{name}` | `META` | lease attrs |
| WebhookEvent | `WH#{source}` | `#{eventId}` | **unique** |
| EmailAudit | `EMAIL#{id}` | `META` | idempotencyKey GSI sparse |
| AuditEvent | `AUD#{id}` | `{occurredAt}` | retention attrs |

## GSIs (sparse)

| GSI | PK | SK | Purpose |
|---|---|---|---|
| gsi1 | domain-specific lookup | e.g. `EMAIL#{email}`, `TAG#PUBLIC#{code}`, `ORD#NUMBER#{orderNumber}` | equality lookups |
| gsi2 | `status` | `createdAt` or `nextRunAt` | admin lists / job due |
| gsi3 | `ownerId` | `createdAt` | user history |

## High-volume partition advice

- FinderScan / EmailAudit / AuditEvent: shard by tagId/email/date SK to avoid hot partitions.  
- Never Scan entire ops tables in request path.

## Counters

Separate items: `CNT#{name}` with `ADD seq :1` (order numbers, invoice numbers, membership invoice numbers — already used as Mongo `counters`).
