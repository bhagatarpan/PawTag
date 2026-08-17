# PawTag Logging Guide

## Overview

PawTag uses [Pino](https://getpino.io/) for structured logging. All application logs are JSON in production and pretty-printed in development.

## Logger Location

```typescript
packages/api/src/lib/logger.ts
```

## Usage

### Basic Logging

```typescript
import { logger } from '../lib/logger';

logger.info('Server started');
logger.error({ err: error }, 'Operation failed');
logger.warn({ queue: 'emails', count: 50 }, 'Queue building up');
logger.debug({ userId: '123' }, 'Processing request');
```

### Child Loggers

Create loggers with pre-bound context:

```typescript
import { createChildLogger } from '../lib/logger';

const reqLogger = createChildLogger({ requestId: req.id, feature: 'auth' });
reqLogger.info('Processing login');
```

### Scoped Loggers

Create loggers for a specific feature:

```typescript
import { createScopedLogger } from '../lib/logger';

const authLogger = createScopedLogger('auth');
authLogger.info({ userId }, 'Login attempt');
```

## Log Levels

| Level | When to Use |
|-------|-------------|
| `fatal` | Process is crashing or in undefined state |
| `error` | An operation failed and needs attention |
| `warn` | Something unexpected but recoverable |
| `info` | Normal operations worth recording |
| `debug` | Detailed information for debugging |

## Structured Fields

Always prefer structured fields over string concatenation:

```typescript
// Good
logger.error({ err: error, orderId: '123', userId: '456' }, 'Order processing failed');

// Bad
logger.error(`Order processing failed for order 123: ${error.message}`);
```

## Common Fields

| Field | Purpose |
|-------|---------|
| `err` | Error object (pino serializes stack trace) |
| `requestId` | Unique request identifier |
| `correlationId` | Cross-service correlation |
| `userId` | Authenticated user ID |
| `feature` | Feature or module name |
| `duration` | Operation duration in ms |

## Environment Behavior

| Environment | Output | Format |
|-------------|--------|--------|
| `development` | Console | Pretty-printed |
| `production` | Stdout | JSON |
| `test` | Suppressed | Silent |

## Sensitive Data

The logger automatically redacts these fields:

- `password`, `passwordHash`, `token`, `secret`, `apiKey`
- `authorization`, `cookie` headers
- `otp`, `creditCard`, `cvv`, `ssn`
- PawTag-specific: `finderPhone`, `finderEmail`, `emergencyContact`

**Never log:**
- Raw request/response bodies
- Environment variables
- `.env` file contents
- Database connection strings
- Private keys or certificates

## What Must Never Be Logged

1. Passwords or password hashes
2. JWT tokens or refresh tokens
3. API keys or secrets
4. Credit card numbers
5. OTP codes in production
6. Full request headers
7. Full request bodies (unless explicitly safe)
8. Database credentials
9. Environment variable contents

## Request Context

Every API request automatically gets a request context with:
- `requestId` — unique identifier for the request
- `correlationId` — cross-service correlation
- `traceId` — distributed trace identifier
- `transactionId` — transaction grouping

These IDs are:
- Generated or accepted from incoming headers (`X-Request-ID`, etc.)
- Stored in `AsyncLocalStorage` for access anywhere in the call stack
- Set in response headers
- Included in structured log output
- Used to correlate logs, traces, and audit events

### Accessing Request Context

```typescript
import { getRequestContext } from '../lib/request-context';

const ctx = getRequestContext();
if (ctx) {
  logger.info({ requestId: ctx.requestId }, 'Processing request');
}
```

## Error Handling

PawTag uses a central error model (`lib/app-errors.ts`) with typed error classes:

```typescript
import { AppError, NotFoundError, ValidationError } from '../lib/app-errors';

throw new NotFoundError('Pet');
throw new ValidationError('Invalid input', [{ field: 'name', message: 'Required' }]);
```

All errors are converted to consistent `{ success, error, code, requestId }` responses.

### Error Taxonomy

Each error has:
- **code**: Stable category (e.g., `AUTHENTICATION_ERROR`, `DATABASE_ERROR`)
- **severity**: `INFO | LOW | MEDIUM | HIGH | CRITICAL` (auto-assigned by default)
- **retryable**: Whether the operation can be retried (auto-assigned by default)
- **fingerprint**: Stable hash for grouping repeated errors
- **userMessage**: Safe message shown to users (internal message stays in logs)
- **operation**: Context about what operation failed

### Error Codes

| Code | HTTP Status | Severity | Retryable |
|------|-------------|----------|-----------|
| `VALIDATION_ERROR` | 400 | LOW | No |
| `AUTHENTICATION_ERROR` | 401 | MEDIUM | No |
| `AUTHORIZATION_ERROR` | 403 | MEDIUM | No |
| `NOT_FOUND_ERROR` | 404 | LOW | No |
| `CONFLICT_ERROR` | 409 | MEDIUM | No |
| `BUSINESS_RULE_ERROR` | 422 | MEDIUM | No |
| `RATE_LIMIT_ERROR` | 429 | LOW | Yes |
| `DATABASE_ERROR` | 500 | HIGH | Yes |
| `EXTERNAL_SERVICE_ERROR` | 502 | HIGH | Yes |
| `NETWORK_ERROR` | 502 | HIGH | Yes |
| `INTEGRATION_ERROR` | 502 | HIGH | Yes |
| `TIMEOUT_ERROR` | 504 | HIGH | Yes |
| `CONFIGURATION_ERROR` | 500 | HIGH | No |
| `SYSTEM_ERROR` | 500 | CRITICAL | No |
| `UNEXPECTED_ERROR` | 500 | CRITICAL | No |

### Error Fingerprints

Errors are fingerprinted by hashing `code + normalized_message`. This allows grouping repeated incidents without losing unique request context. IDs (MongoDB ObjectIds, UUIDs, numbers) are normalized before hashing.

## Redaction

PawTag uses a central redaction policy (`lib/redaction.ts`) to prevent sensitive data from appearing in logs.

### What Is Redacted

| Category | Fields |
|----------|--------|
| Passwords | `password`, `passwordHash`, `hashedPassword`, `passwd` |
| Tokens | `token`, `accessToken`, `refreshToken`, `sessionToken` |
| Secrets | `secret`, `jwtSecret`, `secretKey`, `privateKey` |
| API Keys | `apiKey`, `api_key`, `apiSecret` |
| HTTP Headers | `authorization`, `cookie`, `set-cookie` |
| OTP/MFA | `otp`, `otpCode`, `mfaSecret`, `mfaCode` |
| Payment | `creditCard`, `cardNumber`, `cvv`, `cvc`, `ssn` |
| PawTag-Specific | `finderPhone`, `finderEmail`, `emergencyContact`, `emergencyPhone` |

### Usage

```typescript
import { deepRedact, sanitizeRequestBody, sanitizeHeaders } from '../lib/redaction';

// Redact sensitive fields in objects
const safeData = deepRedact({ password: 'secret', name: 'John' });
// { password: '[REDACTED]', name: 'John' }

// Sanitize request body for logging
const safeBody = sanitizeRequestBody(req.body);

// Sanitize headers for logging
const safeHeaders = sanitizeHeaders(req.headers);
```

### What Must Never Be Logged

1. Raw environment variables or `.env` contents
2. Complete request headers (use `sanitizeHeaders`)
3. Complete request bodies (use `sanitizeRequestBody`)
4. Database connection strings
5. Private keys or certificates

## Migration from console.*

When migrating existing code:

```typescript
// Before
console.error('Login failed:', error);

// After
logger.error({ err: error, email: req.body?.email }, 'Login failed');
```

### Rules

1. Always use structured fields for context
2. Include the error object as `err` field
3. Add relevant IDs (userId, orderId, tagId)
4. Keep human-readable message as second argument
5. Never use string concatenation
