# PawTag Audit Logging System — Complete Architecture Documentation

> **Purpose:** This document provides a complete, self-contained specification of the PawTag audit logging system. An AI agent given this document should be able to implement an identical audit system from scratch without additional context.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Data Model](#3-data-model)
4. [Middleware Layer](#4-middleware-layer)
5. [Service Layer](#5-service-layer)
6. [Policy Engine](#6-policy-engine)
7. [Business Event Logging](#7-business-event-logging)
8. [Navigation Event Logging](#8-navigation-event-logging)
9. [Hash Chain Integrity](#9-hash-chain-integrity)
10. [Sensitive Data Redaction](#10-sensitive-data-redaction)
11. [Retention & Legal Hold](#11-retention--legal-hold)
12. [CMS Settings (DB-Driven Configuration)](#12-cms-settings-db-driven-configuration)
13. [Admin API Endpoints](#13-admin-api-endpoints)
14. [Admin UI (Audit Trail Page)](#14-admin-ui-audit-trail-page)
15. [Frontend Audit Helpers](#15-frontend-audit-helpers)
16. [RBAC Permissions](#16-rbac-permissions)
17. [Performance & Scaling](#17-performance--scaling)
18. [Security Considerations](#18-security-considerations)
19. [Testing Strategy](#19-testing-strategy)
20. [Configuration Reference](#20-configuration-reference)
21. [File Reference](#21-file-reference)
22. [Implementation Checklist](#22-implementation-checklist)

---

## 1. System Overview

PawTag implements an **enterprise-grade, tamper-evident audit logging system** that tracks all significant actions across the platform. The system provides:

- **Two-layer logging:** Automatic HTTP request logging (middleware) + manual business event logging (route handlers)
- **Human-readable narratives:** Business operations are stored as plain-English descriptions (e.g., "Updated phone number")
- **Tamper-evident hash chain:** Each event is SHA-256 hashed and linked to the previous event in its stream
- **Configurable policy engine:** Admins can toggle logging by event category and actor type
- **Sensitive data redaction:** Passwords, tokens, API keys are automatically redacted
- **Retention management:** Configurable retention periods with legal hold support
- **Full-text search:** Searchable by actor, action, entity, transaction, IP, event type

### Tech Stack

| Component | Technology |
|-----------|------------|
| Database | MongoDB Atlas (via Mongoose ODM) |
| Queue | In-memory array (max 10,000 events, batch size 100, flush every 100ms) |
| Hashing | SHA-256 (Node.js `crypto` module) |
| IDs | UUIDv7 (time-ordered, sortable) |
| Caching | In-memory with 5-second TTL for settings |
| Frontend | React 18, TypeScript, Tailwind CSS, Lucide icons |
| Icons | Lucide React icon system |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT REQUEST                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AUDIT MIDDLEWARE                              │
│  - Generates requestId, correlationId, traceId, transactionId   │
│  - Sets actorType: 'UNKNOWN' by default                         │
│  - Decodes JWT (without verification) for potential actor ID    │
│  - Captures sourceIp, userAgent, deviceId                       │
│  - Overrides res.send to capture durationMs                     │
│  - Listens for res.finish → fire-and-forget audit log           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AUTH MIDDLEWARE                                │
│  - Verifies JWT token                                           │
│  - Fetches user's fullName from DB                              │
│  - Calls setAuditActor() with:                                  │
│    actorType, actorId, actorEmail, actorUsername (fullName)     │
│    authenticationMethod: 'jwt'                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ROUTE HANDLER                                 │
│  - May call auditCustomerEvent() / auditAdminEvent()            │
│  - Sets businessOperation: 'Updated phone number'               │
│  - Sets beforeState, afterState, changedFields                  │
│  - May include navigation audit for page-level GETs             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AUDIT SERVICE                                 │
│  - Checks policy engine (isAuditEnabled)                        │
│  - Redacts sensitive fields                                     │
│  - Computes before/after state hashes                           │
│  - Builds event hash (SHA-256) linked to previous event         │
│  - Routes to:                                                   │
│    - Immediate persist (CRITICAL/HIGH severity)                 │
│    - In-memory queue (NORMAL/LOW severity)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MONGODB                                      │
│  Collection: audit_events                                       │
│  - 25+ indexes for query performance                            │
│  - Hash chain for tamper detection                              │
│  - Retention policies with expiry dates                         │
│  - Legal hold support                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### AuditEvent Collection

**Database:** `audit_events`
**File:** `packages/db/src/models/AuditEvent.ts`

#### Core Identifiers

| Field | Type | Description |
|-------|------|-------------|
| `auditEventId` | String (UUIDv7) | Unique event identifier, indexed, unique |
| `transactionId` | String? | Groups related events in a single transaction |
| `correlationId` | String? | Links events across services |
| `requestId` | String? | Unique per HTTP request |
| `traceId` | String? | Distributed tracing identifier |
| `parentEventId` | String? | Links child events to parent |
| `eventSequenceNumber` | Number | Order within a transaction |

#### Timing

| Field | Type | Description |
|-------|------|-------------|
| `occurredAt` | Date | When the event happened |
| `recordedAt` | Date | When the event was stored |
| `durationMs` | Number? | Request duration in milliseconds |

#### Actor Information

| Field | Type | Description |
|-------|------|-------------|
| `actorType` | ActorType | WHO: USER, ADMIN, CSR, FINDER, SYSTEM, etc. |
| `actorId` | String? | User's MongoDB `_id` |
| `actorUsername` | String? | User's display name (fullName) |
| `actorEmail` | String? | User's email address |
| `impersonatorId` | String? | Admin impersonating another user |
| `delegatedById` | String? | User who delegated access |
| `sessionId` | String? | Session identifier |
| `authenticationMethod` | String? | 'jwt', 'api_key', 'session', etc. |
| `authenticationContext` | Object? | Additional auth metadata |

#### Network Information

| Field | Type | Description |
|-------|------|-------------|
| `sourceIp` | String? | Client IP address |
| `forwardedIp` | String? | Forwarded IP (proxy) |
| `userAgent` | String? | Browser/client user agent |
| `deviceId` | String? | Device identifier |
| `applicationName` | String? | Client application name |
| `applicationVersion` | String? | Client version |
| `apiVersion` | String? | API version |
| `environment` | String? | 'development', 'staging', 'production' |

#### Event Details

| Field | Type | Description |
|-------|------|-------------|
| `action` | String | Machine-readable action (e.g., 'profile_updated', 'http_get') |
| `eventType` | String | Event type (e.g., 'profile_update', 'http.request.completed') |
| `eventCategory` | EventCategory | Category: AUTH, CREATE, UPDATE, DELETE, READ, etc. |
| `operationType` | String? | HTTP method or operation type |
| `resourceType` | String? | Entity type (User, Pet, Order, HTTP_ENDPOINT, etc.) |
| `resourceId` | String? | Entity ID |
| `businessOperation` | String? | Human-readable narrative (e.g., "Updated phone number") |
| `reason` | String? | Reason for the action |
| `outcome` | EventOutcome | SUCCESS, FAILURE, PARTIAL, PENDING |
| `status` | String? | HTTP status code or custom status |
| `severity` | EventSeverity | INFO, LOW, MEDIUM, HIGH, CRITICAL |

#### State Changes

| Field | Type | Description |
|-------|------|-------------|
| `beforeState` | Object? | State snapshot before the change |
| `afterState` | Object? | State snapshot after the change |
| `changedFields` | Array? | `[{ field, before, after, sensitive }]` |
| `beforeStateHash` | String? | SHA-256 hash of beforeState |
| `afterStateHash` | String? | SHA-256 hash of afterState |

#### Hash Chain Integrity

| Field | Type | Description |
|-------|------|-------------|
| `streamKey` | String? | Unique stream identifier (actorType\|resourceType\|resourceId) |
| `eventHash` | String? | SHA-256 hash of this event |
| `previousEventHash` | String? | Hash of the previous event in this stream |
| `hashAlgorithm` | String | Always 'sha256' |

#### Lifecycle & Compliance

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | Number | Schema version (for migrations) |
| `tenantId` | String? | Multi-tenant identifier |
| `isImmutable` | Boolean | Prevents modification |
| `legalHold` | Boolean | Prevents deletion |
| `retentionPolicy` | String? | Applied retention policy name |
| `retentionExpiresAt` | Date? | When event can be deleted |
| `archivedAt` | Date? | When event was archived |

### Enums

```typescript
type ActorType = 'USER' | 'ADMIN' | 'CSR' | 'WEB_EDITOR' | 'DESIGNER' | 'AUTHOR' | 'SERVICE' | 'SYSTEM' | 'SCHEDULED_JOB' | 'API_CLIENT' | 'WEBHOOK' | 'AI_AGENT' | 'FINDER' | 'UNKNOWN';

type EventCategory = 'AUTH' | 'AUTHZ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'EXPORT' | 'TRANSITION' | 'FINANCIAL' | 'SECURITY' | 'ADMIN' | 'SYSTEM' | 'INTEGRATION' | 'FILE' | 'CONFIG';

type EventSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

type EventOutcome = 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'PENDING';
```

### Indexes (25+)

The model defines 25+ indexes for query performance:

**Single-field indexes:**
- `auditEventId` (unique), `transactionId`, `correlationId`, `requestId`, `traceId`, `parentEventId`
- `occurredAt`, `actorId`, `actorType`, `sessionId`, `impersonatorId`
- `resourceType`, `resourceId`, `eventCategory`, `severity`, `outcome`
- `streamKey`, `tenantId`, `legalHold`, `retentionExpiresAt`, `archivedAt`, `eventHash`

**Compound indexes:**
- `(actorType, actorId, occurredAt)` — User activity timeline
- `(resourceType, resourceId, occurredAt)` — Entity history
- `(eventCategory, severity, occurredAt)` — Risk analysis
- `(transactionId, eventSequenceNumber)` — Transaction replay
- `(correlationId, occurredAt)` — Cross-service tracing
- `(tenantId, occurredAt)` — Multi-tenant queries
- `(legalHold, retentionExpiresAt)` — Compliance queries

---

## 4. Middleware Layer

**File:** `packages/api/src/middleware/audit.ts`

### Request Flow

1. **Middleware initializes** — Generates IDs, sets `actorType: 'UNKNOWN'`, captures request metadata
2. **Auth middleware runs** — Verifies JWT, sets actor info via `setAuditActor()`
3. **Route handler executes** — May add business event via `auditCustomerEvent()`
4. **Response finishes** — `auditCompletedRequest()` fires asynchronously
5. **Audit service processes** — Policy check → redaction → hashing → persist/queue

### Key Functions

#### `auditMiddleware(req, res, next)`

Runs on every request. Responsibilities:
- Generate `requestId`, `correlationId`, `traceId`, `transactionId` (from headers or new UUIDv7)
- Set `req.auditContext` with all metadata
- Decode JWT without verification for potential actor identification
- Override `res.send` to capture `durationMs`
- Listen for `res.finish` to fire `auditCompletedRequest()`
- Set response headers: `X-Request-ID`, `X-Correlation-ID`, `X-Trace-ID`, `X-Transaction-ID`

#### `setAuditActor(req, actor)`

Called by auth middleware to set actor details:
```typescript
setAuditActor(req, {
  actorType: resolveActorType(role),  // Maps JWT role to ActorType
  actorId: userId,
  actorEmail: email,
  actorUsername: fullName,  // Fetched from DB
  authenticationMethod: 'jwt',
});
```

#### `identifyFromToken(req)`

Decodes JWT **without verification** to extract user info for audit logging when auth fails:
```typescript
const decoded = jwt.decode(token);  // No verification!
if (decoded?.id && decoded?.email) {
  return { actorId: decoded.id, actorEmail: decoded.email, actorUsername: decoded.email.split('@')[0] };
}
```

#### `shouldAuditRequest(req)`

Determines if a request should be audited. Skips:
- `/health`, `/favicon.ico`, `/api/docs`
- `/api/admin/audit` (prevents recursive logging)
- `/api/public/cms`, `/api/finder/shop`, `/api/finder/content`
- `/unread-count`, `/poll` (if `skipPollingEndpoints` setting is enabled)

#### `requestCategory(req)`

Maps HTTP method + path to `EventCategory`:
- `/api/auth/*` → `AUTH`
- `/api/webhooks/*` → `INTEGRATION`
- `GET/HEAD/OPTIONS` → `READ`
- `POST` → `CREATE`
- `PUT/PATCH` → `UPDATE`
- `DELETE` → `DELETE`

#### `auditCompletedRequest(req, res)`

Called on `res.finish`. Builds and logs the audit event:
- If `actorType` is `UNKNOWN` and we have `potentialActorId` from JWT decode, and `identifyAnonymousActors` setting is enabled, use the identified actor info
- Calls `auditService.log()` with the full event

---

## 5. Service Layer

**File:** `packages/api/src/services/audit/audit.service.ts`

### `auditService.log(context, input)`

Main entry point for logging audit events.

**Flow:**
1. **Policy gate:** Check `isAuditEnabled(category, actorType)` — if disabled, return `undefined`
2. **Event assembly:** Build full `IAuditEventDocument` with:
   - Generate `auditEventId` (UUIDv7)
   - Set `occurredAt`, `recordedAt` (Date.now())
   - Copy actor info from context
   - Copy network info from context
   - Set event details from input
   - Compute `beforeStateHash` and `afterStateHash` (SHA-256 of JSON)
   - Apply sensitive field redaction
3. **Priority routing:**
   - `CRITICAL` severity → persist immediately
   - `HIGH` severity → persist immediately
   - `NORMAL`/`LOW` → push to in-memory queue
4. **Queue processing:** Batches of 100 events, flushed every 100ms

### Queue System

```typescript
const MAX_QUEUE_SIZE = 10000;
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 100;
```

- In-memory array (`auditQueue`)
- Priority levels: `critical` > `high` > `normal` > `low`
- Critical/high events bypass queue entirely
- `processQueue()` runs on interval, persists batch, handles errors

### Hash Chain

Each event gets a SHA-256 hash linking it to the previous event in its stream:

```typescript
streamKey = `${actorType}|${resourceType}|${resourceId}`;
eventHash = SHA256({
  auditEventId, transactionId, correlationId, occurredAt,
  actorType, actorId, action, eventType, resourceType, resourceId,
  outcome, beforeStateHash, afterStateHash, previousEventHash, schemaVersion
});
```

### Sensitive Field Redaction

**30+ regex patterns** + **25+ exact field names** are auto-redacted:

```typescript
const SENSITIVE_FIELD_PATTERNS = /password|passwd|secret|token|otp|api[_-]?key|private[_-]?key|credential|cvv|pin/i;
const SENSITIVE_FIELD_NAMES = ['password', 'passwordHash', 'newPassword', 'currentPassword', ...];
```

- `isSensitiveField(name)` — Checks both patterns and exact names
- `redactValue(value, name)` — Returns `'[REDACTED]'` for sensitive fields
- `deepRedact(obj)` — Recursively redacts all nested sensitive fields

---

## 6. Policy Engine

**File:** `packages/api/src/services/audit/audit.policy.ts`

### How It Works

The policy engine controls which audit events are logged based on:
1. **Event category** (AUTH, CREATE, UPDATE, DELETE, READ, etc.)
2. **Actor type** (USER, ADMIN, CSR, FINDER, etc.)

Both must be enabled for an event to be logged.

### Settings (DB-Driven)

```
audit.policy.category.auth = true
audit.policy.category.create = true
audit.policy.category.read = true
audit.policy.actor.user = true
audit.policy.actor.admin = true
audit.policy.actor.finder = true
```

### Caching

- Settings are cached in memory for **5 seconds**
- `getAuditPolicy(forceRefresh?)` reads from DB, updates cache
- `invalidateAuditPolicyCache()` manually busts cache
- **Fail-open design:** If DB is unreachable, all categories/actors default to enabled

### Toggle via Admin UI

Admins can toggle categories and actors via:
- Admin > CMS > Settings > Audit category
- Each category and actor has its own boolean toggle

---

## 7. Business Event Logging

### Pattern

Route handlers call `auditCustomerEvent()` or `auditAdminEvent()` to log business-level events:

```typescript
await auditCustomerEvent(req, {
  action: 'profile_updated',
  eventType: 'profile_update',
  eventCategory: 'AUTH',
  operationType: 'UPDATE',
  resourceType: 'User',
  resourceId: user._id.toString(),
  beforeState: { fullName, email, phoneNumber, address, emergencyContact },
  afterState: { fullName: user.fullName, email: user.email, ... },
  changedFields: [{ field: 'phoneNumber', before: '0211111111', after: '021111111' }],
  outcome: 'SUCCESS',
  severity: 'MEDIUM',
  businessOperation: 'Updated phone number',  // Human-readable narrative
});
```

### Coverage

**46+ business events** in `customer.ts`:
- Pet CRUD, status changes (lost/found/terminal)
- Health records (vaccinations, allergies, medications, microchips, surgeries, weight, conditions, vet details, desexing)
- Tag redemption
- Cart operations
- Order creation
- Notification management
- MFA/privacy settings
- Onboarding completion
- Escalation resolution

**18+ auth events** in `auth.ts`:
- Registration, login, logout
- Password change/reset
- Email/phone verification
- MFA OTP send/verify
- Token refresh
- Profile update (with dynamic narrative)

**3+ subscription events** in `customer-subscriptions.ts`:
- Auto-renew toggle
- Portal link generation

### Business Narratives

Every business event includes a `businessOperation` field with human-readable text:

| Event | Business Operation |
|-------|-------------------|
| `pet_create` | "Created pet 'Blackie'" |
| `pet_mark_lost` | "Marked 'Blackie' as lost" |
| `allergy_create` | "Added allergy 'Egg Shell' for 'Blackie'" |
| `profile_updated` | "Updated phone number" (dynamic) |
| `login` | "Logged in successfully" |
| `register` | "Created new account" |

---

## 8. Navigation Event Logging

Page-level GET endpoints log navigation events:

```typescript
// GET /pets (page-level endpoint)
auditCustomerEvent(req, {
  action: 'view',
  eventType: 'navigation',
  eventCategory: 'READ',
  operationType: 'GET',
  resourceType: 'Navigation',
  outcome: 'SUCCESS',
  severity: 'INFO',
  businessOperation: 'Viewed pets list',
}).catch(() => {});  // Fire-and-forget
```

**Navigation events are added to:**
- `GET /pets` → "Viewed pets list"
- `GET /pets/:id` → "Viewed pet '{name}'"
- `GET /orders` → "Viewed orders"
- `GET /orders/:id` → "Viewed order details"
- `GET /notifications` → "Viewed notifications"

**NOT added to sub-resource endpoints** (e.g., `GET /responsibility` is a badge widget, not a page navigation).

---

## 9. Hash Chain Integrity

### Purpose

Provides **tamper-evident** audit trail. If any event is modified or deleted, the hash chain breaks.

### How It Works

1. Each event gets a `streamKey` = `{actorType}|{resourceType}|{resourceId}`
2. Events in the same stream are linked via `previousEventHash`
3. Each event's hash includes: ID, timestamps, actor, action, resource, outcome, state hashes, previous hash
4. `verifyHashChain(streamKey?, limit?)` checks continuity

### Verification

Admin can verify chain integrity via:
- Admin UI: "Verify Integrity" button
- API: `GET /admin/audit/verify-chain`
- Returns: `{ valid: boolean, checked: number, error?: string }`

---

## 10. Sensitive Data Redaction

### Automatic Redaction

Before persisting, the service automatically redacts:

**Regex patterns (30+):**
```
/password|passwd|secret|token|otp|api[_-]?key|private[_-]?key|credential|cvv|pin/i
```

**Exact field names (25+):**
```
password, passwordHash, newPassword, currentPassword,otp, secret, apiKey, privateKey, ...
```

### What Gets Redacted

| Before | After |
|--------|-------|
| `"password": "mySecret123"` | `"password": "[REDACTED]"` |
| `"token": "abc123..."` | `"token": "[REDACTED]"` |
| `"otp": "123456"` | `"otp": "[REDACTED]"` |

### What Doesn't Get Redacted

- `fullName`, `email`, `phoneNumber` (not sensitive)
- `address`, `emergencyContact` (not sensitive)
- `status`, `role` (not sensitive)

---

## 11. Retention & Legal Hold

### Retention Policies

**File:** `packages/api/src/services/audit/audit.retention.ts`

10 default policies with different retention periods:

| Policy | Category | Severity | Retention |
|--------|----------|----------|-----------|
| `auth_critical` | AUTH | CRITICAL | 2555 days (7 years) |
| `security_high` | SECURITY | HIGH | 1825 days (5 years) |
| `financial` | FINANCIAL | * | 2555 days (7 years) |
| `default` | * | * | 90 days |

### Enforcement

`enforceRetention()` runs periodically:
1. Finds events where `retentionExpiresAt < now` AND `legalHold = false`
2. Deletes expired events
3. Updates `archivedAt` for events being archived

### Legal Hold

- `placeLegalHold(eventIds, reason)` — Sets `legalHold = true`, prevents deletion
- `removeLegalHold(eventIds)` — Removes hold
- Events on legal hold are **never deleted** by retention enforcement

---

## 12. CMS Settings (DB-Driven Configuration)

**All settings stored in `settings` collection, readable via `Setting.findOne({ key })`.**

### Policy Toggles (29 total)

**15 Category toggles:**
```
audit.policy.category.auth = true
audit.policy.category.authz = true
audit.policy.category.create = true
audit.policy.category.update = true
audit.policy.category.delete = true
audit.policy.category.read = true
audit.policy.category.export = true
audit.policy.category.transition = true
audit.policy.category.financial = true
audit.policy.category.security = true
audit.policy.category.admin = true
audit.policy.category.system = true
audit.policy.category.integration = true
audit.policy.category.file = true
audit.policy.category.config = true
```

**14 Actor toggles:**
```
audit.policy.actor.user = true
audit.policy.actor.admin = true
audit.policy.actor.csr = true
audit.policy.actor.web_editor = true
audit.policy.actor.designer = true
audit.policy.actor.author = true
audit.policy.actor.service = true
audit.policy.actor.system = true
audit.policy.actor.scheduled_job = true
audit.policy.actor.api_client = true
audit.policy.actor.webhook = true
audit.policy.actor.ai_agent = true
audit.policy.actor.finder = true
audit.policy.actor.unknown = true
```

### Behavior Settings (2)

```
audit.settings.identifyAnonymousActors = true
audit.settings.skipPollingEndpoints = true
```

| Setting | Default | Description |
|---------|---------|-------------|
| `identifyAnonymousActors` | `true` | When enabled, decodes JWT (without verification) to identify users even when auth fails |
| `skipPollingEndpoints` | `true` | When enabled, skips `/unread-count`, `/poll` from audit logging |

### Admin UI Location

Admin > CMS > Settings > **Audit** category

---

## 13. Admin API Endpoints

### Audit Trail

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/audit` | GET | List audit events (paginated, filtered, searchable) |
| `/api/admin/audit/summary` | GET | Get summary stats (total, today, failed, highRisk, uniqueActors) |
| `/api/admin/audit/verify-chain` | GET | Verify hash chain integrity |
| `/api/admin/audit/export` | GET | Export events as CSV/JSON |
| `/api/admin/audit/entity/:type/:id` | GET | Get entity history (all events for a resource) |

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `page` | Number | Page number (default: 1) |
| `limit` | Number | Page size (default: 50) |
| `search` | String | Full-text search across actor, action, entity, ID, transaction, IP, event type |
| `actorType` | String | Filter by actor type |
| `action` | String | Filter by action group |
| `eventCategory` | String | Filter by category |
| `resourceType` | String | Filter by entity type |
| `resourceId` | String | Filter by entity ID |
| `outcome` | String | Filter by outcome (SUCCESS/FAILURE) |
| `severity` | String | Filter by severity |
| `startDate` | ISO Date | Filter from date |
| `endDate` | ISO Date | Filter to date |
| `sortBy` | String | Sort field (default: occurredAt) |
| `sortDir` | String | Sort direction (asc/desc) |

---

## 14. Admin UI (Audit Trail Page)

**File:** `apps/admin/src/pages/AuditTrail.tsx` (1869 lines)

### Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Page Header: "Audit Logs"                                      │
│  [Verify Integrity] [Export ▾]                                  │
├─────────────────────────────────────────────────────────────────┤
│  Summary Cards: [Total] [Today] [Failed] [High-Risk] [Actors]  │
├─────────────────────────────────────────────────────────────────┤
│  Search Bar (with auto-suggestions, debounced)                  │
├─────────────────────────────────────────────────────────────────┤
│  [Filters] [Today] [Yesterday] [Last 7d] [Last 30d]           │
│  [↑↓ Newest first] [↻ Refresh] [Clear All]                     │
│  Active filter chips                                            │
│  Expanded filter panel (Actor, Action, Category, etc.)         │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ TIME | ACTOR | ACTION | ENTITY | BEFORE | AFTER | RESULT  │ │
│  │      |       |        |        |        |       | SEVERITY │ │
│  ├──────┼───────┼────────┼────────┼────────┼───────┼──────────┤ │
│  │ ...rows with human-readable narratives...                  │ │
│  └────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Pagination: [25/50/100] [← Prev] Page 1 of N [Next →]       │
└─────────────────────────────────────────────────────────────────┘
```

### Grid Columns (8)

| Column | Width | Content |
|--------|-------|---------|
| **Time** | Fixed | Date (primary) + Time (secondary) |
| **Actor** | Flexible | Avatar + Full name (primary) + Email (secondary) |
| **Action** | Flexible | Human-readable label with icon (e.g., "Updated profile") |
| **Entity** | `hidden lg:` | Entity name + changed fields summary |
| **Before** | `hidden xl: min-w-[200px]` | Previous values with field labels |
| **After** | `hidden xl: min-w-[200px]` | New values with field labels |
| **Result** | `hidden md:` | Icon only (CheckCircle/XCircle/AlertCircle/Clock) |
| **Severity** | `hidden xl:` | Icon only (OctagonAlert/AlertTriangle/Info/Circle) |

### Features

- **Auto-complete search:** Suggests from 80+ actions/event types as you type
- **Debounced filtering:** Results update as you type (300ms debounce)
- **Action filter:** Typeahead autocomplete with keyboard navigation
- **Date presets:** Today, Yesterday, Last 7/30 days
- **Sort toggle:** Newest first / Oldest first
- **Refresh button:** Teal primary color, spins while loading
- **Row click:** Opens detail drawer (no expandable rows)
- **Responsive:** Columns hide on smaller screens

### Detail Drawer

Three tabs:
1. **Details:** "What Happened" narrative, event details, who, what, changes
2. **Changes:** Before/After comparison table
3. **Technical:** Identifiers, network, related events, entity history, raw JSON

---

## 15. Frontend Audit Helpers

**File:** `apps/admin/src/lib/audit-diff.ts` (444 lines)

### Pure Helper Functions (No React/DOM)

| Function | Purpose |
|----------|---------|
| `formatAuditValue(value)` | Converts values to display strings (null→"—", boolean→"Yes/No") |
| `buildChangeRows(event)` | Builds Before/After rows from changedFields or state diff |
| `getFieldDisplayName(field)` | Maps field names to labels (70+ mappings) |
| `getEntityDisplayName(resourceType)` | Maps entity types to labels (20+ mappings) |
| `getActionDisplayName(action)` | Maps actions to labels (100+ mappings) |
| `getActualChanges(before, after, changedFields)` | Computes real field-level diffs, handles nested objects |

### `getActualChanges()` — The Core Diff Engine

```typescript
interface ActualChange {
  field: string;      // e.g., "address.line1"
  label: string;      // e.g., "Street"
  before: string;     // e.g., "101 Newton Road"
  after: string;      // e.g., "102 Newton Road"
  type: 'changed' | 'added' | 'removed';
}
```

**Logic:**
1. If `changedFields` exists, filter out unchanged fields
2. Otherwise, compare `beforeState` and `afterState` keys
3. For nested objects (address, emergencyContact), compare sub-fields
4. Return only fields where values actually differ

### Display Mappings

**Field labels (70+):**
```
fullName → "Full name"
email → "Email"
phoneNumber → "Phone number"
address.line1 → "Street"
emergencyContact.name → "Contact name"
...
```

**Entity labels (20+):**
```
User → "Customer Profile"
Pet → "Pet"
Order → "Order"
HTTP_ENDPOINT → "API Endpoint"
Navigation → "Page View"
...
```

**Action labels (100+):**
```
profile_updated → "Updated profile"
pet_create → "Created pet"
login → "Logged in"
http_get → "GET"
...
```

---

## 16. RBAC Permissions

**File:** `packages/api/src/seeds/seed.ts`

### Permission Group

```
Name: AUDIT_SECURITY
Sort Order: 200
Icon: ScrollText
```

### Permissions

| Permission | Display Name | Description |
|------------|--------------|-------------|
| `audit.read` | Read Audit Trail | View audit events and search |
| `audit.admin` | Manage Audit Trail | Manage audit settings, verify chain, export |

### Role Assignment

- **Admin role:** Gets both `audit.read` and `audit.admin`
- **CSR role:** Gets `audit.read` only (can view but not manage settings)

---

## 17. Performance & Scaling

### In-Memory Queue

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `MAX_QUEUE_SIZE` | 10,000 | Max events in queue before dropping |
| `BATCH_SIZE` | 100 | Events per DB write |
| `FLUSH_INTERVAL_MS` | 100 | How often queue is flushed |

### Priority Routing

| Severity | Route | Latency Impact |
|----------|-------|----------------|
| CRITICAL | Immediate persist | ~10-50ms |
| HIGH | Immediate persist | ~10-50ms |
| NORMAL | Queue → batch persist | ~0ms (async) |
| LOW | Queue → batch persist | ~0ms (async) |

### Settings Caching

| Setting | Cache TTL | Purpose |
|---------|-----------|---------|
| Policy (categories/actors) | 5 seconds | Avoid DB hit on every request |
| `identifyAnonymousActors` | 5 seconds | Avoid DB hit on every request |
| `skipPollingEndpoints` | 5 seconds | Avoid DB hit on every request |

### Index Strategy

25+ indexes ensure fast queries:
- **Time-based:** `occurredAt` for date range queries
- **Actor-based:** `(actorType, actorId, occurredAt)` for user activity
- **Entity-based:** `(resourceType, resourceId, occurredAt)` for entity history
- **Risk-based:** `(eventCategory, severity, occurredAt)` for security analysis

---

## 18. Security Considerations

### Tamper Evidence

- SHA-256 hash chain links each event to the previous
- Any modification breaks the chain
- `verifyHashChain()` detects tampering

### Sensitive Data Protection

- 30+ regex patterns + 25+ exact field names auto-redacted
- Passwords, tokens, API keys, OTPs are never stored in plain text
- `deepRedact()` handles nested objects recursively

### Access Control

- Audit trail requires `audit.read` permission
- Audit settings require `audit.admin` permission
- Admin role has full access; CSR has read-only

### Legal Hold

- Events can be placed on legal hold to prevent deletion
- Retention enforcement skips events with `legalHold = true`
- Legal hold can only be removed by authorized users

---

## 19. Testing Strategy

### Unit Tests

**File:** `tests/unit/audit-diff.test.ts`
- Tests `formatAuditValue()`, `buildChangeRows()`, `getFieldDisplayName()`, etc.
- Pure functions, no DB or HTTP

### Integration Tests

**File:** `tests/integration/admin-full.test.ts`
- Tests audit API endpoints (list, summary, verify, export)
- Tests admin CRUD operations that generate audit events
- Tests 401/403 for unauthenticated/forbidden requests

### Test Coverage

- All 920+ tests pass
- Audit-specific tests cover: event creation, policy toggling, hash chain verification, sensitive field redaction

---

## 20. Configuration Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_URL` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | JWT signing secret (used for token decode in audit) |
| `NODE_ENV` | No | Environment label (default: 'development') |

### CMS Settings (DB-Stored)

| Key | Default | Type | Description |
|-----|---------|------|-------------|
| `audit.policy.category.{name}` | `true` | Boolean | Enable/disable audit by category |
| `audit.policy.actor.{name}` | `true` | Boolean | Enable/disable audit by actor type |
| `audit.settings.identifyAnonymousActors` | `true` | Boolean | Identify users from JWT when auth fails |
| `audit.settings.skipPollingEndpoints` | `true` | Boolean | Skip automated polling endpoints |

### Hardcoded Limits

| Parameter | Value | Location |
|-----------|-------|----------|
| Queue max size | 10,000 | `audit.service.ts` |
| Batch size | 100 | `audit.service.ts` |
| Flush interval | 100ms | `audit.service.ts` |
| Settings cache TTL | 5 seconds | `audit.policy.ts`, `audit.ts` |
| Max page size | 100 | `AuditTrail.tsx` |
| Default page size | 50 | `AuditTrail.tsx` |
| Search debounce | 300ms | `AuditTrail.tsx` |
| Sensitive field patterns | 30+ | `audit.service.ts` |
| Sensitive field names | 25+ | `audit.service.ts` |

---

## 21. File Reference

### Backend

| File | Lines | Purpose |
|------|-------|---------|
| `packages/db/src/models/AuditEvent.ts` | 253 | Mongoose model, schema, indexes |
| `packages/api/src/middleware/audit.ts` | 281 | Request middleware, actor identification |
| `packages/api/src/middleware/auth.ts` | 82 | Auth middleware, sets audit actor |
| `packages/api/src/services/audit/audit.service.ts` | 504 | Core service, queue, hashing, redaction |
| `packages/api/src/services/audit/audit.policy.ts` | 71 | Policy engine, category/actor toggles |
| `packages/api/src/services/audit/actor-type.ts` | 27 | Role-to-actor mapping |
| `packages/api/src/services/audit/audit.retention.ts` | 245 | Retention policies, legal hold |
| `packages/api/src/services/audit/audit.transaction.ts` | 100 | Transaction support |
| `packages/api/src/services/audit/index.ts` | 7 | Exports |
| `packages/api/src/seeds/seed-cms.ts` | 1192 | Seeds 31 audit settings |
| `packages/api/src/seeds/seed.ts` | ~400 | Seeds RBAC permissions |
| `packages/api/src/routes/customer.ts` | ~3000 | 46+ business event audit calls |
| `packages/api/src/routes/auth.ts` | ~1750 | 18+ auth event audit calls |
| `packages/api/src/routes/customer-subscriptions.ts` | ~400 | 3 subscription audit calls |

### Frontend

| File | Lines | Purpose |
|------|-------|---------|
| `apps/admin/src/pages/AuditTrail.tsx` | 1869 | Main audit trail page |
| `apps/admin/src/lib/audit-diff.ts` | 444 | Pure helper functions, display mappings |

---

## 22. Implementation Checklist

To duplicate this audit system in another project:

### Phase 1: Data Model
- [ ] Create `AuditEvent` Mongoose model with all 70+ fields
- [ ] Add 25+ indexes for query performance
- [ ] Define TypeScript enums for ActorType, EventCategory, EventSeverity, EventOutcome

### Phase 2: Middleware
- [ ] Create audit middleware that generates request IDs
- [ ] Override `res.send` to capture duration
- [ ] Listen for `res.finish` to fire audit events
- [ ] Implement JWT decode for anonymous actor identification
- [ ] Add endpoint skip list for polling/health endpoints

### Phase 3: Service Layer
- [ ] Implement `auditService.log()` with policy gate
- [ ] Build in-memory queue with priority routing
- [ ] Implement SHA-256 hash chain
- [ ] Add sensitive field redaction (30+ patterns)
- [ ] Implement batch persistence (100 events, 100ms interval)

### Phase 4: Policy Engine
- [ ] Create `audit.policy.*` settings in DB
- [ ] Implement category/actor toggles with 5s cache
- [ ] Add `identifyAnonymousActors` and `skipPollingEndpoints` settings
- [ ] Seed all settings in CMS seed

### Phase 5: Business Event Logging
- [ ] Add `auditCustomerEvent()` / `auditAdminEvent()` helpers
- [ ] Instrument all route handlers with audit calls
- [ ] Add `businessOperation` field for human-readable narratives
- [ ] Add navigation audit calls for page-level GET endpoints

### Phase 6: Admin UI
- [ ] Build 8-column grid (Time, Actor, Action, Entity, Before, After, Result, Severity)
- [ ] Implement auto-complete search with suggestions
- [ ] Add debounced progressive filtering
- [ ] Build detail drawer with tabs (Details, Changes, Technical)
- [ ] Add export (CSV/JSON), verify integrity, date presets

### Phase 7: Frontend Helpers
- [ ] Create `audit-diff.ts` with pure helper functions
- [ ] Implement `getActualChanges()` for nested object diffs
- [ ] Add 70+ field label mappings
- [ ] Add 100+ action label mappings
- [ ] Add 20+ entity label mappings

### Phase 8: Testing
- [ ] Unit tests for pure helper functions
- [ ] Integration tests for API endpoints
- [ ] Tests for policy toggling
- [ ] Tests for hash chain verification

### Phase 9: RBAC
- [ ] Create `AUDIT_SECURITY` permission group
- [ ] Add `audit.read` and `audit.admin` permissions
- [ ] Assign to admin role

---

*Document generated: 2026-08-16*
*PawTag Audit Logging System v1.0*
*Total audit events tracked: 46+ business events, 18+ auth events, 6+ navigation events*
