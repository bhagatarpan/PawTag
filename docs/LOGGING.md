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
