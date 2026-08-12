# PawTag Development Guide

## Project Overview
PawTag is a pet recovery platform using QR code tags. Built as a pnpm monorepo.

## Architecture

```
PawTag/
├── packages/
│   ├── api/       → Express backend (port 5000)
│   ├── db/        → MongoDB models & connection
│   ├── shared/    → Shared TypeScript types
│   └── ui/        → Shared UI component library
├── apps/
│   ├── admin/     → Admin portal (port 3001) - god-mode CRUD
│   ├── web/       → Public site, shop, auth & customer portal (port 3000)
│   ├── mobile/    → React Native (Expo) app
│   └── finder/    → Finder portal (port 3003)
└── docker/        → Docker configs
```

## Development Commands

```bash
# Install all dependencies
pnpm install

# Run everything in parallel
pnpm dev:all

# Run individual services
pnpm dev:api       # API on :5000
pnpm dev:admin     # Admin on :3001
pnpm dev:web       # Public site, shop, auth & customer portal on :3000
pnpm dev:finder    # Finder portal on :3003

# Build everything
pnpm build

# Typecheck everything
pnpm typecheck
```

## Database

- MongoDB Atlas cluster: `api-node-mongo-cluster`
- Connection in: `packages/api/.env`
- Seed: `cd packages/api && pnpm seed`

### Default Admin Account
- Email: `admin@pawtag.co.nz`
- Password: `PawTagAdmin2024!`

### Default Test Customer
- Email: `john@example.com`

## Dev-Time Email Routing

In development, when the `mfa.testMode` CMS setting is `true` (it is by default via `seed-cms.ts`),
verification emails and OTPs are routed to the test email (`mfa.testEmail`, default
`arpanbhagat@yahoo.com`) instead of the user's real address:

- Registration/email-verification links → sent to test email
- Login MFA OTPs → sent to test email
- Phone (SMS) OTPs → still printed in the API terminal as demo SMS **and** also emailed to test email

This lets you register with a throwaway address like `dave@example.com` while still receiving the
links/codes in a real inbox. In production this routing is disabled — emails always go to the
user's own address.

Also note: in dev, `email.service.ts` always sends from `onboarding@resend.dev` (Resend's
pre-verified test domain) so unverified custom domains like `pawtag.co.nz` don't cause rejections.
Production uses the configured domain sender.

## Tech Stack
- **Backend:** Node.js, Express, Mongoose, JWT, bcrypt, Zod validation
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, React Router v6
- **Database:** MongoDB Atlas
- **Monorepo:** pnpm workspaces

## Code Conventions
- TypeScript strict mode
- No hardcoded business values — use settings, env vars, feature flags
- All admin CRUD operations must go through the admin API routes
- Zod schemas for all API input validation
- Audit logging for all admin actions
- All API responses use `{ success, data?, error? }` format

## API Routes
- `/api/auth/*` — Login, register, OTP, profile
- `/api/admin/*` — Full CRUD (requires admin/support role)
- `/api/customer/*` — Pet management, orders, notifications, onboarding, escalations
- `/api/finder/*` — Public tag lookup, location sharing (no auth required)
- `/api/public/cms/*` — Public CMS content (pages, navigation, footer, settings, onboarding config)

---

## Key Patterns & Architecture

### CMS Settings (DB-Driven Configuration)

All business values are stored in the `settings` collection, NOT hardcoded. Read via:
```typescript
import { Setting } from '@pawtag/db';
const setting = await Setting.findOne({ key: 'some.key' }).lean();
const value = setting?.value || 'default';
```

Settings are cached in-memory for 60 seconds in some services (e.g., `otp-settings.service.ts`, `rate-limiter.ts`).

**Setting key convention:** `category.subcategory.property` (e.g., `rateLimit.finder.view.max`, `escalation.delayMinutes`)

Seeded in `packages/api/src/seeds/seed-cms.ts` — idempotent upsert (safe to re-run).

### Rate Limiting (All DB-Driven)

Rate limiters are created via `createDbRateLimiter()` from `packages/api/src/lib/rate-limiter.ts`.
All limits are read from DB settings (key prefix: `rateLimit.*`) with a 1-minute cache.

**Rate limit settings:**
| Key | Default | Scope |
|-----|---------|-------|
| `rateLimit.global.max` | 1000 | General API, per 15min per IP |
| `rateLimit.auth.login.max` | 5 | Login, per 15min per IP |
| `rateLimit.auth.register.max` | 3 | Register, per hour per IP |
| `rateLimit.auth.forgotPassword.max` | 3 | Password reset, per hour per IP |
| `rateLimit.auth.mfaSend.max` | 1 | OTP send, per 30s per IP |
| `rateLimit.auth.mfaVerify.max` | 5 | OTP verify, per 15min per IP |
| `rateLimit.finder.view.max` | 30 | Pet info lookup, per hour per IP |
| `rateLimit.finder.notify.max` | 5 | Notify owner, per hour per IP |
| `rateLimit.finder.location.max` | 10 | Share location, per hour per IP |

**All rate limiters skip in dev/test** (`NODE_ENV === 'development' || 'test'`).

### CAPTCHA

Custom math-problem CAPTCHA (not reCAPTCHA). Token is a JWT signed with `config.jwtSecret`, expires in 5 minutes.
- Auth routes: required after 2+ failed login attempts on same account
- Finder routes (`notify`, `share-location`): required in production, skipped in dev
- Middleware: `packages/api/src/middleware/captcha.ts`
- CAPTCHA endpoint: `GET /api/auth/captcha`

### Tag ID Format

