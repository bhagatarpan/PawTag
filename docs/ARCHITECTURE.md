# PawTag — Architecture

## Overview

PawTag is a pet recovery platform using QR code and NFC tags. A pet owner purchases a tag, links it to their pet's profile, and when the pet is lost, anyone who finds it can scan the tag to notify the owner and facilitate a reunion.

## High-Level Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   apps/web   │  │ apps/admin  │  │ apps/finder │  │ apps/mobile │
│  Public Site │  │ Admin Portal│  │ Finder Page │  │ React Native│
│  + Shop +     │  │ (CRUD/RBAC) │  │ (Public)    │  │ (Expo)      │
│ Customer Portal│ │ :3001       │  │ :3003       │  │ iOS/Android │
│  :3000       │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
└──────┬───────┘         │                 │                 │
       │                 │                 │                 │
       └─────────────────┴─────────────────┴─────────────────┘
                                     │
                              ┌──────┴──────┐
                              │ packages/api │
                              │  Express API │
                              │   :5000      │
                              └──────┬──────┘
                                     │
                         ┌───────────┼───────────┐
                         │           │           │
                  ┌──────┴──┐  ┌────┴────┐  ┌───┴──────┐
                  │packages/ │  │packages/│  │packages/ │
                  │   db     │  │  shared │  │  api     │
                  │ MongoDB  │  │ Types & │  │ Services │
                  │ Models   │  │ Utils   │  │ & Routes │
                  └──────────┘  └─────────┘  └──────────┘
