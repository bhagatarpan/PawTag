# Shared API Contract Cleanup

> Continue centralizing endpoints/types in `packages/shared`.
> Remove literal endpoint strings from applications as features are touched.
>
> Last updated: 2026-09-19

## Purpose

The goal is compile-time drift detection between clients and intended endpoints. When endpoint strings are centralized in `packages/shared`, TypeScript can catch mismatches at compile time.

## Current State

### Shared API Endpoints (packages/shared)

All API endpoints are defined in `packages/shared/src/api/endpoints.ts`:

```typescript
export const API = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    // ...
  },
  admin: {
    users: {
      list: '/admin/users',
      get: (id: string) => `/admin/users/${id}`,
      // ...
    },
    // ...
  },
  // ...
};
```

### Literal Endpoint Strings Found

The following files contain hardcoded endpoint strings that should use the shared API:

| File | Line | Hardcoded String | Should Use |
|---|---|---|---|
| `apps/admin/src/pages/AddressAutocompleteSettings.tsx` | — | `/api/address/suggest` | `API.address.suggest` |
| `apps/admin/src/pages/Shipments.tsx` | — | `/api/admin/commerce/shipments/${id}/label` | `API.admin.commerce.shipments.label(id)` |
| `apps/admin/src/pages/SubscriptionDetailPage.tsx` | — | `/api/admin/invoices/${id}/view` | `API.admin.invoices.view(id)` |
| `apps/admin/src/pages/SubscriptionDetailPage.tsx` | — | `/api/admin/invoices/${id}/email` | `API.admin.invoices.email(id)` |
| `apps/admin/src/pages/SubscriptionDetailPage.tsx` | — | `/api/admin/invoices/${id}/print` | `API.admin.invoices.print(id)` |
| `apps/finder/src/lib/finderApi.ts` | — | `/api/auth/refresh` | `API.auth.refresh` |
| `apps/web/src/lib/api.ts` | — | `/api/auth/refresh` | `API.auth.refresh` |
| `apps/web/src/pages/Checkout.tsx` | — | `/api/checkout/pending` | `API.checkout.pending` |

## Cleanup Rules

### When to Clean Up

- When touching a file for a feature or bug fix
- When adding new endpoints
- During dedicated cleanup passes

### How to Clean Up

1. **Import the shared API endpoint**:
   ```typescript
   // Before
   const res = await api.get('/api/auth/refresh');
   
   // After
   import { API } from '@pawtag/shared/api';
   const res = await api.get(API.auth.refresh);
   ```

2. **For dynamic endpoints**:
   ```typescript
   // Before
   const res = await api.get(`/api/admin/users/${userId}`);
   
   // After
   import { API } from '@pawtag/shared/api';
   const res = await api.get(API.admin.users.get(userId));
   ```

3. **For URL construction**:
   ```typescript
   // Before
   const url = `/api/admin/commerce/shipments/${shipmentId}/label`;
   
   // After
   import { API } from '@pawtag/shared/api';
   const url = API.admin.commerce.shipments.label(shipmentId);
   ```

### Benefits

- **Compile-time safety**: TypeScript catches endpoint mismatches
- **IDE support**: Autocomplete for available endpoints
- **Refactoring safety**: Rename endpoint in one place, all consumers update
- **Documentation**: Endpoint structure is self-documenting

## Shared Types Location

Request/response DTOs should be in `packages/shared/src/api/types.ts`:

```typescript
// Example DTO
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
}

// Example usage
import { API, LoginRequest, LoginResponse } from '@pawtag/shared/api';

const res = await api.post<LoginResponse>(API.auth.login, {
  email,
  password,
} satisfies LoginRequest);
```

## What NOT to Share

- Mongoose document types (use DTOs instead)
- Internal server state
- Database connection details
- Authentication secrets

## Related Documents

- `packages/shared/src/api/endpoints.ts` — Shared endpoint definitions
- `packages/shared/src/api/types.ts` — Shared DTO types
- `docs/SHARED-CONTRACTS.md` — Shared contracts overview
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
