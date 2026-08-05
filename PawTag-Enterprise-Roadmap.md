# PawTag — Enterprise Production Roadmap

**Prepared as:** Technical Leadership (Architecture, Product, Security, QA, DevOps)
**Audience:** Founder / Business Owner (non-technical)
**Purpose:** Take PawTag from its current state to a production-ready, commercially launchable SaaS platform.

This document is self-contained. It builds on the prior code audit and does not repeat it — it makes the decisions you asked for, verifies the real business workflow end-to-end against the actual code, and lays out a phase-by-phase execution plan you can hand to Claude Code one phase at a time.

---

## Part 1 — Final Architecture Decisions

You asked me to decide, not to ask. Here are the calls, and why.

### 1.1 Mobile strategy — React Native (Expo), not Flutter

**Decision: build the pet-owner app in React Native, and delete the existing Flutter scaffold.**

Reasoning:
- The Flutter code that exists today is not a real app — it's a handful of scaffold files (a location provider, two auth pages, an unfinished "Find My" integration). Nothing commercially usable would be lost by removing it.
- Your entire team — human and AI — is already working in TypeScript across `packages/api`, `packages/shared`, and four React frontends. React Native lets the mobile app **import `packages/shared` directly** (types, validation schemas, API client), so a change to your data model updates web and mobile at the same time, from one source of truth. Flutter (Dart) cannot do this — it would always be a second, hand-synced copy of your business logic.
- One language across the whole stack means one set of AI-assisted coding sessions, one hiring pool, one set of conventions — directly serves your "remove duplicate technologies" instruction.
- Expo's managed workflow gives QR camera scanning, push notifications, and — critically for your NFC requirement — NFC read/write via `react-native-nfc-manager`, without you needing native iOS/Android build expertise day one.

**What gets removed:** `lib/`, `android/`, `ios/`, `pubspec.yaml`, `pubspec.lock`, `test/widget_test.dart`, `web/` (Flutter's web build target, not to be confused with `apps/web`). This happens in Phase 1.

**What the finder gets:** nothing installable. A URL. Confirmed in Part 2 below — this is already how `apps/finder` works today, and it stays that way. NFC for the finder is a **tag-side** feature (the physical NFC chip is programmed to open the same finder URL when tapped) — no finder-side app or download is needed for NFC either.

### 1.2 Backend strategy — keep one Express API, no changes

**Decision: keep `packages/api` as the single backend for web, admin, customer portal, finder page, and the new mobile app.**

There is no duplication to remove here — this is correctly built as one API serving multiple clients. The only change: mobile needs a couple of API additions (see 1.3) that don't exist for a browser client (e.g., push token registration — which already has a `PushToken` model, encouragingly).

### 1.3 Authentication strategy — one JWT-based auth, extended with refresh tokens

**Decision: keep the existing JWT + bcrypt system as the single identity provider for every client (web, admin, customer, finder-none, mobile). Do not introduce Auth0/Cognito/Firebase Auth at this stage.**

Reasoning: You already have a working, reasonably well-tested auth system (97% test coverage per the prior audit) with email verification, phone OTP, and password reset. Bringing in an external identity provider now would be pure re-architecture risk with no functional gain — that's the "duplicate technology" pattern you explicitly asked me to avoid creating.

One real gap confirmed in code: `auth.service.ts` issues a single JWT with an expiry (`config.jwtExpiresIn`) and **there is no refresh token** — when it expires, the user is simply logged out. That's tolerable for a web session but will feel broken on mobile, where people expect to stay logged in for weeks. **Add short-lived access tokens (15–30 min) + long-lived rotating refresh tokens** before mobile ships. This is Phase 2.

If you later need enterprise SSO (e.g., a corporate pet-insurance partner wants their staff to log in with their own company login), that's an additive integration on top of this system, not a replacement — defer it until a real customer asks for it.

### 1.4 Frontend strategy — keep four separate apps, don't merge them

**Decision: keep `apps/web`, `apps/customer`, `apps/admin`, `apps/finder` as four separate builds.**

This looks like duplication at first glance but isn't: each serves a different audience with a different security posture (public marketing, authenticated customer, privileged admin, anonymous finder) and different performance needs (the finder page in particular must be tiny and load instantly on a stranger's phone with poor signal — bundling it with the full customer portal would hurt the one interaction that matters most for reunions). Keep them separate; unify them only at the **design-system level** (see Phase 4) so they don't visually drift.

### 1.5 Deployment strategy

You asked me to recommend where this runs, and why, category by category. Table below, reasoning follows.

| Layer | Recommendation | Why |
|---|---|---|
| Backend API (Docker) | **Render** (Web Service, autoscaling) | `docker/Dockerfile.api` already exists and works as-is. Render deploys a Dockerfile with zero extra config, gives you managed TLS, autoscaling, health checks, and preview environments per PR — enterprise behavior without needing a DevOps hire. |
| Web, customer, admin, finder (4 SPAs) | **Vercel** | Static/SPA hosting with global CDN, automatic SSL, instant rollbacks, and a preview URL for every pull request — lets you (non-technical) *see* a change before it's live, just by clicking a link. |
| Database | **MongoDB Atlas** (already in use) | Keep it — don't migrate. Move to a paid tier with **daily automated backups + point-in-time recovery** and enable **IP allowlisting** restricted to Render's egress IPs. |
| Object storage (pet photos, vet PDFs, product images) | **Cloudflare R2** | S3-compatible API (so no code lock-in) with **zero egress fees** — meaningfully cheaper than AWS S3 at your scale, since every finder-page view loads a pet photo. |
| Email (transactional) | **Postmark** | Best-in-class deliverability for transactional mail (verification, password reset, order confirmation, "your pet was found") — this category cannot tolerate landing in spam. |
| SMS | **Twilio** | Industry standard, already assumed by the existing `sms.service.ts`/CMS SMS templates — no change needed, just move to a real account. |
| Payments | **Stripe** (already integrated) | Keep. Move off demo mode, use **Stripe Checkout** or Elements for PCI-compliant card capture, and use **Stripe Billing** (subscriptions) natively for renewals instead of hand-rolled expiry logic — less code for you to maintain, and Stripe handles dunning (failed-payment retries) for you. |
| Shipping / courier | **Sendle** or **NZ Post eCommerce API** | Your seed admin account is `@pawtag.co.nz` — assuming NZ-based fulfillment, both offer label generation + tracking-number APIs with reasonable small-business pricing. Pick whichever your actual courier relationship favors; the integration code is a thin adapter either way. |
| Monitoring / error tracking | **Sentry** | One tool, covers the Express API, all four React apps, and (later) the React Native app. Free tier is enough at launch. |
| Logging | **Better Stack (Logtail)** | Cheap, simple log aggregation + uptime monitoring + a public status page — gives you, the founder, a plain-English dashboard of "is the site up" without needing to read logs yourself. |
| CI/CD | **GitHub Actions** (already present) | Extend the existing `ci.yml` (tests already run here) to also **deploy** to Render/Vercel on merge to `main` (production) and `develop` (staging). |
| Secrets management | **Render/Vercel built-in encrypted env vars** for now; **Doppler** once you have more than 1–2 people touching infrastructure | Avoids secrets ever being pasted into chat, code, or Slack. |
| Backups | Atlas automated snapshots (daily, 7-day retention minimum) + R2 versioning | Standard, low-effort, restores in minutes. |
| Disaster recovery | Documented runbook (Phase 26) + infra defined in Dockerfiles/CI (already mostly true) | You can rebuild the entire stack from the repo + a new Atlas cluster + secrets in under a day. |
| CDN | Vercel edge network (frontends) + Cloudflare in front of the API | Cloudflare in front of Render also gives you free DDoS protection and a WAF — important because the finder page is fully public and unauthenticated by design. |
| Domain / SSL | **Cloudflare DNS** + automatic SSL from Vercel/Render | No manual certificate renewal, ever. |
| Environment strategy | **local → staging → production**, three separate Atlas databases, three separate Stripe accounts (test/test/live) | Prevents a staging test order from ever touching real customer data or a real credit card. |

**Monthly cost at MVP scale is modest** (roughly USD $50–150/month across Render + Vercel + Atlas + Postmark + Twilio + Sentry, before payment processing fees) — this stack is chosen to be cheap and low-ops at your current size, while every piece is a name-brand service you can migrate off of later if you outgrow it. Nothing here is a dead end.

---

## Part 2 — End-to-End Business Flow: Verified Against the Actual Code

I did not assume. Each line below reflects what I found reading the real route files and models, not the README.

| # | Step | Status | Evidence / Gap |
|---|---|---|---|
| 1 | Visits website | ✅ Exists | `apps/web` |
| 2 | Browses products | ✅ Exists | `Product` model, shop routes |
| 3 | Adds tag to cart | ✅ Exists | `Cart` model, `/customer/cart/items` |
| 4 | Checkout | ✅ Exists | `/customer/orders` (POST), address validation |
| 5 | Payment | ⚠️ Partial | Stripe wired but runs in demo mode; order is marked `paid` right after a PaymentIntent is *created*, not after it's *confirmed* client-side. **Financial integrity gap — Phase 5.** |
| 6 | Order confirmation | ⚠️ Partial | Email service exists with templates; not confirmed to fire automatically on order creation — verify/wire in Phase 5. |
| 7 | Invoice | ⚠️ Partial | `Invoice` + `InvoiceAccessToken` models exist (a customer-facing invoice link system is already designed) but **no PDF generation** found. **Phase 15.** |
| 8 | Admin receives order notification | ❌ Missing | No email/dashboard alert fires when an order is placed. An admin could miss a sale entirely. **Phase 7.** |
| 9 | Warehouse receives order | ❌ Missing | No packing/fulfillment concept beyond order status. |
| 10 | Packing | ❌ Missing | No "packed" state in the workflow (status enum has `pending/paid/shipped/delivered/cancelled/refunded` — no `packing`/`packed`). **Phase 6.** |
| 11 | Shipping label | ❌ Missing | No courier API integration. **Phase 9.** |
| 12 | Courier booking | ❌ Missing | Same as above. |
| 13 | Tracking number | ⚠️ Partial | `Order.trackingNumber` field **already exists** and admin can set it manually via `/admin/orders/:id/status` — good foundation, but nothing generates it automatically, and setting it doesn't notify the customer. **Phase 9–10.** |
| 14 | Customer receives shipping updates | ❌ Missing | Confirmed: the admin order-status-update route does not trigger any email/SMS/notification. **Phase 10.** |
| 15 | Order delivered | ⚠️ Partial | `delivered` status exists on the Order model, but nothing sets it automatically (no courier webhook) — currently admin-only manual update. |
| 16 | Customer activates tag | ⚠️ Partial | Tag-to-pet linking API exists, but there's no confirmed flow that ties a *specific physical tag from a specific order* to "activation" — needs the redemption flow built. **Phase 11.** |
| 17 | Tag linked to account | ✅ Exists | `Tag.ownerId` |
| 18 | Tag linked to pet | ✅ Exists | `Tag.petId`, customer pet routes |
| 19 | Subscription starts | ⚠️ Partial | `Subscription` model + Stripe webhook handling exist; needs confirmation this triggers automatically at the right point in the tag-activation flow rather than as a disconnected purchase. |
| 20 | Pet profile completed | ✅ Exists | Extensive — species, breed, medical alerts, photos, vaccinations, microchips, etc. |
| 21 | QR operational | ✅ Exists | `/finder/:tagId` route, fully working, tested. |
| 22 | NFC operational | ❌ Missing entirely | No NFC anywhere in the codebase. New requirement per your mobile decision. **Phase 12.** |
| 23 | Pet lost | ✅ Exists | `/customer/pets/:id/mark-lost` |
| 24 | Finder scans tag | ✅ Exists | Fully built, includes scan logging, "found timer," consent tracking for location sharing. |
| 25 | Owner notified | ✅ Exists | `Notification` created on finder contact/found event. |
| 26 | Pet reunited | ✅ Exists | Auto pet-status flip to `found`, tag reactivation. |
| 27 | Subscription renewal | ⚠️ Partial | Stripe webhook logic present (`invoice.paid`); failed-payment/dunning path not confirmed end-to-end. **Verify in Phase 5/19.** |
| 28 | Repeat purchase | ✅ Exists | Same shop flow. |

**Bottom line:** the *emotional core* of the product — QR scan → owner notified → reunion — is genuinely well-built and tested. The gap is almost entirely on the **commercial operations side**: fulfillment, shipping, notifications-on-status-change, and admin visibility into new orders. That's exactly where the roadmap below concentrates its early phases, because you can't run a physical-goods business without it.

---

## Part 3 — Operations Review

Direct answers to your operational questions, based on what exists today vs. what needs building.

| Question | Current reality | Fix |
|---|---|---|
| How does the owner know a new order arrived? | Nothing — silent. | Phase 7: email + admin dashboard badge. |
| How are invoices generated? | DB record only, no PDF. | Phase 15: PDF generation on payment success. |
| How are shipping labels created? | Manually, outside the system (or not at all). | Phase 9: courier API integration. |
| How are tracking numbers stored? | Field exists, set manually by admin. | Phase 9: auto-populate from courier API. |
| How are customers notified of status? | They aren't. | Phase 10. |
| How are refunds handled? | `createRefund()` exists in the Stripe service but isn't wired into an admin action or inventory restock. | Phase 8. |
| How are cancelled orders handled? | Status value exists, no workflow around it (restocking, refund trigger, customer email). | Phase 6/8. |
| How are returns handled? | Not built at all. | Phase 8 (scoped as "cancellation + basic RMA," full returns can be a post-MVP phase if volume justifies it). |
| How are subscriptions renewed? | Stripe webhook-driven — mostly automated. | Verify only (Phase 19). |
| How are failed payments handled? | Partially — a `TagExpiryNotification` model suggests grace-period logic exists for expired subscriptions, but dunning emails aren't confirmed. | Phase 19. |
| How are expired tags handled? | `grace_period` subscription status exists on `Tag` — reasonably well handled already. | Verify only. |
| How are replacement/damaged tags handled? | Not built. | Phase 13. |
| How are support requests handled? | No ticketing model exists. | Phase 19 — recommend a lightweight "contact us → email" form first, and only adopt a full helpdesk tool (e.g. Plain, Freshdesk) once support volume justifies the cost, rather than building one from scratch. |
| How are admin users notified? | `Notification` model appears customer-scoped only. | Extend in Phase 7. |
| How are inventory levels updated? | Automatically decremented at order time — this already works well. | No action needed. |
| How are low-stock alerts generated? | Not built. | Phase 19. |
| How are reports produced? | No reporting/analytics surface in the admin app currently. | Phase 18: basic order/revenue/scan-volume dashboard using data you already have — no new infrastructure required. |

---

## Part 4 — Gap Analysis (Classified)

**Critical** — blocks running the business or creates real financial/legal risk:
1. Payment confirmed before charge actually succeeds (order marked `paid` prematurely)
2. No order fulfillment/shipping/tracking workflow
3. No admin notification of new orders
4. Hardcoded secrets in seed data / demo Stripe key checked into repo
5. No refresh-token session strategy (blocks a usable mobile app)
6. No native mobile app (business decision, required)
7. No NFC support anywhere (business decision, required)
8. Uploaded files (photos, vet PDFs) stored on local disk — **will be silently deleted on every redeploy** on most modern hosting platforms

