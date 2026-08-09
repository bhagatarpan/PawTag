# PawTag Audit Coverage Matrix — Verified Current State

**Last updated:** 2026-08-09 (verified against code, not inferred)
**Verification method:** Full-codebase discovery + inline inspection of every API route, service, job, middleware, model, seed, and app page that touches audit data. Repo tree, exact line numbers quoted below reflect the state at verification time.
**Status:** `COVERED` / `PARTIAL` / `UNSEEDED` / `GAP` / `BREAKING`.

> The current implementation also includes completed-request auditing for business/security API traffic and configurable category/actor policy controls. References below to the removed legacy `AuditLog` pipeline are historical notes and should not be treated as active code paths.

---

## 0. Purpose

Per the Enterprise Audit-Logging requirements doc, this file is the living Initial/Final Coverage Matrix. It records, for every meaningful state change / security event / data access / automated action / integration event:

- source location (file + line)
- entity / resource
- actor recorded (and whether it is correct)
- audit event actually emitted (`AuditEvent` new pipeline vs legacy `AuditLog`)
- whether the event is correct (before/after, attribution, outcome)
- what is missing

---

## 1. Architecture — what actually exists

### 1.1 Dual audit backends (they do NOT interoperate)

| | New pipeline (`AuditEvent`) | Legacy pipeline (`AuditLog`) |
|---|---|---|
| Model | `packages/db/src/models/AuditEvent.ts` (collection `audit_events`) | `packages/db/src/models/AuditLog.ts` (collection `auditlogs`) |
| Event identity | `auditEventId` UUIDv7, unique index | Mongoose `_id` only |
| Correlation | `transactionId`, `correlationId`, `requestId`, `traceId`, `parentEventId`, `eventSequenceNumber` | none |
| Actor model | `actorType` (USER/ADMIN/CSR/WEB_EDITOR/DESIGNER/AUTHOR/SERVICE/SYSTEM/SCHEDULED_JOB/API_CLIENT/WEBHOOK/AI_AGENT/FINDER/UNKNOWN), `actorId/Username/Email`, `impersonatorId`, `delegatedById`, `sessionId`, `authenticationMethod` | `userId` only (always required) |
| Classification | `action`, `eventType`, `eventCategory`, `operationType`, `resourceType`, `resourceId`, `businessOperation`, `reason`, `status`, `outcome` (SUCCESS/FAILURE/PARTIAL/PENDING), `severity` | `action`, `entity`, `entityId` only |
| State | `beforeState`, `afterState`, `changedFields[]`, `before/afterStateHash` | `changes` (un-typed, un-examined) |
| Sensitive redaction | Central `deepRedact`/`redactValue` in `audit.service.ts` | none (raw `changes` stored) |
| Hash / tamper-evidence | `eventHash`, `previousEventHash`, `hashAlgorithm` (SHA-256) | none |
| Immutability flag | `isImmutable: true` (default) + `legalHold` + retention | none |
| Retention | retention policy engine, `retentionExpiresAt`, enforcement endpoint | none |
| Writer call site form | `auditService.log(context, input)` via per-module helpers | direct `AuditLog.create({...})` |

Key files: `packages/api/src/services/audit/audit.service.ts`, `audit.retention.ts`, `audit.transaction.ts`, `packages/api/src/middleware/audit.ts`, `packages/api/src/routes/audit.ts`, `packages/api/src/routes/admin.ts` (legacy query), `apps/admin/src/pages/AuditLogs.tsx` (legacy UI).

### 1.2 Middleware (`index.ts` wiring)

