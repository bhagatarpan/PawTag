# Phase 11 — Entity Map (domain grouping)

Not one DynamoDB table per Mongo model. Proposed **logical domains** for repository boundaries and later table grouping.

## Domain groups

### 1. Identity
User, RefreshToken, VerificationToken, Role, Permission, PermissionGroup, PermissionScope, UserRole, RolePermission

**Repository interface sketch:** `UserRepository`, `SessionRepository`, `RbacRepository`

### 2. Recovery (pets/tags/finder)
Pet, Tag, FinderScan, LocationEvent, EscalationRecord, TagExpiryNotification

**Critical public key:** `Tag.tagId` (QR/NFC)  
**Privacy:** FinderScan/LocationEvent PII must remain retention-controlled.

### 3. Catalog
Product, Category, Brand, Collection, ShippingMethod, DigitalProduct

### 4. Cart & checkout
Cart, PromoCode, PromoUsage, PendingOrder

### 5. Orders & payments (HIGH RISK)
Order, PaymentTransaction, Invoice, InvoiceAccessToken, Fulfilment, Shipment, Return, PendingRefundRetry

### 6. Membership & rewards (HIGH RISK)
Subscription, UserMembership, MembershipTier, MembershipBenefit, MembershipTierBenefit, PawRewardsLedger, PawRewardsReservation, GuardianPointsLedger, GuardianTierHistory, DigitalEntitlement

### 7. Notifications & support
Notification, PushToken, SupportRequest, TagExpiryNotification

### 8. CMS & configuration (LOW RISK — migrate first)
Setting, FeatureFlag, SiteContent, all Cms* models, EmailTemplateVersion

### 9. Marketing
Referral, ReferralCode, PromoCode (shared with cart)

### 10. Jobs, webhooks, audit, email (HIGH RISK / operational)
BackgroundJob, WebhookEvent, EmailAudit, AuditEvent, SystemLog, IntegrationConnection, StockMovement

## Proposed DynamoDB table grouping (design draft — Phase 11 only)

| Table (draft) | Items (logical) | PK pattern (draft) | Why |
|---|---|---|---|
| `pawtag-core` | User, Session, RBAC | `USER#id`, `RT#hash`, `USER#id#ROLE` | Identity reads by id/hash |
| `pawtag-recovery` | Pet, Tag, FinderScan, Location, Escalation | `TAG#public#tagId`, `PET#id`, `SCAN#tag#ts` | Public finder lookup |
| `pawtag-commerce` | Catalog, Cart, Promo, PendingOrder, Order, Invoice, Payment, Refund | `PROD#sku`, `ORD#number`, `PEND#pi#…` | Checkout + admin |
| `pawtag-membership` | Membership, rewards, entitlements | `MEM#userId`, `RES#checkoutId` | Conditional holds |
| `pawtag-cms` | CMS, settings, features | `SETTING#key`, `CMS#slug#type` | Low risk |
| `pawtag-ops` | Jobs, webhooks, email audit, system logs | `JOB#name`, `WH#src#evt`, `EMAIL#…` | Ops + idempotency |

> Exact table count finalized in Phase 12 after repository interfaces exist. Avoid ideology (one-table vs many); optimize for access patterns + operational clarity.

## External identifiers to preserve as strings

- Mongo `_id` → keep as string `id` in DynamoDB items  
- Stripe IDs, tag public codes, invoice numbers, order numbers, email addresses, provider message IDs  

## Frontend contract rule

Web/admin/finder/mobile must keep calling **HTTP APIs only**. Database implementation is invisible to clients.
