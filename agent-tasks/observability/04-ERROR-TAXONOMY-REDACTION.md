# Phase 4 — Error Taxonomy and Sensitive Data Protection

## Objective

Make errors consistently classifiable and make accidental sensitive-data logging difficult.

## Error taxonomy

Define stable categories appropriate to PawTag, such as:

- AUTHENTICATION_ERROR
- AUTHORIZATION_ERROR
- VALIDATION_ERROR
- BUSINESS_RULE_ERROR
- NOT_FOUND_ERROR
- DATABASE_ERROR
- EXTERNAL_SERVICE_ERROR
- NETWORK_ERROR
- TIMEOUT_ERROR
- RATE_LIMIT_ERROR
- CONFIGURATION_ERROR
- INTEGRATION_ERROR
- SYSTEM_ERROR
- UNEXPECTED_ERROR

Do not create categories that merely duplicate existing domain errors.

Each error should support:

- stable code
- category
- safe user-facing message
- internal technical message
- severity
- retryability where meaningful
- cause
- stack
- metadata
- operation context

## Redaction

Create a central redaction/sanitisation policy.

At minimum inspect and protect:

- passwords
- password hashes
- access tokens
- refresh tokens
- JWTs
- authorization headers
- cookies
- API keys
- secrets
- private keys
- OTPs
- payment credentials
- sensitive personal data

Also evaluate PawTag-specific sensitive fields such as:

- phone numbers
- email addresses
- precise location
- emergency contacts
- private communications

Do not assume every occurrence must be fully removed; define safe handling based on operational need.

## Rules

Redaction must happen centrally where possible.

Do not rely on every developer remembering every secret field.

Never log raw environment variables.

Never log `.env` contents.

Never log complete request headers by default.

Never log complete request bodies by default.

## Error fingerprints

Where useful, create stable error fingerprints so repeated incidents can be grouped without losing unique request context.

## Tests

Create tests proving sensitive fields are redacted.

Include nested objects and error objects.

Test that safe fields remain available.

Test production responses do not leak internal details.

Commit:

`feat(observability): phase 4 - harden error taxonomy and redaction`

Push.

Mark COMPLETE.

```text
STATUS: COMPLETE
COMPLETED_AT: 2026-08-17
COMMIT_SHA: 7b91331
REMOTE_BRANCH: feat/enterprise-observability
TEST_RESULT: typecheck pass, build pass, 978/979 tests pass (1 pre-existing authMiddleware failure)
NOTES: Enhanced error model with severity, retryability, fingerprint, userMessage, operation context. Added NetworkError and IntegrationError. Created centralized redaction module (lib/redaction.ts) with sensitive field detection, deep object redaction, request/header sanitization. Updated errorHandler with new error fields. Production responses hide internal details. Comprehensive tests for redaction (29 tests) and error taxonomy (42 tests).
```
