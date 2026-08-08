# PawTag Audit Coverage Matrix

**Generated:** 2026-08-08
**Status:** Pre-implementation analysis for Enterprise Audit Logging System

---

## Executive Summary

This matrix documents the current audit logging coverage across the PawTag application before implementing the enterprise-grade audit system. It identifies all state-changing operations, their source locations, current audit status, and gaps.

**Current State:**
- **Total Database Models:** 42
- **Total API Route Files:** 20+
- **Total Background Jobs:** 3
- **Operations with Audit Logging:** ~60% (mostly admin routes)
- **Operations WITHOUT Audit Logging:** ~40% (customer, finder, webhooks, jobs, uploads, referrals, push tokens, support)

---

## 1. Database Models & Current Audit Coverage

| Model | Entity Type | Current Audit Coverage | Primary Operations | Gap Severity |
|-------|-------------|------------------------|-------------------|--------------|
| **User** | Core | ✅ Partial (admin only) | create, update, delete, role/status change, password reset, lock/unlock, MFA | HIGH - customer self-service not audited |
| **Role** | RBAC | ✅ Admin | create, update, delete, clone | MEDIUM |
| **Permission** | RBAC | ✅ Admin | create, update, delete/deactivate | MEDIUM |
| **PermissionGroup** | RBAC | ✅ Admin | create, update, delete | MEDIUM |
| **PermissionScope** | RBAC | ✅ Admin | create, update, delete | MEDIUM |
| **UserRole** | RBAC | ✅ Admin | assign, remove, activate/deactivate | HIGH - critical for privilege escalation |
| **RolePermission** | RBAC | ✅ Admin | assign, update, remove | HIGH |
| **Pet** | Core | ✅ Partial (admin only) | create, update, delete, status change | HIGH - customer pet CRUD not audited |
| **Tag** | Core | ✅ Partial (admin only) | create, update, delete, status change, QR generation | HIGH - redemption, replacement not fully audited |
| **Order** | Financial | ✅ Partial (admin + webhooks) | status transitions, cancel, refund, shipment, delivery | HIGH - payment flow partially audited |
| **Product** | Catalog | ✅ Admin | create, update, delete | MEDIUM |
| **Cart** | Commerce | ❌ None | add/remove items, checkout | HIGH - financial precursor |
| **Subscription** | Financial | ✅ Partial (admin + customer) | create, status change, extend, cancel, renew, plan change | HIGH - auto-renewal, dunning not audited |
| **Invoice** | Financial | ✅ Partial (webhooks) | create on payment, admin extend | MEDIUM |
| **InvoiceAccessToken** | Security | ❌ None | create, verify, consume | MEDIUM - sensitive access control |
| **FinderScan** | Core | ❌ None | create (view, notify, location) | CRITICAL - core product interaction |
| **LocationEvent** | Core/Sensitive | ❌ None | create (GPS location) | CRITICAL - PII/location data |
| **Notification** | System | ❌ None | create, read, mark-read | MEDIUM |
| **AuditLog** | Meta | ⚠️ Self-referential | N/A | N/A |
| **Setting** | Config | ✅ Admin (Settings page) | create, update, delete | HIGH - business-critical config |
| **FeatureFlag** | Config | ✅ Admin | create, update, delete | HIGH |
| **VerificationToken** | Security | ❌ None | create, verify, expire | HIGH - auth tokens |
| **RefreshToken** | Security | ❌ None | issue, rotate, revoke | CRITICAL - session security |
| **Referral** | Commerce | ❌ None | create, complete, reward | MEDIUM |
| **ReferralCode** | Commerce | ❌ None | create, validate | MEDIUM |
| **PushToken** | Security | ❌ None | register, remove, list | MEDIUM |
| **SupportRequest** | Operations | ❌ None | create (public), resolve (admin) | MEDIUM |
| **TagExpiryNotification** | System | ❌ None | create, acknowledge | LOW |
| **SiteContent** | CMS | ✅ Partial (admin) | CRUD, publish, versioning | MEDIUM |
| **CmsPage** | CMS | ✅ Partial (admin) | CRUD, publish, rollback | MEDIUM |
| **CmsPageVersion** | CMS | ✅ Partial (admin) | create on update | LOW |
| **CmsNavigation** | CMS | ✅ Admin | CRUD | LOW |
| **CmsFooter** | CMS | ✅ Admin | CRUD | LOW |
| **CmsMedia** | CMS | ✅ Admin | CRUD | LOW |
| **CmsAnnouncement** | CMS | ✅ Admin | CRUD | LOW |
| **CmsRedirect** | CMS | ✅ Admin | CRUD | LOW |
| **CmsPetReference** | CMS | ✅ Admin | CRUD | LOW |
| **CmsHomepageSection** | CMS | ✅ Admin | CRUD | LOW |
| **CmsShopPage** | CMS | ✅ Admin | CRUD | LOW |
| **CmsEmailTemplate** | CMS | ✅ Admin | CRUD | MEDIUM - customer-facing comms |
| **CmsSmsTemplate** | CMS | ✅ Admin | CRUD | MEDIUM - customer-facing comms |
| **CmsAuthPage** | CMS | ✅ Admin | CRUD | LOW |