**High** — should not launch commercially without these:
9. No invoice PDF generation
10. No cancellation/refund/returns workflow
11. No replacement-tag flow
12. CORS reflects any origin (`origin: true`) — needs a whitelist
13. Missing MongoDB indexes on hot paths (`Tag.tagId`, `User.email`, `Pet.ownerId`)
14. No error tracking / monitoring (Sentry) in production
15. API test coverage ~16%, no end-to-end tests
16. No deploy pipeline (CI runs tests only, doesn't ship anywhere)
17. No customer notification on order status change

**Medium** — matters for a polished, maintainable product:
18. No low-stock alerting
19. No support/ticketing intake
20. No admin analytics/reporting
21. No structured logging (console.log only)
22. No DB-connectivity health check endpoint
23. No API versioning strategy
24. React apps have no error boundaries
25. Rate limiting is in-memory (fine for one server, breaks under autoscaling — needs Redis-backed limiter before you scale past one instance)

**Low** — cleanup, doesn't block launch:
26. Inconsistent error message phrasing across routes
27. Swagger annotations exist per-route but no generated OpenAPI spec/docs site
28. Flutter scaffold still in the repo (removed in Phase 1)
29. Duplicate `PUBLIC_SETTING_KEYS` constant in two CMS files

---

## Part 5 — Enterprise Audit Summary

Condensed by domain (full detail lives in the phase-by-phase work below, where each finding becomes a concrete task):

| Domain | Assessment |
|---|---|
| **Architecture** | Sound. Monorepo with clear package boundaries, four purpose-built frontends, one API. No structural rework needed — only the gaps above. |
| **Security** | Good foundations (bcrypt, JWT, Zod validation, RBAC, audit logging, Helmet, rate limiting) undermined by operational gaps: no secrets rotation, permissive CORS, no refresh tokens, local file storage. Addressed in Phases 2, 4, 14. |
| **Performance** | No caching layer, missing indexes, in-memory rate limiting won't survive autoscaling. Addressed in Phases 3, 14+. |
| **Scalability** | Backend is stateless and horizontally scalable *except* for local file storage and in-memory rate limiting — both fixed before they'd become a real problem. |
| **Maintainability** | Strong — TypeScript strict mode, Zod everywhere, consistent response shape, RBAC-gated CRUD. This is a genuinely well-organized codebase to keep building on. |
| **Accessibility** | Not yet audited; the finder page (public, used under stress by strangers) is the highest-priority target — added to the testing roadmap. |
| **SEO** | `apps/web` is the only page that needs it; not yet assessed — low priority until traffic acquisition begins. |
| **Compliance / Privacy** | Location consent is already tracked on finder scans (a genuinely good sign) — but you're capturing pet-owner PII, phone numbers, medical data, and GPS coordinates, so a privacy policy, data-retention policy, and (if selling in NZ/AU/EU) basic compliance review is needed before public launch. Flagged for Phase 26 documentation, but get legal review in parallel — that's outside what code can solve. |
| **Auth/Authz** | Strong RBAC design; missing refresh tokens (Phase 2). |
| **Database** | MongoDB Atlas, well-modeled (35+ models), missing indexes (Phase 3), backups need to be turned on for production tier (Part 1.5). |
| **API design** | Consistent `{ success, data?, error? }` shape, Zod-validated — a genuine strength. No versioning yet; not urgent pre-launch. |
| **DevOps/CI-CD** | Tests run in CI; nothing deploys yet. Phase 16 closes this gap entirely. |
| **Testing/QA** | 201 tests exist but concentrated in auth/security; commerce and fulfillment paths are essentially untested. Testing roadmap below. |
| **Monitoring/Logging/Observability** | None in production today. Phase 17. |
| **Documentation** | This document is the start; Phase 26 produces the full set. |

---

## Part 6 — Testing Roadmap

| Type | Current state | Target | Tooling |
|---|---|---|---|
| Unit | 142 tests, concentrated in auth/validation/email | 80%+ on all services, 100% on auth + payment logic | Vitest (already configured) |
| Integration | 20 tests, auth only | Every route file (customer, admin, finder, subscriptions) covered for happy-path + key failure paths | Vitest + MongoDB Memory Server (already configured) |
| API/contract | None | Auto-generated OpenAPI spec (Swagger comments already exist in code) validated in CI | swagger-jsdoc, already partially present |
| End-to-end | None | 5 critical journeys: browse→checkout→pay, tag activation, lost-pet scan→recovery, admin order fulfillment, subscription renewal | Playwright |
| Regression | 33 tests | Grows every time a real bug is found in QA or production | Vitest |
| Smoke | 6 tests | Extended to run against staging immediately after every deploy | Vitest + CI |
| Security | None automated | Dependency scanning (npm audit) + OWASP ZAP baseline scan in CI + Stripe webhook signature verification tests | GitHub Actions + ZAP |
| Performance/load | None | Load test before any planned marketing push (e.g. simulate 500 concurrent finder-page scans) | k6 |
| Accessibility | None | Automated axe-core checks on all four frontends, manual screen-reader pass on the finder page specifically | axe-core, manual |
| Cross-browser | None | Playwright matrix: Chrome, Safari, Firefox — finder page tested on real iOS/Android devices, since that's where it actually gets used | Playwright + BrowserStack (or physical device testing) |
| Mobile app | N/A yet | Detox or Maestro E2E once the app exists; manual QA on real devices before every store submission | Detox/Maestro |

**Coverage gate before "production-ready" is declared:** overall statement coverage ≥70%, 100% on auth + payment + finder-scan logic, all 5 critical E2E journeys green in CI on every merge to `main`.

---

## Part 7 — Documentation Plan

Each of these is produced as the **deliverable of its corresponding phase** below, not written speculatively now (documentation written before the corresponding code exists just goes stale):

- `ARCHITECTURE.md` — Phase 1
- `docs/deployment/` (staging + production guides) — Phase 16
- `docs/developer-setup.md` — Phase 1
- `docs/environments.md` (env var reference per environment) — Phase 2
- `docs/database-schema.md` — Phase 3
- `docs/api/` (generated OpenAPI reference) — Phase 14 (grouped with infra work)
- `docs/business-workflows.md` (this document's Part 2, kept current) — Phase 6
- `docs/support-runbook.md` — Phase 19
- `docs/release-process.md` + `docs/rollback.md` — Phase 16
- `docs/disaster-recovery.md` — Phase 26

---

## Part 8 — The Roadmap

26 phases, grouped into 9 stages. Each phase is independently shippable, keeps the repo deployable, and is scoped for a single AI coding session. **Work them in order** — later phases assume earlier ones are done.

> **Stage A — Stabilize & Secure the Foundation (1–4)**
> **Stage B — Payment & Order Integrity (5–8)**
> **Stage C — Fulfillment & Shipping (9–11)**
> **Stage D — Tag Lifecycle Completion (12–13)**
> **Stage E — Infrastructure Hardening (14–16)**
> **Stage F — Observability & Operations (17–19)**
> **Stage G — Test Hardening (20–21)**
> **Stage H — Mobile App (22–25)**
> **Stage I — Documentation & Launch Readiness (26)**

---

### Phase 1 — Repository cleanup & mobile-strategy lock-in ✅ COMPLETE

> **Status:** Complete. Flutter scaffold removed. `ARCHITECTURE.md` and `docs/developer-setup.md` created. All tests pass.

**Objective:** Remove the abandoned Flutter scaffold and formally document the React Native decision so no future session (human or AI) re-opens this question.
**Why now:** Every phase after this touches either the web repo or (eventually) a new mobile app — starting with a clean, unambiguous repo prevents wasted work.
**Scope:** Delete Flutter artifacts. Create `ARCHITECTURE.md` documenting the one-backend/four-web-app/one-mobile-app decision. Create `docs/developer-setup.md`.
**Files likely affected:** Delete `lib/`, `android/`, `ios/`, `pubspec.yaml`, `pubspec.lock`, `test/widget_test.dart`, `web/` (Flutter web target), `analysis_options.yaml`. Add `ARCHITECTURE.md`, `docs/developer-setup.md`. Update `AGENTS.md` "Next Move" section to point at this roadmap instead of stale notes.
**Database changes:** None.
**API changes:** None.
**UI changes:** None.
**Testing required:** Confirm `pnpm install && pnpm typecheck && pnpm test` still pass after deletion (nothing in the pnpm workspace should reference the Flutter code).
**Acceptance criteria:** Repo contains no Flutter/Dart files. `ARCHITECTURE.md` exists and states the mobile/backend/frontend decisions from Part 1 of this document. `pnpm typecheck` and `pnpm test` pass.
**Risks:** Low — deleting unused scaffold code.
**Rollback plan:** `git revert` the commit; nothing else depends on this change.
**Definition of Done:** Clean `git status`, all existing tests green, `ARCHITECTURE.md` merged.

```
IMPLEMENTATION PROMPT — PHASE 1

You are working in the PawTag monorepo (pnpm workspace, TypeScript). This is Phase 1 of a
26-phase production roadmap. Do ONLY the work described below — do not start any other phase.

TASK:
1. Delete the unused Flutter mobile scaffold entirely: the `lib/`, `android/`, `ios/`, `web/`
   directories at the repo root, `pubspec.yaml`, `pubspec.lock`, `test/widget_test.dart`, and
   `analysis_options.yaml`. Confirm none of these are referenced by `pnpm-workspace.yaml`,
   `package.json`, or any file under `packages/` or `apps/` before deleting — if you find a
   reference, stop and report it instead of deleting.
2. Create `ARCHITECTURE.md` at the repo root documenting:
   - One Express API (`packages/api`) serves all clients.
   - Four web frontends (`apps/web`, `apps/customer`, `apps/admin`, `apps/finder`) — explain
     why they stay separate (different audiences, the finder page must stay minimal).
   - Mobile strategy: a new React Native (Expo) app for pet owners will live in `apps/mobile`
     and will depend on `packages/shared` for types. The finder role gets no app — NFC taps
     and QR scans both open the existing `apps/finder` web page.
   - One authentication system (JWT, to be extended with refresh tokens in Phase 2) used by
     every client.
3. Create `docs/developer-setup.md` covering: prerequisites, `pnpm install`, environment file
   setup (reference `packages/api/.env.example`), `pnpm dev:all`, running tests.
4. In `AGENTS.md`, replace the "Next Move" section with a single line pointing to
   `ARCHITECTURE.md` and this roadmap, so future sessions don't act on stale notes.

TESTS TO RUN (do not skip): `pnpm install`, `pnpm typecheck`, `pnpm test`. All must pass with
zero errors before you consider this phase done.

FILES TO UPDATE: delete the Flutter files listed above; add `ARCHITECTURE.md` and
`docs/developer-setup.md`; edit `AGENTS.md`.

COMPLETION CRITERIA: `git status` shows only the expected deletions/additions, `pnpm typecheck`
and `pnpm test` both exit 0, and `ARCHITECTURE.md` + `docs/developer-setup.md` exist and are
readable. Do not touch any other part of the codebase.
```

---

### Phase 2 — Secrets hardening & refresh-token auth ✅ COMPLETE

> **Status:** Complete. Hardcoded `PawTagAdmin2024!` removed from seed scripts and Login.tsx. Seeds use env vars with random fallback. RefreshToken model, `/refresh` route, and `docs/environments.md` all in place.

**Objective:** Remove hardcoded secrets, add startup validation of required env vars, and add refresh-token support to the auth system.
**Why now:** Mobile (Stage H) cannot ship without refresh tokens, and no further phase should be built on a repo with a hardcoded admin password.
**Scope:** Move seed admin credentials to env vars with a random fallback if unset. Add a config-validation step that fails fast on server boot if required secrets are missing. Add `refreshToken` issuance/rotation/revocation to the auth flow.
**Files likely affected:** `packages/api/src/config/`, `packages/api/src/services/auth.service.ts`, `packages/api/src/routes/auth.ts`, `packages/api/src/seeds/`, `packages/db/src/models/` (new `RefreshToken` model), `.env.example`.
**Database changes:** New `RefreshToken` collection (userId, tokenHash, expiresAt, revokedAt, deviceInfo).
**API changes:** `/api/auth/refresh` (new), `/api/auth/logout` updated to revoke the refresh token, `/api/auth/login` and `/api/auth/register` now return both access and refresh tokens.
**UI changes:** None yet (frontend token-refresh wiring happens per-app as each app is touched; not required for this phase to be complete).
**Testing required:** Unit tests for token issuance/rotation/expiry/revocation. Integration test for the full refresh flow.
**Acceptance criteria:** Server refuses to boot with a clear error if `JWT_SECRET` or `MONGODB_URI` is missing. No secret exists in seed files or source code. Refresh tokens work end-to-end in tests.
**Risks:** Breaking existing sessions during rollout — mitigate by supporting both old single-token and new dual-token validation for one deploy cycle.
**Rollback plan:** Revert the deploy; old single-JWT clients continue working since access-token validation logic is unchanged, only extended.
**Definition of Done:** All new tests pass, existing auth tests still pass, no secret literals remain in the repo (grep-verified).

```
IMPLEMENTATION PROMPT — PHASE 2

You are working in the PawTag monorepo. This is Phase 2 of a 26-phase roadmap (Phase 1 —
Flutter removal and ARCHITECTURE.md — is already complete). Do ONLY the work below.

TASK:
1. Audit `packages/api/src/seeds/` for hardcoded secrets (e.g. the admin password
   "PawTagAdmin2024!"). Replace with values read from environment variables
   (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`), and if unset in a non-production environment,
   generate a random password and print it once to the console during seeding — never commit
   a default.
2. Add a config validation module (e.g. `packages/api/src/config/validateEnv.ts`) that runs at
   server startup and throws a clear, human-readable error (naming the missing variable) if
   any of these are unset: `JWT_SECRET`, `MONGODB_URI`, and any other variable the existing
   code accesses via `process.env` with a `!` non-null assertion. Search the codebase for `!`
   assertions on `process.env` to find the full list.
3. Update `packages/api/.env.example` to list every required and optional environment variable
   with a one-line comment explaining each.
4. Add a `RefreshToken` Mongoose model in `packages/db/src/models/RefreshToken.ts`: fields
   `userId` (ref User), `tokenHash` (string, indexed), `expiresAt` (Date), `revokedAt` (Date,
   nullable), `deviceInfo` (string, optional), `createdAt`. Export it from
   `packages/db/src/index.ts` alongside the other models.
5. In `packages/api/src/services/auth.service.ts`, add functions to issue a refresh token
   (random secure token, store only its hash, 30-day expiry), verify a refresh token (hash
   lookup, check not expired/revoked), and rotate it (revoke the old one, issue a new one) —
   follow the same hashing pattern already used for password-reset tokens in `auth.ts` for
   consistency (see `hashToken`/`generateSecureToken` usage there).
6. Reduce the access token's `expiresIn` to 30 minutes in config (currently likely much
   longer — check `config.jwtExpiresIn`).
