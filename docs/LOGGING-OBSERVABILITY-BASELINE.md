# PawTag Logging & Observability Baseline

> Phase 1 deliverable — evidence-based assessment of current state.

---

## 1. Current State

### 1.1 Structured Logger

**File:** `packages/api/src/lib/logger.ts`

Pino is configured with:
- `silent` in test
- `pino-pretty` in development
- `info` level in production
- Dependencies: `pino@10.3.1`, `pino-http@11.0.0`, `pino-pretty@13.1.3`

**Critical finding:** `pino-http` is declared but **never used**. HTTP request logging uses `morgan('dev')` instead (`index.ts:87`).

Logger usage is inconsistent:
| Area | `logger.*` calls | `console.*` calls |
|------|------------------|-------------------|
| `routes/` | 49 | 44 |
| `services/` | 9 | 64 |
| `middleware/` | 5 | 1 |
| `jobs/` | 0 | 7 |
| `index.ts` | 5 | 0 |
| **Total** | **~68** | **~116** |

### 1.2 Console.* Inventory (Runtime Only)

**Runtime `console.log` (19 calls):**
- `services/escalation.service.ts` — 5 calls
- `services/email.service.ts` — 10 calls (demo mode email logging)
- `jobs/lowStockCheck.ts` — 4 calls

**Runtime `console.error` (52 calls):**
- `routes/auth.ts` — 14 calls (highest-traffic route)
- `routes/admin.ts` — 6 calls
- `routes/customer.ts` — 5 calls
- `routes/customer-subscriptions.ts` — 2 calls
- `routes/finder.ts` — 1 call
- `routes/upload.ts` — 1 call
- `routes/webhooks.ts` — 1 call
- `services/email.service.ts` — 3 calls
- `services/sms.service.ts` — 3 calls
- `services/escalation.service.ts` — 2 calls
- `services/subscription.service.ts` — 3 calls
- `services/push-notification.service.ts` — 2 calls
- `services/inventory.service.ts` — 1 call
- `services/referral.service.ts` — 1 call
- `services/reminder.service.ts` — 2 calls
- `services/orderNotification.service.ts` — 1 call
- `jobs/lowStockCheck.ts` — 3 calls

**Seed scripts (acceptable — CLI tooling):** ~90 `console.*` calls across 4 seed files.

### 1.3 Error Handling

**Global error handler** (`middleware/errorHandler.ts`, 30 lines):
- Catches Mongoose `ValidationError`, `CastError`, duplicate key (11000)
- Generic 500 for everything else
- Error messages hidden in production for 500s
- Uses `logger.error()` correctly

**Route-level error handling:**
- ~338 `try/catch` blocks across 26 route files
- ~200+ use anonymous catch (`} catch {`) that **discards the error entirely**
- ~53 use named error variable with `console.error`
- No custom error classes — only native `Error` instances thrown
- No error code enum — ad-hoc string literals scattered across routes

**API response format:** Consistent `{ success, data?, error? }` envelope everywhere.

**Zod validation errors:** Handled by `middleware/validation.ts` — returns `{ success: false, error: 'Validation failed', details: [...] }`. NOT caught by global error handler (Zod errors have `name: 'ZodError'`).

### 1.4 Request Context

**Audit middleware** (`middleware/audit.ts`, 281 lines):
- Generates/accepts `X-Request-ID`, `X-Correlation-ID`, `X-Trace-ID`, `X-Transaction-ID` (all UUID v7)
- Stores in `req.auditContext`
- Sets response headers

**Critical gap:** Request IDs are stored in `req.auditContext` but **NOT propagated to logger**. When `logger.error()` is called in route handlers, there is no request ID in the log line.

### 1.5 Process-Level Handlers

- `SIGTERM` handler exists (`index.ts:214-217`) — calls `disconnectDatabase()` then `process.exit(0)`
- **NO `process.on('unhandledRejection')` handler** — unhandled promise rejections may crash silently in Node 15+
- **NO `process.on('uncaughtException')` handler** — process may be left in undefined state

### 1.6 Sentry Integration

**File:** `packages/api/src/index.ts` (lines 4-12, 186-188)

- Opt-in via `SENTRY_DSN` env var
- Excluded in test environment
- `tracesSampleRate: 0.1` (10% of transactions)
- Uses `Sentry.setupExpressErrorHandler(app)`
- **NO `Sentry.captureException()` calls anywhere** — Sentry is purely passive
- No custom scope enrichment, no breadcrumbs, no user context

### 1.7 Health Check

**Single endpoint:** `GET /health` returns `{ status: 'ok', timestamp }`.
- Does NOT verify database connectivity
- Does NOT check external services
- Does NOT report memory/disk usage
- Excluded from audit logging

### 1.8 Metrics

**None.** No Prometheus, Datadog, StatsD, or any metrics library exists in the codebase.

### 1.9 OpenTelemetry Tracing

**None.** No OpenTelemetry SDK, no trace exporters, no span creation.

### 1.10 Existing Audit System

**Enterprise-grade audit logging** exists and must be preserved:
- SHA-256 hash chain integrity
- Actor tracking (USER, ADMIN, CSR, FINDER, WEBHOOK, etc.)
- Field-level diffs with sensitive field redaction
- Policy engine with per-category and per-actor toggles
- Queue-based async processing
- Retention policies and legal holds

**Files:** `packages/api/src/services/audit/` (6 files)

---

## 2. Gaps

### 2.1 Missing