```

## One Backend

A single Express API (`packages/api`) serves all clients — web, admin, finder page, and the future mobile app. There is no API duplication; each client consumes the same endpoints with different permission levels.

- **Port 5000** in development
- JWT-based authentication with RBAC (role-based access control)
- Zod validation on all inputs
- Consistent `{ success, data?, error? }` response shape

## Frontends

The web app consolidates the public site, shop, auth, and the customer portal into a single application so customers have one seamless experience — browse, buy, sign up, verify, and manage their account (pets, orders, subscriptions, notifications, tag activation) in one place.

| App | Port | Audience | Auth | Purpose |
|-----|------|----------|------|---------|
| `apps/web` | 3000 | Public/Pet owners | Optional | Marketing site, shop, checkout, auth, customer portal (pets, orders, subscriptions, tags, referrals) |
| `apps/admin` | 3001 | Staff | Admin RBAC | Full CRUD, dashboard, order management, CMS, system logs, site availability |
| `apps/finder` | 3003 | Strangers | None | Public tag lookup — must be tiny and fast |
| `apps/mobile` | — | Pet owners | JWT + refresh | React Native (Expo) — pet management, QR/NFC scanning, push notifications |

The finder page is intentionally kept minimal — it's the page a stressed stranger opens on their phone with poor signal to report a found pet. Bundling it with heavier apps would hurt the one interaction that matters most for reunions.

## Mobile App — React Native (Expo)

The mobile app (`apps/mobile`) is a React Native (Expo) app for pet owners, built with:

- **Expo SDK 52** — managed workflow with EAS Build
- **React Navigation** — stack + bottom tab navigation (13 screens)
- **Native capabilities**: camera-based QR scanning, NFC tag activation, push notifications
- Imports `packages/shared` directly for types and validation — no business logic duplication
- Uses the same JWT auth system with refresh tokens for long-lived sessions
- Token storage via `expo-secure-store`
- Push notifications via `expo-notifications` → Expo Push API → Firebase Cloud Messaging (Android) / APNs (iOS)

The finder role gets **no app** — both NFC taps and QR scans open the existing `apps/finder` web page.

### Mobile Screens

| Screen | Purpose |
|--------|---------|
| Login / Register / ForgotPassword | Auth flows with MFA support |
| Home | Dashboard with 7 quick action cards |
| PetList / PetDetail / AddPet | Pet management (CRUD) |
| QRScanner / NFCScanner | Tag scanning and activation |
| RedeemTag | Manual tag ID entry + activation |
| LostMode | Toggle pet lost/found status with confirmation |
| HealthRecords | 7-tab health records (vaccinations, microchips, etc.) |
| SubscriptionScreen | View/manage subscriptions |
| OrderHistory | Order list with tracking |
| Settings | App settings and account management |
| OfflineScreen | Branded offline/maintenance experience |

## Shared Package

`packages/shared` contains TypeScript types, validation schemas, and utility functions used by all clients. Changes to data models here propagate to every frontend at build time.

## Database

MongoDB Atlas with Mongoose ODM. 45 models covering users, pets, tags, orders, subscriptions, invoices, notifications, CMS content, system logs, audit events, escalation records, and more. See `docs/database-schema.md` for the full model reference.

## Authentication

JWT-based with bcrypt password hashing. A single auth system serves every client:

- Email/password login
- Email verification (token-based)
- Phone OTP verification
- Password reset (token-based, email-delivered)
- RBAC roles: SUPER_ADMIN, ADMIN, CUSTOMER_SERVICE, WEBSITE_EDITOR, CUSTOMER

Access tokens are short-lived (30 min). Refresh tokens (30-day, rotating) support long-lived sessions on mobile.

## Key Business Flows

### Tag Recovery Flow
1. Owner purchases tag → ships to customer
2. Customer activates tag → links to pet profile
3. Pet goes lost → owner marks as lost
4. Finder scans QR or taps NFC → opens finder page
5. Finder submits contact info → owner notified
6. Pet reunited → status flipped to found

### E-Commerce Flow
1. Browse shop → add to cart
2. Checkout → Stripe payment
3. Order confirmed → admin notified
4. Fulfillment → shipping label → tracking
5. Delivered → customer activates tag

## External Services

| Service | Purpose | Env Var | Failure Impact |
|---------|---------|---------|----------------|
| MongoDB Atlas | Database — stores all application data | `DB_URL` | **Critical** — entire app down |
| Stripe | Payments, subscriptions, customer portal | `STRIPE_SECRET_KEY` | **Critical** — no purchases or subscriptions |
| Resend | Transactional email (receipts, verification, notifications) | `RESEND_API_KEY` | **High** — emails logged to console, users can't verify/reset |
| Twilio | SMS/OTP for phone verification | `TWILIO_*` | **Medium** — OTP falls back to demo mode (logged to console) |
| Cloudflare R2 | Object storage (pet photos, product images, PDFs) | `R2_*` | **Low** — falls back to local disk in dev |
| Sentry | Error tracking and performance monitoring | `SENTRY_DSN` | **Low** — errors only visible in server logs |
| Expo | Mobile push notifications, EAS Build | — | **Medium** — push notifications fail silently, no new mobile builds |
| Apple APNs | iOS push notification delivery | (configured in Expo) | **Medium** — iOS notifications fail |
| Google FCM | Android push notification delivery | (configured in Expo) | **Medium** — Android notifications fail |

## Environment Strategy

Three environments with complete separation:

- **Local** — `pnpm dev:all`, local MongoDB or memory server, Stripe test mode
- **Staging** — Separate Atlas cluster, Stripe test-mode account, deployed via `develop` branch
- **Production** — Separate Atlas cluster, Stripe live account, deployed via `main` branch

See `docs/deployment/staging.md` and `docs/deployment/production.md` for deployment procedures.

## Site Availability Controls

Two global system controls for maintenance and offline modes:

- **Service:** `packages/api/src/lib/site-availability.service.ts` — 10s TTL cache, precedence logic (OFFLINE > MAINTENANCE > ONLINE)
- **Middleware:** `packages/api/src/middleware/site-availability.ts` — blocks mutations during maintenance, blocks all during offline
- **Admin routes:** `GET/PUT /api/admin/site-availability/status` — requires `setting.read`/`setting.update`
- **Public endpoint:** `GET /api/public/system/status` — always accessible, returns effective status
- **Settings:** 7 `site.*` settings in `seed-cms.ts` (maintenanceMode, offlineMode, messages, pollingInterval)
- **Web:** `SiteAvailabilityProvider` (30s polling), `MaintenanceBanner`, `OfflinePage`
- **Finder:** Shows pet info read-only during maintenance, offline screen when offline
- **Mobile:** `OfflineScreen` component, 30s polling

## System Logging

Application logs written to MongoDB via Pino with structured output:

- **Logger:** `packages/api/src/lib/logger.ts` — wraps each level method to fire `writeLog()`
- **Log writer:** `packages/api/src/lib/log-writer.ts` — batched async writes to `SystemLog` collection
- **Settings cache:** `packages/api/src/lib/system-log-settings.ts` — 60s TTL cache for level/category/sampling/retention
- **Admin UI:** `apps/admin/src/pages/SystemLogs.tsx` — viewer with search, filters, pagination, detail drawer, purge, export (CSV/JSON/PDF)
- **Settings UI:** `apps/admin/src/pages/SystemLogSettings.tsx` — master toggle, level/category toggles, sampling sliders, retention
- **RBAC:** `systemlogs.read` (ADMIN, CUSTOMER_SERVICE, WEBSITE_EDITOR), `systemlogs.admin` (ADMIN only)
- **Tests:** `tests/unit/system-log-settings.test.ts`, `tests/unit/system-log-utils.test.ts`, `tests/integration/system-logs-api.test.ts`

## Audit Logging

Enterprise-grade audit trail with integrity verification:

- **Service:** `packages/api/src/services/audit/audit.service.ts` — queue-based, async
- **Middleware:** `packages/api/src/middleware/audit.ts` — auto-captures all `/api/*` requests
- **Model:** `AuditEvent` with SHA-256 hash chain (each event links to previous via `previousEventHash`)
- **Features:** Actor tracking (USER, ADMIN, CSR, FINDER, SYSTEM), field-level diffs with sensitive field redaction
- **Policy engine:** `audit.policy.category.*` and `audit.policy.actor.*` settings control what's logged

## Observability Stack

Full observability infrastructure (built as unplanned addition):

- **Structured logging:** Pino → MongoDB (`SystemLog` collection with TTL index)
- **Distributed tracing:** OpenTelemetry with request correlation IDs
- **Metrics:** Request duration, error rates, DB connectivity health
- **Health endpoints:** `GET /api/health` (MongoDB connectivity check)
- **Documentation:** `docs/OBSERVABILITY-ARCHITECTURE.md`, `docs/OBSERVABILITY-RUNBOOK.md`

## Key Documentation

| Document | Purpose |
|----------|---------|
| `docs/developer-setup.md` | Local development setup |
| `docs/environments.md` | Environment variable reference |
| `docs/database-schema.md` | All 45 Mongoose models |
| `docs/business-workflows.md` | Business logic flows |
| `docs/deployment/staging.md` | Staging deployment guide |
| `docs/deployment/production.md` | Production deployment guide |
| `docs/deployment/mobile-release.md` | Mobile app store submission |
| `docs/release-process.md` | How to ship safely |
| `docs/rollback.md` | How to undo deployments |
| `docs/support-runbook.md` | Customer support procedures |
| `docs/disaster-recovery.md` | Infrastructure failure recovery |
| `docs/mobile-ux-audit.md` | Mobile UX quality audit |
| `docs/launch-checklist.md` | Pre-launch verification |
| `docs/site-availability.md` | Maintenance/offline mode controls |
| `docs/LOGGING.md` | Structured logging setup |
| `docs/OBSERVABILITY-ARCHITECTURE.md` | Observability stack architecture |
| `docs/OBSERVABILITY-RUNBOOK.md` | Observability operations runbook |
