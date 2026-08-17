# Observability Architecture

## Overview

PawTag's observability system provides comprehensive monitoring, debugging, and auditing capabilities through a layered architecture that connects technical evidence with business evidence.

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                            │
│  Express Routes │ Services │ Database │ External Integrations       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      STRUCTURED LOGS                                │
│  pino logger │ request context │ correlation IDs │ redaction        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY SIGNALS                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Metrics  │  │  Traces  │  │  Errors  │  │  Health  │           │
│  │          │  │          │  │          │  │          │           │
│  │ Counters │  │ OpenTel  │  │  Sentry  │  │ Endpoints│           │
│  │ Histogram│  │ Spans    │  │  Capture │  │ Liveness │           │
│  │ Gauges   │  │ Context  │  │  Monitor │  │ Readiness│           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AUDIT TRAIL                                    │
│  Business events │ Security evidence │ Hash chain integrity        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CORRELATION LAYER                                 │
│  Feature context │ Workflow tracking │ Documentation mapping        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    REPORTING LAYER                                   │
│  Incident reports │ Request timelines │ Feature health │ Dep health │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Structured Logger (`lib/logger.ts`)

- **Technology**: pino (high-performance Node.js logger)
- **Format**: JSON in production, pretty-printed in development
- **Redaction**: Automatic sensitive field redaction
- **Context**: Request-scoped context propagation

**Key Features**:
- 6 log levels: debug, info, warn, error, fatal, silent
- Child loggers for scoped context
- Automatic timestamp and service metadata
- Environment-aware configuration

### 2. Request Context (`lib/request-context.ts`)

- **Technology**: AsyncLocalStorage (Node.js async context)
- **Propagation**: Automatic across async operations
- **Fields**: requestId, correlationId, traceId, transactionId

**Key Features**:
- Async-safe context propagation
- Available in all downstream code
- Enriches logs with request context
- Integrates with audit middleware

### 3. Metrics (`lib/metrics.ts`)

- **Technology**: In-process counters, histograms, gauges
- **Format**: OpenTelemetry-compatible
- **Endpoint**: `/health/metrics`

**Metric Categories**:
- HTTP requests (count, duration, errors, status)
- Authentication (success, failures)
- Database (operations, errors, duration, slow queries)
- Integrations (calls, errors, duration)
- Jobs (executions, errors, duration)
- Rate limiting (hits)
- Notifications (sent, failed)

### 4. Distributed Tracing (`lib/tracing.ts`)

- **Technology**: OpenTelemetry SDK
- **Exporters**: OTLP (production), Console (development)
- **Instrumentation**: Auto-instrumentation for HTTP, Express, Mongoose

**Key Features**:
- Vendor-neutral (OpenTelemetry standard)
- Automatic span creation for HTTP requests
- Database operation tracing
- External integration tracing
- Graceful failure (never blocks business requests)

### 5. Error Monitoring (`lib/monitoring.ts`)

- **Technology**: Sentry (vendor-neutral abstraction)
- **Capture**: Unhandled exceptions, API errors, integration failures
- **Features**: Release tracking, user context, breadcrumbs

**Key Features**:
- Sensitive data redaction before sending
- Request/trace context enrichment
- Environment-aware configuration
- Graceful shutdown with event flushing

### 6. Correlation (`lib/correlation.ts`)

- **Purpose**: Connect logs, audit events, and documentation
- **Feature Registry**: Maps features to expected audit events
- **Evidence Building**: Human-readable correlation summaries

**Key Features**:
- Feature/workflow context propagation
- Log-audit correlation
- Documentation gap detection
- Evidence export

### 7. Reporting (`lib/reporting.ts`)

- **Purpose**: Generate operational reports from observability data
- **Reports**: Incident, request timeline, feature health, dependency health
- **Severity**: Deterministic rules (not arbitrary)

**Report Types**:
- **Incident Report**: What happened, root cause, recommendations
- **Request Timeline**: Full request lifecycle view
- **Feature Health**: Error rate, latency, audit coverage
- **Dependency Health**: Provider status, success rate, latency

### 8. Health Endpoints (`routes/health.ts`)

- **Liveness**: Is the process alive?
- **Readiness**: Can the service accept traffic?
- **Dependencies**: External service status
- **Metrics**: Current metrics snapshot

## Data Flow

### Request Lifecycle

