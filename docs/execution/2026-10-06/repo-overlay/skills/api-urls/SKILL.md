---
name: api-urls
description: Enforce centralized PawTag frontend API endpoint definitions and configured API clients across customer web, admin, Finder web, and the web-first customer mobile shell. Use when adding/changing frontend API calls or endpoint definitions. Prevent hardcoded `/api` paths, double prefixes, ad-hoc clients, and browser/native contract drift.
---

# API URL Conventions

Use `API.*` constants from `packages/shared/src/api/endpoints.ts` and each application's configured client unless a documented exception is required.

Current browser clients include `apps/web`, `apps/admin`, and `apps/finder`. The existing Expo client may remain during migration, but the target installed customer app uses the same `apps/web` client inside the Capacitor shell rather than a second product API layer.

Before committing a frontend API change verify:
- new/shared endpoint is represented centrally where that is the repo convention;
- base URL is applied once;
- no accidental `/api/api/...`;
- auth/cookie/native bridge behavior uses the configured client contract;
- direct Axios/fetch usage is deliberate and does not bypass required interceptors/credentials;
- web/native shell requests target the same API contract.