- **New tags:** `PT-XXXXXXXX` (8 alphanumeric chars, ~2.8T combinations, generated via `crypto.randomBytes()`)
- **Legacy tags:** `PT-NNNNNN` (6 digits) — still validated and work
- Prefix configurable via CMS setting `tag.idPrefix`
- Generation: `packages/api/src/lib/tag-id.ts` → `generateTagId()`

### Owner Privacy (`showOwnerNameInFinder`)

Two-level privacy control on the finder portal:
1. **Admin CMS setting** `finder.showOwnerName` (global toggle)
2. **Per-user toggle** `User.showOwnerNameInFinder` (default: `true`)

Both must be `false` to hide the owner's name. When hidden:
- Name → `null`
- Location → `"located in {suburb}, {city}"`
- Phone → `null` (gated by same privacy check)

**Always hidden from finders:** street address, email, emergency contact details.
**Always shown:** pet info, medical alerts, vaccinations, microchips, suburb/city.

### Finder Portal Security

The finder portal (`/api/finder/*`) is **public — no auth required**. Security measures:
- **Rate limiting:** DB-driven per-IP limits on view/notify/location endpoints
- **CAPTCHA:** Required on `notify` and `share-location` in production
- **Audit logging:** All finder actions logged via `auditFinderEvent()` (fire-and-forget)
- **Privacy:** Owner phone/name gated by privacy setting; finder contacts hidden from `/found-timer`

### Escalation System

When a pet is found and the owner doesn't respond within 30 minutes:
1. `EscalationRecord` created with `escalationDeadline`
2. `escalation.service.ts` polls every 1 minute for overdue escalations
3. Emergency contact receives email + in-app notification
4. Owner can manually forward to emergency contact via dashboard

Settings: `escalation.delayMinutes`, `escalation.notifyEmergencyContact`, `escalation.enableManualForward`

### Onboarding Wizard (CMS-Driven)

Fully CMS-driven — admin can add/remove/reorder steps without code changes.
- **Config:** `CmsOnboarding` model with steps + global settings
- **Admin UI:** `/cms/onboarding` — editors for content, flow steps, callouts, privacy notes, why-it-matters
- **Frontend:** `OnboardingWizard.tsx` — dynamic rendering based on CMS config
- **Gating:** `AccountLayout.tsx` checks `onboardingCompleted === false && onboardingSkipped !== true`
- **Skip/Dismiss:** "Maybe later" → `onboardingSkipped=true`; "Don't show me again" → `onboardingCompleted=true`
- **Success screen:** Animated checkmark + confetti + security proof points + "PawTag Active" badge
- **Key fix:** `completeOnboarding()` does NOT call `refreshUser()` — it only sets `completed=true` locally. `refreshUser()` happens on "Go to Dashboard" click.

### Audit Logging (Enterprise-Grade)

All admin and finder actions are logged to `AuditEvent` model with:
- SHA-256 hash chain integrity (each event links to previous via `previousEventHash`)
- Actor tracking (USER, ADMIN, CSR, FINDER, SYSTEM, etc.)
- Field-level diffs with sensitive field redaction
- Policy engine: `audit.policy.category.*` and `audit.policy.actor.*` settings control what's logged
- Audit service: `packages/api/src/services/audit/audit.service.ts` (queue-based, async)
- Audit middleware: `packages/api/src/middleware/audit.ts` (auto-captures all `/api/*` requests)

### Auth & Permissions

- JWT-based auth with refresh tokens
- MFA: email/phone OTP (configurable per role via `mfa.adminEnabled`, `mfa.customerEnabled`)
- RBAC: Roles → Permissions → Scopes (OWN or ALL)
- Permission check: `requirePermission('resource.action')` middleware
- Admin permissions seeded in `packages/api/src/seeds/seed.ts`

### Frontend Patterns

- **Customer portal:** `apps/web` — AccountLayout wraps all `/account/*` routes
- **Public pages:** `apps/web` — no auth required
- **Finder portal:** `apps/finder` — standalone, no auth, decomposed into 10 components
- **Admin portal:** `apps/admin` — full CRUD with RBAC, toast notifications, enterprise UI

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/api/src/lib/rate-limiter.ts` | DB-driven rate limiter factory |
| `packages/api/src/lib/tag-id.ts` | Tag ID generation (crypto-based) |
| `packages/api/src/middleware/captcha.ts` | CAPTCHA verification middleware |
| `packages/api/src/routes/finder.ts` | Public finder portal API (rate-limited, audited) |
| `packages/api/src/routes/auth.ts` | Auth routes with DB-driven rate limiters |
| `packages/api/src/routes/customer.ts` | Customer routes (onboarding, escalations, etc.) |
| `packages/api/src/seeds/seed-cms.ts` | CMS settings + onboarding steps seed |
| `packages/api/src/seeds/seed.ts` | RBAC permissions + roles seed |
| `packages/api/src/services/audit/audit.service.ts` | Enterprise audit logging service |
| `packages/api/src/services/escalation.service.ts` | 30-min escalation polling |
| `packages/db/src/models/CmsOnboarding.ts` | Onboarding wizard config model |
| `packages/db/src/models/EscalationRecord.ts` | Escalation tracking model |
| `packages/db/src/models/User.ts` | User model (includes onboarding + privacy fields) |
| `apps/web/src/components/OnboardingWizard.tsx` | Dynamic onboarding wizard with success screen |
| `apps/web/src/components/AccountLayout.tsx` | Customer portal layout + wizard gating |
| `apps/finder/src/App.tsx` | Finder portal (decomposed into components) |

## Next Move

See `ARCHITECTURE.md` for the full system architecture and `PawTag-Enterprise-Roadmap.md` for the 26-phase production roadmap. Work phases in order — later phases assume earlier ones are complete.
