# Observability Runbook

## Overview

This runbook provides step-by-step procedures for common operational scenarios in PawTag's observability system.

## Quick Reference

### Health Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /health` | Basic health check | `{ status: 'ok', timestamp }` |
| `GET /health/live` | Liveness probe | `{ status: 'alive', uptime }` |
| `GET /health/ready` | Readiness probe | `{ status: 'ready', checks }` |
| `GET /health/dependencies` | Dependency status | `{ status: 'ok', dependencies }` |
| `GET /health/metrics` | Current metrics | `{ counters, histograms, gauges }` |

### Key Environment Variables

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `SENTRY_DSN` | Sentry error monitoring DSN | No | - |
| `SENTRY_RELEASE` | Sentry release identifier | No | SERVICE_VERSION |
| `SENTRY_SAMPLE_RATE` | Error sample rate (0-1) | No | 1.0 |
| `SENTRY_TRACES_SAMPLE_RATE` | Trace sample rate (0-1) | No | 0.1 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector endpoint | No | - |
| `OTEL_CONSOLE_EXPORTER` | Enable console trace export | No | false |
| `OTEL_SAMPLE_RATE` | Trace sample rate (0-1) | No | 1.0 |
| `LOG_LEVEL` | Minimum log level | No | info |

---

## Scenario: "I have a 500 error"

### Steps

1. **Find the request ID**
   - Check the error response for `X-Request-ID` header
   - Or check server logs for the timestamp of the error

2. **Search logs by request ID**
   ```bash
   # In your logging system (e.g., Datadog, CloudWatch, ELK)
   # Search for: requestId:<your-request-id>
   ```

3. **Check the trace**
   - Look for `X-OTel-Trace-Id` in response headers
   - Search your tracing system (Jaeger, Zipkin, etc.) for the trace ID
   - Review the span tree for timing and errors

4. **Check audit events**
   - Search audit logs for the request ID
   - Review the operation that was attempted
   - Check the actor and outcome

5. **Check dependencies**
   ```bash
   curl /health/dependencies
   ```
   - Review status of external services (Stripe, Resend, Twilio, etc.)
   - Check for recent dependency failures in metrics

6. **Check deployment/release**
   - Verify the current deployment version
   - Check if the error started after a recent deployment
   - Review Sentry for release-specific errors

### Common Causes

- Database connection issues
- External service timeout
- Invalid input causing unhandled exception
- Authentication/authorization failure
- Configuration error

---

## Scenario: "Users report slow pages"

### Steps

1. **Check current metrics**
   ```bash
   curl /health/metrics
   ```
   - Look at `pawtag_http_request_duration_ms` histogram
   - Identify routes with high latency

2. **Identify slow routes**
   - Check metrics for route-specific latency
   - Look for patterns (specific endpoints, specific times)

3. **Check traces for slow requests**
   - Search traces for duration > threshold
   - Review span breakdown:
     - Database query time
     - External service calls
     - Business logic execution

4. **Check database performance**
   - Review slow query logs (threshold: 500ms)
   - Check database connection pool
   - Look for N+1 query patterns

5. **Check external dependencies**
   - Review integration metrics
   - Check provider status pages
   - Look for timeout patterns

### Common Causes

- Database queries without indexes
- N+1 query patterns
- External service latency
- Memory pressure
- CPU saturation

---

## Scenario: "Notifications stopped"

### Steps

1. **Check notification metrics**
   - Look at `pawtag_notifications_sent_total` and `pawtag_notifications_failed_total`
   - Calculate error rate

2. **Check dependency health**
   ```bash
   curl /health/dependencies
   ```
   - Verify Resend (email) status
   - Verify Twilio (SMS) status

3. **Check logs for notification errors**
   - Search for notification-related errors
   - Look for rate limiting messages
   - Check for authentication failures

4. **Check retry behavior**
   - Review retry count in metrics
   - Look for retry exhaustion messages
   - Check if retries are being rate limited

5. **Check provider status**
   - Visit Resend status page
   - Visit Twilio status page
   - Check for known outages