- `auditMiddleware` is mounted globally (index.ts:88) **before all routes**. It sets `req.auditContext` (requestId/correlationId/traceId/transactionId, IP, forwardedIp, UA, deviceId, app name/version, env, optional `x-tenant-id`), and wraps `res.send` to stamp `durationMs`.
- **It does NOT emit any audit event.** Every persisted event is explicit manual (by design — no noise from GETs).
- `setAuditActor()` (middleware/audit.ts:71) is now **called by `authenticate`** (auth.ts:61-65), so `req.auditContext` carries actorId/actorEmail for every authenticated request.
- `requirePermission` (middleware/permission.ts) now emits `AUTHZ_FAILURE` (outcome FAILURE) for 401/403/500 denials.
- `verificationGuard.ts` rejection paths still silent (future phase).

### 1.3 Audit management API (routes/audit.ts — mounted at `/api/admin/audit`)

- `GET /` (full search/filter: id/correlation/request/trace/parent/actor/tenant/category/type/action/operation/resource/outcome/severity/IP/date-range/legalHold)
- `GET /stats`, `GET /transaction/:id`, `GET /correlation/:id`, `GET /entity/:type/:id`, `GET /actor/:actorId`
- `GET /verify-chain` (hash-chain verification endpoint)
- `POST/DELETE /legal-hold`, `POST /retention/enforce`

**RESOLVED:** `audit.read` / `audit.admin` are now seeded (seed.ts:301-302) and assigned to the ADMIN role (seed.ts:503-504). Admin UI: new `apps/admin/src/pages/AuditTrail.tsx` (route `/audit-trail`, sidebar entry with `audit.read`) queries `GET /api/admin/audit`, incl. filters, pagination and a **Verify Integrity** button hitting `/verify-chain`.

### 1.4 Admin UI (apps/admin/src/pages/AuditLogs.tsx — legacy)

- Reads `GET /api/admin/audit-logs` (admin.ts) → legacy `AuditLog` collection. Still shown under "Legacy Audit Log" for historical data.
- **New** `AuditTrail.tsx` (see §1.3) is the primary view over the tamper-evident `AuditEvent` stream.

---

## 2. Verified integrity & correctness results (status after PH1+PH2 remediation)

| # | Finding | Status after remediation |
|---|---|---|
| 1 | **Hash chain was broken** (per-stream in-memory `Map`; global `verifyChain` walker resets on restart). | ✅ **FIXED** — per-stream chain seeded from **DB** (`findLatestStreamHash`), `verifyHashChain` verifies per stream (tests + API endpoint). |
| 2 | **Transactional audit unused** (`AuditTransaction`/`withAuditTransaction` never imported; no outbox). | ⚠️ REMAINING — future phase. |
| 3 | **Actor attribution wrong in hot paths** — `authenticate` never called `setAuditActor`; `token_refresh` + subscription renew/cancel/created mislabeled. | ✅ **FIXED** — `authenticate` calls `setAuditActor` (auth.ts:61-65); `token_refresh` actor is USER; renew = SCHEDULED_JOB with actorId/email. |
| 4 | **Failures almost never audited** (login, locked, MFA OTP, reset, reuse, permission, Zod, 5xx). | ✅ **PARTIALLY FIXED** — login_failure/blocked, mfa_failed/blocked, AUTHZ_FAILURE (permission.ts), validation failure, login MFA. Admin-refund FAILURE + a few rare paths still open. |
| 5 | **Two backends; UI reads legacy + new API unreachable (unseeded perms).** | ✅ **FIXED** — `audit.read`/`audit.admin` seeded (seed.ts:301-302, 503-504); `AuditTrail.tsx` wired to `/api/admin/audit`. |
| 6 | **Legacy `AuditLog` has no redaction/outcome/chain; RBAC still dumps `req.body`.** | ⚠️ REMAINING — RBAC migration is a future phase. |

---

## 3. Initial Audit Coverage Matrix

Legend — Status: `COVERED` `PARTIAL` `GAP` `BREAKING`. Current Audit column: event name(s) actually emitted today; **(none)** and **`FAIL`** annotated where audited only success.

### 3.1 AUTHENTICATION & SECURITY — `routes/auth.ts`

