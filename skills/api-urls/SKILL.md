---
name: api-urls
description: Enforce centralized API endpoint usage across ALL PawTag codebases. Never hardcode API URLs in any frontend application (web, admin, finder, mobile). Use the centralized API constants from packages/shared/src/api/endpoints.ts.
---

# API URL Conventions

Follow `AGENTS.md` first.

## Core Rule: Never hardcode API paths

Every frontend API call MUST use the centralized `API.*` constants from `@pawtag/shared/api`. This applies to ALL domains: auth, cart, checkout, shipping, finder, admin, invoices, subscriptions, guardian, uploads, CMS, referrals, support, products, tags, and any future endpoints.

## Correct pattern

```typescript
import { API } from '@pawtag/shared/api';
import api from '../lib/api';

// api client has baseURL configured (e.g., '/api' or VITE_API_URL)
const res = await api.get(API.checkout.pending);
// Resolves to: {baseURL}/checkout/pending → /api/checkout/pending
```

## Wrong patterns (NEVER do these)

```typescript
// WRONG: Double prefix — baseURL is already '/api'
api.get('/api/checkout/pending');
// Resolves to /api/api/checkout/pending → 404 ❌

// WRONG: Hardcoded path
api.get('/api/auth/login');
// Resolves to /api/api/auth/login → 404 ❌

// WRONG: Manual URL construction with hardcoded prefix
axios.post(`/api${API.public.promo.validate}`, data);
// Bypasses auth interceptors and hardcodes prefix ❌

// WRONG: Direct axios import bypasses configured client
import axios from 'axios';
axios.get('/api/something');
// No auth tokens, no 401 handling, no refresh logic ❌
```

## API Client Setup per App

| App | File | baseURL |
|-----|------|---------|
| web | `apps/web/src/lib/api.ts` | `import.meta.env.VITE_API_URL \|\| '/api'` |
| admin | `apps/admin/src/lib/api.ts` | `import.meta.env.VITE_API_URL \|\| '/api'` |
| finder | `apps/finder/src/lib/finderApi.ts` | `import.meta.env.VITE_API_URL \|\| '/api'` |
| mobile | `apps/mobile/src/api/client.ts` | `process.env.EXPO_PUBLIC_API_URL \|\| 'http://localhost:5000/api'` |

The shared client factory is at `packages/shared/src/api/client-factory.ts`.

## Adding new endpoints

1. Add the path to `packages/shared/src/api/endpoints.ts` under the appropriate namespace
2. Export from `packages/shared/src/api/index.ts` if needed
3. Use `API.namespace.endpoint` in all frontend code
4. Never hardcode paths in components or pages

## Exceptions (rare)

- `fetch()` for public unauthenticated endpoints (invoice view, support contact form) may use `fetch(\`/api${API.public.*}\`)` when the auth interceptor would interfere
- Direct `axios` should NEVER be used in production code — always use the configured `api` client

## Address Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/customer/addresses` | List all saved addresses |
| `POST` | `/customer/addresses` | Create new address (max 5) |
| `PUT` | `/customer/addresses/:id` | Update address |
| `DELETE` | `/customer/addresses/:id` | Delete address |
| `PUT` | `/customer/addresses/:id/default` | Set as preferred address |
| `GET` | `/address/suggest` | Address autocomplete (Photon/NZ Post) |

**Rules:**
- Address CRUD uses `API.customer.addresses.*` constants
- Address autocomplete uses `API.address.suggest`
- 5-address limit enforced server-side
- Label is required for all addresses
- One address can be marked as preferred/default

## Audit checklist

Before committing any frontend change that makes API calls:
- [ ] All API paths use `API.*` constants
- [ ] No hardcoded `/api/` strings in fetch/axios calls
- [ ] No direct `import axios from 'axios'` (except where explicitly justified)
- [ ] No double-prefix bugs (`/api/api/...`)
- [ ] New endpoints are in `endpoints.ts`
