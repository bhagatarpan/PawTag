# Phase 11 — DynamoDB Discovery Inventory

**Executed:** 2026-10-06  
**Rule:** discovery only — no application behavior change, no data migration.

## Scope

- 73 Mongoose models in `packages/db/src/models/`
- All API routes/services/jobs import models from `@pawtag/db`
- No raw Mongo drivers outside `packages/db` (connection + models only)
- Frontend apps do not import database models (API-only persistence)

## Model inventory (73)

### Identity & auth
| Model | Unique / critical fields | TTL / notes |
|---|---|---|
| User | email, phone; pawRewards fields | |
| RefreshToken | tokenHash | expiry on token |
| VerificationToken | tokenHash, type | OTP/reset single-use |
| Role, Permission, PermissionGroup, PermissionScope | name/slug | RBAC |
| UserRole, RolePermission | composite links | |

### Pets & recovery
| Model | Unique / critical | Notes |
|---|---|---|
| Pet | petId | owner-scoped |
| Tag | tagId (public) | status lifecycle; HYBRID 2 |
| FinderScan | — | tagId, createdAt indexes; privacy PII |
| LocationEvent | — | GPS; privacy retention |
| EscalationRecord | — | finder notify follow-up |
| TagExpiryNotification | — | reminders |

### Commerce
| Model | Unique / critical | Notes |
|---|---|---|
| Product | sku; stock/reserved | inventory atomic updates |
| StockMovement | — | audit of stock |
| Category, Brand, Collection, ShippingMethod | slug/name | catalog |
| Cart | userId+active | cart items |
| PromoCode | code | usageCount |
| PromoUsage | code+orderId | Phase 02 idempotency |
| PendingOrder | stripePaymentIntentId | checkout hold + TTL |
| Order | orderNumber | money; activity $push |
| PaymentTransaction | — | provider IDs |
| Invoice | invoiceNumber | financial docs |
| InvoiceAccessToken | tokenHash | TTL expiry |
| Fulfilment, Shipment, Return, PendingRefundRetry | order links | ops |

### Membership & rewards
| Model | Notes |
|---|---|
| Subscription | tag subscription legacy + Stripe IDs |
| UserMembership | tier; pending_payment vs active |
| MembershipTier, MembershipBenefit, MembershipTierBenefit | entitlement registry |
| PawRewardsLedger, PawRewardsReservation | reward hold/commit |
| GuardianPointsLedger, GuardianTierHistory | points |

### CMS / settings / admin
| Model | Notes |
|---|---|
| Setting, FeatureFlag | key/value config |
| SiteContent | content blocks |
| CmsPage, CmsPageVersion, CmsNavigation, CmsFooter, CmsMedia, CmsAnnouncement, CmsRedirect, CmsEmailTemplate, EmailTemplateVersion, CmsSmsTemplate, CmsPetReference, CmsHomepageSection, CmsShopPage, CmsAuthPage, CmsOnboarding | CMS surfaces |
| DigitalProduct, DigitalEntitlement | digital SKUs |
| Referral, ReferralCode | marketing |
| SupportRequest | support |
| PushToken | FCM tokens |

### Jobs, webhooks, audit, email
| Model | Notes |
|---|---|
| BackgroundJob | job config + run history |
| WebhookEvent | source+eventId unique idempotency |
| EmailAudit | idempotencyKey; TTL 1 year |
| AuditEvent | retention policies, legal hold |
| SystemLog | operational logs |
| IntegrationConnection | Xero etc. |

## Critical persistence patterns (from code)

| Pattern | Where | Migration implication |
|---|---|---|
| Atomic stock reserve/confirm | `inventory.service.ts` `$inc` + conditional | DynamoDB conditional writes required |
| Rewards reserve/commit | `pawrewards.service.ts` + `User.pawRewardsReserved` | optimistic/conditional on reserved+balance |
| Promo idempotent usage | `PromoUsage` unique | unique PK |
| Webhook idempotency | `WebhookEvent` unique source+eventId | unique item; not TTL-delete mid-retry |
| Sequence counters | `counters` collection `$inc` | DynamoDB atomic ADD |
| Populate joins | orders/invoices/admin lists | denormalize or multi-get in repository |
| Aggregations | admin analytics | redesign as GSIs / pre-aggregates — no Scan |
| Mongo transactions | seeds only | production commerce uses state machines + idempotency |
| TTL indexes | PendingOrder.expiresAt, EmailAudit 1y | DynamoDB TTL is async — keep cleanup jobs |

## Conclusion

PawTag is a **document-style product with strong unique keys and conditional updates**. DynamoDB design must be **access-pattern led**, not table-per-model. Phase 12+ must introduce **repository interfaces** before cutting over money domains.