| Operation | Location | Entity/Resource | Actor (recorded / correct?) | Current audit event | Correct? | Missing | Proposed event | Risk |
|---|---|---|---|---|---|---|---|---|
| Register | auth.ts:142-222 | User | USER / n/a pre-auth | `user_registration` (SUCCESS, MEDIUM) | Partial (no actorId; no `FAIL` on duplicate/409) | failure path, actorId | `auth.user_registration` (incl. outcome) | HIGH |
| Login w/o MFA (success) | auth.ts:460-470 | User/session | USER | `user_login` (SUCCESS, LOW) | Partial (no actorId) | — | — | med |
| Login failure (wrong pw/user) | auth.ts:279-334 | User | USER | **(none)** | — | FAIL event + attempt count | `auth.login_failed` | **CRITICAL** |
| Login locked account | auth.ts:285-293,423 | User | — | **(none)** | — | FAIL event | `auth.login_blocked_locked` | HIGH |
| Account lockout | auth.ts:310-320 | User | SYSTEM | `account_lockout` (SECURITY, HIGH, SUCCESS) | Yes | unlock counterpart not audited | `auth.account_unlocked` | HIGH |
| Login MFA) | auth.ts:426-436 | VerificationToken | USER | `mfa_otp_sent` | Yes | — | — | MEDIUM |
| MFA verify success | auth.ts:1506-1533 | session/tokens | USER | `mfa_verification` (SUCCESS, MEDIUM) | Partial (no actorId) | MFA failure + attempts | `auth.mfa_failed`, `auth.mfa_max_attempts` | CRITICAL |
| Email verify success | auth.ts:560-570 | User | USER (token) | `email_verification` | Yes | failure/no | `auth.email_verification_failed` | LOW |
| Reset-password request | auth.ts:1057-1106 | VerificationToken | USER (pre-auth) | `password_reset_request` (HIGH) | Yes | none | — | MEDIUM |
| Reset-password complete | auth.ts:1142-1152 | User | USER | `password_reset_complete` (HIGH) | Yes | invalid/expired token attempt | `auth.password_reset_failed` | HIGH |
| Change-password | auth.ts:1210-1220 | User | USER | `password_change` (HIGH) | Partial | **wrong-currentpassword** not audited | `auth.password_change_failed` | HIGH |
| Refresh token (renew) | auth.ts:1256-1270 | tokens | SERVICE (mislabeled, should be USER) | `token_refresh` (LOW) | No (actorSERVICE); no FAILURE | use-reuse/rot failure | `auth.token_refresh_failed` | HIGH |
| Refresh token reuse | auth.ts:1240-1256 | token | — | **(none)** | — | replay detection | `auth.token_refresh_reuse` | **CRITICAL** |
| Logout | auth.ts:1292-1308 | RefreshToken | USER/UNKNOWN | `user_logout` (LOW) | Partial (actor ok) | — | `token_refresh_failed` | LOW |
| Send/verify phone OTP | auth.ts:668-916 | VerificationToken/User | USER | `phone_otp_send`, `phone_verification` | Partial | OTP failure/attempts | `auth.phone_otp_failed` | MEDIUM |
| Profile update | auth.ts:1185-1196 | User | USER | **(NONE)** | — | whole mutation | `user.profile_update` | MEDIUM |

NOTE — `PUT /auth/profile` unaudited (whole mutation). `auditAuthEvent` (a98-113) drops `req.user` fidelity.

**Net:** 0 failed-operation events in the whole auth module. This is the biggest security hole.

### 3.2 ADMIN (routes/admin.ts, admin-subscriptions.ts, admin-analytics.ts)

`auditAdminEvent` (admin.ts:54-69) writes `AuditEvent` actorType ADMIN; actorId/email injected. No FAILURE outcomes anywhere. No READ auditing.