---

## 2. API Route Coverage Analysis

### 2.1 Authentication Routes (`/api/auth`)

| Endpoint | Operation | Actor | Current Audit | Missing Fields |
|----------|-----------|-------|---------------|----------------|
| POST /register | User registration | USER/SYSTEM | ✅ Basic | before/after state, correlation_id, device info |
| POST /login | Login | USER | ✅ Basic | MFA context, session_id, risk_score |
| POST /login (failed) | Failed login | USER | ✅ Account lock | IP reputation, geo, attempt_count |
| POST /logout | Logout | USER | ❌ None | session_id, token_revoked |
| POST /refresh | Token refresh | SERVICE | ❌ None | old_token_id, new_token_id, rotation |
| POST /verify-email | Email verification | USER | ✅ Idempotent | token_id, verification_method |
| POST /resend-verification | Resend email | USER | ❌ None | previous_token_id |
| POST /forgot-password | Password reset request | USER | ❌ None | token_id, delivery_method |
| POST /reset-password | Password reset | USER | ❌ None | token_id, password_policy |
| POST /change-password | Password change | USER | ✅ Basic | old_hash_ref, policy_version |
| POST /send-phone-otp | Phone OTP | USER | ❌ None | carrier, delivery_status |
| POST /verify-phone | Phone verify | USER | ❌ None | otp_id, attempts |
| GET /captcha | CAPTCHA challenge | SYSTEM | ❌ None | challenge_id, answer_hash |
| GET /verification-status | Check status | USER | ❌ None | query_context |

**Severity:** CRITICAL - Auth is the primary attack surface

### 2.2 Admin Routes (`/api/admin`)

