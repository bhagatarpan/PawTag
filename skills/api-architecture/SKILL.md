---
name: api-architecture
description: Use when creating, modifying, or reviewing API calls, endpoints, or client configuration. Enforces centralized API endpoint definitions, shared client factory usage, and prohibits hard-coded API paths. Mandatory before any API-related change.
---

# API Architecture & Centralization Rules

## Core Rule

ALL API endpoints MUST be defined in `packages/shared/src/api/endpoints.ts`.
ALL API client instances MUST be created via `createApiClient` from `@pawtag/shared/api`.
NO hard-coded API path strings allowed in frontend code.

## Single Source of Truth

### Endpoint Constants

Every API path is defined in `packages/shared/src/api/endpoints.ts` as part of the `API` object:

```typescript
import { API } from '@pawtag/shared/api';

// Static paths
api.get(API.auth.login);
api.get(API.customer.pets.list);

// Dynamic paths (functions)
api.get(API.admin.users.get(userId));
api.get(API.finder.tag(tagId));
```

**Convention:**
- Static paths: `API.domain.resource` (e.g., `API.auth.login`)
- Dynamic paths: `API.domain.resource(id)` — functions return the full path
- All paths are relative to the API base URL (typically `/api`)

### Client Factory

Each app creates its API client using `createApiClient`:

```typescript
import { createApiClient, createLocalStorageTokenStorage } from '@pawtag/shared/api';

export default createApiClient({
  baseURL: '/api',
  storage: createLocalStorageTokenStorage('pawtag_token', 'pawtag_refresh_token'),
  refreshEndpoint: '/api/auth/refresh',
  onAuthFailure: () => { /* app-specific cleanup */ },
});
```

**Factory features:**
- Queue-based 401 token refresh (concurrent requests share one refresh call)
- Sync storage (localStorage) or async storage (SecureStore) support
- Per-app `onAuthFailure` callback (redirect, clear tokens, etc.)
- Optional response interceptors (admin auto-toast, etc.)

## Rules

### MUST

1. **Import `API` from `@pawtag/shared/api`** — never hard-code path strings
2. **Use the shared client instance** — never create raw `axios.create()` instances
3. **Use `API.domain.resource(id)` for dynamic paths** — never interpolate strings
4. **Add new endpoints to `endpoints.ts`** before using them in frontend code
5. **Keep endpoint functions pure** — no side effects, just return the path string

### MUST NOT

1. **Never use raw `axios.get()`/`axios.post()`** — always use the configured client
2. **Never hard-code `/api/...` paths** in frontend call sites
3. **Never duplicate the token refresh logic** — use `createApiClient`
4. **Never skip the client's interceptors** by importing axios directly
5. **Never put API base URLs in frontend code** — use the client's `baseURL` config

### EXCEPTIONS

- **Backend routes** (`packages/api/src/routes/`) — these DEFINE the endpoints, they don't consume them
- **Finder app `useSiteSettings`** — may use raw axios for simple unauthenticated calls (document why)
- **Mobile token storage** — uses async `AsyncTokenStorage` interface, not localStorage

## Adding a New Endpoint

1. Add the endpoint to `packages/shared/src/api/endpoints.ts`:
   ```typescript
   export const API = {
     // ... existing endpoints
     admin: {
       // ... existing admin endpoints
       newFeature: {
         list: '/admin/new-feature',
         get: (id: string) => `/admin/new-feature/${id}` as const,
       },
     },
   } as const;
   ```

2. Use it in the frontend:
   ```typescript
   import { API } from '@pawtag/shared/api';
   
   const res = await api.get(API.admin.newFeature.list);
   const item = await api.get(API.admin.newFeature.get('123'));
   ```

3. No changes needed to the client factory or app-specific `api.ts` files.

## File Structure

```
packages/shared/src/api/
├── endpoints.ts          # ALL endpoint paths (single source of truth)
├── client-factory.ts     # Shared axios factory (refresh, interceptors, storage)
└── index.ts              # Barrel export

apps/web/src/lib/api.ts      # Uses createApiClient + localStorage
apps/admin/src/lib/api.ts    # Uses createApiClient + auto-toast interceptor
apps/finder/src/lib/finderApi.ts  # Uses createApiClient (unauthenticated)
apps/mobile/src/api/client.ts     # Uses createApiClient + async SecureStore
```

## Verification Checklist

Before submitting any API-related PR:

- [ ] No hard-coded `/api/...` strings in frontend files
- [ ] All new endpoints added to `endpoints.ts`
- [ ] No raw `axios` imports in frontend (except documented exceptions)
- [ ] No duplicated token refresh logic
- [ ] New endpoints have tests in `tests/unit/api-endpoints.test.ts`
- [ ] `pnpm --filter @pawtag/shared typecheck` passes
- [ ] `pnpm vitest run tests/unit/api-endpoints.test.ts` passes