7. Add routes in `packages/api/src/routes/auth.ts`:
   - `POST /api/auth/refresh` — body: `{ refreshToken }`, returns a new access token AND a
     new rotated refresh token (rotation, not reuse).
   - Update `POST /api/auth/login` and `POST /api/auth/register` to also return
     `refreshToken` in the response `data`.
   - Update `POST /api/auth/logout` (add this route if it doesn't exist) to revoke the
     provided refresh token.
8. Write unit tests in `tests/unit/` for token issuance, verification, expiry, and rotation.
   Write an integration test in `tests/integration/` that logs in, calls `/refresh`, and
   confirms the old refresh token no longer works after rotation.

TESTS TO RUN: `pnpm test:unit`, `pnpm test:integration`, `pnpm typecheck`. All existing tests
must still pass in addition to the new ones.

FILES TO UPDATE: as listed above. Do not modify any frontend app in this phase — access/refresh
token usage in the web apps is out of scope here.

DOCUMENTATION: create `docs/environments.md` listing every environment variable from the
updated `.env.example`, grouped by required vs optional, with a one-sentence purpose for each.

COMPLETION CRITERIA: `grep -r "PawTagAdmin2024" .` (excluding `.git`) returns nothing. Server
fails to start with a clear error if `JWT_SECRET` is unset (verify manually). All new and
existing tests pass. `docs/environments.md` exists.
```

---

### Phase 3 — Database indexing & N+1 query fixes ✅ COMPLETE

> **Status:** Complete. Indexes on Tag.tagId, User.email, User.phoneNumber, Pet.ownerId confirmed. N+1 admin query pattern fixed via `.populate()`. `docs/database-schema.md` created.

**Objective:** Add missing indexes on hot-path fields and eliminate the N+1 query pattern in admin user/role listing.
**Why now:** Cheap to fix now, expensive to diagnose later once there's real traffic; also directly required before any load testing in Stage G is meaningful.
**Scope:** Add indexes to `Tag.tagId`, `User.email`, `User.phoneNumber`, `Pet.ownerId`, and any other field used in a `.findOne`/`.find` filter across the route files. Replace the per-user role lookup loop in admin listing with a single aggregation/`$lookup`.
**Files likely affected:** `packages/db/src/models/Tag.ts`, `User.ts`, `Pet.ts`, `packages/api/src/routes/admin.ts`.
**Database changes:** New indexes (see above). No schema shape changes.
**API changes:** None (response shape unchanged, only performance).
**UI changes:** None.
**Testing required:** Integration test confirming admin user-list endpoint issues a bounded, small number of queries regardless of user count (e.g. assert via a query-count spy/mock).
**Acceptance criteria:** Indexes present and verified via `db.collection.getIndexes()` in a test. Admin user-listing query count no longer scales linearly with user count.
**Risks:** Index creation on a large existing collection can briefly lock — negligible at current data volume, note for later if the collection grows past ~1M documents before this phase runs.
**Rollback plan:** Indexes are additive and safe to leave in place even if reverted; query-pattern change can be reverted independently via `git revert`.
**Definition of Done:** New indexes committed in model files (`schema.index(...)`), N+1 fixed, tests green.

```
IMPLEMENTATION PROMPT — PHASE 3

You are working in the PawTag monorepo. This is Phase 3 of a 26-phase roadmap (Phases 1–2
complete: Flutter removed, secrets hardened, refresh tokens added). Do ONLY the work below.

TASK:
1. In `packages/db/src/models/Tag.ts`, add `schema.index({ tagId: 1 }, { unique: true })` if
   not already present (check first — do not create a duplicate index).
2. In `packages/db/src/models/User.ts`, add indexes on `email` (unique) and `phoneNumber`
   (non-unique, sparse) if not already present.
3. In `packages/db/src/models/Pet.ts`, add an index on `ownerId`.
4. Search `packages/api/src/routes/*.ts` for any other `.findOne({ someField: ... })` or
   `.find({ someField: ... })` pattern used on a field that is not already indexed, on models
   likely to grow large (Order, FinderScan, LocationEvent, Notification) — add appropriate
   indexes for the fields actually queried (e.g. `FinderScan.tagId`, `Notification.userId`,
   `Order.userId`, `Order.orderNumber`).
5. Find the N+1 pattern in `packages/api/src/routes/admin.ts` where user listing fetches
   `UserRole` per user in a loop. Replace it with a single query using `$lookup`/aggregation
   or a batched `UserRole.find({ userId: { $in: [...] } })` followed by an in-memory map —
   whichever fits the existing code style with the least disruption.
6. Add an integration test in `tests/integration/` that seeds 20 users with roles, calls the
   admin user-list endpoint, and asserts the number of database queries issued does not scale
   linearly with user count (use a query-count spy on the Mongoose connection, or assert
   response time stays flat as a simpler proxy if a query counter isn't easily available).

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`. All existing tests must still pass.

FILES TO UPDATE: model files listed above, `packages/api/src/routes/admin.ts`, one new test
file.

DOCUMENTATION: create `docs/database-schema.md` — for each of the 35+ models in
`packages/db/src/models/`, list the model name, its purpose in one sentence, and its indexed
fields. Generate this from the actual model files, not from memory.

COMPLETION CRITERIA: all listed indexes exist in the model files, the N+1 admin query pattern
is replaced with a single batched query, the new integration test passes, and
`docs/database-schema.md` accurately reflects every model in `packages/db/src/models/`.
```

---

### Phase 4 — Production security headers & CORS whitelist ✅ COMPLETE

> **Status:** Complete. CORS uses environment-driven `ALLOWED_ORIGINS` with production enforcement. Helmet security headers active. `docs/environments.md` updated.

**Objective:** Replace the permissive `origin: true` CORS config with an environment-driven whitelist, and confirm Helmet/security headers are production-appropriate.
**Why now:** Cheap, isolated, high-value security fix that should land before any real deployment (Phase 16).
**Scope:** CORS whitelist read from an env var (comma-separated allowed origins per environment). Review Helmet config for CSP appropriate to the four frontends.
**Files likely affected:** `packages/api/src/index.ts` (or wherever CORS/Helmet are configured), `.env.example`, `docs/environments.md`.
**Database changes:** None.
**API changes:** None functionally, but requests from non-whitelisted origins will now be rejected — this is intentional.
**UI changes:** None.
**Testing required:** Integration test confirming a request with an allowed `Origin` header succeeds and a request with a disallowed one is rejected.
**Acceptance criteria:** CORS origin list is environment-driven, not hardcoded `true`. All four known frontend origins (and the future mobile app's dev origin) are allowlisted in `.env.example` for local dev.
**Risks:** Misconfiguring the whitelist could lock out a legitimate frontend — mitigate by testing all four apps against the API locally before merging.
**Rollback plan:** Revert the CORS config change; low blast radius.
**Definition of Done:** CORS test passes, all four apps confirmed working locally against the updated API.

```
IMPLEMENTATION PROMPT — PHASE 4

You are working in the PawTag monorepo. This is Phase 4 of a 26-phase roadmap (Phases 1–3
complete). Do ONLY the work below.

TASK:
1. Find the current CORS configuration in `packages/api/src/index.ts` (likely
   `cors({ origin: true, ... })`). Replace it with a whitelist read from a new environment
   variable `ALLOWED_ORIGINS` (comma-separated URLs). Parse it into an array at startup and
   pass a validation function to `cors()` that checks the request's `Origin` header against
   that array, rejecting anything not on the list. In non-production environments, if
   `ALLOWED_ORIGINS` is unset, default to `http://localhost:3000,http://localhost:3001,
   http://localhost:3002,http://localhost:3003` (the four local dev ports from `AGENTS.md`).
   In production, fail startup with a clear error if `ALLOWED_ORIGINS` is unset (extend the
   Phase 2 config validator).
2. Review the Helmet configuration in the same file. Ensure a Content-Security-Policy is set
   that's compatible with the four React SPAs (allow self, and any CDN domains actually used
   by the frontends — check `apps/*/index.html` for external script/style tags first).
3. Add an integration test confirming: a request with `Origin: http://localhost:3000` succeeds
   with the appropriate `Access-Control-Allow-Origin` response header, and a request with
   `Origin: http://evil-example.com` does not receive that header (CORS rejection).
4. Update `.env.example` and `docs/environments.md` (from Phase 3) with the new
   `ALLOWED_ORIGINS` variable.

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`. Then manually run `pnpm dev:all` and
confirm all four apps (`:3000`, `:3001`, `:3002`, `:3003`) can still successfully call the API
from the browser (no CORS errors in devtools console) — report the result of this manual check.

FILES TO UPDATE: `packages/api/src/index.ts`, `.env.example`, `docs/environments.md`, one new
test file.

COMPLETION CRITERIA: new CORS test passes, all four apps confirmed working against the API
locally, `ALLOWED_ORIGINS` documented, and production startup fails fast if it's unset.
```

---

### Phase 5 — Real Stripe payment confirmation ✅ COMPLETE

> **Status:** Complete. Orders use `pending_payment` status, confirmed only via `payment_intent.succeeded` webhook. Integration tests in `payment-confirmation.test.ts`.

**Objective:** Fix the payment-integrity gap: an order must only be marked `paid` after Stripe confirms the charge succeeded, not immediately after creating a PaymentIntent.
**Why now:** This is the single highest-risk item in the whole platform — it's a direct path to shipping product that was never actually paid for. Fix before any other commerce work builds on top of it.
**Scope:** Move order creation to a `pending_payment` state, integrate Stripe Checkout (hosted, PCI-compliant) or Elements on the frontend, and only flip the order to `paid` inside the existing `webhooks.ts` Stripe handler on `payment_intent.succeeded`. Confirm order-confirmation email fires on that same trigger.
**Files likely affected:** `packages/api/src/routes/customer.ts`, `packages/api/src/routes/webhooks.ts`, `packages/api/src/services/stripe.service.ts`, `packages/db/src/models/Order.ts`, `apps/customer/src/pages/Checkout*.tsx` (or equivalent).
**Database changes:** Order status enum gains `pending_payment` (or reuses `pending` with a clearer meaning — decide during implementation and document the decision inline).
**API changes:** `POST /customer/orders` now creates the order in a pending state and returns a Stripe client secret for the frontend to confirm; the webhook handler becomes the sole place that flips status to `paid`.
**UI changes:** Customer checkout page integrates Stripe Elements/Checkout for card capture instead of assuming success.
**Testing required:** Integration test simulating a Stripe webhook `payment_intent.succeeded` event and confirming order status updates only then, not before. Test that a failed/abandoned payment leaves the order in a non-paid state and does not decrement stock permanently (or reserves stock with a timeout — decide and document).
**Acceptance criteria:** No code path marks an order `paid` without a corresponding Stripe webhook confirmation. Order confirmation email fires exactly once, on payment success.
**Risks:** This changes the checkout UX (a redirect or embedded card form appears where there wasn't one) — test thoroughly against Stripe's test mode before this touches production.
**Rollback plan:** Feature-flag the new flow behind an env var if needed for a staged rollout; otherwise standard `git revert`.
**Definition of Done:** New tests green, manual test purchase in Stripe test mode completes end-to-end and only marks paid after test-card confirmation.

```
IMPLEMENTATION PROMPT — PHASE 5

You are working in the PawTag monorepo. This is Phase 5 of a 26-phase roadmap (Phases 1–4
complete: cleanup, secrets/refresh-tokens, indexes, CORS). Do ONLY the work below.

CONTEXT: Currently, `packages/api/src/routes/customer.ts`'s `POST /orders` route calls
`createPaymentIntent()` and immediately sets `status: paymentMethod === 'card' ? 'paid' :
'pending'` — this marks the order paid before any actual payment confirmation happens. Fix
this.

TASK:
1. In `packages/db/src/models/Order.ts`, confirm/add a `pending_payment` value to the status
   enum (keep existing values `pending`, `paid`, `shipped`, `delivered`, `cancelled`,
   `refunded` — add `pending_payment` before `paid` in the lifecycle, and add `packing` after
   `paid` and before `shipped` while you're in this file, since Phase 6 will need it — but do
   NOT build the packing workflow logic itself in this phase, only add the enum value).
2. In `packages/api/src/routes/customer.ts`'s order creation route: create the order with
   status `pending_payment`, return the Stripe `clientSecret` (already returned by
   `createPaymentIntent()` in `stripe.service.ts`) in the API response so the frontend can
   confirm the card. Do NOT set status to `paid` in this route.
3. In `packages/api/src/routes/webhooks.ts`, add (or extend if a payment-intent handler
   already exists there — check first) a handler for the Stripe `payment_intent.succeeded`
   event that: looks up the order by the `orderNumber` stored in the PaymentIntent metadata,
   sets its status to `paid`, sets `payment.status = 'completed'` and `payment.paidAt`, and
   triggers the order-confirmation email via the existing email service
   (`packages/api/src/services/email/`). Also add a handler for
   `payment_intent.payment_failed` that sets the order status to `cancelled` and restores the
   decremented product/variant stock (reverse the stock decrement logic currently in the
   order-creation route in `customer.ts`).
4. In the demo-mode path of `stripe.service.ts` (`createPaymentIntent` when no real Stripe key
   is set), keep demo mode functional for local dev, but make sure the demo flow still goes
   through the same `pending_payment` → webhook-confirms → `paid` path rather than special-
   casing it — add a way to simulate the webhook firing in demo mode (e.g. a `confirmPayment`
   call from the frontend after entering test details, which internally calls the same webhook
   handler logic) so local development doesn't require a real Stripe account.
5. Update the customer checkout frontend (`apps/customer/src/pages/` — find the checkout page)
   to use Stripe.js/Elements: after the order is created and a `clientSecret` returned, confirm
   the card payment client-side using Stripe's `confirmCardPayment`, then poll or redirect to
   an order-confirmation page. Use `@stripe/stripe-js` and `@stripe/react-stripe-js` (add as
   dependencies if not present).
6. Write integration tests in `tests/integration/`: (a) simulate a
   `payment_intent.succeeded` webhook and assert the order flips to `paid` and stock stays
   decremented; (b) simulate `payment_intent.payment_failed` and assert the order becomes
   `cancelled` and stock is restored; (c) assert `POST /orders` alone (no webhook) leaves the
   order in `pending_payment`, never `paid`.

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`, `pnpm test`. All must pass.

FILES TO UPDATE: as listed above. Do not touch `apps/web`, `apps/admin`, or `apps/finder` in
this phase.

COMPLETION CRITERIA: grep confirms no code path sets `status: 'paid'` outside the webhook
handler. All three new integration tests pass. The customer checkout page successfully
completes a purchase against Stripe test mode (report the Stripe test card number used and
confirm the resulting order in the database has status `paid` only after webhook receipt).
```

---

### Phase 6 — Order status state machine ✅ COMPLETE

> **Status:** Complete. `orderStatus.service.ts` with `isValidTransition()`. Admin route enforces valid transitions. Admin UI shows only valid next statuses. `docs/business-workflows.md` with state diagram. Unit + integration tests.

**Objective:** Formalize the order lifecycle (`pending_payment → paid → packing → shipped → delivered`, with `cancelled`/`refunded` as terminal branch states) with server-side transition validation, so no status can be set out of order by mistake.
**Why now:** Everything in Stage C (fulfillment) depends on a trustworthy status field; do this before building shipping on top of an unvalidated one.
**Scope:** A single state-transition validator function used by every route that changes order status. Update `docs/business-workflows.md` with the finalized state diagram.
**Files likely affected:** `packages/api/src/routes/admin.ts`, new `packages/api/src/services/orderStatus.service.ts`, `packages/db/src/models/Order.ts`.
**Database changes:** None beyond Phase 5's enum addition.
**API changes:** `/admin/orders/:id/status` now validates the transition and returns a 400 with a clear message on an invalid one (e.g. `delivered` → `pending_payment`).
**UI changes:** Admin order-detail view should only offer valid next statuses as options (small UI change, can be a simple dropdown filtered client-side).
**Testing required:** Unit tests covering every valid and invalid transition pair.
**Acceptance criteria:** Invalid transitions are rejected with a clear error; valid ones succeed and are audit-logged (audit logging already exists — confirm it fires here).
**Risks:** Low.
**Rollback plan:** `git revert`.
**Definition of Done:** State machine tested exhaustively, wired into the existing status-update route, admin UI reflects valid options.

```
IMPLEMENTATION PROMPT — PHASE 6

You are working in the PawTag monorepo. This is Phase 6 of a 26-phase roadmap (Phases 1–5
complete, including the payment-confirmation fix and the `pending_payment`/`packing` status
values added to Order in Phase 5). Do ONLY the work below.

TASK:
1. Create `packages/api/src/services/orderStatus.service.ts` exporting a function
   `isValidTransition(from: OrderStatus, to: OrderStatus): boolean` and a constant map of
   allowed transitions:
   `pending_payment -> paid | cancelled`
   `paid -> packing | cancelled | refunded`
   `packing -> shipped | cancelled`
   `shipped -> delivered`
   `delivered -> refunded` (post-delivery refund case)
   No other transitions are valid (e.g. you cannot go from `delivered` back to `packing`).
2. In `packages/api/src/routes/admin.ts`'s `PUT /orders/:id/status` route, look up the order's
   current status, call `isValidTransition`, and return `400 { success: false, error: 'Invalid
   status transition from X to Y' }` if invalid. Only proceed with the update and existing
   `AuditLog.create(...)` call if valid.
3. Write unit tests in `tests/unit/` covering every valid transition (must succeed) and a
   representative set of invalid ones (must be rejected), including edge cases like
   transitioning to the same status and transitioning from a terminal state.
4. In `apps/admin`, find the order-detail/order-list component that lets an admin change order
   status (search for where `PUT /orders/:id/status` is called from the frontend). Update the
   status-selection control (dropdown or similar) to only display options that are valid next
   states for the order's current status, using the same transition map — export it from
   `packages/shared` if that's the cleanest way to share it between API and frontend, otherwise
   duplicate the small constant with a comment noting it must stay in sync with
   `orderStatus.service.ts`.
5. Create `docs/business-workflows.md` documenting the full order lifecycle as a state diagram
   (ASCII or Mermaid is fine) plus a one-paragraph description of each state.

TESTS TO RUN: `pnpm test:unit`, `pnpm typecheck`. All existing tests must still pass.

FILES TO UPDATE: new `orderStatus.service.ts`, `packages/api/src/routes/admin.ts`, the relevant
admin frontend component, new `docs/business-workflows.md`.

COMPLETION CRITERIA: unit tests cover all valid and invalid transitions and pass. The admin API
route rejects invalid transitions with a 400. The admin UI only offers valid next-status
options. `docs/business-workflows.md` exists and accurately describes the state machine just
implemented.
```

---

### Phase 7 — Admin new-order notification ✅ COMPLETE

> **Status:** Complete. Webhook creates idempotent admin notification + email. Admin notification routes with unread badge. Integration tests in `admin-notifications.test.ts`.

**Objective:** Alert the business owner/admin the moment a real order is paid — email plus an in-admin-dashboard indicator.
**Why now:** This is a one-line business risk (missed orders) fixed with a small, isolated change; do it right after order integrity (Phase 5) is solid so the trigger point (`paid` webhook) is trustworthy.
**Scope:** Extend the `payment_intent.succeeded` webhook handler from Phase 5 to also notify admins. Add an `AdminNotification`-style record (or extend the existing `Notification` model to support an admin-facing `audience` field) and surface an unread-count badge in `apps/admin`.
**Files likely affected:** `packages/api/src/routes/webhooks.ts`, `packages/db/src/models/Notification.ts`, `packages/api/src/services/email/`, `apps/admin/src/` (dashboard/nav badge component).
**Database changes:** Add an `audience: 'customer' | 'admin'` field to `Notification` (default `customer` for backward compatibility) or a new lightweight `AdminAlert` model — pick whichever requires less rework of existing customer-notification code; document the choice.
**API changes:** New `GET /admin/notifications` (or extend the existing notification routes with an admin-scoped variant) + unread-count endpoint, mirroring what already exists for customers.
**UI changes:** Admin nav shows an unread-order-alert badge; clicking it lists recent new orders.
**Testing required:** Integration test: paid webhook fires → admin notification record created → email service invoked (mock the email send in tests).
**Acceptance criteria:** Every successful payment produces exactly one admin notification and one admin email, no duplicates on webhook retries (Stripe retries webhooks — ensure idempotency using the PaymentIntent ID).
**Risks:** Webhook idempotency — Stripe can deliver the same event more than once; must not double-notify.
**Rollback plan:** `git revert`; no data migration to unwind since this only adds new records.
**Definition of Done:** Tests green, manual test order in Stripe test mode triggers a visible admin dashboard badge and a real email.

```
IMPLEMENTATION PROMPT — PHASE 7

You are working in the PawTag monorepo. This is Phase 7 of a 26-phase roadmap (Phases 1–6
complete: cleanup, security, payment-confirmation fix, order state machine). Do ONLY the work
below.

TASK:
1. Decide and implement: extend `packages/db/src/models/Notification.ts` with an
   `audience: 'customer' | 'admin'` field, defaulting to `'customer'` so all existing code
   creating notifications continues to work unchanged. Add an index on `{ audience: 1,
   userId: 1, read: 1 }` or similar to support an efficient admin unread-count query (admin
   notifications can use a shared/null `userId` since they're organization-wide, not
   per-admin — use whichever pattern fits the existing `Notification` schema best, and note
   your choice in a code comment).
2. In `packages/api/src/routes/webhooks.ts`, in the `payment_intent.succeeded` handler added in
   Phase 5: after marking the order `paid`, create one `Notification` with `audience: 'admin'`
   summarizing the order (order number, customer name, amount), and send one email via the
   existing email service to an `ADMIN_ALERT_EMAIL` address (new env var, add to
   `.env.example` and `docs/environments.md`). Guard against duplicate notifications on webhook
   retries by checking the PaymentIntent ID isn't already recorded on an existing admin
   notification for that order before creating a new one (Stripe webhooks are not guaranteed
   exactly-once).
3. Add `GET /api/admin/notifications` and `GET /api/admin/notifications/unread-count` routes in
   `packages/api/src/routes/admin.ts`, gated by the existing `requirePermission` middleware
   (use an appropriate existing permission or add `notification.read` scoped to admin role —
   check `packages/db/src/models/Permission.ts` for the existing pattern first).
4. In `apps/admin`, add an unread-count badge to the main navigation (find the existing nav
   component) that polls or fetches the unread-count endpoint, and a simple notifications list
   view reachable by clicking it.
5. Write an integration test: simulate a `payment_intent.succeeded` webhook twice with the same
   PaymentIntent ID, and assert only one admin notification is created (idempotency), the email
   service is called exactly once (mock it), and the unread-count endpoint reflects it.

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`, `pnpm test`. All must pass.

FILES TO UPDATE: as listed above, plus `.env.example` and `docs/environments.md`.

COMPLETION CRITERIA: new integration test passes and specifically proves idempotency on
duplicate webhook delivery. Admin nav shows an unread badge. `ADMIN_ALERT_EMAIL` documented.
```

---

### Phase 8 — Cancellation & refund workflow ✅ COMPLETE

> **Status:** Complete. Cancel/refund routes with state machine enforcement, stock restoration via `inventory.service.ts`, Stripe refund integration. Customer notifications. Integration tests in `order-cancel-refund.test.ts`.

**Objective:** Build a real admin-facing cancel/refund action that reverses stock, calls Stripe's existing `createRefund()`, updates order status through the Phase 6 state machine, and notifies the customer.
**Why now:** Directly required by the operations review (Part 3) — currently `createRefund()` exists but isn't reachable from any UI or workflow.
**Scope:** One admin action, one customer notification, correct inventory reversal.
**Files likely affected:** `packages/api/src/routes/admin.ts`, `apps/admin/src/pages/` (order detail), `packages/api/src/services/stripe.service.ts` (already has `createRefund`, likely no change needed).
**Database changes:** None beyond what Phases 5–6 already added.
**API changes:** `POST /admin/orders/:id/cancel` and `POST /admin/orders/:id/refund`.
**UI changes:** Cancel/refund buttons on the admin order-detail page, with a confirmation step and a reason field (stored on the order for the audit trail).
**Testing required:** Integration tests for both actions confirming stock restoration, Stripe refund call, status transition validity (must use Phase 6's validator), and customer notification.
**Acceptance criteria:** A cancelled/refunded order restores its stock exactly once, cannot be cancelled/refunded twice, and the customer receives a notification/email.
**Risks:** Double-refund risk if the action isn't idempotent — guard against re-triggering on an already-refunded order via the state machine.
**Rollback plan:** `git revert`; Stripe refunds themselves are not reversible by this system (that's expected — refunds are a genuine terminal action) but no data corruption occurs on revert of the code.
**Definition of Done:** Tests green, manual test refund in Stripe test mode succeeds and reflects correctly in the admin UI and customer notification.

```
IMPLEMENTATION PROMPT — PHASE 8

You are working in the PawTag monorepo. This is Phase 8 of a 26-phase roadmap (Phases 1–7
complete). Do ONLY the work below.

TASK:
1. In `packages/api/src/routes/admin.ts`, add `POST /orders/:id/cancel` (body: `{ reason:
   string }`) — validates the transition to `cancelled` using `isValidTransition` from Phase 6,
   restores stock for every item on the order (reverse the decrement logic from
   `customer.ts`'s order-creation route — extract it into a shared helper in
   `packages/api/src/services/inventory.service.ts` if it isn't already reusable, and call that
   same helper from both the payment-failed webhook handler in Phase 5 and this new route to
   avoid duplicated logic), sets status to `cancelled`, stores the reason on the order (add a
   `cancellationReason` field to the Order model if not present), creates an `AuditLog` entry,
   and creates a customer-facing `Notification` + email informing them of the cancellation.
2. Add `POST /orders/:id/refund` (body: `{ reason: string, amount?: number }`) — validates the
   transition to `refunded`, calls the existing `createRefund()` from `stripe.service.ts` using
   the order's stored `payment.transactionId`, and on success updates order status, stores the
   reason, creates an `AuditLog` entry, and notifies the customer. On Stripe refund failure,
   return a clear error and do NOT change the order status.
3. Guard both routes so they cannot be called on an order not currently in a state that allows
   the transition (rely on `isValidTransition` — return 400 with the specific error it's
   designed to give).
4. In `apps/admin`, add "Cancel order" and "Refund order" buttons to the order-detail page, each
   opening a small confirmation dialog that collects the reason, and disabled/hidden when the
   order's current status doesn't permit that action (mirror the state-machine logic from
   Phase 6's frontend integration).
5. Write integration tests: (a) cancel a `paid` order, assert stock is restored exactly to
   pre-order levels and status becomes `cancelled`; (b) attempt to cancel an already-`shipped`
   order and assert it's rejected; (c) refund a `paid` order, assert Stripe's refund function is
   called with the correct payment intent (mock it) and status becomes `refunded`; (d) attempt
   to refund an already-`refunded` order and assert it's rejected (idempotency).

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`, `pnpm test`. All must pass.

FILES TO UPDATE: `packages/api/src/routes/admin.ts`, new
`packages/api/src/services/inventory.service.ts` (or confirm/refactor existing stock logic into
it), `packages/db/src/models/Order.ts` (add `cancellationReason`/`refundReason` fields), the
admin order-detail frontend component.

COMPLETION CRITERIA: all four described test scenarios pass. Buttons are correctly
shown/hidden/disabled based on order state in the admin UI. No order can be cancelled or
refunded twice.
```

---

### Phase 9 — Shipping/courier integration ✅ COMPLETE

> **Status:** Complete. `shipping.service.ts` with demo mode and real API stub. Order model has `carrier` and `shippingLabelUrl` fields. Admin create-shipment route. Integration tests in `shipping.test.ts`.

**Objective:** Replace manual tracking-number entry with a real courier API integration that generates a shipping label and tracking number when an admin marks an order as ready to ship.
**Why now:** This is the largest genuinely-missing piece of the operational flow (Part 2, steps 9–13) — build it once the order state machine (Phase 6) and cancellation logic (Phase 8) it depends on are solid.
**Scope:** Integrate one courier API (Sendle or NZ Post — pick based on your actual courier account; scope this phase against whichever you set up first). Admin action: "Create shipping label" on a `packing` order → calls courier API → stores label URL + tracking number on the order → transitions status to `shipped`.
**Files likely affected:** New `packages/api/src/services/shipping.service.ts`, `packages/api/src/routes/admin.ts`, `packages/db/src/models/Order.ts` (add `shippingLabelUrl`, `carrier` fields alongside existing `trackingNumber`).
**Database changes:** Add `carrier` and `shippingLabelUrl` fields to `Order`.
**API changes:** `POST /admin/orders/:id/create-shipment`.
**UI changes:** "Create shipment" button on packing-status orders in the admin order-detail view; displays the resulting label link and tracking number once created.
**Testing required:** Integration test mocking the courier API response, confirming order fields populate correctly and status transitions to `shipped` only on success.
**Acceptance criteria:** A real (sandbox/test-mode) courier API call succeeds and the resulting tracking number/label are stored and visible in admin.
**Risks:** Courier API account setup is an external dependency outside code — flag this as a blocker to resolve with the founder before starting (need a real Sendle/NZ Post developer account and API key).
**Rollback plan:** `git revert`; orders can still be manually marked shipped with a manually-entered tracking number as a fallback (keep the existing manual path working alongside the new automated one).
**Definition of Done:** Tests green against a mocked courier API; a real sandbox-mode shipment successfully created and verified manually.

```
IMPLEMENTATION PROMPT — PHASE 9

You are working in the PawTag monorepo. This is Phase 9 of a 26-phase roadmap (Phases 1–8
complete). Do ONLY the work below.

NOTE: This phase requires a real (sandbox) courier API account and API key, which is an
external/business dependency, not something you can create yourself. If `SHIPPING_PROVIDER_API_KEY`
is not present in the environment, implement everything below against the provider's
documented sandbox/test endpoint structure and clearly mark in a code comment and in
`docs/environments.md` that a real sandbox key is required before this can be tested live —
do not block the rest of the implementation on having a live key today.

TASK:
1. Create `packages/api/src/services/shipping.service.ts` exporting a `createShipment(order)`
   function that calls the chosen courier's sandbox API (Sendle recommended for NZ/AU — use
   their documented REST API for creating an order/shipment and retrieving a tracking number
   and label URL) with the order's shipping address, package details (assume a standard small
   parcel size/weight for a pet tag unless the Product model specifies dimensions — check
   `packages/db/src/models/Product.ts` first), and returns `{ success, trackingNumber,
   labelUrl, carrier, error? }`. Mirror the demo-mode fallback pattern already used in
   `stripe.service.ts` (Phase 5 context) — if no API key is configured, return a realistic
   fake tracking number/label URL so local development and CI don't require a live key.
2. Add `carrier` and `shippingLabelUrl` fields to `packages/db/src/models/Order.ts` (alongside
   the existing `trackingNumber` field — do not duplicate it).
3. In `packages/api/src/routes/admin.ts`, add `POST /orders/:id/create-shipment` — only valid
   when the order's current status is `packing` (use `isValidTransition` from Phase 6 to also
   validate the resulting transition to `shipped`). Calls `createShipment`, and on success
   stores `trackingNumber`, `carrier`, `shippingLabelUrl`, transitions status to `shipped`,
   creates an `AuditLog` entry, and (reusing the notification pattern from Phase 7/8) creates a
   customer notification + email with the tracking number. On failure, return a clear error and
   leave the order in `packing`.
4. In `apps/admin`'s order-detail page, add a "Create shipment" button visible only on
   `packing`-status orders, and once a shipment exists, display the tracking number and a link
   to the label.
5. Write an integration test that mocks `shipping.service.ts`'s courier API call, calls the new
   route, and asserts: success case updates all three new fields and transitions status;
   failure case leaves the order in `packing` with no partial field updates.

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`, `pnpm test`. All must pass.

FILES TO UPDATE: new `shipping.service.ts`, `packages/api/src/routes/admin.ts`,
`packages/db/src/models/Order.ts`, admin order-detail frontend component, `.env.example`,
`docs/environments.md` (document `SHIPPING_PROVIDER_API_KEY` and note the sandbox requirement).

COMPLETION CRITERIA: integration tests pass against the mocked courier API. If a real sandbox
key is available in the environment, additionally perform and report the result of one real
sandbox shipment creation. If no key is available, clearly state that live verification is
pending a courier account and is not a code defect.
```

---

### Phase 10 — Customer shipping-status notifications ✅ COMPLETE

> **Status:** Complete. `orderNotification.service.ts` with `notifyCustomerOfStatusChange()`. All 5 status transitions trigger in-app + email notifications. Integration tests in `order-notifications.test.ts`.

**Objective:** Every order status change that matters to the customer (`paid`, `packing`→`shipped`, `delivered`, `cancelled`, `refunded`) triggers an email and in-app notification.
**Why now:** Directly closes the "customer receives shipping updates" gap (Part 2, step 14) — small, isolated, and depends only on the state machine (Phase 6) and shipment creation (Phase 9) already being in place.
**Scope:** One centralized notification hook, called from every place order status changes (admin manual update, Phase 9's shipment creation, Phase 8's cancel/refund, Phase 5's payment webhook).
**Files likely affected:** New `packages/api/src/services/orderNotification.service.ts`, called from the routes touched in Phases 5, 7, 8, 9.
**Database changes:** None.
**API changes:** None (internal service, no new endpoints).
**UI changes:** None (customer already has a notifications view via the existing `Notification` model/routes).
**Testing required:** Integration test confirming a notification + email fires for each of the five status transitions listed above, and does not fire for internal/invalid transitions.
**Acceptance criteria:** Every customer-relevant status change is visible to the customer within seconds, in-app and via email.
**Risks:** Risk of duplicate notifications if this isn't consolidated into one call site — the whole point of this phase is to prevent that by centralizing it.
**Rollback plan:** `git revert`.
**Definition of Done:** All five transition-triggered notifications tested and passing; manually verified in a full test order run.

```
IMPLEMENTATION PROMPT — PHASE 10

You are working in the PawTag monorepo. This is Phase 10 of a 26-phase roadmap (Phases 1–9
complete). Do ONLY the work below.

CONTEXT: By now, customer-notification-on-status-change logic has likely been added ad hoc in
several places (the Phase 5 webhook handler, Phase 8's cancel/refund routes, Phase 9's shipment
creation). This phase consolidates that into one reusable function so future status-changing
code paths can't forget to notify the customer.

TASK:
1. Create `packages/api/src/services/orderNotification.service.ts` exporting
   `notifyCustomerOfStatusChange(order, newStatus, extra?: { trackingNumber?, reason? })` that
   creates the appropriate `Notification` record and sends the appropriate email template
   (check `packages/api/src/services/email/templates/` for existing templates to reuse or
   extend) for each of: `paid` ("order confirmed"), `shipped` ("your order has shipped" —
   include tracking number and carrier), `delivered` ("your order was delivered"), `cancelled`
   ("your order was cancelled" — include reason), `refunded` ("your refund has been
   processed"). For any other status value, do nothing (no-op, not an error).
2. Refactor the Phase 5 webhook handler, Phase 8's cancel/refund routes, and Phase 9's
   create-shipment route to call this single function instead of any ad hoc notification code
   they currently contain — remove the duplicated logic.
3. Add a `delivered` transition trigger: since no courier webhook exists yet for delivery
   confirmation, add `POST /admin/orders/:id/mark-delivered` as a manual admin action (using
   `isValidTransition` for the `shipped -> delivered` check) that calls
   `notifyCustomerOfStatusChange`. Add a corresponding button in the admin order-detail page,
   visible only on `shipped`-status orders.
4. Write an integration test that walks a single order through `paid -> packing -> shipped ->
   delivered` and separately `paid -> cancelled`, asserting exactly one notification/email fires
   per transition (mock the email send and assert call count), with correct content for each
   (e.g. the `shipped` notification includes the tracking number).

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`, `pnpm test`. All must pass.

FILES TO UPDATE: new `orderNotification.service.ts`, refactor the routes listed above, add the
`mark-delivered` route and admin UI button.

COMPLETION CRITERIA: the full status walk test passes with exactly one notification per
transition and correct content. No status-changing route in the codebase notifies the customer
through any path other than this new centralized function (verify by searching for
`Notification.create` calls related to orders and confirming they're now only inside
`orderNotification.service.ts`).
```

---

### Phase 11 — Tag activation & redemption flow ✅ COMPLETE

> **Status:** Complete. `POST /customer/tags/redeem` with orderId validation. Tag model has `orderId` field. `RedeemTagPage.tsx` in customer portal. Integration tests in `tag-redemption.test.ts`.

**Objective:** Build the explicit "redeem this physical tag from my delivered order" flow, so a customer who receives a tag in the mail links that specific tag to their account with a clear, guided step — not just an implicit admin-side linking.
**Why now:** This is the connective step between commerce (Stages B/C) and the recovery product itself (already built) — it's the one piece of the Part 2 flow marked partial that most directly affects new-customer onboarding experience.
**Scope:** A "redeem tag" screen in the customer portal (and later, mobile) where the customer enters the tag ID printed on their physical tag (or scans it), which the system validates against their delivered order before linking it to their account and prompting pet-profile creation.
**Files likely affected:** `packages/api/src/routes/customer.ts`, `apps/customer/src/pages/` (new redeem-tag page), `packages/db/src/models/Tag.ts` (confirm/add an `orderId` reference so a tag can be traced back to the order it shipped in).
**Database changes:** Add `orderId` reference on `Tag` if not already present (needed to validate that a redeemed tag ID actually belongs to that customer's delivered order, preventing tag-ID guessing).
**API changes:** `POST /customer/tags/redeem` (body: `{ tagId }`) — validates the tag exists, isn't already claimed, and (if `orderId` linkage exists) belongs to a delivered order for this customer or is otherwise a valid unclaimed tag purchased through the shop.
**UI changes:** New guided "Activate your tag" flow in the customer portal, triggered right after login if the customer has a delivered order with an unredeemed tag.
**Testing required:** Integration tests for successful redemption, redemption of an already-claimed tag (rejected), and redemption of a tag ID that doesn't exist (rejected with a clear message).
**Acceptance criteria:** A customer can go from "package arrived" to "tag linked to my account, ready to attach to a pet profile" in one guided flow, with no admin intervention required.
**Risks:** Need to decide how tag IDs are generated/printed at fulfillment time if that doesn't already exist — check current tag-creation flow first (this phase should confirm and document whichever process is already in place, e.g., are tags pre-provisioned with printed IDs before sale, or generated at redemption time) and only build new provisioning logic if genuinely missing.
**Rollback plan:** `git revert`; no destructive changes to existing tag data.
**Definition of Done:** Tests green, manual redemption flow works end-to-end in staging.

```
IMPLEMENTATION PROMPT — PHASE 11

You are working in the PawTag monorepo. This is Phase 11 of a 26-phase roadmap (Phases 1–10
complete). Do ONLY the work below.

TASK:
1. First, investigate and report (as a comment in your implementation summary, not just in
   code): how are `Tag` documents and their `tagId` values currently created today — are they
   pre-provisioned in bulk before sale (e.g. via the seed scripts or an admin bulk-create tool),
   or created ad hoc when a customer adds a pet? Check `packages/db/src/models/Tag.ts`,
   `packages/api/src/seeds/`, and everywhere `Tag.create(` is called in `packages/api/src/routes/`.
   Base the rest of this phase on what you find rather than assuming.
2. Add an `orderId` field (ref `Order`, nullable) to `Tag.ts` if not already present, to allow
   tracing a physical tag back to the order it was purchased/shipped in.
3. Add `POST /api/customer/tags/redeem` in `packages/api/src/routes/customer.ts` (body:
   `{ tagId: string }`, requires `requirePermission('tag.create')` or the closest existing
   permission): looks up the `Tag` by `tagId`. If it doesn't exist, return a clear 404
   ("Tag ID not recognized — check the code on your tag"). If it's already claimed
   (`ownerId` set), return 409 ("This tag has already been activated"). Otherwise, if the tag
   has an associated `orderId`, confirm that order belongs to the requesting customer and is in
   `shipped` or `delivered` status before allowing redemption (prevents someone redeeming a tag
   that shipped to a different customer); if the tag has no `orderId` (e.g. legacy/bulk-
   provisioned tags), allow redemption by any authenticated customer. On success, set
   `ownerId` to the requesting customer and return the tag, prompting the frontend to continue
   into pet-profile creation/linking.
4. In `apps/customer`, add a new page/flow for tag redemption: a form to enter (or camera-scan,
   using an existing QR/camera library if one is already a dependency, otherwise a manual text
   input is sufficient for this phase — do not add a new scanning library just for this) the
   tag ID, calling the new endpoint, then routing into the existing add-pet/link-tag flow on
   success.
5. On the customer dashboard, if the customer has a `delivered` order containing tag products
   and no corresponding claimed `Tag` yet, surface a prompt ("Activate your new tag") linking
   to the redemption page. Keep this detection simple (query for delivered orders with tag
   line items vs. claimed tags for the customer) — do not over-engineer product-type detection
   if `Product` doesn't already have a clear "is this a tag" flag; add a boolean
   `isTagProduct` field to `Product.ts` if none exists and it's needed for this check.
6. Write integration tests: successful redemption of an unclaimed tag; rejected redemption of
   an already-claimed tag; rejected redemption of a nonexistent tag ID; rejected redemption of
   an order-linked tag by a different customer than the order belongs to.

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`, `pnpm test`. All must pass.

FILES TO UPDATE: `packages/db/src/models/Tag.ts`, `packages/db/src/models/Product.ts` (if
`isTagProduct` is added), `packages/api/src/routes/customer.ts`, new customer frontend
redemption page and dashboard prompt.

COMPLETION CRITERIA: all four described test scenarios pass. Report findings from step 1 (how
tags are currently provisioned) explicitly in your summary, since it affects whether any
further provisioning-side work is needed in a future phase.
```

---

### Phase 12 — NFC support ✅ COMPLETE

> **Status:** Complete. `nfcEnabled` field on Tag model. `WriteNfcTag.tsx` admin utility using Web NFC API. Manual test procedure documented in `docs/business-workflows.md`. Unit tests.

**Objective:** Add NFC as a second way to reach the finder page (alongside QR), per the finalized mobile/tag strategy — a tap on an NFC-enabled tag opens the same public finder URL, no app required.
**Why now:** New requirement from your product decisions; scoped here since it only needs the finder page (already built) plus an NFC-writing step at fulfillment/activation, not the mobile app itself.
**Scope:** Confirm the finder URL scheme (`https://pawtag.co.nz/finder/:tagId` or similar) is NDEF-writable to a standard NFC tag; add an admin (or, once mobile exists, mobile) tool to write that URL to a physical NFC chip during fulfillment or customer self-activation.
**Files likely affected:** New `packages/api/src/routes/admin.ts` addition or a small standalone admin utility page for NFC writing (Web NFC API works in Chrome on Android — note the platform limitation), `apps/admin/src/pages/`.
**Database changes:** Add `nfcEnabled: boolean` to `Tag.ts` to track which physical tags have NFC chips vs. QR-only.
**API changes:** None required beyond what already serves the finder page — NFC just needs to open the existing URL.
**UI changes:** Small admin tool page for writing NFC tags during fulfillment (Chrome/Android only, per Web NFC API support — document this limitation clearly rather than over-building for unsupported browsers).
**Testing required:** Manual hardware test (cannot be unit tested meaningfully) — write a test tag, tap it against an Android phone, confirm it opens the finder page. Document the manual test procedure.
**Acceptance criteria:** A physical NFC tag, once written, opens the correct finder page on tap with no app installed.
**Risks:** Web NFC is Android/Chrome-only today (not supported in Safari/iOS) — the finder page itself must still work identically via QR fallback for iOS users, which it already does. Document this clearly so it's not treated as a bug later.
**Rollback plan:** N/A — this is additive and doesn't change any existing behavior.
**Definition of Done:** Documented manual test passes on at least one real Android device with a real NFC tag.

```
IMPLEMENTATION PROMPT — PHASE 12

You are working in the PawTag monorepo. This is Phase 12 of a 26-phase roadmap (Phases 1–11
complete). Do ONLY the work below.

TASK:
1. Add `nfcEnabled: boolean` (default `false`) to `packages/db/src/models/Tag.ts`, to track
   which physical tags have an NFC chip in addition to (or instead of) a printed QR code.
2. Confirm the exact public finder URL format currently used for QR codes (check how QR codes
   are generated — search for QR generation code referencing `tagId`, likely in `apps/web` or
   the tag-creation flow). The NFC tag must be written with the identical URL format so both
   access methods land on the exact same finder page.
3. Build a simple admin utility page in `apps/admin` (e.g. `apps/admin/src/pages/WriteNfcTag.tsx`)
   using the browser's Web NFC API (`NDEFReader`, available in Chrome on Android only) that:
   lets an admin enter or scan a `tagId`, confirms the tag exists in the database, and writes an
   NDEF record containing the full finder URL to a physical NFC tag placed against the device.
   On successful write, call a new `PUT /admin/tags/:id` (or extend the existing tag-update
   route if one exists) to set `nfcEnabled: true` on that tag's database record.
4. Clearly display a browser-compatibility notice on this admin page: "NFC writing requires
   Chrome on Android. This feature is not available on iOS, Safari, or Firefox." Do not attempt
   to polyfill or work around this — it's a genuine platform limitation, not a bug to fix.
5. Confirm (by reading `apps/finder`'s routing) that the finder page itself needs zero changes
   — since NFC just opens the same URL a QR code would, the finder page doesn't know or care
   which method was used to reach it. If you find any code that assumes QR-specific context,
   flag it rather than silently changing finder-page behavior.
6. Write a unit test for the `nfcEnabled` field's presence and default value, and an
   integration test for the tag-update route setting it. Web NFC hardware interaction itself
   cannot be meaningfully unit tested — do not attempt to mock browser NFC APIs; instead,
   document a manual test procedure in `docs/business-workflows.md` (append a section):
   "To verify NFC: open the admin Write NFC Tag page in Chrome on an Android device, enter a
   real tag ID, tap a blank NFC tag against the phone, then tap the same NFC tag against
   another NFC-enabled Android phone and confirm it opens the correct finder page."

TESTS TO RUN: `pnpm test:unit`, `pnpm test:integration`, `pnpm typecheck`. All must pass.

FILES TO UPDATE: `packages/db/src/models/Tag.ts`, new admin NFC-writing page, tag-update route
if extended, `docs/business-workflows.md`.

COMPLETION CRITERIA: automated tests for the data-layer changes pass. The manual test procedure
is clearly documented. State plainly in your summary that real hardware verification (an actual
NFC tag + Android phone) is a manual step for the founder or QA to perform, since it cannot be
automated.
```

---

### Phase 13 — Replacement/damaged tag flow ✅ COMPLETE

> **Status:** Complete. `replacesTagId` and `replacedByTagId` on Tag model. `POST /customer/tags/:id/request-replacement` route. Customer UI "Report lost/damaged tag" button. Integration tests in `tag-replacement.test.ts`.

**Objective:** Let a customer request a replacement for a lost or damaged tag, which transfers all pet history/subscription to a new physical tag ID without the customer losing their pet's data.
**Why now:** Direct operational gap identified in Part 3; naturally follows tag activation (Phase 11) since it reuses the same linking logic.
**Scope:** Customer-initiated replacement request (creates a new order for a replacement tag, at a discounted/free rate per business policy — policy value itself is a business decision for the founder, not a technical one; implement it as a configurable price via the existing `Setting`/`FeatureFlag` pattern already used elsewhere in the codebase). On fulfillment of that replacement order and redemption of the new tag, the old tag is deactivated and all pet/subscription data transfers to the new tag ID.
**Files likely affected:** `packages/api/src/routes/customer.ts`, `packages/db/src/models/Tag.ts`, `apps/customer/src/pages/`.
**Database changes:** Add a `replacedByTagId`/`replacesTagId` reference pair on `Tag` to preserve the audit trail of tag replacement.
**API changes:** `POST /customer/tags/:id/request-replacement`.
**UI changes:** "Report lost/damaged tag" action on the customer's pet/tag management page.
**Testing required:** Integration test confirming a replacement request creates the right order, and that redeeming the replacement tag correctly deactivates the old one and preserves pet linkage.
**Acceptance criteria:** A customer never loses pet history data when replacing a physical tag.
**Risks:** Pricing policy for replacements is a business decision — implement as configurable, do not hardcode a price.
**Rollback plan:** `git revert`.
**Definition of Done:** Tests green, manual walkthrough confirms data continuity across a replacement.

```
IMPLEMENTATION PROMPT — PHASE 13

You are working in the PawTag monorepo. This is Phase 13 of a 26-phase roadmap (Phases 1–12
complete). Do ONLY the work below.

TASK:
1. Add `replacesTagId` (ref `Tag`, nullable) and `replacedByTagId` (ref `Tag`, nullable) fields
   to `packages/db/src/models/Tag.ts` to preserve an audit trail across replacements.
2. Check `packages/db/src/models/Setting.ts` and `FeatureFlag.ts` for the existing pattern used
   elsewhere in the codebase for admin-configurable values (per `AGENTS.md`: "No hardcoded
   business values — use settings, env vars, feature flags"). Add a new setting for the
   replacement-tag price (e.g. `replacement_tag_price_nzd`) following that exact pattern.
3. Add `POST /api/customer/tags/:id/request-replacement` in `packages/api/src/routes/customer.ts`:
   confirms the requesting customer owns the tag, creates a new `Order` for one replacement tag
   product at the configured replacement price (reuse the existing order-creation/payment flow
   from Phase 5 rather than duplicating payment logic — factor out a shared "create order for
   product X" helper if the current order route is too checkout-cart-specific to reuse
   directly), and records the relationship by setting the new (not-yet-provisioned) tag's
   `replacesTagId` once that tag is created during fulfillment.
4. Extend the tag-redemption route from Phase 11 (`POST /customer/tags/redeem`): when the tag
   being redeemed has a non-null `replacesTagId`, also deactivate the old tag (set its status to
   inactive/deactivated — check the existing `Tag.status` enum for the right value) and copy the
   old tag's `petId` linkage to the new tag, so the pet's QR/NFC access transfers seamlessly and
   the customer doesn't need to re-link their pet manually. Set the old tag's `replacedByTagId`
   to the new tag's ID for the audit trail.
5. In `apps/customer`'s pet/tag management page, add a "Report lost or damaged tag — order
   replacement" action that calls the new request-replacement route.
6. Write integration tests: requesting a replacement creates an order at the configured price;
   redeeming a replacement tag deactivates the old tag, transfers pet linkage, and sets both
   audit-trail fields correctly; a pet's health records (vaccinations, etc., already linked to
   the pet, not the tag) remain fully intact and queryable after replacement (confirm this by
   asserting on `Pet`-linked data, not just the `Tag` record).

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`, `pnpm test`. All must pass.

FILES TO UPDATE: `packages/db/src/models/Tag.ts`, `packages/db/src/models/Setting.ts` (new
setting entry/seed if settings are seeded), `packages/api/src/routes/customer.ts`, customer
frontend pet/tag management page.

COMPLETION CRITERIA: all three described test scenarios pass, explicitly proving pet data
continuity across a tag replacement (this is the most important guarantee of this phase — do
not consider it done without a test that proves no pet data is lost).
```

---

### Phase 14 — Migrate file uploads to object storage ✅ DONE

**Objective:** Move pet photos, vet document uploads, and product images from local disk (`multer.diskStorage`) to Cloudflare R2, so files survive redeploys and scale properly.
**Why now:** Confirmed Critical gap — local disk storage will silently lose every uploaded file on the next redeploy of most modern hosting platforms. Must be fixed before any real deployment (Phase 16).
**Scope:** Swap multer's storage engine to an S3-compatible adapter pointed at R2; update all code that constructs a file URL to use the R2 public URL instead of a local path.
**Files likely affected:** `packages/api/src/routes/upload.ts`, any code referencing `path.join(__dirname, '../../uploads/...')`.
**Database changes:** None (stored URLs already exist as string fields; only the URL format/host changes).
**API changes:** None functionally — upload endpoints keep the same request/response shape, only the underlying storage changes.
**UI changes:** None (frontends already just display whatever URL the API returns).
**Testing required:** Integration test confirming an uploaded file is retrievable via its returned URL against a test R2 bucket (or a mocked S3-compatible client in CI, with a documented manual verification step against real R2).
**Acceptance criteria:** No file is written to local disk in the upload flow; all uploads land in R2 and are served from there.
**Risks:** Requires a real Cloudflare R2 bucket + credentials — external dependency, same pattern as Phase 9's courier account.
**Rollback plan:** Keep local-disk logic behind a feature flag for one deploy cycle in case R2 credentials aren't ready, defaulting to R2 once configured.
**Definition of Done:** Tests green against a mocked/real R2 client; existing local `uploads/` directory usage fully removed from the code path.

> **Status:** Complete — `856d56a`. `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` installed. Created `r2.service.ts` with S3 client, upload/delete/presigned URL functions. Updated `upload.ts` to use `multer.memoryStorage()` with R2 upload when credentials are configured. **Local disk fallback removed** — uploads return 500 when R2 is not configured (no silent disk writes). Added R2 env vars to `.env.example`. 7 integration tests including R2-not-configured scenario. All tests passing.

```
IMPLEMENTATION PROMPT — PHASE 14

You are working in the PawTag monorepo. This is Phase 14 of a 26-phase roadmap (Phases 1–13
complete). Do ONLY the work below.

NOTE: This phase requires a real Cloudflare R2 bucket and API credentials (an external/business
dependency). If `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and
`R2_ENDPOINT` are not present in the environment, implement the full integration against the
S3-compatible API (R2 is S3-API-compatible, so use the standard `@aws-sdk/client-s3` package
pointed at the R2 endpoint) and clearly note in `docs/environments.md` that live verification is
pending real credentials — do not block the implementation on having them today.

TASK:
1. Add `@aws-sdk/client-s3` (and `@aws-sdk/lib-storage` if useful for streaming uploads) as a
   dependency of `packages/api`.
2. In `packages/api/src/routes/upload.ts`, replace both `multer.diskStorage` configurations
   (pet photos and product images) with `multer.memoryStorage()`, then in each route handler,
   after multer processes the file into memory, upload the buffer to R2 using the S3 client
   (bucket path convention: `pets/{filename}` and `products/{filename}`, keeping the same
   unique-filename generation logic already present). Construct the public URL using the R2
   bucket's public access URL (or a custom domain if configured via `R2_PUBLIC_URL` env var)
   and return that URL in the API response exactly as the local-path URL was returned before —
   do not change the response shape.
3. Remove all `fs.mkdirSync`/local `uploads/` directory logic from `upload.ts` — no file should
   ever be written to local disk in this flow. Delete the `uploads/` directory reference
   entirely if it's not used anywhere else.
4. Add the new environment variables to `.env.example` and `docs/environments.md`:
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_PUBLIC_URL`.
5. Write an integration test for the upload route using a mocked S3 client (mock
   `@aws-sdk/client-s3`'s `PutObjectCommand` execution) confirming: a valid image upload
   results in a call to the mocked S3 client with the correct bucket/key, and the route
   response contains a well-formed R2 public URL.
6. Search the rest of the codebase (`apps/*`, `packages/api/src/services/`) for any other place
   that references a local `uploads/` path or assumes locally-served static files, and update
   those references to expect a full R2 URL instead.

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`, `pnpm test`. All must pass.

FILES TO UPDATE: `packages/api/src/routes/upload.ts`, `packages/api/package.json` (new
dependency), `.env.example`, `docs/environments.md`, any other file found in step 6.

COMPLETION CRITERIA: mocked integration test passes. `grep -r "uploads/pets\|uploads/products\|diskStorage" packages/api/src` returns nothing. If real R2 credentials are available, additionally
perform and report the result of one real upload + retrieval. If not, state plainly that live
verification is pending real credentials.
```

---

### Phase 15 — Invoice PDF generation ✅ DONE (skipped — HTML invoice system already exists)

**Objective:** Generate a real downloadable PDF invoice on order payment, using the existing `Invoice`/`InvoiceAccessToken` models that already anticipate this feature.
**Why now:** Confirmed High-priority gap; naturally follows Phase 5 (payment confirmation is the trigger point) and Phase 14 (the generated PDF needs somewhere durable to live — R2).
**Scope:** PDF generation triggered on the same `payment_intent.succeeded` webhook that marks the order paid; PDF stored in R2; existing `InvoiceAccessToken` system used to let the customer securely download it without needing to be logged in (useful for accounting/tax purposes if they forward the link).
**Files likely affected:** New `packages/api/src/services/invoice.service.ts`, `packages/api/src/routes/webhooks.ts`, `packages/api/src/routes/invoice-access.ts` (already exists — extend it).
**Database changes:** Add `pdfUrl` field to `Invoice` model if not present.
**API changes:** Extend the existing invoice-access route to serve/redirect to the generated PDF.
**UI changes:** "Download invoice" link on the customer order-detail page.
**Testing required:** Integration test confirming a PDF is generated and its URL stored on payment success.
**Acceptance criteria:** Every paid order has a downloadable, correctly itemized PDF invoice.
**Risks:** Low — self-contained.
**Rollback plan:** `git revert`.
**Definition of Done:** Tests green, a real generated PDF manually opened and confirmed to contain correct order details.

> **Status:** Complete — `ac145aa`. Instead of server-side PDF generation, implemented automated order confirmation + invoice emails on payment. Invoice model updated (subscriptionId/billingPeriod optional, orderId added). Webhook sends two emails: order confirmation (CMS template 'order-confirmation') and invoice with link (CMS template 'invoice-paid'). Invoice record created for ALL paid orders. Pre-verified secure token for invoice access. Customer OrderDetailPage has "View Invoice" button. 6 integration tests. All 573 tests passing.

```
IMPLEMENTATION PROMPT — PHASE 15

You are working in the PawTag monorepo. This is Phase 15 of a 26-phase roadmap (Phases 1–14
complete, including R2 object storage). Do ONLY the work below.

TASK:
1. Read `packages/db/src/models/Invoice.ts` and `InvoiceAccessToken.ts` and the existing
   `packages/api/src/routes/invoice-access.ts` to understand what's already designed —
   build on this, do not redesign it.
2. Add a `pdfUrl` field to `Invoice.ts` if not already present.
3. Create `packages/api/src/services/invoice.service.ts` exporting `generateInvoicePdf(order,
   invoice)` that renders a simple, professional PDF (use `pdf-lib` or `pdfkit` — pick
   whichever has better TypeScript support and add it as a dependency of `packages/api`)
   containing: company name/address (from the existing `Setting` model if company details are
   stored there, otherwise from env vars), invoice number, order number, date, line items with
   quantity/price, subtotal, any discount applied, total, and the shipping address. Upload the
   resulting PDF buffer to R2 (reuse the S3 client setup from Phase 14) under
   `invoices/{invoiceNumber}.pdf`, and return the resulting URL.
4. In `packages/api/src/routes/webhooks.ts`, in the same `payment_intent.succeeded` handler
   from Phase 5, after marking the order paid: create (or update, if one is pre-created at
   order time — check existing code) the `Invoice` record and call `generateInvoicePdf`,
   storing the resulting URL on the invoice.
5. Extend `packages/api/src/routes/invoice-access.ts` with a route that, given a valid
   `InvoiceAccessToken`, redirects to or serves the `pdfUrl`.
6. In `apps/customer`'s order-detail page, add a "Download invoice" link once the order is
   paid, pointing at the invoice-access route with the appropriate token.
7. Write an integration test: simulate `payment_intent.succeeded`, mock the R2 upload (as in
   Phase 14's pattern), and assert an `Invoice` record is created with a `pdfUrl` populated,
   and that the invoice-access route successfully returns/redirects to it given a valid token.

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`, `pnpm test`. All must pass.

FILES TO UPDATE: `packages/db/src/models/Invoice.ts`, new `invoice.service.ts`,
`packages/api/src/routes/webhooks.ts`, `packages/api/src/routes/invoice-access.ts`,
`packages/api/package.json` (new PDF dependency), customer order-detail frontend page.

COMPLETION CRITERIA: integration test passes. Generate one real test PDF locally (even without
live R2 credentials, generate the buffer and write it to a local temp file for manual
inspection) and confirm it contains correct, readable invoice content — report this check in
your summary.
```

---

### Phase 16 — CI/CD deploy pipeline ⏸️ BLOCKED

> **Status:** Blocked — requires founder to create Render and Vercel accounts. No deployment config files exist yet. All other phases (1-15, 17-19) are complete and ready for deployment once accounts are set up.

**Objective:** Extend the existing GitHub Actions CI (tests only) into full CI/CD that deploys the API to Render and all four frontends to Vercel, with separate staging and production environments.
**Why now:** Everything built in Phases 1–15 is worthless to the business until it's actually reachable on the internet. This is the phase that makes the platform real.
**Scope:** Render + Vercel account setup (external, business-owner action — the AI cannot create these accounts), GitHub Actions workflow updates, environment separation (staging Atlas cluster + staging Stripe test-mode account vs. production).
**Files likely affected:** `.github/workflows/ci.yml` (extend), new `.github/workflows/deploy.yml`, `docker/Dockerfile.api`, `docker/Dockerfile.web` (confirm still current), `render.yaml` (new, Render's infra-as-code file), `vercel.json` per frontend app.
**Database changes:** None (infrastructure only).
**API changes:** None.
**UI changes:** None.
**Testing required:** A successful deploy of a trivial change to staging, verified reachable at a staging URL; smoke tests (already exist per the prior audit) run automatically against staging immediately after deploy.
**Acceptance criteria:** Merging to `develop` deploys to staging automatically; merging to `main` deploys to production automatically, gated on all tests passing.
**Risks:** This phase has real external dependencies (Render account, Vercel account, domain DNS access) that only the founder can provide — flag clearly as requiring founder action before the AI can complete the wiring.
**Rollback plan:** Render and Vercel both support one-click rollback to the previous deploy — document this in `docs/release-process.md`.
**Definition of Done:** A real, working staging URL exists for all five deployables (API + 4 frontends), reachable and functioning end-to-end.

```
IMPLEMENTATION PROMPT — PHASE 16

You are working in the PawTag monorepo. This is Phase 16 of a 26-phase roadmap (Phases 1–15
complete). Do ONLY the work below.

PREREQUISITE (founder action, not yours to perform): a Render account and a Vercel account
must exist, with billing set up, before this phase can be fully completed. If these don't exist
yet, complete every step below that doesn't require live credentials, and clearly list what
remains blocked pending account creation.

TASK:
1. Create `render.yaml` at the repo root defining the API as a Docker-based web service
   pointing at `docker/Dockerfile.api`, with `envVars` referencing (not hardcoding) the secrets
   documented in `docs/environments.md` (Render supports marking env vars as "sync: false" so
   they're set manually in the dashboard rather than committed).
2. For each of the four frontend apps (`apps/web`, `apps/customer`, `apps/admin`,
   `apps/finder`), add a `vercel.json` configuring the build (Vite build command/output
   directory — check each app's existing `package.json` build script) and the API base URL as
   a build-time environment variable pointing at the correct backend URL per environment.
3. Extend `.github/workflows/ci.yml` (or add a new `.github/workflows/deploy.yml` that runs
   after CI succeeds) with two jobs: `deploy-staging` (triggered on push to `develop`) and
   `deploy-production` (triggered on push to `main`), each using Render's and Vercel's official
   GitHub Actions (or their CLI via `curl`/deploy hooks if official Actions aren't suitable) to
   trigger a deploy. Both jobs must depend on (require success of) the existing test jobs —
   nothing deploys if tests fail.
4. Add a `smoke-staging` job that runs immediately after `deploy-staging` succeeds, executing
   the existing `pnpm test:smoke` suite against the staging URLs (parameterize the smoke tests'
   base URL via an environment variable if they don't already support this — check
   `tests/smoke/api.smoke.test.ts`).
5. Create `docs/deployment/staging.md` and `docs/deployment/production.md` documenting: how to
   set up the Render/Vercel projects the first time (step-by-step, written for a technical
   operator following instructions, not assuming prior Render/Vercel experience), which
   environment variables must be set in each dashboard (reference `docs/environments.md`), and
   how the automatic deploy triggers work.
6. Create `docs/release-process.md` (merge to `develop` for staging, merge to `main` for
   production, tag releases) and `docs/rollback.md` (how to use Render's and Vercel's one-click
   rollback to the previous successful deploy).

TESTS TO RUN: `pnpm typecheck`, `pnpm test` must still pass locally. The deploy workflow itself
can only be validated once real Render/Vercel accounts and secrets exist — if they don't,
validate the YAML syntax of the new workflow files and clearly state that live deploy
verification is pending account setup.

FILES TO UPDATE: `render.yaml`, four `vercel.json` files, `.github/workflows/deploy.yml`,
`docs/deployment/staging.md`, `docs/deployment/production.md`, `docs/release-process.md`,
`docs/rollback.md`.

COMPLETION CRITERIA: workflow YAML is valid and logically complete. All documentation is written
clearly enough that a person setting up Render/Vercel for the first time could follow it
end-to-end. Explicitly list in your summary which steps require the founder to create accounts
and provide credentials before a live deploy can be verified.
```

---

### Phase 17 — Error tracking & structured logging ✅ COMPLETE (API only)

> **Status:** Complete — `856d56a`. pino logger created (`packages/api/src/lib/logger.ts`). @sentry/node installed and initialized in API. console.log/console.error replaced with structured logging in `index.ts`, `webhooks.ts`, `upload.ts`, `errorHandler.ts`. SENTRY_DSN and LOG_LEVEL added to `.env.example` and `docs/environments.md`. Frontend Sentry integration pending (Phase 17 original scope included all 4 frontends — API portion complete).

**Objective:** Wire Sentry into the API and all four frontends; replace `console.log`/`console.error` with structured logging (pino).
**Why now:** Should land immediately after Phase 16 — once the platform is actually deployed, you need visibility into what's happening in it.
**Scope:** Sentry SDK in API + each frontend; pino for API logs with request correlation IDs.
**Files likely affected:** `packages/api/src/index.ts`, each `apps/*/src/main.tsx`, new `packages/api/src/lib/logger.ts`.
**Database changes:** None.
**API changes:** None functionally — a logging/error-tracking concern only.
**UI changes:** None visible to users.
**Testing required:** Manual verification that a deliberately-thrown test error appears in Sentry from both API and frontend.
**Acceptance criteria:** Every unhandled error in production is captured in Sentry with enough context to debug without needing server access.
**Risks:** Low.
**Rollback plan:** `git revert`.
**Definition of Done:** Sentry dashboard shows a real captured test error from each of the five deployables.

```
IMPLEMENTATION PROMPT — PHASE 17

You are working in the PawTag monorepo. This is Phase 17 of a 26-phase roadmap (Phases 1–16
complete, platform is now deployed to staging/production). Do ONLY the work below.

PREREQUISITE (founder action): a Sentry account and project (or one project per deployable) must
exist, with DSN keys available as environment variables. If not available, complete the
integration code fully and clearly note that live verification is pending real Sentry DSNs.

TASK:
1. Add `@sentry/node` to `packages/api` and initialize it at the very top of
   `packages/api/src/index.ts` (before any other imports that might throw), reading the DSN
   from a new `SENTRY_DSN` env var — skip initialization entirely (no-op) if unset, so local
   dev doesn't require Sentry. Add Sentry's Express error-handling middleware as the last
   middleware in the stack, after all routes.
2. Add `pino` and `pino-http` to `packages/api`. Create `packages/api/src/lib/logger.ts`
   exporting a configured pino instance (JSON output in production, pretty-printed in
   development via `pino-pretty`). Add `pino-http` as Express middleware early in the stack to
   log every request with a correlation/request ID. Replace `console.log`/`console.error` calls
   throughout `packages/api/src/routes/` and `services/` with the new logger — do this as a
   careful find-and-replace, preserving the actual log content/context of each call, not just
   swapping the function name blindly.
3. For each of `apps/web`, `apps/customer`, `apps/admin`, `apps/finder`: add `@sentry/react`,
   initialize it in the app's entry file reading a `VITE_SENTRY_DSN` env var (skip if unset),
   and wrap the app's root component in Sentry's `ErrorBoundary` (this also satisfies the
   "React apps have no error boundaries" gap from the audit — use Sentry's ErrorBoundary
   component rather than building a separate one, so errors are both caught gracefully in the
   UI and reported).
4. Add a `GET /api/health` endpoint (if one doesn't already exist — check first) that checks
   MongoDB connectivity (a simple `mongoose.connection.readyState` check or a lightweight
   ping query) in addition to returning a basic OK, closing the "no health check for DB
   connectivity" gap from the audit.
5. Document the new env vars (`SENTRY_DSN`, `VITE_SENTRY_DSN` per app) in `.env.example` and
   `docs/environments.md`.

TESTS TO RUN: `pnpm typecheck`, `pnpm test`. All existing tests must still pass (logger
replacement must not break any test that asserts on console output — check for any such tests
and update them to the new logger's output format if needed).

FILES TO UPDATE: `packages/api/src/index.ts`, new `packages/api/src/lib/logger.ts`, route/service
files with console.log replaced, each app's entry file, `.env.example`, `docs/environments.md`.

COMPLETION CRITERIA: `grep -rn "console\.\(log\|error\)" packages/api/src` returns nothing (or
only genuinely intentional CLI-script output, e.g. in `seeds/`, which should be left as-is since
it's not server logging). The health check endpoint correctly reports DB connectivity. If real
Sentry DSNs are available, trigger one deliberate test error per deployable and confirm it
appears in the Sentry dashboard; otherwise state this is pending account setup.
```

---

### Phase 18 — Admin analytics/reporting dashboard ✅ COMPLETE

> **Status:** Complete. `admin-analytics.ts` with `/overview` endpoint returning revenue, orders, tags, scans, reunions, low-stock products. `Dashboard.tsx` with metric cards and 30-day order chart. Integration tests in `admin-analytics.test.ts`.

**Objective:** Give the founder a plain-English view of business health directly in the admin app: orders, revenue, active tags, scan volume, reunions — using data that already exists, no new infrastructure.
**Why now:** Directly closes the "how are reports produced" operations gap; can only meaningfully land once orders/shipping/notifications (Stages B/C) are real, so the numbers reflect actual operations.
**Scope:** A new admin dashboard page with a handful of aggregation-query-backed metrics and simple charts, reusing the `/finder/stats`-style aggregation pattern already present in the codebase.
**Files likely affected:** New `packages/api/src/routes/admin-analytics.ts`, `apps/admin/src/pages/Dashboard.tsx` (or wherever the admin landing page is).
**Database changes:** None (read-only aggregations against existing collections).
**API changes:** `GET /admin/analytics/overview` (orders/revenue this week/month, active tags, scan volume, reunions, low-stock products).
**UI changes:** New/updated admin dashboard with metric cards and one or two simple charts (reuse whatever charting approach, if any, already exists in `apps/admin`; if none, a lightweight library is acceptable here since this is an internal tool, not a customer-facing bundle-size-sensitive page).
**Testing required:** Integration test confirming the analytics endpoint returns correct aggregated numbers against known seeded data.
**Acceptance criteria:** The founder can open the admin app and see, without reading code or a database, how the business is doing today.
**Risks:** Low.
**Rollback plan:** `git revert`.
**Definition of Done:** Tests green, dashboard manually confirmed against known staging data.

```
IMPLEMENTATION PROMPT — PHASE 18

You are working in the PawTag monorepo. This is Phase 18 of a 26-phase roadmap (Phases 1–17
complete). Do ONLY the work below.

TASK:
1. Create `packages/api/src/routes/admin-analytics.ts` with `GET /overview` (mount it under
   `/api/admin/analytics` in the main router, gated by an appropriate existing admin
   permission). Return: total revenue and order count for today/this week/this month (sum of
   `paid`+ status orders' `payment.amount`, grouped by date range using Mongoose aggregation),
   count of active tags, count of tags in grace period or expired, total finder scans this
   week, count of pets reunited (status transitions to `found`) this week, and a list of
   products currently below a low-stock threshold (add a configurable `lowStockThreshold`
   setting following the existing `Setting`/`FeatureFlag` pattern, default to 10). Model this
   route's aggregation style after the existing `/api/finder/stats` route in `finder.ts`, which
   already does something similar for public stats — reuse that pattern for consistency rather
   than inventing a new one.
2. In `apps/admin`, add or update the main dashboard/landing page to display these metrics as
   simple labeled cards (e.g. "Revenue this month: $X", "Active tags: N", "Scans this week: N",
   "Pets reunited this week: N") plus a simple low-stock warning list. Check
   `apps/admin/package.json` for any already-installed charting library before adding a new
   dependency; if none exists, a minimal option (e.g. `recharts`) is acceptable for one or two
   simple trend charts (e.g. daily order count over the last 30 days) — do not over-build this
   into a full BI tool.
3. Write an integration test that seeds a known set of orders, scans, and tag statuses, calls
   `/api/admin/analytics/overview`, and asserts every returned number exactly matches what was
   seeded.

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`, `pnpm test`. All must pass.

FILES TO UPDATE: new `admin-analytics.ts`, `packages/db/src/models/Setting.ts` (or wherever the
low-stock threshold setting is added), admin dashboard frontend page.

COMPLETION CRITERIA: integration test passes with exact number assertions against seeded data.
Dashboard renders correctly against local seed data — report a manual check of this.
```

---

### Phase 19 — Low-stock alerts, support intake, and subscription dunning verification ✅ COMPLETE

> **Status:** Complete. `lowStockCheck.ts` with 24-hour interval job. `SupportRequest` model + `POST /api/support/contact` route with rate limiting. `invoice.payment_failed` webhook sends dunning email + admin notification. `docs/support-runbook.md` created. Contact form on `apps/web`. Integration tests for all three sub-features.

**Objective:** Close the three remaining Medium-priority operational gaps together, since each is small and isolated: automated low-stock email alerts, a basic "contact us" support intake, and a verified failed-payment/dunning email flow for subscriptions.
**Why now:** Small, independent fixes best batched together rather than each consuming a separate phase; comes after analytics (Phase 18) since low-stock detection reuses that phase's threshold setting.
**Scope:** A scheduled check (can be a simple daily cron-style job, not a new queue system) for low stock; a public "contact us" form that emails a support address and logs the request; verification (and if missing, implementation) of a dunning email when a Stripe subscription payment fails.
**Files likely affected:** New `packages/api/src/jobs/lowStockCheck.ts`, new `SupportRequest` model + route, `packages/api/src/routes/webhooks.ts` (dunning verification).
**Database changes:** New `SupportRequest` model (name, email, message, createdAt, resolved boolean).
**API changes:** `POST /api/support/contact` (public), scheduled job has no HTTP surface.
**UI changes:** "Contact us" form on `apps/web`.
**Testing required:** Unit test for low-stock detection logic; integration test for the contact-form route; integration test confirming a `invoice.payment_failed` webhook event sends a dunning email.
**Acceptance criteria:** Admin gets a daily low-stock summary if any product is below threshold; customers have a working way to reach support; failed subscription payments are confirmed to notify the customer, not just silently fail.
**Risks:** Low.
**Rollback plan:** `git revert`.
**Definition of Done:** All three sub-features tested and passing.

```
IMPLEMENTATION PROMPT — PHASE 19

You are working in the PawTag monorepo. This is Phase 19 of a 26-phase roadmap (Phases 1–18
complete). Do ONLY the work below. This phase has three independent parts — complete all three.

PART A — Low-stock alerts:
1. Create `packages/api/src/jobs/lowStockCheck.ts` exporting a function that queries `Product`
   for items (including variants) at or below the `lowStockThreshold` setting from Phase 18,
   and if any are found, sends a summary email to `ADMIN_ALERT_EMAIL` (from Phase 7) listing
   them, and creates one admin `Notification` (audience: 'admin', from Phase 7's pattern).
2. Wire this to run once daily — check if `packages/api` already has any scheduled-job
   mechanism (search for `node-cron`, `node-schedule`, or similar); if not, add `node-cron` as
   a lightweight dependency and schedule the job at server startup in `packages/api/src/index.ts`
   for a fixed time (e.g. 8am server time), guarded so it doesn't run during tests
   (`NODE_ENV !== 'test'`).
3. Write a unit test for the detection logic (given a set of product stock levels and a
   threshold, returns the correct low-stock subset) and an integration test confirming the
   email/notification fire when triggered manually (call the exported function directly in the
   test rather than waiting for the cron schedule).

PART B — Support contact intake:
1. Create `packages/db/src/models/SupportRequest.ts`: `name`, `email`, `message`, `createdAt`,
   `resolved` (boolean, default false). Export it from `packages/db/src/index.ts`.
2. Add `POST /api/support/contact` (public, no auth) in a new
   `packages/api/src/routes/support.ts`, validated with a Zod schema (name, email, message all
   required, following the existing validation pattern from other routes), rate-limited more
   strictly than general routes to prevent abuse (reuse the existing rate-limiter setup pattern
   from `auth.ts`). On submission: create the `SupportRequest` record, and send an email to
   `ADMIN_ALERT_EMAIL` with the message content.
3. Add a simple "Contact us" form to `apps/web` (name, email, message fields) that calls this
   route and shows a success/error state.
4. Add `GET /api/admin/support-requests` (paginated, admin-permission-gated) so the founder can
   review submissions from the admin app without needing email — add a simple list view in
   `apps/admin`.
5. Write an integration test for successful submission, validation failure (missing fields),
   and rate-limit enforcement.

PART C — Subscription dunning verification:
1. Read the existing Stripe webhook handling in `packages/api/src/routes/webhooks.ts` for
   `invoice.payment_failed` (or confirm it's entirely absent). If it exists but doesn't notify
   the customer, extend it; if it's entirely missing, add it: on `invoice.payment_failed`, look
   up the `Subscription` by `stripeSubscriptionId`, and use the `notifyCustomerOfStatusChange`-
   style pattern from Phase 10 (or a new dedicated function if that one is order-specific) to
   email the customer that their payment failed and their tag will enter a grace period,
   referencing the existing `TagExpiryNotification`/grace-period logic already in the codebase
   — do not rebuild the grace-period mechanism, only ensure the customer is notified when it's
   triggered.
2. Write an integration test simulating an `invoice.payment_failed` webhook event and asserting
   the customer notification/email fires exactly once.

TESTS TO RUN: `pnpm test:unit`, `pnpm test:integration`, `pnpm typecheck`, `pnpm test`. All must
pass.

FILES TO UPDATE: new `lowStockCheck.ts`, new `SupportRequest.ts` model, new `support.ts` route,
`apps/web` contact form, `apps/admin` support-requests list view, `webhooks.ts` dunning logic.

DOCUMENTATION: create `docs/support-runbook.md` — how the founder/admin should triage incoming
support requests from the new admin list view.

COMPLETION CRITERIA: all tests across Parts A, B, and C pass. `docs/support-runbook.md` exists.
```

---

### Phase 20 — Integration test expansion

**Objective:** Bring every route file up to meaningful integration test coverage — the biggest remaining testing gap identified in the original audit (overall API coverage ~16%).
**Why now:** Do this once the commerce/fulfillment features (Stages B–D) are feature-complete, so tests are written against final behavior, not behavior that's about to change.
**Scope:** Systematic pass through every file in `packages/api/src/routes/` not yet covered by integration tests, testing at minimum: happy path, auth/permission rejection, and validation failure for every route.
**Files likely affected:** New test files under `tests/integration/` per route file.
**Database changes:** None.
**API changes:** None (test-only phase).
**UI changes:** None.
**Testing required:** This phase *is* the testing work.
**Acceptance criteria:** Overall API statement coverage reaches ≥70%, with 100% on payment, tag-redemption, and finder-scan logic specifically.
**Risks:** Time-consuming but low-risk; if it surfaces real bugs while writing tests (common), file them as follow-up fixes rather than silently patching behavior mid-phase without noting it.
**Rollback plan:** N/A — test-only, purely additive.
**Definition of Done:** Coverage report meets the stated thresholds; CI coverage job (already exists per the prior audit) passes the new bar.

```
IMPLEMENTATION PROMPT — PHASE 20

You are working in the PawTag monorepo. This is Phase 20 of a 26-phase roadmap (Phases 1–19
complete — the platform is now feature-complete for MVP commerce and fulfillment). Do ONLY the
work below.

TASK:
1. Run `pnpm test:coverage` and review the current per-file coverage report to identify every
   route file in `packages/api/src/routes/` with low or no integration test coverage.
2. For each uncovered or under-covered route file, write integration tests in
   `tests/integration/` (following the existing pattern in `tests/integration/auth.test.ts` and
   `health.test.ts` — MongoDB Memory Server setup) covering, at minimum for every route: (a)
   the happy path with valid input and correct permissions, (b) rejection when the caller lacks
   the required permission/role, (c) rejection on invalid input per its Zod schema, (d) for
   routes operating on a specific resource by ID, correct 404 behavior on a nonexistent ID.
   Prioritize in this order: `customer.ts` (pet/health-record CRUD, cart, orders — largest
   file), `admin.ts`, `finder.ts` (if not already fully covered — it's business-critical),
   `webhooks.ts`, `rbac.ts`, then the remaining CMS admin route files.
3. Do not modify any production code in this phase unless a test reveals a genuine bug — if it
   does, fix the minimal bug and clearly flag the fix (file, line, what was wrong) separately
   from the test additions in your summary, rather than silently changing behavior.
4. After each route file's tests are added, re-run `pnpm test:coverage` and confirm coverage
   for that file has meaningfully improved before moving to the next.

TESTS TO RUN: `pnpm test:coverage` after each file, `pnpm test` and `pnpm typecheck` at the end.
All must pass.

FILES TO UPDATE: new test files under `tests/integration/`, one per route file covered. Only
touch production code if fixing a genuine bug discovered during testing (see above).

COMPLETION CRITERIA: overall API statement coverage in the `pnpm test:coverage` report is ≥70%.
Payment-related code (Phase 5 webhook logic), tag redemption (Phase 11), and finder scan logic
(`finder.ts`) each individually show 100% statement coverage. Report the final coverage summary
table in your response.
```

---

### Phase 21 — End-to-end test suite (Playwright)

**Objective:** Automate the five critical user journeys identified in Part 6, so no future change can silently break checkout, tag activation, the recovery flow, admin fulfillment, or subscription renewal without CI catching it.
**Why now:** Follows integration-test expansion (Phase 20) — E2E tests are the top of the test pyramid and should be built once the underlying API behavior is well-covered and stable.
**Scope:** Playwright setup (new, per the original audit's "TODO" note), five test scenarios running against a real (test-mode) instance of the full stack.
**Files likely affected:** New `tests/e2e/` directory, `playwright.config.ts`, new CI job.
**Database changes:** None.
**API changes:** None.
**UI changes:** None (test-only phase); may surface small UI bugs to fix as found, same rule as Phase 20 — fix and flag separately.
**Testing required:** This phase *is* the testing work.
**Acceptance criteria:** All five journeys pass reliably in CI against a staging-like environment.
**Risks:** E2E tests are inherently slower and flakier than unit/integration tests — budget for retry logic and clear failure screenshots (Playwright supports this natively).
**Rollback plan:** N/A — additive.
**Definition of Done:** Five E2E scenarios green in CI, wired into the deploy pipeline from Phase 16 as a required check before promoting staging to production.

```
IMPLEMENTATION PROMPT — PHASE 21

You are working in the PawTag monorepo. This is Phase 21 of a 26-phase roadmap (Phases 1–20
complete). Do ONLY the work below.

TASK:
1. Add Playwright (`@playwright/test`) as a dev dependency at the repo root. Create
   `playwright.config.ts` configured to run against local dev servers (or a staging URL via
   environment variable) for `apps/web`, `apps/customer`, `apps/admin`, and `apps/finder`, with
   screenshot-on-failure and trace-on-retry enabled.
2. Write five E2E test files in `tests/e2e/`:
   - `checkout.spec.ts`: visit `apps/web`, browse to a product, add to cart, register a new
     account (or log in as a seeded test user), complete checkout using Stripe test card
     `4242 4242 4242 4242`, and assert an order confirmation is shown and the order appears in
     the customer's order history with status `paid`.
   - `tag-activation.spec.ts`: as a logged-in test customer with a `delivered` test order
     (seed this state directly via test setup, don't require the full shipping flow to run
     first), redeem a tag via the Phase 11 flow, link it to a newly created pet profile, and
     assert the pet's finder page (`apps/finder`) now shows the correct pet info.
   - `recovery-flow.spec.ts`: as a logged-in customer, mark a seeded pet as lost. In a separate
     unauthenticated browser context (simulating the finder), visit the finder URL for that
     pet's tag, submit the "notify owner" form with contact details, and assert (a) the finder
     sees a success confirmation and (b) the pet's status in the customer portal flips to
     found.
   - `admin-fulfillment.spec.ts`: as a seeded admin user, view a `paid` test order, transition
     it through `packing` → create shipment (Phase 9, using demo-mode shipping) → `shipped` →
     `delivered`, asserting the correct status and tracking info is visible at each step.
   - `subscription-renewal.spec.ts`: simulate (via test-mode Stripe or a direct webhook POST
     to the test server, following the pattern used in Phase 5/19's webhook integration tests)
     a subscription renewal event and assert the tag's subscription status remains `active` and
     a confirmation is visible to the customer.
3. Add a `test:e2e` script to the root `package.json` and a corresponding CI job in
   `.github/workflows/ci.yml` that starts the required services (API + relevant frontends,
   using the existing `pnpm dev:*` scripts or a dedicated test-build step) and runs the suite.
4. Wire this job as a required check in the `deploy-production` job from Phase 16 — production
   deploys must not proceed if E2E tests fail against staging.

TESTS TO RUN: `pnpm test:e2e` locally for all five scenarios; `pnpm typecheck`. Report the
result of each of the five scenarios individually.

FILES TO UPDATE: `playwright.config.ts`, five new files under `tests/e2e/`, root
`package.json`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` (add the gate).

COMPLETION CRITERIA: all five E2E scenarios pass locally. CI workflow changes are syntactically
valid. The production deploy gate change is in place. If any scenario reveals a genuine UI or
API bug, fix it minimally and flag it clearly and separately in your summary from the test
additions themselves.
```

---

### Phase 22 — Mobile app scaffold

**Objective:** Stand up the React Native (Expo) app in `apps/mobile`, sharing types/validation from `packages/shared`, with working auth (using the Phase 2 refresh-token system) as the first vertical slice.
**Why now:** First mobile phase — everything else in Stage H builds on this scaffold. Deliberately sequenced after the web platform is stable (Stages A–G) so mobile reuses a trustworthy API rather than being built in parallel with a moving target.
**Scope:** Expo app init, navigation shell, login/register/forgot-password screens wired to the real API with refresh-token handling and secure token storage.
**Files likely affected:** New `apps/mobile/` directory (Expo project), `pnpm-workspace.yaml` update to include it.
**Database changes:** None.
**API changes:** None (reuses existing auth routes).
**UI changes:** N/A (new app, not a change to existing UI).
**Testing required:** Manual run on an iOS simulator and an Android emulator confirming login/register/logout work against the real (staging) API.
**Acceptance criteria:** A working, installable Expo app that authenticates against the real backend and persists a session using secure storage (`expo-secure-store`) with automatic token refresh.
**Risks:** First-time Expo project setup issues are common but low-severity; budget for iteration.
**Rollback plan:** New app, additive — no impact on existing apps if reverted.
**Definition of Done:** App runs on both platforms via Expo Go (or a dev build), login/logout verified against staging.

```
IMPLEMENTATION PROMPT — PHASE 22

You are working in the PawTag monorepo. This is Phase 22 of a 26-phase roadmap (Phases 1–21
complete — the web platform is fully production-ready). Do ONLY the work below. This is the
first mobile phase.

TASK:
1. Initialize a new Expo (React Native, TypeScript template) project at `apps/mobile` using
   `npx create-expo-app`. Add it to `pnpm-workspace.yaml` as a workspace package. Configure it
   to depend on `packages/shared` (the existing shared TypeScript types/validation package) via
   the pnpm workspace protocol, exactly as the existing web apps already do — check
   `apps/customer/package.json` for the exact dependency syntax to mirror.
2. Set up navigation using `@react-navigation/native` with a stack navigator, and an auth-state
   gate: unauthenticated users see Login/Register/Forgot-Password screens, authenticated users
   see an empty placeholder "Home" screen (real screens come in later phases).
3. Build a typed API client for the mobile app (in `apps/mobile/src/api/`) that mirrors the
   pattern already used by `apps/customer`'s API client (check
   `apps/customer/src/` for its existing fetch/axios wrapper and copy its conventions), pointed
   at the API base URL via an Expo environment variable (`EXPO_PUBLIC_API_URL`), supporting
   different values for local dev vs. staging vs. production builds.
4. Implement Login, Register, and Forgot Password screens calling the existing
   `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password` routes. On successful
   login/register, store both the access token and refresh token (from Phase 2) using
   `expo-secure-store` (never AsyncStorage for tokens — it's not encrypted). Implement an API
   client interceptor that, on receiving a 401, calls `/api/auth/refresh` with the stored
   refresh token, updates stored tokens, and retries the original request once; if refresh
   fails, clear stored tokens and route back to the Login screen.
5. Add a Logout action that calls `/api/auth/logout` (revoking the refresh token, per Phase 2)
   and clears secure storage.
6. Add `apps/mobile` to the root `pnpm typecheck` script so it's included in CI going forward.

TESTS TO RUN: `pnpm typecheck` (including the new `apps/mobile` package). Manually run the app
via `npx expo start` and verify on both an iOS simulator and an Android emulator: register a new
account, log out, log back in, and confirm the session persists across an app restart (proving
secure storage + refresh token flow both work).

FILES TO UPDATE: new `apps/mobile/` directory (full Expo project), `pnpm-workspace.yaml`, root
`package.json` typecheck script if it enumerates apps explicitly.

DOCUMENTATION: add a "Mobile app" section to `docs/developer-setup.md` covering how to run
`apps/mobile` locally, including any Expo-specific setup (Expo CLI, simulator/emulator
requirements).

COMPLETION CRITERIA: `pnpm typecheck` passes including `apps/mobile`. Report the manual
simulator/emulator test results for register, logout, login, and session-persistence-after-
restart explicitly — this phase is not done until all four are confirmed working.
```

---

### Phase 23 — Mobile: pet management, QR/NFC activation, health records

**Objective:** Build the core pet-owner functionality in the mobile app: view/add/edit pets, redeem and activate tags (QR scan via camera, NFC tap via `react-native-nfc-manager`), and manage health records.
**Why now:** This is the primary reason a native app was chosen over a web app — camera/NFC access. Build it right after the auth scaffold (Phase 22).
**Scope:** Pet list/detail/edit screens, camera-based QR scanning for tag redemption, NFC tap-to-activate, health record screens (vaccinations, medications, etc.) reusing the same API routes the customer web portal already uses.
**Files likely affected:** New screens/components under `apps/mobile/src/`.
**Database changes:** None (reuses existing customer API routes entirely).
**API changes:** None (mobile is a new client of existing endpoints).
**UI changes:** N/A (new app).
**Testing required:** Manual device testing (camera and NFC cannot be meaningfully tested in a simulator — NFC in particular requires a real device).
**Acceptance criteria:** A pet owner can fully manage their pets and activate a tag from their phone, using the camera or an NFC tap, without ever touching the web portal.
**Risks:** NFC read support (as opposed to the admin-only NFC *write* tool from Phase 12) needs testing on real hardware early — flag any platform limitations found.
**Rollback plan:** Additive, no impact on other apps.
**Definition of Done:** Verified on a real Android device (NFC) and a real iOS device (QR camera; iOS NFC read support is more limited — document exactly what works).

```
IMPLEMENTATION PROMPT — PHASE 23

You are working in the PawTag monorepo. This is Phase 23 of a 26-phase roadmap (Phase 22 —
mobile auth scaffold — complete). Do ONLY the work below.

TASK:
1. Build Pet List and Pet Detail/Edit screens in `apps/mobile`, calling the existing
   `/api/customer/pets` routes (list, get, create, update, delete) — mirror the data shape and
   validation already used by `apps/customer`'s pet management pages so behavior is consistent
   across web and mobile.
2. Add camera-based QR scanning using `expo-camera`'s barcode scanning capability: a "Scan tag"
   screen that reads a QR code, extracts the `tagId` from the scanned finder URL, and calls the
   Phase 11 `/api/customer/tags/redeem` endpoint, then routes into pet linking.
3. Add NFC tag reading using `react-native-nfc-manager`: an "Activate via NFC" option that
   listens for an NFC tap, reads the NDEF record (the finder URL written in Phase 12), extracts
   the `tagId`, and redeems it the same way as the QR flow — share the redemption logic between
   both entry points rather than duplicating it.
4. Build health record screens (vaccinations, microchips, medications, allergies, vet visits,
   surgeries, weight history) calling the existing `/api/customer/pets/:id/vaccinations` etc.
   routes — these already exist and are fully built server-side; this phase is purely mobile UI
   consuming them.
5. Add a "Report lost/damaged tag" action calling the Phase 13 replacement-tag route.

TESTS TO RUN: `pnpm typecheck`. Manual device testing is required for this phase — camera and
NFC functionality cannot be meaningfully verified in a simulator/emulator. Test on a real
Android device (both QR scan and NFC tap against a tag written in Phase 12) and a real iOS
device (QR scan; note that iOS NFC read support via React Native libraries is more limited than
Android — test and document exactly what does and doesn't work rather than assuming).

FILES TO UPDATE: new screens/components under `apps/mobile/src/`, `apps/mobile/package.json`
(new dependencies: `expo-camera`, `react-native-nfc-manager`).

COMPLETION CRITERIA: report explicit real-device test results for: pet CRUD, QR-based tag
redemption, NFC-based tag redemption (Android), NFC-based tag redemption (iOS — report actual
platform capability, don't assume parity with Android), and health record CRUD. Any platform
limitation discovered must be clearly documented, not silently worked around with a fragile
hack.
```

---

### Phase 24 — Mobile: subscriptions, push notifications, lost mode, order history

**Objective:** Complete the remaining mobile feature set: subscription management, push notifications (the `PushToken` model already exists — this phase finally uses it), lost-mode toggle, and order history.
**Why now:** Rounds out the mobile MVP feature list from your original requirements, building on the pet-management foundation from Phase 23.
**Scope:** Subscription screen (view status, manage via Stripe), push notification registration + handling for "pet found" and order-status alerts, lost-mode toggle screen, order history list.
**Files likely affected:** New screens under `apps/mobile/src/`, `packages/api/src/routes/push-tokens.ts` (verify/extend for mobile registration).
**Database changes:** None (uses existing `PushToken` model).
**API changes:** Extend the existing push-token registration route if needed for Expo push tokens specifically (Expo uses its own push token format, distinct from raw APNs/FCM tokens, routed through Expo's push service).
**UI changes:** N/A (new app).
**Testing required:** Manual device testing for push notification delivery (requires a real device — push notifications do not work in most simulators).
**Acceptance criteria:** A customer with the app installed receives a push notification when their pet is scanned/found and when an order ships, and can manage their subscription and toggle lost mode from their phone.
**Risks:** Push notification setup (Expo push credentials, Apple Push Notification service certificates) is an external/business dependency similar to Phases 9/14/16 — flag clearly.
**Rollback plan:** Additive.
**Definition of Done:** Verified push notification delivery on a real device; subscription and lost-mode screens functionally verified against staging.

```
IMPLEMENTATION PROMPT — PHASE 24

You are working in the PawTag monorepo. This is Phase 24 of a 26-phase roadmap (Phases 22–23 —
mobile auth and pet management — complete). Do ONLY the work below.

PREREQUISITE (founder/external action): Expo push notification credentials (and, for iOS, an
Apple Developer account with push notification capability enabled) are needed for live push
delivery. If unavailable, complete all code and clearly flag live verification as pending.

TASK:
1. Read `packages/db/src/models/PushToken.ts` and `packages/api/src/routes/push-tokens.ts` to
   understand the existing design (built but never consumed by a client, per the earlier
   audit). Build on it rather than redesigning it.
2. In `apps/mobile`, add push notification registration using `expo-notifications`: on login,
   request notification permission, obtain an Expo push token, and register it via the existing
   push-tokens API route (extend that route if it doesn't already accommodate the Expo token
   format — Expo tokens look like `ExponentPushToken[...]`, distinct from raw platform tokens).
3. On the API side, find where customer notifications are currently created (Phase 7/10's
   `Notification`-creation call sites: pet-found events, order-status changes) and add a call to
   send an actual push notification via Expo's push API (`expo-server-sdk` — add as a
   dependency of `packages/api`) to the customer's registered push token(s) whenever a
   `Notification` is created for that customer, in addition to the existing email/in-app
   notification. Keep this as a best-effort side effect — a push delivery failure must never
   block or fail the underlying business operation (order status change, pet found, etc.).
4. Build a Subscription screen in `apps/mobile` showing the tag's subscription status
   (active/grace period/expired) and a "Manage subscription" action — for MVP, this can
   deep-link to a web-based Stripe customer portal session (create one via
   `POST /api/customer/subscriptions/portal-link` if this doesn't already exist, using Stripe's
   Billing Portal, rather than rebuilding subscription management natively in the app).
5. Build a Lost Mode screen: a clear toggle calling the existing mark-lost/mark-found routes
   from `customer.ts`, with a confirmation step before marking a pet lost (this is an
   emotionally significant action — the UI should feel calm and clear, not alarming).
6. Build an Order History screen calling the existing `/api/customer/orders` routes, showing
   status (using the Phase 6 state machine's terminology) and tracking info per order.

TESTS TO RUN: `pnpm typecheck`. Manual device testing required for push notification delivery —
report explicit test results: register a device, trigger a "pet found" event (e.g. via a test
finder-page scan against a staging pet), and confirm a push notification arrives on the device.

FILES TO UPDATE: new screens under `apps/mobile/src/`, `packages/api/src/routes/push-tokens.ts`
(if extended), notification-creation call sites (add push delivery), `packages/api/package.json`
(new `expo-server-sdk` dependency), possibly a new `subscriptions` portal-link route.

COMPLETION CRITERIA: report real-device push notification delivery test results explicitly. If
Expo/Apple push credentials aren't available, state this clearly as the blocker for that
specific verification step and confirm everything else (subscription screen, lost mode, order
history) works against staging data regardless.
```

---

### Phase 25 — Mobile store readiness & E2E

**Objective:** Prepare the mobile app for App Store and Google Play submission, and add Detox/Maestro E2E coverage for the mobile-specific flows.
**Why now:** Final mobile phase — closes out Stage H once all features (Phases 22–24) are built and stable.
**Scope:** App icons/splash screens, store metadata, privacy-policy/permissions descriptions (camera, NFC, notifications, location), EAS Build configuration for production binaries, and automated E2E tests for the mobile-specific flows (QR/NFC activation, push notification handling).
**Files likely affected:** `apps/mobile/app.json`/`eas.json`, new `apps/mobile/e2e/`.
**Database changes:** None.
**API changes:** None.
**UI changes:** Polish pass on the screens built in Phases 22–24.
**Testing required:** Detox or Maestro E2E for tag activation and lost-mode flows on real devices/simulators; manual full run-through against store submission checklists for both platforms.
**Acceptance criteria:** App builds successfully via EAS for both platforms and is ready to submit (submission itself is a founder/business action requiring developer accounts, not something the AI performs).
**Risks:** App Store/Play Store review can reject apps for policy reasons unrelated to code quality (e.g., permission-usage descriptions) — write permission descriptions carefully and plainly.
**Rollback plan:** N/A — this phase doesn't touch production systems.
**Definition of Done:** A production build successfully compiles via EAS for both platforms; E2E suite passes.

```
IMPLEMENTATION PROMPT — PHASE 25

You are working in the PawTag monorepo. This is Phase 25 of a 26-phase roadmap (Phases 22–24 —
full mobile feature set — complete). Do ONLY the work below.

TASK:
1. Configure `apps/mobile/app.json` with proper app name, bundle identifiers (iOS) and package
   name (Android), app icon, and splash screen assets (use simple placeholder branded assets if
   final brand assets aren't provided — flag clearly that these are placeholders needing
   founder/designer sign-off before real submission).
2. Write clear, honest permission usage descriptions for iOS (`NSCameraUsageDescription`,
   `NSLocationWhenInUseUsageDescription` if location is used for lost-pet features, NFC usage
   description) and Android (camera, NFC, notifications) — these directly affect store
   approval; write them in plain language describing exactly why the app needs each permission
   (e.g. "PawTag uses your camera to scan your pet's QR tag during activation").
3. Set up `eas.json` with build profiles for `development`, `preview` (internal testing), and
   `production`, following Expo's EAS Build documentation structure.
4. Add Detox (or Maestro, whichever has better current Expo compatibility — check as of this
   session) and write E2E tests for: QR-based tag activation flow, NFC-based tag activation
   flow (Android only, per Phase 23's findings), and the lost-mode toggle with confirmation
   step.
5. Create `docs/deployment/mobile-release.md` documenting: how to trigger an EAS build, how to
   submit to TestFlight (iOS) and Play Console internal testing (Android), and a pre-submission
   checklist (permission descriptions reviewed, privacy policy URL set, app icons finalized,
   test accounts prepared for reviewers if the app requires login to functionally review).

TESTS TO RUN: `pnpm typecheck`. Run the Detox/Maestro E2E suite on a real device or emulator and
report results for each of the three scenarios.

FILES TO UPDATE: `apps/mobile/app.json`, `apps/mobile/eas.json`, new `apps/mobile/e2e/` test
files, new `docs/deployment/mobile-release.md`.

COMPLETION CRITERIA: `eas build --profile preview` (or documented equivalent) succeeds for at
least one platform (report which — both if credentials for both Apple and Google are available).
E2E tests pass. Explicitly state in your summary that actual App Store/Play Store submission is
a founder action requiring developer accounts and cannot be performed by this session.
```

---

### Phase 26 — Full documentation set & launch readiness

**Objective:** Close out every remaining documentation item from Part 7, produce a disaster-recovery guide, and do a final cross-check of every phase's acceptance criteria before declaring the platform launch-ready.
**Why now:** Final phase — everything else is built and tested; this phase makes the platform operable by someone other than the person who built it, which is the actual definition of "production-ready."
**Scope:** Disaster-recovery runbook, final architecture doc update reflecting the now-complete mobile app, a launch-readiness checklist cross-referencing every phase's acceptance criteria.
**Files likely affected:** `docs/disaster-recovery.md`, `ARCHITECTURE.md` (update), new `docs/launch-checklist.md`.
**Database changes:** None.
**API changes:** None.
**UI changes:** None.
**Testing required:** A full manual run-through of the launch checklist.
**Acceptance criteria:** Every phase 1–25 acceptance criterion is verifiably met; disaster-recovery runbook has been dry-run at least once (e.g., restoring a database backup to a scratch environment).
**Risks:** N/A.
**Rollback plan:** N/A.
**Definition of Done:** Launch checklist fully checked off; founder has everything needed to run this business without needing to re-read this whole document from scratch.

```
IMPLEMENTATION PROMPT — PHASE 26

You are working in the PawTag monorepo. This is Phase 26 — the final phase — of a 26-phase
roadmap. Phases 1–25 are complete: the platform is feature-complete, tested, deployed, and the
mobile app is store-ready. Do ONLY the work below.

TASK:
1. Create `docs/disaster-recovery.md` covering: how to restore the MongoDB Atlas database from
   a snapshot to a scratch environment (step-by-step, referencing Atlas's actual restore UI/CLI
   process), how to redeploy the entire stack from scratch if Render/Vercel accounts were lost
   (referencing `docs/deployment/staging.md` and `production.md` from Phase 16), and target
   Recovery Time Objective / Recovery Point Objective values (propose reasonable defaults, e.g.
   RTO 4 hours, RPO 24 hours, given the Atlas daily-backup cadence from Part 1 of the roadmap
   document, and note that these can be tightened later if the business needs stricter
   guarantees and is willing to pay for more frequent backups/point-in-time recovery).
2. Update `ARCHITECTURE.md` (from Phase 1) to reflect the now-complete system: add the mobile
   app to the architecture diagram/description, and add a final summary of every external
   service the platform depends on (Stripe, Postmark/Twilio, R2, Sentry, Render, Vercel, Atlas,
   the shipping provider, Expo push) in one consolidated table with what each is used for.
3. Create `docs/launch-checklist.md` that walks through every phase (1–25) in this roadmap and,
   for each, restates its acceptance criteria as a checkbox. Go through the actual codebase and
   test suite to verify each one is genuinely met — do not simply copy the roadmap's criteria
   without checking; if any phase's criteria are not actually met (e.g. a live-credential-
   dependent step from an earlier phase was left pending), mark it clearly as "pending founder
   action: [specific thing needed]" rather than checking it off incorrectly.
4. Confirm every documentation file referenced throughout this roadmap actually exists in the
   repository: `ARCHITECTURE.md`, `docs/developer-setup.md`, `docs/environments.md`,
   `docs/database-schema.md`, `docs/business-workflows.md`, `docs/deployment/staging.md`,
   `docs/deployment/production.md`, `docs/deployment/mobile-release.md`,
   `docs/release-process.md`, `docs/rollback.md`, `docs/support-runbook.md`,
   `docs/disaster-recovery.md`, `docs/launch-checklist.md`. List any that are missing and
   create them if genuinely absent.
5. Run the full test suite one final time (`pnpm test`, `pnpm typecheck`, `pnpm test:e2e`) and
   include the final pass/fail summary in `docs/launch-checklist.md`.

TESTS TO RUN: `pnpm test`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm test:e2e`. Report the
full results.

FILES TO UPDATE: new `docs/disaster-recovery.md`, updated `ARCHITECTURE.md`, new
`docs/launch-checklist.md`, and any missing documentation file discovered in step 4.

COMPLETION CRITERIA: `docs/launch-checklist.md` exists with every phase's criteria genuinely
verified (not assumed), any items still pending founder action are explicitly and honestly
called out rather than glossed over, and the full test suite result is included in the document.
This is the final phase — a founder reading only `docs/launch-checklist.md` and
`ARCHITECTURE.md` should understand exactly what state the platform is in and what, if
anything, remains before commercial launch.
```

---

## Part 8B — Affiliate Marketplace Track (Phases 27–32)

**Added after the founder's original 26-phase roadmap. This is a separate, parallel track — not a change to Phases 1–26.**

### Architecture decision: keep this completely separate from the existing shop

You want to sell pet products, food, and toys **without holding stock** — a customer clicks through to a partner retailer's site, buys there, and you earn a commission. This is architecturally a different business from your tag/subscription shop (Phases 5–13), which owns payment, inventory, and fulfillment end-to-end. Trying to force affiliate products through the existing `Order`/`Product`/Stripe/shipping system would corrupt the order state machine built in Phase 6 for real fulfillment — an affiliate "order" never gets packed, shipped, or delivered by you, so it shouldn't live in the same table pretending it might.

**Decision: build a new, self-contained affiliate module alongside the existing shop, not inside it.**

New data model (all new, nothing existing changes):
- **`AffiliatePartner`** — one record per affiliate network/program (name, commission structure, API credentials, payout terms)
- **`AffiliateProduct`** — the products you display (title, image, display price, category, link to a `AffiliatePartner`, destination URL template)
- **`AffiliateClick`** — every time a visitor clicks "Buy on [Partner]," logged with a generated tracking ID, timestamp, and (if logged in) your user's ID
- **`AffiliateConversion`** — a completed purchase reported back by the network, matched to a click, with the commission amount and payout status (`pending` → `approved` → `paid`)

**How the money flow actually works** (so you know what you're signing up for): visitor clicks a product on PawTag → hits your own `/go/:slug` redirect (this is the only part *you* build) → lands on the partner's real product page with a tracking ID embedded in the URL → they buy there, on their site, with their payment system — you never touch money, stock, or shipping for these items → the affiliate network tells you, days or weeks later (via a webhook or a report you pull), that a sale happened and what you earned → you get paid by the network on their schedule (typically monthly, net-30 or longer), not per-transaction. **This means affiliate revenue is inherently delayed and not instantly verifiable** — plan cash flow accordingly, this isn't a Stripe-speed payment.

**Which affiliate network(s) to use — recommendation:** don't try to sign individual deals with every pet brand. Two-track approach:
1. **Amazon Associates** first — fastest to get approved, by far the largest pet product catalog (food, toys, accessories), well-documented API for generating tracking links. Good for launch.
2. **One aggregator network** (Awin or Impact — both are well-established, industry-standard affiliate networks) added once you have some traffic — these give you one API/dashboard covering many individual pet retailers (Chewy, PetSmart-type brands, boutique pet brands) instead of separate integrations for each. This is the same "avoid duplicate technology" principle from Part 1: one integration pattern (the `AffiliatePartner` model), many networks plugged into it.

**Legal — do not skip this:** in the US, FTC rules (and equivalent consumer-protection rules elsewhere) require a **clear and conspicuous disclosure** near affiliate links — e.g. "As an Amazon Associate, PawTag earns from qualifying purchases" — not buried only in a footer or terms page. This is built into Phase 31 below, not treated as an afterthought.

**What does NOT change in Phases 1–26:** nothing. Your tag/subscription shop keeps its own Stripe checkout, its own `Order` state machine, its own shipping integration. The affiliate module is additive — it can be built, tested, and even launched independently of where you are in the original 26 phases, though it makes sense to sequence it after your core platform (Phase 26) is stable, since it reuses the admin app, the design system, and the deployed infrastructure you'll already have in place.

---

### Phase 27 — Affiliate data model & network account setup

**Objective:** Create the `AffiliatePartner`, `AffiliateProduct`, `AffiliateClick`, and `AffiliateConversion` models, and integrate the Amazon Associates link-generation API as the first partner.
**Why this phase comes now:** Foundation for everything else in this track; nothing else in Phases 28–31 can be built without these models existing.
**Scope:** New Mongoose models, a new `packages/api/src/services/affiliate/` directory with a partner-agnostic interface and an Amazon Associates implementation.
**Files likely affected:** `packages/db/src/models/AffiliatePartner.ts`, `AffiliateProduct.ts`, `AffiliateClick.ts`, `AffiliateConversion.ts` (new), `packages/api/src/services/affiliate/`.
**Database changes:** Four new collections, as described above.
**API changes:** `POST /api/admin/affiliate/partners` and `POST /api/admin/affiliate/products` (admin-only CRUD, following the exact permission-gated pattern already used for `Product` in `admin.ts`).
**UI changes:** None yet (admin UI for managing these comes in Phase 28).
**Testing required:** Unit tests for the Amazon link-generation service; integration tests for the new admin CRUD routes.
**Acceptance criteria:** An admin can create an `AffiliatePartner` record for Amazon Associates and an `AffiliateProduct` pointing at a real Amazon product, and the system generates a correctly-tagged Amazon affiliate link for it.
**Risks:** Requires a real, approved Amazon Associates account (external/business dependency — Amazon's approval process itself takes time and requires some initial traffic/content, flag this clearly to the founder as a prerequisite, not something the AI can obtain).
**Rollback plan:** New, additive models — safe to revert entirely with no impact on the existing shop.
**Definition of Done:** Tests green; one real Amazon affiliate link manually verified to resolve correctly and carry the tracking tag.

```
IMPLEMENTATION PROMPT — PHASE 27

You are working in the PawTag monorepo. This is Phase 27, the first phase of the new Affiliate
Marketplace track, built on top of the already-complete original 26-phase roadmap. Do ONLY the
work below.

PREREQUISITE (founder/external action): a real, approved Amazon Associates account and its
tracking ID are needed for live verification. If unavailable, implement the full service using
Amazon's documented link format and Product Advertising API structure, and clearly flag live
verification as pending real credentials.

TASK:
1. Create four new Mongoose models in `packages/db/src/models/`, following the exact
   conventions already used by existing models (timestamps, soft-delete pattern if used
   elsewhere, exported from `packages/db/src/index.ts`):
   - `AffiliatePartner.ts`: `name`, `network` (enum: `amazon_associates`, `awin`, `impact`,
     `other`), `trackingId` (your affiliate/tracking ID with this partner), `apiCredentials`
     (encrypted or reference to a secret, not plaintext — follow whatever secret-handling
     pattern already exists in the codebase for third-party API keys, e.g. how the Stripe
     secret key is read from env vars, and do not store raw API secrets in the database),
     `commissionRateEstimate` (number, informational only — actual commission comes from the
     network's conversion reports, not something you set), `active` (boolean).
   - `AffiliateProduct.ts`: `title`, `description`, `imageUrl`, `displayPrice`, `category`,
     `partnerId` (ref `AffiliatePartner`), `destinationUrl` (the partner's actual product page),
     `slug` (unique, used in the Phase 29 redirect route), `active` (boolean).
   - `AffiliateClick.ts`: `affiliateProductId` (ref), `userId` (ref `User`, nullable — not
     every clicker is logged in), `trackingToken` (unique generated ID for this click),
     `clickedAt`, `userAgent`, `ipHash` (hash the IP, don't store it raw, for basic privacy).
   - `AffiliateConversion.ts`: `affiliateClickId` (ref, nullable if the network doesn't support
     click-level matching for this partner), `affiliateProductId` (ref), `partnerId` (ref),
     `orderValueReported` (number), `commissionAmount` (number), `status` (enum: `pending`,
     `approved`, `paid`, `reversed`), `reportedAt`, `paidAt` (nullable), `externalConversionId`
     (the network's own ID for this conversion, for reconciliation).
2. Create `packages/api/src/services/affiliate/types.ts` defining a partner-agnostic interface:
   `generateAffiliateLink(product: AffiliateProduct, trackingToken: string): string`.
3. Create `packages/api/src/services/affiliate/amazonAssociates.ts` implementing that interface
   for Amazon: takes a product's ASIN or destination URL and the account's Associates tracking
   ID, and returns a correctly-formatted Amazon affiliate link (`https://www.amazon.com/dp/
   {ASIN}?tag={trackingId}` pattern, or via the Product Advertising API if you choose to
   integrate it for live pricing — a simple tagged-URL approach is acceptable for this phase;
   live pricing sync is out of scope here). If no real tracking ID is configured in the
   environment, generate a clearly-marked placeholder link for local dev/testing.
4. Add admin-only CRUD routes in a new `packages/api/src/routes/admin-affiliate.ts`:
   `POST/GET/PUT/DELETE /partners` and `POST/GET/PUT/DELETE /products`, gated by an appropriate
   permission (add a new `affiliate.manage` permission following the existing RBAC pattern from
   `packages/db/src/models/Permission.ts`).
5. Write unit tests for the Amazon link-generation function (correct tag appended, handles
   missing tracking ID gracefully) and integration tests for the new admin CRUD routes
   (creation, permission rejection, validation failure — same pattern as other admin routes).

TESTS TO RUN: `pnpm test:unit`, `pnpm test:integration`, `pnpm typecheck`. All must pass.

FILES TO UPDATE: four new model files, new `packages/api/src/services/affiliate/` directory,
new `admin-affiliate.ts` route file, `packages/db/src/models/Permission.ts` (new permission).

DOCUMENTATION: create `docs/affiliate-marketplace.md` documenting the four new models, the
partner-agnostic service interface, and how to add a second network later (e.g. Awin) by
implementing the same interface.

COMPLETION CRITERIA: all new tests pass. If a real Amazon Associates tracking ID is available,
generate and manually verify one real affiliate link resolves correctly; otherwise state this is
pending account approval, which is a founder action.
```

---

### Phase 28 — Affiliate storefront (browse & product pages)

**Objective:** Build the customer-facing browsing experience for affiliate products on `apps/web` — category browsing, product detail, and a clear "Buy on [Partner]" call-to-action, visually distinct from your own tag/subscription products.
**Why this phase comes now:** Needs the Phase 27 data model to exist first; this is the first customer-visible piece of the affiliate track.
**Scope:** New storefront pages/components in `apps/web`, reusing the existing design system rather than introducing a new one.
**Files likely affected:** New pages/components under `apps/web/src/pages/`, `GET /api/affiliate/products` (public route).
**Database changes:** None beyond Phase 27.
**API changes:** `GET /api/affiliate/products` (public, paginated, filterable by category), `GET /api/affiliate/products/:slug`.
**UI changes:** New "Shop" or "Affiliate Marketplace" section on `apps/web` with category filters and product cards; each card clearly labeled as sold by the partner, not by PawTag directly.
**Testing required:** Integration tests for the new public routes (pagination, filtering, only returns `active` products).
**Acceptance criteria:** A visitor can browse affiliate products by category and reach a product detail page without any account or login.
**Risks:** Low.
**Rollback plan:** `git revert`; purely additive.
**Definition of Done:** Tests green; manual browse-through confirms the experience is clear and doesn't get confused with your own checkout flow.

```
IMPLEMENTATION PROMPT — PHASE 28

You are working in the PawTag monorepo. This is Phase 28 of the Affiliate Marketplace track
(Phase 27 — data model and Amazon integration — is complete). Do ONLY the work below.

TASK:
1. Add `GET /api/affiliate/products` (public, no auth) in `packages/api/src/routes/`, returning
   paginated `AffiliateProduct` records where `active: true`, filterable by `category` query
   param, and `GET /api/affiliate/products/:slug` for a single product's detail. Neither route
   exposes `AffiliatePartner.apiCredentials` or any other sensitive partner field — return only
   the fields needed for display (title, description, imageUrl, displayPrice, category,
   partner's display name only).
2. In `apps/web`, add a new storefront section (e.g. `/shop` or `/marketplace` — pick whichever
   fits the existing site's navigation/IA best, check `apps/web/src/App.tsx` or router config
   for the existing route structure and follow its conventions) with: a category filter/browse
   view calling the new products list route, and a product detail page calling the single-
   product route.
3. On each product card and detail page, add a clearly labeled "Buy on {Partner Name}" button
   — this does NOT link directly to the partner yet (that's Phase 29's redirect service); for
   this phase, it's acceptable for the button to link to a placeholder `/go/{slug}` path that
   doesn't yet do anything, since Phase 29 implements it.
4. Visually distinguish affiliate products from your own tag/subscription products — a small
   badge or label such as "Sold by {Partner}" on every affiliate product card, reusing existing
   design tokens from the frontend-design system rather than introducing new colors/styles.
5. Write integration tests for both new routes: pagination works correctly, category filtering
   works, inactive products are excluded, and the response never includes
   `AffiliatePartner.apiCredentials` or other sensitive fields (assert this explicitly).

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`. All must pass.

FILES TO UPDATE: new public affiliate-products route file, new `apps/web` storefront
pages/components.

COMPLETION CRITERIA: integration tests pass, explicitly including the assertion that sensitive
partner credential fields are never exposed in the public API response. Manually confirm the
new storefront section renders correctly and is clearly distinguishable from the tag shop.
```

---

### Phase 29 — Click tracking & redirect service

**Objective:** Build the `/go/:slug` redirect route that logs an `AffiliateClick` and sends the visitor on to the partner's site with the correct tracking parameters attached.
**Why this phase comes now:** This is the actual mechanism that earns you money — needs the storefront (Phase 28) to have somewhere to link from.
**Scope:** One server route, fast and reliable (this is on the critical path of every potential sale — it must not be slow or flaky).
**Files likely affected:** New `packages/api/src/routes/affiliate-redirect.ts`.
**Database changes:** None beyond Phase 27.
**API changes:** `GET /go/:slug` — public, unauthenticated, immediately issues an HTTP redirect.
**UI changes:** None (server-side redirect, not a page).
**Testing required:** Integration test confirming a click is logged and the redirect target contains the correct affiliate tracking parameters.
**Acceptance criteria:** Every click through this route is logged before the redirect fires, and the destination URL always carries your tracking tag.
**Risks:** This route must be fast (sub-100ms) since it sits between a customer's click and a purchase — a slow redirect loses sales. Keep the click-logging write non-blocking where safe (e.g., don't make the customer wait on a slow write) without sacrificing data integrity.
**Rollback plan:** `git revert`; if this route breaks, affiliate links simply stop resolving — no impact on the core tag shop.
**Definition of Done:** Tests green; a real manual click-through to Amazon (if credentials are live) resolves correctly and appears in the `AffiliateClick` log.

```
IMPLEMENTATION PROMPT — PHASE 29

You are working in the PawTag monorepo. This is Phase 29 of the Affiliate Marketplace track
(Phases 27–28 complete). Do ONLY the work below.

TASK:
1. Create `packages/api/src/routes/affiliate-redirect.ts` with `GET /go/:slug` (public route,
   mounted near the root, not under `/api`, since this is meant to be a short, clean URL a
   customer clicks — e.g. `https://pawtag.co.nz/go/some-product-slug`). On request: look up the
   `AffiliateProduct` by `slug` (404 with a friendly message if not found or inactive), generate
   a `trackingToken` (a short random ID), create an `AffiliateClick` record (product ID, user ID
   if the request includes a valid session/JWT — check for it but do not require
   authentication, hashed IP, user agent, the tracking token), call the appropriate
   `affiliate` service (from Phase 27, selected based on the product's `AffiliatePartner.network`
   field) to generate the correctly-tagged destination URL including the tracking token as a
   sub-ID parameter where the network's URL format supports it (Amazon's standard tag format
   doesn't support arbitrary sub-IDs without the Product Advertising API or Amazon's
   "AssociateTag + ascsubtag" parameter — use `ascsubtag` if targeting Amazon, since it exists
   specifically for this purpose), and issue an HTTP 302 redirect to that URL.
2. Ensure the `AffiliateClick` write happens before the redirect is issued (don't fire-and-
   forget it in a way that could lose the record if the process is interrupted), but keep the
   whole handler fast — a single indexed insert should already be well under 100ms; do not add
   any unnecessary synchronous work (e.g. don't call an external API to "verify" the link before
   redirecting — trust the pre-generated destination URL).
3. Add rate limiting to this route to prevent it being used to spam-click and inflate click
   counts (reuse the existing rate-limiter pattern from `auth.ts`, tuned appropriately for a
   public high-traffic route — more permissive than login, since real users will click this
   often, but enough to block obvious abuse).
4. Write an integration test: request `/go/{valid-slug}` and assert (a) a 302 response with a
   `Location` header pointing at the expected partner destination URL including the tracking
   token/subtag, and (b) exactly one `AffiliateClick` record was created with the correct
   product reference. Also test the 404 case for an unknown or inactive slug.

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`. All must pass.

FILES TO UPDATE: new `affiliate-redirect.ts` route file, mounted in the main Express app setup.

COMPLETION CRITERIA: integration tests pass. If a real Amazon Associates tracking ID is
configured, manually click through a real `/go/:slug` link and confirm it lands on Amazon with
the tag and subtag both present in the URL, and that the corresponding `AffiliateClick` record
appears in the database; otherwise state this specific check is pending real credentials.
```

---

### Phase 30 — Conversion & commission ingestion

**Objective:** Receive conversion/commission data back from the affiliate network (via webhook if the network supports it, or a scheduled report pull if not) and record it as `AffiliateConversion`, matched back to the original click where possible.
**Why this phase comes now:** This is where affiliate revenue actually becomes visible in your system — needs clicks (Phase 29) to exist to match against.
**Scope:** One ingestion path per network integrated (Amazon first). Amazon Associates does not offer a real-time webhook — commission data is available via periodic reports/API pull, so this phase implements a scheduled job (reusing the `node-cron` pattern from the original roadmap's Phase 19) rather than a webhook for Amazon specifically; document this network-specific difference clearly, since a future network (e.g. Awin) may support real webhooks and should use them when it does.
**Files likely affected:** New `packages/api/src/jobs/affiliateConversionSync.ts`, `packages/api/src/services/affiliate/amazonAssociates.ts` (extend).
**Database changes:** None beyond Phase 27.
**API changes:** None public; internal job only (add a webhook endpoint here too, structured generically, for future networks that do support them).
**UI changes:** None yet (dashboard is Phase 31).
**Testing required:** Unit/integration tests using a mocked network API response, confirming conversions are correctly parsed, matched to clicks, and not double-recorded on repeated syncs.
**Acceptance criteria:** Running the sync job against a (mocked, then real) network report produces accurate `AffiliateConversion` records with no duplicates on re-runs.
**Risks:** Amazon's reporting has a delay (commissions aren't visible same-day) — set expectations correctly in the admin dashboard copy (Phase 31), not as a bug.
**Rollback plan:** `git revert`; conversion data already ingested is historical and unaffected.
**Definition of Done:** Tests green against mocked data; if live credentials exist, one real sync run manually verified against the actual Amazon Associates dashboard numbers.

```
IMPLEMENTATION PROMPT — PHASE 30

You are working in the PawTag monorepo. This is Phase 30 of the Affiliate Marketplace track
(Phases 27–29 complete). Do ONLY the work below.

NOTE: Amazon Associates does not provide real-time conversion webhooks — commission data must
be pulled periodically via their reporting interface/API, and there is an inherent reporting
delay (commissions typically aren't visible until at least the next day). Build accordingly;
this is expected network behavior, not something to work around.

TASK:
1. Extend `packages/api/src/services/affiliate/amazonAssociates.ts` with a function that
   fetches recent conversion/commission data. If using Amazon's Product Advertising API or
   Associates reporting export, implement against its actual documented format; if no live
   credentials are configured, implement against a clearly-defined mock response shape and add
   a code comment stating live integration needs a real Associates account with reporting
   access enabled.
2. Create `packages/api/src/jobs/affiliateConversionSync.ts`: for each active `AffiliatePartner`
   with `network: 'amazon_associates'`, call the fetch function above, and for each returned
   conversion record: attempt to match it to an existing `AffiliateClick` via the tracking
   subtag if present in the network's report; if no subtag match is available (common — not
   every network reliably passes sub-IDs back), still record the `AffiliateConversion` with
   `affiliateClickId: null` and match it to the `AffiliateProduct` by ASIN/product reference
   instead, so revenue is still tracked even without perfect click attribution. Use the
   network's `externalConversionId` to prevent creating a duplicate `AffiliateConversion` record
   on repeated sync runs (upsert by that field, not a plain insert).
3. Schedule this job daily via `node-cron` (same pattern as the original roadmap's low-stock
   job), guarded against running during tests.
4. Design the ingestion function generically enough that a future network integration (e.g.
   Awin, which does support real-time postback webhooks) could plug in either via this same
   scheduled-pull pattern or via a new `POST /api/webhooks/affiliate/:network` endpoint — add
   that webhook route now as a stub that validates a shared-secret signature and calls the same
   underlying "record a conversion" function used by the scheduled job, so the recording logic
   isn't duplicated between the two entry paths even though only the pull-based Amazon path is
   live in this phase.
5. Write tests using a mocked Amazon API response: first sync creates the expected
   `AffiliateConversion` records with correct matching; running the same sync again with the
   same mocked data does not create duplicates (asserts on `externalConversionId` uniqueness).

TESTS TO RUN: `pnpm test:unit`, `pnpm test:integration`, `pnpm typecheck`. All must pass.

FILES TO UPDATE: `amazonAssociates.ts` (extended), new `affiliateConversionSync.ts` job, new
generic affiliate webhook route stub.

COMPLETION CRITERIA: tests pass against mocked data, explicitly proving no duplicate conversions
on repeated sync runs. If live Amazon Associates reporting access is available, run the sync
once for real and manually cross-check the resulting numbers against the Amazon Associates
dashboard; otherwise state this is pending reporting-API access, a founder/account action.
```

---

### Phase 31 — Admin affiliate revenue dashboard & legal disclosure

**Objective:** Give the founder visibility into affiliate performance (clicks, conversions, pending/paid commission) in the admin app, and implement the FTC-style affiliate disclosure required by law wherever affiliate links appear.
**Why this phase comes now:** Closes the loop — Phases 27–30 build the plumbing, this phase makes it visible and makes the whole thing legally compliant before real traffic hits it.
**Scope:** Extend the Phase 18-style admin analytics pattern with affiliate-specific metrics; add a persistent, clearly visible disclosure component wherever affiliate products/links are shown on `apps/web`.
**Files likely affected:** New `packages/api/src/routes/admin-affiliate.ts` additions (or a new analytics sub-route), `apps/admin/src/pages/`, `apps/web` affiliate storefront components from Phase 28.
**Database changes:** None beyond Phase 27.
**API changes:** `GET /api/admin/affiliate/overview` (clicks/conversions/commission this week/month, top-performing products, pending vs. paid commission totals).
**UI changes:** New admin dashboard section; a disclosure banner/label on every affiliate storefront page and product card.
**Testing required:** Integration test for the new analytics endpoint against seeded click/conversion data.
**Acceptance criteria:** The founder can see, without touching the database, how much the affiliate program has earned and what's still pending payout from the network; every page displaying affiliate products shows a clear, honest disclosure.
**Risks:** Getting the legal disclosure wrong is a real compliance risk, not just a nice-to-have — write the disclosure text plainly and make sure it's visually adjacent to the links, not hidden.
**Rollback plan:** `git revert`.
**Definition of Done:** Tests green; disclosure visible and readable on every relevant page, confirmed manually.

```
IMPLEMENTATION PROMPT — PHASE 31

You are working in the PawTag monorepo. This is Phase 31 of the Affiliate Marketplace track
(Phases 27–30 complete). Do ONLY the work below.

TASK:
1. Add `GET /api/admin/affiliate/overview` in `packages/api/src/routes/admin-affiliate.ts`
   (gated by the `affiliate.manage` permission from Phase 27), returning: total clicks and
   conversions for today/this week/this month, total commission by status (`pending`,
   `approved`, `paid`) as separate sums, and a list of the top 10 `AffiliateProduct`s by click
   count and by commission earned. Use a Mongoose aggregation, following the same pattern
   already used in the core roadmap's Phase 18 admin analytics route — mirror its structure and
   conventions for consistency rather than inventing a new style.
2. In `apps/admin`, add a new "Affiliate" section to the dashboard (or a dedicated page) showing
   these metrics as labeled cards plus a simple table of top-performing products. Include a
   brief note in the UI itself that Amazon commission data has a reporting delay (per Phase 30)
   so the founder doesn't mistake a lag in numbers for a bug.
3. Create a reusable `AffiliateDisclosure` component in `apps/web` (and reuse it wherever
   affiliate content might appear on other frontends later) with text along the lines of: "This
   page contains affiliate links. If you make a purchase through one of these links, PawTag may
   earn a commission at no extra cost to you." Place this component: (a) once, prominently, at
   the top of the affiliate storefront/marketplace section from Phase 28, and (b) as a small,
   always-visible label directly on or immediately next to every individual "Buy on {Partner}"
   button — not only as a single banner elsewhere on the page, since disclosure needs to be
   visible at the point of the link itself, not just somewhere on the page.
4. Write an integration test for the new analytics endpoint: seed known clicks and conversions
   across multiple products and statuses, call the endpoint, and assert every returned number
   exactly matches the seeded data (mirror the exact-match assertion style used in the core
   roadmap's Phase 18 test).

TESTS TO RUN: `pnpm test:integration`, `pnpm typecheck`, `pnpm test`. All must pass.

FILES TO UPDATE: `admin-affiliate.ts` (new overview route), admin dashboard frontend, new
`AffiliateDisclosure` component in `apps/web`, applied to the Phase 28 storefront pages.

DOCUMENTATION: add a short section to `docs/affiliate-marketplace.md` (from Phase 27) explaining
the disclosure requirement and confirming where it's implemented, so this isn't accidentally
removed in a future redesign without someone realizing it's a legal requirement, not decoration.

COMPLETION CRITERIA: integration test passes with exact-match assertions. Manually confirm the
disclosure component is visible on the marketplace page and next to every individual affiliate
buy button — report this check explicitly, since it's the compliance-critical part of this
phase.
```

---

### Phase 32 — Mobile app affiliate browsing (optional, sequence after Phase 24)

**Objective:** Extend the pet-owner mobile app (from the core roadmap's Stage H) with the same affiliate browsing and click-through experience as the web storefront.
**Why this phase comes now:** Optional/lower priority — only build this once both the mobile app's core features (core roadmap Phase 24) and the affiliate storefront (Phase 28) independently exist and are stable. Sequence flexibly; this doesn't block anything else.
**Scope:** Mobile screens mirroring Phase 28's browse/detail pages, using the mobile app's existing API client pattern; clicks open the `/go/:slug` redirect (Phase 29) in the device's browser or an in-app browser view rather than the app's own webview trying to handle partner checkout.
**Files likely affected:** New screens under `apps/mobile/src/`.
**Database changes:** None.
**API changes:** None (reuses the public routes from Phases 28–29).
**UI changes:** N/A (new mobile screens).
**Testing required:** Manual device testing that tapping a product opens the correct partner page in the system browser (not trapped inside the app, which can cause issues with some retailers' checkout/payment flows).
**Acceptance criteria:** A pet owner can browse and buy affiliate products from within the mobile app, with the actual purchase happening in a full, trusted browser context.
**Risks:** Low — mostly a UI-consumption phase of already-built APIs.
**Rollback plan:** Additive, no impact on other app features.
**Definition of Done:** Verified on a real device that tapping through leaves the app cleanly and lands correctly on the partner's site.

```
IMPLEMENTATION PROMPT — PHASE 32

You are working in the PawTag monorepo. This is Phase 32 of the Affiliate Marketplace track.
Prerequisites: the mobile app's core features (original roadmap Phase 24) and the affiliate
storefront + redirect service (Phases 28–29 of this track) must all be complete. Do ONLY the
work below.

TASK:
1. Build Affiliate Browse and Product Detail screens in `apps/mobile`, calling the existing
   public `GET /api/affiliate/products` and `GET /api/affiliate/products/:slug` routes from
   Phase 28 — mirror the web storefront's category filtering and layout conventions, adapted to
   mobile UI patterns already established elsewhere in the app (Phase 23/24 screens).
2. Add the same `AffiliateDisclosure`-equivalent text from Phase 31 to these mobile screens —
   duplicate the exact wording used on web for consistency, adapted to a mobile-appropriate
   compact placement (e.g. a persistent small banner at the top of the browse screen, plus a
   one-line label under each buy button).
3. Implement the "Buy on {Partner}" action using `expo-web-browser`'s `openBrowserAsync` (an
   in-app browser tab that still uses the system's real browser engine and cookie/session
   context — NOT a custom webview that could interfere with the partner's own checkout, login,
   or payment flow) pointed at the app's own `/go/:slug` redirect URL from Phase 29, which then
   forwards on to the partner exactly as it does for web visitors.
4. Manually test on a real device: tap a product's buy button, confirm the in-app browser opens,
   the `/go/:slug` redirect resolves correctly, and the partner's real site loads with the
   affiliate tag present in the URL (check the browser's address bar).

TESTS TO RUN: `pnpm typecheck`. This phase is primarily manual-device-verified since it's UI
consumption of already-tested APIs; report the real-device test result explicitly.

FILES TO UPDATE: new screens under `apps/mobile/src/`, `apps/mobile/package.json`
(`expo-web-browser` dependency if not already present).

COMPLETION CRITERIA: report explicit real-device confirmation that the buy flow opens correctly,
redirects correctly, and lands on the partner's real site with tracking intact.
```

---

## Part 8B Summary — What This Adds and What It Doesn't Touch

| | Core roadmap (Phases 1–26) | Affiliate track (Phases 27–32) |
|---|---|---|
| Stock/inventory | Yours, tracked and decremented | None — partner's problem entirely |
| Payment | Stripe, captured by you | None — captured by the partner, you're never PCI-in-scope for these items |
| Shipping/fulfillment | Built in Phases 9–13 | None — partner ships |
| Revenue timing | Immediate, at checkout | Delayed, reported by the network days/weeks later |
| Order state machine (Phase 6) | Used | Not used — affiliate purchases aren't `Order` records at all |
| Data model | `Product`, `Order`, `Subscription` | New, separate: `AffiliatePartner`, `AffiliateProduct`, `AffiliateClick`, `AffiliateConversion` |

Nothing in Phases 1–26 needs to change to support this. That separation is deliberate — it's what lets you launch the affiliate marketplace independently, on its own timeline, without putting the tag/subscription business (your core product) at any risk.

---

## Part 9 — How to Use This

1. Read Part 1 once — those are the decisions; you don't need to revisit them.
2. Skim Parts 2–5 to understand where the business currently has real operational gaps (fulfillment is the big one).
3. Work the phases in Part 8 **in order, one at a time**. For each: copy the implementation prompt into Claude Code, let it complete the phase fully (including its tests), review the result, then move to the next phase. Don't skip ahead — later phases assume earlier ones are genuinely done, not just started.
4. A handful of phases (9, 14, 16, 24, 25) need something from you first — a courier account, an R2/Sentry/Expo account, etc. Those are called out explicitly in each phase; nothing will silently block on them, but they won't be *fully* verified until you've provided the credentials.
5. Phase 26 is the finish line for the core platform: a checklist you can point to and say, honestly, "this is production-ready."
6. **Phases 27–32 (Part 8B) are a separate, optional track** for the affiliate marketplace — start it whenever you're ready, independent of exactly where you are in 1–26, though it makes sense to have your core platform stable first since the affiliate storefront lives on `apps/web` and the admin dashboard alongside it. Phase 27 needs an approved Amazon Associates account before it can be fully verified — that approval process is worth starting now, in parallel, since it can take time on Amazon's side.