| Endpoint | Operation | Actor | Current Audit | Missing Fields |
|----------|-----------|-------|---------------|----------------|
| GET /dashboard | Read dashboard | ADMIN | ❌ Read access | - |
| GET /stats/lost-found | Read stats | ADMIN | ❌ Read access | - |
| GET /users | List users | ADMIN | ❌ Read access | filter_params, result_count |
| GET /users/:id | Read user | ADMIN | ❌ Read access | fields_accessed |
| PUT /users/:id/role | Role assignment | ADMIN | ✅ Basic | old_roles[], new_roles[], scope |
| PUT /users/:id/status | Status change | ADMIN | ✅ Basic | reason, previous_state |
| POST /users/:id/reset-password | Admin password reset | ADMIN | ✅ Basic | temp_password_flag |
| PUT /users/:id/lock | Lock account | ADMIN | ✅ Basic | lock_reason, unlock_conditions |
| PUT /users/:id/unlock | Unlock account | ADMIN | ✅ Basic | unlock_reason |
| PUT /users/:id | Update user | ADMIN | ✅ Field-level | - |
| DELETE /users/:id | Soft delete | ADMIN | ✅ Basic | deletion_reason |
| POST /owners/register | Admin create user | ADMIN | ✅ Basic | invited_via |
| POST /pets | Create pet (any owner) | ADMIN | ✅ Basic | - |
| PUT /pets/:id | Update pet | ADMIN | ⚠️ Raw body | field-level diff |
| DELETE /pets/:id | Delete pet | ADMIN | ✅ Basic | - |
| GET /pets | List pets | ADMIN | ❌ Read access | filters, pagination |
| PUT /pets/:id/status | Pet status | ADMIN | ✅ Basic | old_status missing |
| GET /tags | List tags | ADMIN | ❌ Read access | - |
| POST /tags | Create tag | ADMIN | ✅ Basic | - |
| GET /tags/:id | Read tag | ADMIN | ❌ Read access | - |
| PUT /tags/:id | Update tag | ADMIN | ✅ Field-level | - |
| DELETE /tags/:id | Delete tag | ADMIN | ✅ Basic | - |
| GET /tags/:id/qr | Generate QR | ADMIN | ❌ Read access | - |
| POST /tags/qr-bulk | Bulk QR | ADMIN | ❌ Read access | tag_ids[], count |
| GET /products | List products | ADMIN | ❌ Read access | - |
| POST /products | Create product | ADMIN | ✅ Minimal | full_object |
| PUT /products/:id | Update product | ADMIN | ✅ Minimal | field-level diff |
| DELETE /products/:id | Delete product | ADMIN | ✅ Minimal | - |
| GET /orders | List orders | ADMIN | ❌ Read access | - |
| PUT /orders/:id/status | Order status | ADMIN | ✅ Good | transition_validation |
| POST /orders/:id/cancel | Cancel order | ADMIN | ✅ Good | stock_restoration_detail |
| POST /orders/:id/refund | Refund order | ADMIN | ✅ Good | stripe_refund_id, amount |
| POST /orders/:id/create-shipment | Create shipment | ADMIN | ✅ Good | carrier_response |
| POST /orders/:id/mark-delivered | Mark delivered | ADMIN | ✅ Good | - |
| PUT /users/:id/skip-invoice-otp | Skip OTP | ADMIN | ✅ Good | expiry |
| GET /tag-expiry-notifications | List notifications | ADMIN | ❌ Read access | - |
| PUT /tag-expiry-notifications/:id/acknowledge | Acknowledge | ADMIN | ❌ None | acknowledger, notes |
| GET /notifications | List admin notifications | ADMIN | ❌ Read access | - |
| GET /notifications/unread-count | Unread count | ADMIN | ❌ Read access | - |
| PUT /notifications/:id/read | Mark read | ADMIN | ❌ None | - |
| PUT /notifications/mark-all-read | Mark all read | ADMIN | ❌ None | count |
| GET/POST/PUT/DELETE /content | Site content CRUD | ADMIN | ✅ Basic | - |
| CMS routes (pages, nav, email, sms, etc.) | CMS operations | ADMIN | ✅ Basic | version_info, publish_state |

**Severity:** HIGH - Admin operations are well-covered for mutations but READ access is not audited

### 2.3 Customer Routes (`/api/customer`)

| Endpoint | Operation | Actor | Current Audit | Gap |
|----------|-----------|-------|---------------|-----|
| GET /pets | List pets | USER | ❌ None | Read access to PII |
| GET /pets/:id | Read pet | USER | ❌ None | - |
| POST /pets | Create pet | USER | ❌ None | **NO AUDIT** |
| PUT /pets/:id | Update pet | USER | ❌ None | **NO AUDIT** |
| DELETE /pets/:id | Delete pet | USER | ❌ None | **NO AUDIT** |
| GET /tags | List tags | USER | ❌ None | - |
| POST /tags/redeem | Redeem tag | USER | ❌ None | **NO AUDIT - critical** |
| POST /tags/:id/request-replacement | Replacement | USER | ✅ Basic | - |
| GET /tags/unredeemed-count | Count | USER | ❌ None | - |
| POST /pets/:id/mark-lost | Mark lost | USER | ❌ None | **NO AUDIT - critical** |
| POST /pets/:id/mark-found | Mark found | USER | ❌ None | **NO AUDIT - critical** |
| GET /orders | List orders | USER | ❌ None | Read financial data |
| POST /orders | Create order | USER | ❌ None | **NO AUDIT - financial** |
| GET /orders/:id | Read order | USER | ❌ None | Financial PII |
| GET /cart | Read cart | USER | ❌ None | - |
| POST /cart/items | Add to cart | USER | ❌ None | - |
| PUT /cart/items/:id | Update cart | USER | ❌ None | - |
| DELETE /cart/items/:id | Remove from cart | USER | ❌ None | - |
| DELETE /cart | Clear cart | USER | ❌ None | - |
| GET /referral | Get code | USER | ❌ None | - |
| GET /referral/stats | Referral stats | USER | ❌ None | - |
| GET /referral/history | Referral history | USER | ❌ None | - |
| GET /invoices/:id/access | Access invoice | USER | ❌ None | **Sensitive financial doc** |
| POST /invoices/:id/verify-otp | Invoice OTP | USER | ❌ None | - |
| POST /invoices/:id/resend-otp | Resend OTP | USER | ❌ None | - |
| GET /notifications | List notifications | USER | ❌ None | - |
| PUT /notifications/:id/read | Mark read | USER | ❌ None | - |
| PUT /notifications/mark-all-read | Mark all read | USER | ❌ None | - |
| POST /push-tokens | Register token | USER | ❌ None | Device info |
| DELETE /push-tokens/:token | Remove token | USER | ❌ None | - |
| GET /push-tokens | List tokens | USER | ❌ None | - |