```text
1. HTTP Request arrives
   │
2. Audit Middleware
   ├─ Creates request ID, correlation ID, trace ID
   ├─ Sets up request context (AsyncLocalStorage)
   └─ Captures actor information
   │
3. Metrics Middleware
   ├─ Records request start time
   └─ Increments request counter
   │
4. Tracing Middleware
   ├─ Enriches with OpenTelemetry trace context
   └─ Adds trace headers to response
   │
5. Route Handler
   ├─ Business logic executes
   ├─ Database operations traced
   ├─ External integrations traced
   └─ Errors captured and classified
   │
6. Response
   ├─ Status code recorded
   ├─ Duration calculated
   ├─ Metrics updated
   ├─ Audit event emitted
   └─ Error monitoring notified (if error)
```

### Error Flow

```text
1. Error occurs
   │
2. Error Handler
   ├─ Classifies error type
   ├─ Determines severity
   ├─ Redacts sensitive data
   └─ Logs structured error
   │
3. Monitoring
   ├─ Captures exception with context
   ├─ Enriches with request/trace IDs
   └─ Sends to Sentry (if enabled)
   │
4. Metrics
   ├─ Increments error counter
   └─ Records error duration
   │
5. Audit
   └─ Emits failure audit event
   │
6. Response
   └─ Returns appropriate error response
```

## Correlation IDs

| ID | Purpose | Source |
|----|---------|--------|
| requestId | Unique per request | Generated by audit middleware |
| correlationId | Groups related requests | Generated or propagated |
| traceId | OpenTelemetry trace | Generated by tracing |
| spanId | OpenTelemetry span | Generated by tracing |
| transactionId | Database transaction | Generated by audit middleware |

## Environment Configuration

### Development

```env
NODE_ENV=development
LOG_LEVEL=debug
OTEL_CONSOLE_EXPORTER=true
SENTRY_SAMPLE_RATE=0
```

### Production

```env
NODE_ENV=production
LOG_LEVEL=warn
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.example.com
SENTRY_DSN=https://...@sentry.io/...
SENTRY_RELEASE=1.0.0
SENTRY_SAMPLE_RATE=1.0
SENTRY_TRACES_SAMPLE_RATE=0.1
```

## Security Considerations

### Sensitive Data Protection

- Passwords, tokens, secrets are redacted from logs
- Request/response bodies are not logged by default
- Health endpoints don't expose internal details
- Monitoring scrubbing configured centrally

### Access Control

- Operational views protected by RBAC
- Audit events track all access
- Rate limiting prevents abuse
- CORS restricts origins

## Reliability

### Failure Modes

| Component | Failure Impact | Mitigation |
|-----------|---------------|------------|
| Logger | Logs lost | Non-blocking writes |
| Tracing | Traces lost | Graceful degradation |
| Monitoring | Errors not captured | Local logging fallback |
| Metrics | Metrics lost | In-memory collection |

### Design Principles

- **Non-blocking**: Observability never blocks business requests
- **Graceful degradation**: Component failures don't affect application
- **Fail-safe**: Errors in observability are caught and logged
- **Vendor-neutral**: Abstract interfaces allow provider swapping

## Integration Points

### External Systems

| System | Purpose | Protocol |
|--------|---------|----------|
| Sentry | Error monitoring | HTTPS |
| OpenTelemetry Collector | Trace aggregation | OTLP/HTTP |
| MongoDB | Data storage | MongoDB protocol |
| Stripe | Payments | HTTPS |
| Resend | Email | HTTPS |
| Twilio | SMS | HTTPS |

### Internal Systems

| System | Purpose | Interface |
|--------|---------|-----------|
| Audit Service | Business event logging | Internal API |
| Rate Limiter | Request throttling | Middleware |
| Auth Middleware | Authentication | Middleware |
| RBAC | Authorization | Middleware |

## Future Enhancements

### Planned

- [ ] Prometheus metrics export
- [ ] Grafana dashboards
- [ ] Alert manager integration
- [ ] Log aggregation (ELK/Datadog)
- [ ] Distributed tracing backend (Jaeger/Zipkin)
- [ ] Custom metrics dashboard

### Considered

- [ ] Real-time log streaming
- [ ] Anomaly detection
- [ ] Predictive alerting
- [ ] Cost optimization metrics
- [ ] User experience monitoring

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Sentry Documentation](https://docs.sentry.io/)
- [Pino Documentation](https://getpino.io/)
- [Observability Testing Guide](./OBSERVABILITY-TESTING.md)
- [Observability Runbook](./OBSERVABILITY-RUNBOOK.md)