6. **Check audit events**
   - Search for notification-related audit events
   - Verify notifications are being triggered
   - Check for business rule blocking

### Common Causes

- Provider API key expired
- Rate limiting by provider
- Provider outage
- Configuration error
- Business rule blocking notifications

---

## Scenario: "I suspect unauthorized activity"

### Steps

1. **Check audit trail**
   - Search audit events for suspicious patterns:
     - Multiple failed login attempts
     - Unusual IP addresses
     - Unusual user agents
     - Access to sensitive endpoints
     - Data exports

2. **Identify the actor**
   - Check actor information in audit events
   - Review actor type (USER, ADMIN, FINDER, etc.)
   - Check actor IP and user agent

3. **Review operations**
   - Look at operation types (CREATE, UPDATE, DELETE)
   - Check resource types accessed
   - Review outcomes (SUCCESS, FAILURE)

4. **Check request context**
   - Find request IDs from audit events
   - Search logs for those request IDs
   - Review full request details

5. **Check traces**
   - Use trace IDs from audit events
   - Review full request flow
   - Look for anomalies

6. **Take action**
   - If confirmed malicious:
     - Block IP address
     - Disable user account
     - Review and revert changes
     - Notify affected users

### Common Causes

- Compromised credentials
- Brute force attack
- Session hijacking
- Insider threat
- Configuration error allowing unauthorized access

---

## Scenario: "Production is noisy"

### Steps

1. **Identify the logger**
   - Check which log level is configured
   - Review `LOG_LEVEL` environment variable

2. **Identify noisy sources**
   - Search logs for high-volume messages
   - Look for repeated patterns
   - Check for debug-level logs in production

3. **Adjust log level**
   - Update `LOG_LEVEL` environment variable
   - Options: `fatal`, `error`, `warn`, `info`, `debug`, `trace`
   - Production recommended: `info` or `warn`

4. **Adjust sampling**
   - For traces: Update `OTEL_SAMPLE_RATE`
   - For errors: Update `SENTRY_SAMPLE_RATE`
   - Lower values = less volume

5. **Deploy safely**
   - Update environment variables
   - Restart service
   - Monitor for impact

6. **Monitor**
   - Verify log volume decreased
   - Ensure important events still captured
   - Check error monitoring still working

### Recommendations

- Production log level: `info` or `warn`
- Trace sampling: 10% (0.1) for normal operation
- Error sampling: 100% (1.0) - never miss errors
- Use structured logging to enable filtering

---

## Telemetry Failure Recovery

### If OpenTelemetry Collector is Down

- Application continues normally
- Traces are lost but not critical
- Logs and metrics still work
- No action required immediately

### If Sentry is Down

- Application continues normally
- Errors are logged locally
- No action required immediately
- Check Sentry status when convenient

### If Logging Fails

- **Critical** - investigate immediately
- Check disk space
- Check log aggregator connectivity
- Review log rotation settings

---

## Configuration Checklist

### Development

```env
NODE_ENV=development
LOG_LEVEL=debug
OTEL_CONSOLE_EXPORTER=true
SENTRY_SAMPLE_RATE=0
```

### Staging

```env
NODE_ENV=staging
LOG_LEVEL=info
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.example.com
SENTRY_DSN=https://...@sentry.io/...
SENTRY_SAMPLE_RATE=1.0
SENTRY_TRACES_SAMPLE_RATE=0.5
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

---

## Escalation

### Severity Levels

| Severity | Response Time | Action |
|----------|---------------|--------|
| CRITICAL | Immediate | All hands, incident commander |
| HIGH | 1 hour | Senior engineer on call |
| MEDIUM | 4 hours | Next business day |
| LOW | 24 hours | Backlog |

### Escalation Path

1. On-call engineer
2. Senior engineer
3. Engineering manager
4. CTO

---

## Contacts

- **Engineering**: engineering@pawtag.co.nz
- **On-call**: oncall@pawtag.co.nz
- **Status page**: status.pawtag.co.nz