**Severity:** CRITICAL - Customer portal has almost NO audit logging

### 2.4 Finder Routes (`/api/finder`) - PUBLIC, NO AUTH

| Endpoint | Operation | Actor | Current Audit | Gap |
|----------|-----------|-------|---------------|-----|
| GET /stats | Public stats | ANONYMOUS | ❌ None | - |
| GET /:tagId | View pet profile | ANONYMOUS/FINDER | ❌ None | **Core product - no audit** |
| POST /:tagId/notify | Notify owner | FINDER | ❌ None | **Critical reunion flow - no audit** |
| GET /:tagId/found-timer | Found timer | FINDER | ❌ None | - |
| POST /:tagId/share-location | Share GPS | FINDER | ❌ None | **Location PII - no audit** |
| GET /shop/products | Browse shop | ANONYMOUS | ❌ None | - |
| GET /content/:slug | View content | ANONYMOUS | ❌ None | - |

**Severity:** CRITICAL - Core product interactions completely unaudited

### 2.5 Webhook Routes (`/api/webhooks`)

| Endpoint | Operation | Actor | Current Audit | Gap |
|----------|-----------|-------|---------------|-----|
| POST /stripe | Stripe events | WEBHOOK/STRIPE | ✅ Partial | idempotency_key, event_id, processing_status |

**Events handled:**
- payment_intent.succeeded → order paid, subscription create, tags create, referral, admin notification, customer notification, invoice create
- payment_intent.payment_failed → order cancelled, stock restore, customer notification
- invoice.payment_succeeded → subscription active, invoice create
- invoice.payment_failed → subscription dunning, customer notification, admin notification
- customer.subscription.deleted → subscription cancelled

**Severity:** HIGH - Financial events partially audited but missing correlation IDs

### 2.6 Other Routes

| Route Group | Operations | Current Audit | Severity |
|-------------|------------|---------------|----------|
| `/api/upload` | Pet photo upload, product images upload/delete | ❌ None | HIGH - File operations |
| `/api/support` (public) | Contact form submit | ❌ None | MEDIUM |
| `/api/admin/support-requests` | List, resolve | ❌ None | MEDIUM |
| `/api/referrals` | Get code, stats, history, validate, admin list | ❌ None | MEDIUM |
| `/api/push-tokens` | Register, remove, list | ❌ None | MEDIUM |
| `/api/invoice-access` | Access, verify OTP, resend OTP | ❌ None | HIGH - Financial docs |
| `/api/customer/subscriptions` | List, detail, invoices, renew, cancel, auto-renew, change-plan, portal-link | ❌ None | HIGH - Financial |
| `/api/admin/subscriptions` | List, stats, detail, status override, extend | ❌ Partial (extend creates invoice) | HIGH |

---

## 3. Background Jobs & Automated Actions

| Job | Trigger | Operations | Current Audit | Actor Type | Severity |
|-----|---------|------------|---------------|------------|----------|
| `lowStockCheck` | Daily cron | Query products, send email, create admin Notification | ❌ None | SCHEDULED_JOB | HIGH |
| `reminderService` | Scheduled | Check subscriptions, send reminders, create notifications | ❌ None | SCHEDULED_JOB | HIGH |
| `subscriptionService` | Scheduled | Update statuses, process renewals, handle grace period | ❌ None | SCHEDULED_JOB | CRITICAL |
| Webhook handlers | Stripe events | See webhook section | ✅ Partial | WEBHOOK | HIGH |

**Critical Gap:** NO automated actions are audited. The actor is always recorded as the human admin who triggered the webhook or the system user, but the actual automated process is not identifiable.

---

## 4. Current AuditLog Schema Analysis

```typescript
// Current schema (packages/db/src/models/AuditLog.ts)
{
  userId: ObjectId (required, indexed)
  action: String (required, indexed)
  entity: String (required, indexed)
  entityId: String (required)
  changes?: Mixed (field-level old/new)
  ipAddress?: String
  userAgent?: String
  createdAt, updatedAt (timestamps)
}
```