| Gap | Impact |
|-----|--------|
| Structured request logging (pino-http unused) | No structured HTTP request/response logs |
| Request ID propagation to logger | Cannot correlate log lines to requests |
| Process-level exception/rejection handlers | Silent crashes, undefined state |
| Application metrics | No visibility into request rates, latency, error rates |
| Distributed tracing | Cannot follow requests across service boundaries |
| Centralized error monitoring | Passive Sentry only; caught errors silently discarded |
| Health check depth | Cannot detect degraded dependencies |
| Error taxonomy/classification | Ad-hoc string literals, no consistent categorization |
| Redaction policy | No central redaction; relies on individual developer discipline |
| Structured error classes | Only native `Error`; no domain-specific error types |

### 2.2 Partial

| Area | Status |
|------|--------|
| Logger (pino) | Installed and configured but underutilized |
| Request IDs | Generated but not propagated to logs |
| Sentry | Installed but passive; no manual captures |
| Error handler | Handles Mongoose errors only; misses Zod, business, timeout errors |
| Audit logging | Fully functional; no correlation to technical logs |

### 2.3 Inconsistent

| Area | Pattern |
|------|---------|
| Error logging | `console.error` in routes, `logger.error` in middleware |
| Catch blocks | ~200 anonymous catches discard errors; ~53 named catches log |
| Error responses | Consistent envelope but inconsistent error messages |
| Service logging | Some services use logger, most use console |

### 2.4 Unknown

- Log volume in production (no metrics to measure)
- Actual error rates (Sentry passive; no active monitoring)
- Request latency baselines (no instrumentation)

---

## 3. Existing Systems to Preserve

| System | Location | Notes |
|--------|----------|-------|
| **Audit subsystem** | `packages/api/src/services/audit/` | SHA-256 hash chain, policy engine, retention. Do not replace with logs. |
| **Pino logger** | `packages/api/src/lib/logger.ts` | Already configured; extend rather than replace. |
| **Request ID generation** | `middleware/audit.ts` | UUID v7 IDs; propagate to logger instead of regenerating. |
| **Sentry** | `index.ts` | Already integrated; enhance with manual captures. |
| **SIGTERM handler** | `index.ts:214` | Graceful shutdown; extend with logging. |

---

## 4. Proposed Target Architecture

```
Application Code
    │
    ▼
┌─────────────────────────────┐
│  Structured Logger (Pino)   │◄── Request Context (IDs, timing)
│  - debug/info/warn/error    │
│  - JSON in production       │
│  - redaction hooks          │
└─────────┬───────────────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌────────┐ ┌────────────┐
│ Metrics│ │ Traces     │
│Prometheu│ │OpenTelemetry│
│  s     │ │            │
└───┬────┘ └─────┬──────┘
    │            │
    ▼            ▼
┌─────────────────────────────┐
│  Error Monitoring (Sentry)  │
│  - manual captures          │
│  - release tracking         │
│  - scope enrichment         │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  Audit Trail (Existing)     │
│  - business/security events │
│  - hash chain integrity     │
│  - correlated via IDs       │
└─────────────────────────────┘
```

---

## 5. Dependency Decisions

| Tool | Purpose | Rationale |
|------|---------|-----------|
| **pino** (existing) | Structured logger | Already installed; industry standard for Node.js |
| **pino-http** (existing, unused) | HTTP request logging | Replace morgan; structured request/response logs |
| **@opentelemetry/sdk-node** | Tracing + metrics | Vendor-neutral; standard for Node.js |
| **@opentelemetry/sdk-metrics** | Prometheus-compatible metrics | Part of OTel SDK |
| **@sentry/node** (existing) | Error monitoring | Already installed; enhance usage |
| **pino-redact** or custom | Sensitive data redaction | Built into pino; use redact option |

**Minimal additions:** No new logging frameworks. Extend existing pino + OTel + Sentry.

---

## 6. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Sensitive data in logs | HIGH | Central redaction policy; test for secrets in logs |
| Log volume in production | MEDIUM | Configurable log levels; sampling for high-volume endpoints |
| Performance overhead | MEDIUM | Async logging (pino default); sampling for traces |
| Audit/log confusion | MEDIUM | Clear separation: audit = business evidence, logs = technical evidence |
| Duplicate events | LOW | Audit fires once; technical logs may repeat — by design |
| Vendor lock-in | LOW | OpenTelemetry for tracing/metrics; pino for logging |
| Breaking existing API contracts | HIGH | Do not change error response format; only add metadata |
| Tracing failure causing request failure | HIGH | OTel SDK designed to fail gracefully; never block requests |

---

## 7. Phase Plan

| Phase | Scope | Key Deliverables |
|-------|-------|------------------|
| **Phase 2** | Core structured logger | Extend pino config; add redaction; migrate console.* calls |
| **Phase 3** | Request context + error handling | Propagate IDs to logger; central error model; process handlers |
| **Phase 4** | Error taxonomy + redaction | Error classes; error codes; central redaction policy |
| **Phase 5** | Service/DB/integration logging | Instrument services, DB queries, external calls |
| **Phase 6** | Metrics + health | OTel metrics; Prometheus endpoint; deep health checks |
| **Phase 7** | OpenTelemetry tracing | Distributed tracing across request lifecycle |
| **Phase 8** | Error monitoring | Enhance Sentry; manual captures; release tracking |
| **Phase 9** | Log-audit correlation | Connect logs to audit events via shared IDs |
| **Phase 10** | Operational reporting | Incident view, request timeline, feature health |
| **Phase 11** | Testing + failure injection | Prove observability works when things fail |
| **Phase 12** | Production hardening + runbook | Config review, retention, deployment docs |
