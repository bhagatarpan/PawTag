# Observability Testing Guide

## Overview

This document explains how PawTag's observability system is verified through comprehensive testing, including failure injection scenarios.

## Test Structure

### Unit Tests

- `tests/unit/metrics.test.ts` - Metrics collection (counters, histograms, gauges)
- `tests/unit/tracing.test.ts` - OpenTelemetry tracing initialization and helpers
- `tests/unit/monitoring.test.ts` - Error monitoring (Sentry integration)
- `tests/unit/correlation.test.ts` - Log-audit-documentation correlation
- `tests/unit/reporting.test.ts` - Operational reporting
- `tests/unit/observability-failure.test.ts` - Failure injection tests

### Integration Tests

- `tests/integration/health.test.ts` - Health endpoint verification
- `tests/smoke/api.smoke.test.ts` - API smoke tests including health checks

## Failure Scenarios Tested

### Database Failures

| Scenario | Verification |
|----------|--------------|
| Database unavailable | Error logged, metrics updated, trace records error |
| Database timeout | Error logged with duration, metrics updated |
| Query error | Error classified, sensitive data redacted |

### External Provider Failures

| Scenario | Verification |
|----------|--------------|
| Provider timeout | Error logged with provider context, metrics updated |
| Provider 4xx | Error classified, user-facing message appropriate |
| Provider 5xx | Error logged, monitoring captures incident |

### Authentication/Authorization Failures

| Scenario | Verification |
|----------|--------------|
| Invalid credentials | Warning logged, metrics updated, no sensitive data leaked |
| Insufficient permissions | Warning logged with required role context |
| Token expired | Error classified, user prompted to re-authenticate |

### Validation Failures

| Scenario | Verification |
|----------|--------------|
| Missing required field | Info logged with field details |
| Invalid format | Error classified, user-facing message clear |
| Business rule violation | Error logged with rule context |

### Unexpected Exceptions

| Scenario | Verification |
|----------|--------------|
| Unhandled exception | Error logged with stack trace, monitoring captures incident |
| Process crash | Fatal logged, monitoring captures incident, graceful shutdown |

### Background Job Failures

| Scenario | Verification |
|----------|--------------|
| Job processing error | Error logged with job context, metrics updated |
| Retry exhaustion | Warning logged with retry count, monitoring alerts |

## Verification Checklist

For each failure scenario, verify:

1. **User-facing response** - Appropriate error message, no internal details leaked
2. **Structured log** - Correct level, message, and context fields
3. **Severity** - Deterministic severity based on rules, not arbitrary
4. **Error classification** - Correct error type/category
5. **Stack trace** - Captured internally for debugging
6. **Sensitive data** - Redacted from logs and monitoring
7. **Request IDs** - Preserved across all observability layers
8. **Audit events** - Emitted for business operations where appropriate
9. **Metrics** - Error counters incremented, duration recorded
10. **Traces** - Error recorded in span, trace context preserved
11. **Monitoring** - Incident captured in error monitoring system

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific observability tests
pnpm test -- tests/unit/metrics.test.ts
pnpm test -- tests/unit/tracing.test.ts
pnpm test -- tests/unit/monitoring.test.ts
pnpm test -- tests/unit/correlation.test.ts
pnpm test -- tests/unit/reporting.test.ts
pnpm test -- tests/unit/observability-failure.test.ts

# Run integration tests
pnpm test -- tests/integration/health.test.ts
```

## Test Isolation

- All observability tests use mocks to isolate from external dependencies
- Monitoring (Sentry) is mocked to prevent test errors from polluting production
- Tracing (OpenTelemetry) is mocked to avoid requiring a collector
- Logger is mocked to verify log output without console noise

## Regression Prevention

The full test suite runs in CI to ensure:

- Existing audit system continues functioning
- No sensitive data is logged
- Error contracts are maintained
- API responses remain consistent
- Performance is not degraded

## Adding New Tests

When adding new failure scenarios:

1. Add to `tests/unit/observability-failure.test.ts`
2. Follow the verification checklist above
3. Ensure mocks are properly isolated
4. Run full test suite to verify no regressions