**Missing Critical Fields:**
- `audit_event_id` (UUIDv7) - no globally unique ID
- `transaction_id` - no business transaction correlation
- `correlation_id` - no request correlation
- `request_id` - no HTTP request tracking
- `trace_id` - no distributed tracing
- `parent_event_id` - no event hierarchy
- `event_sequence_number` - no ordering within transaction
- `actor_type` - no distinction between USER/ADMIN/SERVICE/SYSTEM/WEBHOOK
- `impersonator_id` - no impersonation tracking
- `delegated_by_id` - no delegation tracking
- `session_id` - no session correlation
- `authentication_method` - no auth context
- `resource_version_before/after` - no optimistic locking
- `business_operation` - no high-level operation name
- `reason` - no business justification
- `outcome` - no success/failure/partial
- `severity` - no risk classification
- `event_hash` / `previous_event_hash` - no tamper evidence
- `schema_version` - no schema evolution
- `tenant_id` - no multi-tenancy (future)

---

## 5. Risk Assessment by Category

### CRITICAL (Immediate Action Required)
1. **Authentication & Session Management** - Login, MFA, token refresh, password reset
2. **Finder/Reunion Flow** - Tag scan, notify owner, location sharing (core product)
3. **Financial Transactions** - Order creation, payment, refund, subscription billing
4. **Automated Systems** - Scheduled jobs, webhook processors, subscription lifecycle
4. **Sensitive Data Access** - Invoice access, location events, customer PII reads

### HIGH (High Priority)
1. **Customer Portal Mutations** - Pet CRUD, tag redemption, replacement, lost/found
2. **Admin Read Access** - User/pet/tag/order listing (PII exposure)
3. **Configuration Changes** - Settings, feature flags, CMS content
4. **File Operations** - Upload/delete pet photos, product images
5. **RBAC Changes** - Role/permission assignments (privilege escalation)

### MEDIUM (Standard Priority)
1. **Referral System** - Code generation, validation, rewards
2. **Push Notifications** - Token registration/removal
3. **Support Requests** - Contact form, resolution
4. **Admin Bulk Operations** - QR bulk generation, bulk status updates

### LOW (Future Enhancement)
1. **Public Read Operations** - Stats, shop browse, content viewing
2. **CMS Versioning** - Page rollbacks, version history

---

## 6. Proposed Audit Event Types

### Event Categories
| Category | Code | Description |
|----------|------|-------------|
| AUTHENTICATION | AUTH | Login, logout, MFA, registration, password, tokens |
| AUTHORIZATION | AUTHZ | Role/permission changes, privilege escalation |
| DATA_CREATE | CREATE | Entity creation |
| DATA_UPDATE | UPDATE | Entity modification |
| DATA_DELETE | DELETE | Soft/hard deletion |
| DATA_READ | READ | Sensitive data access |
| DATA_EXPORT | EXPORT | Bulk data export/download |
| STATE_TRANSITION | TRANSITION | Status/lifecycle changes |
| FINANCIAL | FINANCIAL | Payments, orders, subscriptions, invoices |
| SECURITY | SECURITY | Lockouts, failed attempts, suspicious activity |
| ADMIN_ACTION | ADMIN | Administrative operations |
| SYSTEM_EVENT | SYSTEM | Automated jobs, webhooks, scheduled tasks |
| INTEGRATION | INTEGRATION | External API calls, webhooks received |
| FILE_OPERATION | FILE | Upload, download, delete |
| CONFIGURATION | CONFIG | Settings, feature flags, templates |

### Severity Levels
| Level | Code | Examples |
|-------|------|----------|
| INFO | 10 | Read access, list views, non-sensitive queries |
| LOW | 20 | Successful login, profile view, tag scan |
| MEDIUM | 30 | Data updates, password change, tag redemption |
| HIGH | 40 | Financial transactions, privilege changes, deletions |
| CRITICAL | 50 | Security config changes, bulk operations, data exports, failed auth |

---

## 7. Implementation Priority

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] New AuditEvent schema with all required fields
- [ ] Centralized AuditService with async write path
- [ ] Request middleware for correlation IDs
- [ ] Redaction/masking policy for sensitive fields
- [ ] Database indexes for query performance

### Phase 2: Authentication & Security (Week 2-3)
- [ ] Instrument all auth routes
- [ ] Session/token lifecycle events
- [ ] Failed attempt tracking with risk scoring
- [ ] MFA enrollment/verification events