| Operation | Lines | Entity | Current Audit | Correct? | Missing | Risk |
|---|---|---|---|---|---|---|
| Assign role | 428-487 | User/UserRole | `user_role_update` (AUTHZ/HIGH) | Partial — metada `legacyRole: user.role` read *after* mutation (L480) → stores NEW | before/after roles | HIGH |
| Status change | 527-553 | User | `user_status_update` | Yes (`oldStatus` pre-captured) | — | HIGH |
| Admin reset-password | 556-585 | User | `admin_password_reset` | Yes | 5xx/failure | HIGH |
| Lock account | 588-616 | User | `user_account_lock` | Yes | — | HIGH |
| Unlock account | 619-647 | User | `user_account_unlock` | Yes | — | HIGH |
| **Update user profile** | 650-691 | User | `user_profile_update` | Yes — per-field `{old,new}` built before assign | `FAIL` for 409 duplicate-email | MEDIUM |
| Soft delete user | 697-721 | User | `user_delete` (DELETE/HIGH) | Yes | delete-reason not captured | HIGH |
| Create owner | 759-833 | User | `admin_user_create` | Yes | — | MEDIUM |
| Create pet | 861-905 | Pet | `admin_pet_create` | Yes | — | MEDIUM |
| **Update pet** | 942-973 | Pet | `admin_pet_update` | **BREAKING — `Object.assign(pet,req.body)` then `before: pet.get(field)` (947-952) → before==after** | fix snapshot-before | MEDIUM |
| Soft delete pet | 1001-1025 | Pet | `admin_pet_delete` | Yes | — | HIGH |
| Pet status | 1209-1235 | Pet | `admin_pet_status_update` | Yes (`oldStatus` pre) | no transition validate | MEDIUM |
| Create tag | 1363-1416 | Tag | `admin_tag_create` | Yes | — | MEDIUM |
| Update tag | 1485-1544 | Tag | `admin_tag_update` | Yes (`oldValues` pre) | — | MEDIUM |
| Delete tag | 1566-1587 | Tag | `admin_tag_suite_delete` | Yes | — | HIGH |
| Create product | 1967-1987 | Product | `admin_product_create` | Yes | — | MEDIUM |
| **Update product** | 2034-2063 | Product | `admin_product_update` | **BREAKING — `findByIdAndUpdate({new:true})` (2036) → before unavailable, `before==after`** | **fetch→snapshot→update→diff** | MEDIUM |
| Hard delete product | 2091-2112 | Product | `admin_product_delete` | Yes | — | HIGH |
| Order status | 2235-2277 | Order | `admin_order_status_update` | Yes (`previousStatus` pre) | invalid transition 4xx not audited | HIGH |
| Cancel order | 2283-2329 | Order + stock | `admin_order_cancel` | Yes | stock restore detail | **CRITICAL** |
| Refund order | 2332-2391 | Order + Stripe | `admin_order_refund` | Partial — **Stripe refund failure (2356-2359) NOT audited** | outcome FAIL | **CRITICAL** |
| Create shipment | 2394-2462 | Order | `admin_order_shipment_create` | Partial — `changedFields` hard-codes `before:null` for trackingNumber/carrier | real pre-values | HIGH |
| Mark delivered | 2465-2504 | Order | `admin_order_delivered` | Yes | — | HIGH |
| Skip invoice OTP | 2507-2539 | User | `user_skip_invoice_otp` (CONFIG) | Approx `before: !skip` (doesn't read stored) | real before | MEDIUM |
| Tag-expiry ack | 2573-2585 | TagExpiryNotification | **(NONE)** | `findByIdAndUpdate({new:true})` | ADD | LOW |
| Admin notification read/mark-all | 2619-2635 | Notification | **(NONE)** | bulk op | ADD (bulk parent) | LOW |
| Content CRUD | 2759-2854 | SiteContent | **(NONE)** | incl. `{new:true}` update | ADD | MEDIUM |
| Settings read | — | Setting | **(NONE)** | *business-critical config* | ADD | **HIGH** |
| Settings create/update | 2931-2997 | Setting | **(NONE)** (PUT/POST/DELETE) | `findOneAndUpdate({new:true})` | **ADD** (MFA/test-mail dimensions) | **CRITICAL** |
| Feature-flag CRUD | 3058-3145 | FeatureFlag | **(NONE)** | `{new:true}` | ADD | **CRITICAL** config change |
| `GET /audit-logs` | 3186-3207 | AuditLog (legacy) | read — no event | reads **legacy** collection | — | — |

**admin-subscriptions.t` — whole file unaudited:** `PUT /subscriptions/:id/status` (alt route 168-209, also writes `Tag`) and `POST /:id/extend` (220-280, mutates 3 entities + invoice) have **no audit import at all**.
**admin-analytics.ts** — read-only, no risk.

### 3.3 CUSTOMER (routes/customer.ts) — server-side

`auditCustomerEvent` (customer.ts:18-35) injects `req.user` actor — correct pattern.

| Operation | Lines | Audit | Note |
|---|---|---|---|
| Pet create/update/delete | 170/236/306 | COVERED | update snapshot **correct** (before captured pre-`Object.assign`) |
| mark-lost / mark-found | 613/682 | COVERED | oldStatus pre-captured; tag flips collapsed to metadata |
| Tag redeem | 399-474 | COVERED (HIGH) | old-tag deactivation only in metadata, not separate event |
| Tag replacement | 476-547 | COVERED (HIGH) | — |
| Order create | 983-1160 | COVERED (FINANCIAL/HIGH) | stock decrement inside handler not separate event |
| Confirm payment | 1201-1263 | **(NONE)** in customer.ts | sub-created logged via service as `SCHEDULED_JOB` actor; email/invoice only legacy in webhook path |
| mark-terminal | 1460-1481 | (NONE) | flips tag inactive too — **GAP** |
| Cart (GET create, add, update, del, clear) | 779-894 | **(NONE)** | — |
| Notifications read/mark-all/clear | 1382-1492 | (NONE) | bulk destruct deleteMany(clear-read) unaudited |
| Notification preferences PUT | 1533-1553 | (NONE) | `$set` subfields |
| MFA toggle | 1989-2013 | **legacy `AuditLog.create` only** (2007) | NOT in `AuditEvent` + gated on `pe.read` permission (wrong gate) |

### 3.4 CUSTOMER MEDICAL / HEALTH sub-documents (customer.ts:1565-1986)

`pet.<vaccinations|microchips|medications|allergies|vetDetails|surgeries|weightHistory|healthConditions|desexing>`

- 24 endpoints, **all un-audited**, **no before snapshots** (handlers `push`/`Object.assign`/`deleteOne` then `pet.save()`, then return).
- Each: POST create, PUT update, DELETE — no events. This is the largest single GAP by count.

### 3.5 SUBSCRIPTIONS — automated vs user

| Operation | Source | Audit | Gotchas |
|---|---|---|---|
| Cancel via customer | subscription.service.ts:210-244 | audit `subscription_cancelled` | `newStatus:'cancelled'` claim NEVER set (only autoRenew=false + timestamps) **record claim does not match data** |
| Renew via customer | subscription.service.ts:187-205 | audit present | actor mislabeled `SCHEDULED_JOB` toward end-user action |
| Auto-renew toggle | customer-subscriptions.ts:243-247 | **(NONE)** | direct save |
| Change plan | subscription.service.ts:701-716 | **(NONE)** | direct |
| Portal-link create | customer-subscriptions.ts:313- **369** | **(NONE)** | external call + bulk `updateMany` |
| Auto-renewals loop | subscription.service.ts:247-295 | **(NONE)** | each save + invoice un-audited — central |
| checkExpiring/expired/grace | subscription.service.ts:297-513 | aggregate audit only `>0` events | when 0 affected silent |
| changeTagExpiryNotifications | 556-661 | (NONE) | admin notif creation |
| resetExpiredSkipOtp | 587- replicate | (NONE) | bulk `updateMany` |
| changeSubscriptionPlan | 683-715 | (NONE) | — |

### 3.6 RBAC (routes/rbac.ts) — all legacy `AuditLog.create` (18 calls)

| Operation | Audit | Issue |
|---|---|---|
| PermissionGroup CRUD | COVERED | update dumps `req.body` — no before |
| Permission CRUD/deactivate | COVERED | 143 etc. omits permissionGroupId link; 163 dumps body |
| Role CRUD/clone | COVERED | Role delete cascades RolePermission but cascade not separately logged; update dumps body |
| RolePermission assign/update/remove | COVERED | 344,356 — omits scopeId; no before |
| PermissionScope update/delete | **UNSEEDED** (407-431 — none audit call) | — |
| UserRole assign/remove | COVERED | 466,478,502; re-activate path logs `assign_role` incl. old data lost; super-admin guard fails to audio |
| Reads | — | permission check reads unlogged |

### 3.7 FINDER (public, routes/finder.ts)

| Op | Audit | Notes |
|---|---|---|
| View pet (active tag) | COVERED `finder_view_pet` (READ/MEDIUM, actor FINDER) | provided subscription counts incremented; scan record |
| View pet (expired tag) | **GAP (155-173)** | scan is created / not audited |
| Notify owner | COVERED | finder_share |
| share-location (GPS) | COVERED | — |
| found-timer / stats / shop / content | none | read-only, low risk per policy |

### 3.8 WEBHOOKS (routes/webhooks.ts)

- `auditWebhookEvent` (16-40): actor WEBHOOK/stripe; **ignores req entirely — no correlation IDs**, fire-and-forget, no catch.
- Main events: payment_intent.succeeded/failed, invoice.payment.succeeded/failed, subscription.deleted — all get `payment_succeeded`/etc. FINANCIAL/HIGH events. **BUT:**
  - **No Stripe signature verification** (auth comment; demo + real both read `req.body` unverified)
  - failed signature / unknown event / replay dedup → no audit (only `logger.info`)
  - subscript side-effects: tag auto-create, referral invoke, invoice HTML, emails → only legacy `AuditLog.create` (389-404) or nothing.

### 3.9 FILES (routes/upload.ts)

- POST pet-photo, product-images (multer), DELETE product-images — **no audit** (no import) → **GAP**.

### 3.10 JOBS / SERVICES

- `lowStockCheck` — logs `low_stock_check` (SCHEDULED_JOB) BUT **empty-result early-return un-audited** (lowStockCheck.ts:42-44)
- `reminderService.sendFinderReminders` — per-send `finder_reminder_sent` logged; none+result unlogged
- subscription.service aggregates only logged when >0
- **referral.service.ts — NO audit anywhere** (ReferralCode upsert, Referral.create, reward completion extends subscriptions − CRITICAL financial GAP)
- inventory.service.ts restoreOrderStock — no audit (payment-fail stock rollback)
- notification-delivery service — all notifications unworthy? (always covered by parent event if parent audited; many parents unaudited though)
- stripe.service refunds/demo sims — no audit

---

## 4. Cross-cutting engineering gaps (all the spec items)

| Spec requirement | Status |
|---|---|
| Central `auditService` (event→) | PARTIAL — good core; hash chain broken; no outbox; no DLQ |
| Actor propagation (TH: §9) | PARTIAL — dead `setAuditActor`; auth events no actorId; jobs-sync correct only for pure jobs |
| Correlation through the full request | PARTIAL — request helpers propagate; webhook/job contexts **fresh with no IDs** |
| Failure/denied auditing (§10, §18) | **GAP** — almost zero FAILURE outcomes |
| Before/after + diff (§13) | PARTIAL — 2 known admin bugs; legacy body dumps; created-doc `{new:true}` patterns |
| Redaction (§22) | OK new pipeline; legacy = raw |
| Transaction/outbox (§23) | GAP — unused `AuditTransaction` |
| Bulk operations (§24) | just a few aggregate events; no parent/count/affected-IDs strategy |
| Tamper-evidence (§25-26) | BREAKING — verified chain broken/testless |
| Multi-tenant isolation (§27) | single-tenant application today; `tenantId` plumbed but not enforced anywhere |
| Retention/archival (§28) | Policy engine OK — real archival is NOOP (flag set, nothing moved); enforcement deletes |
| Query API (§34) | blocked by unseeded permission |
| Failure observability (§31-32) | PARTIAL — queue stats endpoint; finder/webhook helper fire-and-forget, no catch, no alerts, no metrics |
| Schema versioning (§33) | `schemaVersion: 1` present, versioning strategy undocumented |
| Monitoring/alerting (§38-39) | none implemented |

---

## 5. Automated test state (verified)

- Existing audit assertions: `tests/integration/tag-replacement.test.ts` (1 `AuditEvent`), `tests/integration/purchase-emails.test.ts` (legacy `AuditLog`).
- **New this remediation pass:**
  - `tests/unit/audit.hashchain.test.ts` — 5 tests: single-stream verify valid; tamper (hash mismatch) detected; broken previous-hash link detected; streamKey-scoped verify; DB-driven buckets across restart.
  - `tests/unit/audit.redaction.test.ts` — 4 tests: sensitive-pattern detection; nested redaction; scalar `redactValue`; deterministic/order-independent `computeHash`.
  - `tests/integration/audit-api.test.ts` — 5 tests: admin can query `/api/admin/audit`; setting update before/after diff (CONFIG/HIGH); feature-flag `isEnabled` before/after (CRITICAL); `/verify-chain` end-to-end valid over multi-stream events; content create+delete audited with ADMIN actor.
- `pnpm test:all` result at remediation time: **860 tests, 859 pass** (1 pre-existing failure in `admin-analytics.test.ts` that also fails on clean `main`).

---

## 6. Known issues needing action (top actionable bugs)

### 6.1 Resolved (this remediation pass)

1. ✅ **Hash chain fixed & per-stream.** `persistEvent` chains per-stream (`actorType|resourceType|resourceId`) and seeds `previousEventHash` from the **DB** (persisted across restarts) — `findLatestStreamHash` (audit.service.ts:205-221). `verifyHashChain` verifies **per stream** from DB buckets, matching persist semantics. Verified by `tests/unit/audit.hashchain.test.ts` and `GET /api/admin/audit/verify-chain` in `tests/integration/audit-api.test.ts`.
2. ✅ **before==after bugs fixed.** `PUT /admin/pets/:id` and `PUT /admin/products/:id` now **fetch→snapshot→update→diff** before/after.
3. ✅ **Failure auditing added.** `login_failure`/`login_blocked`/`login_lockout`/`mfa_failed`/`mfa_blocked` in `auth.ts`; AUTHZ_FAILURE on 401/403/500 in `permission.ts`; validation FAILURE in `validation.ts`.
4. ✅ **Permissions seeded + admin UI.** `audit.read`, `audit.admin` in `seed.ts` (ADMIN role). New `apps/admin/src/pages/AuditTrail.tsx` reads `GET /api/admin/audit` (route `/audit-trail`, sidebar entry), incl. Verify-Integrity button, filters, pagination.
5. ✅ **Actor attribution fixed.** `authenticate` calls `setAuditActor` → `req.auditContext.actorId/Email` populated for every authenticated request; `token_refresh` actor fixed to USER.
6. ✅ **PH2 domain coverage added.** See §7 for the added streams: admin settings/feature-flags/content CRUD (CONFIG/CRITICAL), customer confirm-payment (FINANCIAL), medical/health sub-docs (24 endpoints), MFA toggle migrated from legacy `AuditLog`→`AuditEvent`, subscription auto-renew/plan-change/portal, referral code/reward (FINANCIAL), inventory stock-restore, low-stock empty-result, uploads (FILE), expired-tag finder view, webhook signature/unknown/payment-failed (SECURITY/FAILURE).
7. ✅ **New tests.** `tests/unit/audit.hashchain.test.ts` (5), `tests/unit/audit.redaction.test.ts` (4), `tests/integration/audit-api.test.ts` (5).

### 6.2. Remaining (future phases)

1. Rbac routes (routes/rbac.ts) still write legacy `AuditLog` — migrate to `auditService`.
2. Transactional audit (`AuditTransaction`/`withAuditTransaction`) still unused — no outbox.
3. Admin refund failure (Stripe) FAILURE outcome still un-audited (very CRITICAL).
4. `PUT /auth/profile` still unaudited (whole mutation).
5. Multi-tenant isolation not enforced; real archival still NOOP.
6. Monitoring/alerting (§39) not implemented.

---

## 7. PH2 additions — new audit streams (this remediation pass)

### 7.1 Admin config (CRITICAL) — `routes/admin.ts`
- `setting_create` / `setting_update` / `setting_delete` (CONFIG/HIGH) with value/category before+after + changedFields; `setting_update` does fetch→snapshot→update→diff.
- `feature_flag_create` / `feature_flag_update` / `feature_flag_delete` (CONFIG/**CRITICAL**) with `isEnabled` before/after.
- `content_create` / `content_update` / `content_delete` (MEDIUM) with status/slug/title snapshots.

### 7.2 Customer financial & security — `routes/customer.ts`
- `order_confirm_payment` (FINANCIAL/HIGH): status pending_payment→paid, payment pending→completed, amount in metadata.
- `pet_mark_terminal` (TRANSITION/HIGH): before/after status + tagsDeactivated metadata (was silent GAP).
- `mfa_enabled` / `mfa_disabled` migrated from legacy `AuditLog` → `AuditEvent` (SECURITY/HIGH) with before/after.
- `notifications_clear_read` / `notifications_mark_all_read` / `notification_preferences_update` (LOW).
- Health records (vaccinations, microchips, medications, allergies, vetDetails, surgeries, weightHistory, healthConditions, desexing) — all create/update/delete instrumented (Pet subdocs, LOW/MEDIUM, before/after + changedFields on edits, beforeState on deletes).
- Cart item create/update/delete + cart clear (Cart, LOW).

### 7.3 Subscriptions — `subscription.service.ts`, `customer-subscriptions.ts`
- `subscription_auto_renewal` per successful auto-renew (FINANCIAL/HIGH) incl. invoice number/amount/currentPeriodEnd when actually saved (fixes empty-result silent gap).
- `subscription_plan_changed` (UPDATE/HIGH) with plan before/after + price.
- `subscription_auto_renew_toggled` (UPDATE/MEDIUM) user actor.
- `subscription_portal_link_created` (INTEGRATION/MEDIUM).

### 7.4 Referrals / inventory / jobs
- `referral_code_created` (CREATE), `referral_created` (FINANCIAL), `referral_reward_completed` (FINANCIAL/HIGH) — was COMPLETELY unaudited (was CRITICAL financial gap).
- `inventory_stock_restored` on payment-failure stock rollback (FINANCIAL/MEDIUM).
- `low_stock_check` now logged even when 0 affected (removed silent early-return); `finder_reminder_check` logged for no-op runs.

### 7.5 Webhooks / uploads / finder
- `stripe_signature_invalid` (SECURITY/FAILURE/HIGH) for missing/invalid signature in real mode.
- `payment.failed` (FINANCIAL/FAILURE/HIGH) with stripeEventId/orderId metadata.
- `webhook_unknown_event` (INFO) for unhandled types.
- `upload_pet_photo`, `upload_product_image`, `upload_product_image_delete` (FILE/MEDIUM).
- `finder_view_expired` (READ/MEDIUM) for expired-tag lookups (previously silent).

---

*This matrix is a living document — update it as the phases are implemented.*
