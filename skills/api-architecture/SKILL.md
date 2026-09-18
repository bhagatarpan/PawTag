---
name: api-architecture
description: Implement or review PawTag API routes, services, shared endpoint definitions, request/response contracts, validation, pagination, errors, and frontend API usage. Use when adding/changing endpoints, moving route logic into services, updating packages/shared API clients, or resolving web/mobile/API contract drift. Preserve practical route-service-model boundaries without forcing unnecessary abstraction.
---

# API Architecture

Follow `AGENTS.md` first.

## Preferred layering

`route/controller -> validation/auth middleware -> service/domain logic -> model/repository/integration`

Routes should primarily:
- parse/validate input,
- authenticate/authorize,
- call a service,
- map service result/errors to HTTP.

Move substantial reusable business orchestration out of giant route files when touching that behavior. Do not perform a repository-wide refactor merely to satisfy layering aesthetics.

## Shared contracts

Frontend application API calls should use centralized endpoint definitions and shared DTO/types where those abstractions genuinely fit. New shared application endpoints should normally be represented in `packages/shared`.

Do not certify an existing shared abstraction as correct without tracing its consumers. In particular, storage/token APIs used by both browser and React Native should use explicit types/contracts rather than runtime guessing.

## Validation

Validate all public mutations, commerce mutations, security-sensitive input, and destructive admin actions server-side. Do not rely on frontend schemas for security.

Prefer schemas that can be shared only when server and client semantics are truly identical.

## Responses/errors

Keep status codes and error shapes consistent enough for clients to handle predictably. Avoid leaking internal stack/provider details. Include actionable machine-readable error codes for expected business failures where useful.

## Collection endpoints

Use bounded pagination for potentially large collections. Define sorting/filtering explicitly. Avoid returning full internal Mongoose documents when a response DTO/projection is more appropriate.

## Versioning

Do not add versioning machinery without a real compatibility requirement. Preserve backward compatibility for released clients where relevant.