### Phase 3: Admin & RBAC (Week 3-4)
- [ ] Complete admin route coverage (add READ auditing)
- [ ] RBAC change events with full before/after
- [ ] Impersonation/delegation tracking
- [ ] Configuration change events

### Phase 4: Customer Portal (Week 4-5)
- [ ] Pet/Tag/Order CRUD auditing
- [ ] Tag redemption/replacement flow
- [ ] Lost/Found pet events
- [ ] Subscription self-service

### Phase 5: Finder & Public (Week 5-6)
- [ ] Tag scan/view events
- [ ] Notify owner flow
- [ ] Location sharing (with privacy controls)
- [ ] Anonymous access with correlation

### Phase 6: Financial & Integrations (Week 6-7)
- [ ] Webhook event correlation
- [ ] Payment lifecycle events
- [ ] Subscription billing events
- [ ] Invoice access/download

### Phase 7: Background Jobs & Files (Week 7-8)
- [ ] Scheduled job execution events
- [ ] File upload/delete events
- [ ] Automated notification events
- [ ] Referral/push token events

### Phase 8: Advanced Features (Week 8-10)
- [ ] Tamper-evident hash chaining (per-stream)
- [ ] Retention policy engine
- [ ] Audit query API with filtering
- [ ] Admin audit dashboard
- [ ] Alerting on audit failures
- [ ] Compliance reporting

---

## 8. Technical Architecture Decisions

### Write Path
- **Async Fire-and-Forget** with bounded queue for non-critical events
- **Synchronous** for CRITICAL/HIGH severity (auth, financial, security)
- **Transactional Outbox** pattern for database mutations (write audit in same transaction)
- **Dead Letter Queue** for failed audit writes with alerting

### Storage
- **Primary:** MongoDB collection `AuditEvent` (separate from `AuditLog`)
- **Archive:** Cold storage (S3/R2) after retention period
- **Indexing:** Compound indexes for query patterns
- **Partitioning:** By date (monthly collections) for performance

### Tamper Evidence
- **Per-Stream Hash Chaining:** Each actor/entity stream has independent chain
- **Event Hash:** SHA-256 of canonical event JSON
- **Previous Hash:** Links to previous event in same stream
- **Periodic Anchoring:** Merkle root to immutable storage (future)

### Privacy & Compliance
- **Field-Level Redaction:** Configurable per field type
- **PII Minimization:** Hash emails/IPs in audit, store full only in secure context
- **Right to Erasure:** Audit events anonymized (not deleted) on user deletion request
- **Legal Hold:** Flag to prevent archival/deletion

---

## 9. Testing Strategy

| Test Type | Coverage Target |
|-----------|-----------------|
| Unit Tests | AuditService, redaction, hash chaining, correlation ID propagation |
| Integration Tests | Each route generates correct audit event with all fields |
| Contract Tests | Audit event schema validation |
| Load Tests | Audit pipeline under 1000 req/s |
| Chaos Tests | Audit DB unavailable, queue full, network partition |
| Security Tests | Tamper detection, injection attempts, PII leakage |
| Compliance Tests | Retention enforcement, legal hold, anonymization |

---

## 10. Remaining Audit Gaps (Post-Implementation Checklist)

After implementation, verify ZERO gaps in:

- [ ] Every mutation route (POST/PUT/PATCH/DELETE) generates audit event
- [ ] Every sensitive read route (GET financial/PII) generates READ event
- [ ] Every auth route generates appropriate AUTH events
- [ ] Every webhook handler generates INTEGRATION events with correlation
- [ ] Every scheduled job generates SYSTEM events with job_id
- [ ] Every file operation generates FILE events
- [ ] Every RBAC change generates AUTHZ events with full diff
- [ ] Failed operations generate events with outcome=FAILED
- [ ] Bulk operations generate parent + child events
- [ ] Correlation IDs flow through entire request lifecycle
- [ ] Actor type correctly identified (USER/ADMIN/SERVICE/SYSTEM/WEBHOOK)
- [ ] Sensitive fields redacted in all events
- [ ] Hash chain verifiable for each stream
- [ ] Audit events immutable (no UPDATE/DELETE via app APIs)
- [ ] Retention policies enforced
- [ ] Query API supports all investigation patterns

---

## 11. Approval & Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Security Lead | | | |
| Compliance Officer | | | |
| Engineering Lead | | | |
| Product Owner | | | |

---

*This matrix is a living document. Update as implementation progresses.*