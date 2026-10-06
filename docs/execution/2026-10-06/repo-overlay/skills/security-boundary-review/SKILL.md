---
name: security-boundary-review
description: Review or implement PawTag authentication, authorization, ownership, privacy, admin permissions, public endpoints, uploads, and sensitive mutations. Use whenever code touches users, pets, tags, finder data, orders, subscriptions, admin actions, tokens, verification, files, or any resource that one account must not access through another account. Focus on server-side trust boundaries and IDOR/BOLA prevention.
---

# Security Boundary Review

Treat `AGENTS.md` security rules as mandatory.

## Resource access questions

For every protected operation answer from code:

- Who is the caller?
- What identity is trusted, and where was it established?
- What resource is being accessed?
- Why may this caller access that resource?
- Is ownership constrained in the server query or service logic?
- Is required role/permission checked server-side?
- Can changing an ID, payment intent, tag ID, user ID, or nested resource ID cross an account boundary?
- Does an admin permission match the exact destructive or financial capability?

## Non-negotiable rule

Never weaken authentication, ownership, authorization, validation, privacy, or audit controls merely because a legitimate workflow currently fails. Find the real contract defect.

## Check by category

### Authentication
- Token creation, expiry, rotation, revocation, invalidation.
- Password reset and verification tokens.
- MFA and account lockout.
- Secure client storage and session teardown.

### Authorization
- Horizontal access between customers.
- Vertical escalation to admin capabilities.
- Nested-resource ownership.
- Super-admin behavior must still preserve explicit safety controls.

### Public/Finder
- Return explicit public DTO/projections only.
- Minimize PII, health, location, and contact data.
- Apply abuse controls without breaking legitimate recovery.

### Mutations
- Validate input server-side.
- Audit sensitive/destructive/financial actions.
- Avoid trusting prices, roles, ownership, totals, status transitions, or permissions from clients.

## Review output

Identify concrete exploit/failure path, affected file/function, severity, and minimal secure remediation. Add regression tests for boundary failures where practical.
