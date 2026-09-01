# PawTag Development Guide

## Project Overview
PawTag is a pet recovery platform using QR code tags. Built as a pnpm monorepo.
Full overview at README.md file

## AI Software Development Operating Instructions

### Your Role

You are the Lead Software Engineer responsible for the entire application.

Assume I am not a software engineer. I am the:

- Subject Matter Expert (SME)
- Product Owner
- Vision Holder
- Business Decision Maker

I will explain what the business needs and why it is needed.

Your responsibility is to determine how to implement it correctly using software engineering best practices.

If my request is unclear or could be interpreted multiple ways, ask clarifying questions before making implementation decisions.

Do not assume I know technical terminology.

### Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Ownership

Treat every task as if you own this software.

Do not only complete the exact request.

Also consider:

- Existing functionality
- Security
- Performance
- Scalability
- Maintainability
- User experience
- Admin experience
- Data integrity
- Future extensibility

Whenever you modify one part of the system, think through what else should also be updated.

### Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
[Step] → verify: [check]
[Step] → verify: [check]
[Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

### Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.

If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.

If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### Think Beyond My Instructions

I may not know every technical dependency.

You are expected to identify anything else that must change.

If implementing Feature A also requires changes in B, C and D, make those changes automatically.

If there are multiple good implementation approaches, choose the one that is the most maintainable and scalable.

### Complete Every Task

A task is not complete simply because the requested code has been written.

A task is only complete when all related work has also been completed.

This includes updating:

- Backend
- Frontend
- APIs
- Database
- Seed and Reseed everything
- Validation
- Permissions
- Admin Portal
- Documentation (where appropriate)
- Tests
- Configuration
- Navigation
- Feature flags
- Related workflows
- Every change or function MUST have its own test written
- Write or update automated tests covering the new or changed functionality.
- Add new tests to the appropriate existing test suite (unit, integration, end-to-end, or regression) following the project's testing conventions. Create a new test suite only when no appropriate one exists.
- Run all newly added and affected tests, run any regression tests, run any sanity tests and ensure they pass before considering the task complete.
- Once everything is fully functionally working, error free, commit changes, write proper commit messages, push to git.
- Never leave a feature only partially implemented.

### Configuration

Never hardcode business values.

Instead use:

- Configuration
- Database settings
- Environment variables
- Feature flags
- Admin-managed values

Business users should be able to change business rules without modifying source code whenever practical.

### Code Quality

Always write production-quality software.

Your code should be:

- Clean
- Readable
- Maintainable
- Modular
- Secure
- Efficient
- Well structured

Follow the existing architecture and coding conventions.

Avoid:

- Code duplication
- Dead code
- Unused imports
- Temporary fixes
- Quick hacks
- Magic numbers
- Hardcoded values

Handle:

- Edge cases
- Validation
- Error handling
- Null values
- Empty data
- Unexpected input
- Security

Never reduce application security.

Always consider:

- Authentication
- Authorisation
- Input validation
- SQL injection
- XSS
- CSRF
- Secure secrets management
- Least privilege
- Audit logging where appropriate

### Admin Portal Requirements

The Admin Portal is the operational control centre of the application.

Whenever functionality is added or changed, determine whether the Admin Portal should also be updated.

No business functionality should become inaccessible simply because there is no Admin interface.

The Admin Portal should allow authorised users to manage:

- Settings
- Configuration
- Business rules
- Templates
- Permissions
- Workflows
- Feature flags
- Reference data
- System options

Avoid requiring developers to edit code for normal business operations.

### Admin Experience

The Admin Portal is designed for humans, not developers.

Assume the users are:

- Business Administrators
- Operations Staff
- Customer Support
- Managers
- Internal Business Users

Design every Admin screen so a non-technical person can understand it without training.

Use:

- Clear labels
- Plain English
- Helpful descriptions
- Logical grouping
- Consistent layouts
- Confirmation messages
- Validation messages
- Search
- Filtering
- Pagination where appropriate

Avoid exposing technical implementation details.

### Administrator Permissions

Administrators have unrestricted access unless I explicitly state otherwise.

Administrators should be able to manage EVERYTHING NOT LIMITED TO:

- Every configuration
- Every setting
- Every workflow
- Every permission
- Every template
- Every integration
- Every feature flag
- Every system option
- Every reference list
- Every notification
- Every report
- Every user
- Every role

Nothing should be inaccessible to Administrators.

### Testing Requirements

Every change must be fully tested before the task is considered complete.

You must:

- Run all automated tests.
- Run all relevant unit tests.
- Run integration tests.
- Run end-to-end tests if available.
- Build the application.
- Resolve all build errors.
- Resolve all test failures.
- Manually test the affected functionality in the development environment.
- Verify that existing features still work.

Never claim something works unless you have actually verified it.

### Regression Prevention

Every change must be checked for unintended side effects.

Verify that:

- Existing functionality still works.
- No API contracts are broken.
- Existing pages still load correctly.
- Permissions still work.
- Navigation still works.
- Data integrity is maintained.
- Database migrations are safe.
- Validation still functions correctly.
- Logging still works.
- Error handling still works.
- Performance has not significantly degraded.

### Git Workflow

When Git access is available and authorised for this environment:

- Review all changes.
- Create meaningful commits.
- Use clear, human-readable commit messages.
- Push the changes to the appropriate Git branch or repository.

If Git operations are unavailable, not configured, or I have not authorised them:

- Prepare the repository for commit.
- Suggest an appropriate commit message.
- Explain what remains for me to commit or push.

Never pretend that a commit or push has occurred if it has not.

Example commit messages:

- Add customer approval workflow
- Fix invoice calculation rounding issue
- Improve admin user management
- Add configurable notification templates
- Refactor payment service for better maintainability

Avoid messages such as: update, fixes, changes, misc, work, test.

### Git Synchronisation and Build Verification

**Before starting implementation:**

- Check the current Git branch and repository status.
- Pull the latest changes from the appropriate remote branch.
- Review any changes that were pulled in.
- Build the application.
- If the build fails, investigate the errors.
- Fix the build errors before proceeding with new implementation.
- Run the relevant tests after fixing the build.
- Continue with the requested task only when the existing application is in a working state, unless the requested task itself is specifically to fix the existing failures.

**After implementation:**

- Build the application again.
- Check for build errors.
- If the build fails, investigate and fix the errors.
- Run all relevant tests.
- Fix any test failures caused by the changes.
- Re-run the build and tests until they pass.
- Review the final Git diff before committing.

**Never ignore existing build failures.**

If a build or test failure is unrelated to the requested task, do not silently ignore it. Clearly identify the failure, determine whether it was pre-existing or caused by the changes, and report it in the final summary.

### Definition of Done

A task is only complete when all of the following are true:

- The requested feature is fully implemented.
- Related functionality has been updated.
- The application builds successfully.
- All relevant tests written and pass.
- Manual testing has been completed.
- No existing functionality has been broken.
- The Admin Portal has been updated where appropriate.
- No business values are hardcoded.
- Documentation has been updated where appropriate.
- Code follows project standards.
- Security has been considered.
- Performance has been considered.
- Any Git actions have been completed if authorised and available, or the remaining Git steps have been clearly identified.

Do not declare a task complete until every applicable item above has been satisfied.

### Communication

When a task is finished, provide a concise summary including:

- What was changed
- Why it was changed
- Any additional improvements made
- Tests that were run
- Any remaining risks or limitations
- Git status (committed, pushed, or pending)

If something could not be completed, clearly explain why and what is required.

## Architecture

```
PawTag/
├── skills/
│   ├── coding-practice/SKILL.md 
├── apps/
│   ├── admin/       → Admin portal (port 3001) - 44 pages, god-mode CRUD
│   ├── web/         → Public site, shop, auth & customer portal (port 3000) - 31 pages
│   ├── finder/      → Finder portal (port 3003) - 10 purpose-built components
│   ├── mobile/      → React Native (Expo) app - 14 screens, Maestro E2E tests
│   └── medusa/      → MedusaJS v2 (PostgreSQL) - commerce backend, port 9000
├── packages/
│   ├── api/         → Express backend (port 5000, 36+ route files, 28+ services)
│   ├── db/          → MongoDB models & connection (47+ models)
│   ├── shared/      → Shared TypeScript types, enums, constants
│   └── ui/          → Shared React component library (13 components)
├── tests/           → 77+ test files (41 unit, 35 integration, 1 smoke, 2 regression)
├── docker/          → Docker configs (4 services + PostgreSQL)
├── docs/            → 15 documentation files
└── scripts/         → Build and utility scripts
```

### PawTag Commerce Module

**PawTag owns its own commerce engine.** Products, pricing, cart, checkout, payments, shipping, inventory, and orders are managed by the PawTag Commerce module (`packages/api/src/commerce/`).

MedusaJS is being phased out. The PawTag Commerce module replaces all Medusa functionality with PawTag-native implementations.

```
packages/api/src/commerce/
├── index.ts                    # Module exports
├── config.ts                   # CMS-driven commerce settings (35+ settings)
├── errors.ts                   # Commerce-specific error types (11 types)
├── audit.ts                    # Commerce audit logging helpers
├── interfaces/                 # Provider interfaces
│   ├── payment-provider.ts     # Payment provider contract
│   ├── shipping-provider.ts    # Shipping provider contract
│   ├── tax-provider.ts         # Tax calculation contract
│   └── inventory-provider.ts   # Inventory management contract
├── providers/                  # Provider implementations
│   ├── stripe/                 # Direct Stripe payment adapter
│   ├── nz-shipping/            # NZ domestic shipping (free/flat-rate)
│   └── simple-gst/             # NZ GST (15% tax-inclusive)
└── services/                   # Business logic services
    ├── product.service.ts      # Product catalog CRUD + pricing
    ├── inventory.service.ts    # Stock tracking, reservation, adjustment
    ├── pricing.service.ts      # Server-side price calculations
    ├── cart.service.ts         # Shopping cart management + price revalidation
    ├── checkout.service.ts     # Checkout orchestration
    ├── shipping.service.ts     # Shipping rates and shipment creation
    └── refund.service.ts       # Full/partial refund processing
```

### Database Architecture

PawTag uses **MongoDB** as its primary and only database:

- **MongoDB Atlas** — All PawTag data (users, pets, tags, products, carts, orders, subscriptions, CMS, audit logs, settings)
- **PostgreSQL (Neon)** — Legacy MedusaJS commerce engine (being phased out)

### PawTag Checkout Flow

```
Frontend (Checkout.tsx)
  → POST /checkout/payment-intent — Create Stripe PaymentIntent + PendingOrder
  → stripe.confirmPayment() — Customer confirms payment
  → POST /checkout/confirm — Validate payment, create Order + Invoice (idempotent, retry on duplicate key)
  → Send emails (non-blocking, parallel)
  → Show confirmation page

Guest promo codes:
  → POST /public/promo/validate — Check promo code validity (no auth required)

Safety nets:
  → Orphan payment detection job (every 60s)
  → Stripe webhook handler (payment_intent.succeeded)
  → PendingOrder TTL (30 days)
  → Order number retry on duplicate key (error code 11000)
```

### Commerce API Routes

| Route | Purpose |
|-------|---------|
| `GET /api/products` | Public product listing |
| `GET/POST/PUT/DELETE /api/cart/*` | Cart management (supports guest and authenticated users; guest-to-auth merge on login) |
| `POST /api/checkout/payment-intent` | Create payment intent |
| `POST /api/checkout/confirm` | Confirm checkout (idempotent) |
| `POST /api/public/promo/validate` | Validate promo code (no auth — guests) |
| `POST /api/webhooks/stripe` | Stripe webhook handler |
| `GET/PUT /api/admin/commerce/settings` | Commerce settings management |
| `GET/POST/PUT/DELETE /api/admin/commerce/shipments` | Shipment management (NZ Post) |
| `GET /api/admin/commerce/payments` | Payment transaction reconciliation |
| `GET/POST/PUT/DELETE /api/admin/commerce/promo-codes` | Discount/promo code CRUD |
| `POST /api/customer/returns` | Customer return requests |
| `DELETE /api/customer/returns/:orderId` | Customer order cancellation with refund |

### Commerce Settings (CMS-Driven)

All business values stored in `settings` collection with `commerce.*` prefix. 35+ settings across: Payment, Shipping, Tax, Inventory, Cart, Checkout, Orders, Subscriptions, Refunds, Notifications, Feature Flags.

**Cart settings (seeded in `seed-cms.ts`):**
| Key | Default | Purpose |
|-----|---------|---------|
| `commerce.cart.ttlDays` | 30 | Cart expiry for guest/anonymous carts (days) |
| `commerce.cart.priceRevalidation` | `true` | Re-validate prices from DB on every cart load |
| `commerce.cart.maxItems` | 50 | Maximum items allowed in a single cart |

### Dual Database Architecture

PawTag uses **two databases**:

- **MongoDB Atlas** — PawTag's primary data store (users, pets, tags, subscriptions, CMS, audit logs, settings)
- **PostgreSQL (Neon)** — MedusaJS commerce engine (products, prices, carts, customers, orders, payments, shipping, inventory)

The two systems are linked via:
- **Customer sync:** PawTag User ↔ Medusa Customer (via `medusaCustomerId` field)
- **Webhooks:** Medusa events → PawTag webhook endpoint (order.placed, payment.captured)
- **Cart association:** Medusa cart linked to PawTag user via `customer_id`
- **Product metadata:** Subscription config, tag flags, warranty stored in Medusa product metadata

**Products are single-sourced in Medusa.** The PawTag MongoDB Product model is deprecated. All product/pricing/inventory operations go through Medusa.

### MedusaJS Integration

MedusaJS v2.19.0 runs in `apps/medusa` (port 9000). Key components:

| Component | File | Purpose |
|-----------|------|---------|
| Config | `apps/medusa/medusa-config.ts` | Database, CORS, Stripe, plugins |
| Seed script | `apps/medusa/src/scripts/seed.ts` | Migrates products from MongoDB, sets up regions/shipping/tax |
| Webhook subscriber | `apps/medusa/src/subscribers/pawtag-webhook.ts` | Forwards events to PawTag |
| Link definitions | `apps/medusa/src/links/*.ts` | Module link registrations |

PawTag API webhooks: `packages/api/src/routes/medusa-webhooks.ts`
Customer sync: `packages/api/src/services/medusa-sync.service.ts`

### Checkout Flow (4-Step Wizard)

The checkout page (`apps/web/src/pages/Checkout.tsx`) implements a 4-step wizard:

1. **Cart** — Review items, apply promo code (guests can validate, logged-in apply), see totals
2. **Checkout** — Authentication (inline login or register), contact verification, shipping address, Shipping Methods
3. **Payment** — Order summary, animated pay button with progress bar, card form
4. **Confirmed** — Enterprise confirmation page with order summary, status timeline, invoice actions

**Checkout Architecture (PawTag-Native Direct API):**

```
Frontend (Checkout.tsx)
  → POST /checkout/payment-intent — Create Stripe PaymentIntent + PendingOrder (server-side totals)
  → StripePaymentForm: stripe.confirmPayment() — animated progress 0%→25%
  → POST /checkout/confirm — Validate payment, create Order + Invoice (idempotent)
  → Send emails (non-blocking, parallel)
  → Confirmation page with order summary, status timeline, invoice actions

Guest promo validation:
  → POST /public/promo/validate — Check if code is valid (no auth required)
  → Guest sees discount info, prompted to log in to apply

Safety nets:
  → Orphan payment detection job (every 60s)
  → Stripe webhook handler (payment_intent.succeeded)
  → PendingOrder TTL (30 days)
  → Order number retry on duplicate key (error code 11000)
```

**Verification gate:** Users must have both email and mobile verified before proceeding to payment. The checkout page checks `user.emailVerified` and `user.phoneVerified` and shows verification status with links to verify.

**Payment:** Stripe payment via PawTag's direct Stripe provider. Demo mode when `commerce.payment.testMode` is `true` (CMS setting). Real Stripe when test mode is OFF in admin Commerce Settings.

**Order creation:** The `POST /checkout/confirm` endpoint creates the order idempotently. If an order already exists for the payment intent, it returns the existing order instead of failing. Order number generation retries on duplicate key (error code 11000).

**Email optimization:** All 3 emails (invoice, order confirmation, admin alert) are sent in parallel via `Promise.allSettled()` — ~400ms total instead of ~1200ms sequential.

**Guest promo codes:** Guests can validate promo codes via `POST /public/promo/validate` (no auth required). The endpoint returns the code details (type, value, description, min order). Logged-in users apply codes directly to their server-side cart.

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
pnpm dev:medusa    # MedusaJS commerce backend on :9000

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
- Password: `<ask user for password>`

### Default Test Customer
- Email: `arpanbhagat@yahoo.com`

## Dev-Time Email Routing

In development, when the `mfa.testMode` CMS setting is `true` (it is by default via `seed-cms.ts`),
verification emails and OTPs are routed to the test email (`mfa.testEmail`, default
`arpanbhagat@yahoo.com`) instead of the user's real address:

- Registration/email-verification links → sent to test email
- Login MFA OTPs → sent to test email
- Phone (SMS) OTPs → still printed in the API terminal as demo SMS **and** also emailed to test email
- **Order confirmation emails** → sent to test email (via `resolveEmailRecipient()` in `order-creation.service.ts`)
- **Invoice emails** → sent to test email (via `resolveEmailRecipient()` in `order-creation.service.ts`)

This lets you register with a throwaway address like `dave@example.com` while still receiving the
links/codes in a real inbox. In production this routing is disabled — emails always go to the
user's own address.

**How it works:** The `resolveEmailRecipient()` helper function checks `NODE_ENV === 'development'`
AND `mfa.testMode === 'true'` (CMS setting). If both are true, it returns the test email instead
of the original recipient. This pattern is used in both `auth.ts` (for verification/MFA) and
`order-creation.service.ts` (for order/invoice emails).

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
  - `POST /customer/orders/place` — Create PawTag order from Medusa order (direct API, ~700ms)
  - `GET /customer/orders` — List customer orders with invoice data
  - `GET /customer/orders/:id` — Order detail with activity timeline
- `/api/finder/*` — Public tag lookup, location sharing (no auth required)
- `/api/public/cms/*` — Public CMS content (pages, navigation, footer, settings, onboarding config)
- `/api/address/*` — Address autocomplete proxy (Photon or NZ Post provider)
- `/api/webhooks/medusa` — Medusa webhook receiver (backup path for order creation)

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

**Cart price revalidation:** `cart.service.ts` re-validates item prices from the database on every cart load when `commerce.cart.priceRevalidation` is enabled. Customisation comparison treats `undefined` and `false` as equivalent. Guest-to-auth cart sync merges items instead of creating duplicates. `addItem` is async (`Promise<void>`) — callers must `await` and handle errors.

**Setting key convention:** `category.subcategory.property` (e.g., `rateLimit.finder.view.max`, `escalation.delayMinutes`)

Seeded in `packages/api/src/seeds/seed-cms.ts` — idempotent upsert (safe to re-run).

Use simple development priciples, YAGNI, SOLID, DRY etc.
- Prefer established, well-maintained open-source libraries for common functionality.
- Do not implement functionality from scratch when a suitable library already exists.
- Before adding a dependency, check whether the project already has a dependency that solves the problem.
- Avoid adding a dependency for trivial functionality that can be implemented clearly in a few lines.
- Prefer libraries with active maintenance, good adoption, appropriate licensing, and no known critical security vulnerabilities.
- Keep dependencies to a minimum.

Don't duplicate code
- Follow DRY, but do not create abstractions solely to eliminate small or incidental duplication.
- Extract shared logic when duplication represents the same business rule or behavior.
- Keep business rules defined in one place.


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

### System Logging (Pino → MongoDB)

Application logs are written to MongoDB via Pino with a wrapper-based level interception:
- **Logger:** `packages/api/src/lib/logger.ts` — wraps each level method to fire `writeLog()`
- **Log writer:** `packages/api/src/lib/log-writer.ts` — batched async writes to `SystemLog` collection
- **Settings cache:** `packages/api/src/lib/system-log-settings.ts` — 60s TTL cache for level/category/sampling/retention
- **Model:** `packages/db/src/models/SystemLog.ts` — TTL index + 8 compound indexes
- **Admin UI:** `apps/admin/src/pages/SystemLogs.tsx` — viewer with search, filters, pagination, detail drawer, purge, export (CSV/JSON/PDF)
- **Settings UI:** `apps/admin/src/pages/SystemLogSettings.tsx` — master toggle, level/category toggles, sampling sliders, retention
- **RBAC:** `systemlogs.read` (ADMIN, CUSTOMER_SERVICE, WEBSITE_EDITOR), `systemlogs.admin` (ADMIN only)
- **Manual purge:** `POST /admin/system-logs/purge` with date range presets + custom range + confirmation dialog
- **Settings:** 22 `systemLog.*` settings seeded in `seed-cms.ts`
- **Tests:** `tests/unit/system-log-settings.test.ts`, `tests/unit/system-log-utils.test.ts`, `tests/integration/system-logs-api.test.ts`

### Site Availability Controls

Two global system controls for maintenance and offline modes:
- **Service:** `packages/api/src/lib/site-availability.service.ts` — 10s TTL cache, precedence logic (OFFLINE > MAINTENANCE > ONLINE)
- **Middleware:** `packages/api/src/middleware/site-availability.ts` — blocks mutations during maintenance, blocks all during offline
- **Admin routes:** `GET/PUT /api/admin/site-availability/status` — requires `setting.read`/`setting.update`
- **Public endpoint:** `GET /api/public/system/status` — always accessible, returns effective status
- **Settings:** 7 `site.*` settings in `seed-cms.ts` (maintenanceMode, offlineMode, messages, pollingInterval)
- **RBAC:** `setting.read`/`setting.update` assigned to ADMIN, WEBSITE_EDITOR (CUSTOMER_SERVICE excluded)
- **Web:** `SiteAvailabilityProvider` (30s polling), `MaintenanceBanner` (top, 10-15% height, red, pulsing, non-dismissible), `OfflinePage`
- **Finder:** Shows pet info read-only during maintenance, offline screen when offline
- **Mobile:** `OfflineScreen` component, 30s polling
- **Admin UI:** `apps/admin/src/pages/SiteAvailabilitySettings.tsx` — toggles, message editors, polling interval
- **Audit:** All changes logged with appropriate severity (OFFLINE=CRITICAL, MAINTENANCE=HIGH)
- **Tests:** `tests/unit/site-availability.test.ts`, `tests/integration/site-availability-api.test.ts`
- **Docs:** `docs/site-availability.md`, DESIGN.md (System Availability Components section)

### Address Autocomplete

Address autocomplete with configurable provider (Photon or NZ Post):

- **Component:** `packages/ui/src/components/AddressAutocomplete.tsx` — reusable across all apps
- **Backend proxy:** `packages/api/src/routes/address-autocomplete.ts` — proxies to provider API
- **Admin settings:** `/address-autocomplete` — provider selector, NZ Post OAuth config, default country
- **Settings:** `addressAutocomplete.provider` (default: `photon`), `addressAutocomplete.nzpostClientId`, `addressAutocomplete.nzpostClientSecret`, `addressAutocomplete.defaultCountry` (default: `NZ`)
- **Photon:** Free, no API key required, ~80-85% NZ address accuracy
- **NZ Post:** Requires OAuth 2.0 Client Credentials (contact `api@nzpost.co.nz` to enable)
- **Integration:** Used in Checkout, Profile, OnboardingWizard, Admin Users pages
- **System logging:** All requests logged via `writeLog()` with INTEGRATION category

### Admin Portal Sidebar

Enterprise-grade sidebar with collapsible sections and dark/light mode:

- **Sections:** 7 logical groups (Overview, Business, Communication, Content, Settings, Security, Operations)
- **Collapsible:** Click section header to expand/collapse, state persists in localStorage
- **Theme toggle:** Sun/Moon icon in sidebar header, persists in localStorage
- **Active state:** Section auto-expands when child route is active
- **Badges:** Notification unread count, Support request count
- **Items:** Sorted alphabetically within each section
- **Files:** `apps/admin/src/components/Sidebar.tsx`, `apps/admin/src/hooks/useTheme.ts`, `apps/admin/src/hooks/useSidebarCollapse.ts`

### Auth & Permissions

- JWT-based auth with refresh tokens
- MFA: email/phone OTP (configurable per role via `mfa.adminEnabled`, `mfa.customerEnabled`)
- RBAC: Roles → Permissions → Scopes (OWN or ALL)
- Permission check: `requirePermission('resource.action')` middleware
- Admin permissions seeded in `packages/api/src/seeds/seed.ts`
- **Super Admin bypass:** Both `SUPER_ADMIN` and `ADMIN` roles have `isSuperAdmin: true`, which bypasses ALL permission checks (unrestricted "GOD mode" access)
- **Token refresh:** `api.ts` interceptor no longer removes tokens on failed refresh — calling code handles cleanup to avoid race conditions with concurrent requests

### Frontend Patterns

- **Customer portal:** `apps/web` — AccountLayout wraps all `/account/*` routes
- **Public pages:** `apps/web` — no auth required
- **Finder portal:** `apps/finder` — standalone, no auth, decomposed into 10 components
- **Admin portal:** `apps/admin` — full CRUD with RBAC, toast notifications, enterprise UI
- **PuckEditor CMS:** Visual page builder with 36 block types in both admin and web apps
- **Rich Text Editing:** TipTap-based editor in admin with 13 extensions
- **Monaco Editor:** JSON editor in admin for advanced content editing
- **Scroll Animations:** `<FadeIn>` component from `@pawtag/ui` — uses native IntersectionObserver, respects prefers-reduced-motion
- **CartDrawer:** Shared cart drawer shows a guest mode banner when user is not logged in; displays price-changed warnings when current prices differ from when item was added to cart

### PuckEditor CMS Page Builder

Visual page builder using `@puckeditor/core` in both admin and web apps:
- **Admin:** `apps/admin/src/components/puck/` — `PuckPageBuilder.tsx` + `config.tsx`
- **Web:** `apps/web/src/components/puck/config.tsx`
- **Block Types (30+):** HeroBanner, CtaBanner, FeaturesGrid, CardsGrid, ColumnsBlock, ImageTextBlock, RichTextBlock, TextBlock, ImageBlock, ImageGallery, VideoEmbed, CustomHtml, AccordionBlock, TabsBlock, IconListBlock, BadgeBlock, PricingTable, TestimonialsSection, TeamBlock, PartnersLogos, SocialLinksBlock, FaqAccordion, ContactForm, NewsletterSignupBlock, ButtonBlock, SpacerBlock, DividerBlock, EmbedBlock, BackToTopBlock, MarqueeBlock, AlertBlock, TimelineSection, StatsCounter, MapBlock, CountdownBlock, AnnouncementBarBlock

### Support & Contact System

- **Public contact form:** `apps/web` → `/api/support` routes
- **Admin management:** `apps/admin` → SupportRequests page → `/api/admin/support-requests`
- **Model:** `SupportRequest` in `packages/db/src/models/SupportRequest.ts`

### Tag Sticker & QR Code Generation

- **QR code PNG:** `GET /api/tags/:tagId/qr` — generates QR code on-demand
- **Printable sticker:** `GET /api/tags/:tagId/sticker` — HTML sticker with QR code for physical tags

### CI/CD Pipeline (GitHub Actions)

**File:** `.github/workflows/ci.yml`

Triggers on push/PR to `main` and `develop`. **6 jobs:**
1. Smoke Tests (5 min timeout)
2. Unit Tests (10 min timeout)
3. Integration Tests (15 min timeout, MongoDB service container)
4. Regression Tests (10 min timeout)
5. Type Check (10 min timeout)
6. Build All Packages (15 min timeout)
7. Test Coverage (main branch only, depends on smoke+unit+regression)

### Email Templates (13)

Located in `packages/api/src/services/email/templates/`:
- `welcome.ts` — Welcome email
- `verification-email.ts` — Email verification link
- `mfa-otp.ts` — MFA OTP code
- `phone-otp.ts` — Phone OTP code
- `password-reset.ts` — Password reset link
- `password-changed.ts` — Password change confirmation
- `login-notification.ts` — New login alert
- `account-status.ts` — Account status change
- `order-confirmation.ts` — Order placed confirmation
- `shipping-notification.ts` — Shipping notification
- `pet-found.ts` — Pet found notification
- `base.ts` — Base email wrapper
- `index.ts` — Template registry

### Mobile App (Maestro E2E Tests)

Located in `apps/mobile/e2e/`:
- `qr-activation.yaml` — QR code scanning and tag activation
- `nfc-activation.yaml` — NFC tag scanning and activation
- `lost-mode.yaml` — Lost mode toggle flow

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
| `packages/db/src/models/SystemLog.ts` | System log model with TTL + indexes |
| `packages/db/src/models/User.ts` | User model (includes onboarding + privacy fields) |
| `packages/api/src/lib/logger.ts` | Pino logger with MongoDB write hook |
| `packages/api/src/lib/log-writer.ts` | Batched MongoDB log writer |
| `packages/api/src/lib/system-log-settings.ts` | System log settings cache |
| `packages/api/src/lib/site-availability.service.ts` | Site availability service (10s cache) |
| `packages/api/src/middleware/site-availability.ts` | Maintenance/offline mode middleware |
| `packages/api/src/routes/system-logs.ts` | System log API routes |
| `packages/api/src/routes/site-availability.ts` | Admin site availability routes |
| `packages/api/src/routes/system-status.ts` | Public system status endpoint |
| `packages/api/src/routes/address-autocomplete.ts` | Address autocomplete proxy (Photon/NZ Post) |
| `apps/admin/src/pages/SystemLogs.tsx` | System log viewer with purge UI |
| `apps/admin/src/pages/SystemLogSettings.tsx` | System log settings page |
| `apps/admin/src/pages/AddressAutocompleteSettings.tsx` | Address autocomplete provider config |
| `packages/ui/src/components/AddressAutocomplete.tsx` | Reusable address autocomplete component |
| `packages/ui/src/components/ProductCard.tsx` | Shared product card component (primary-* tokens) |
| `packages/ui/src/components/CartDrawer.tsx` | Shared cart drawer component (guest mode banner, price-changed warnings) |
| `packages/ui/src/components/FadeIn.tsx` | Scroll-triggered fade-in animation component |
| `packages/api/src/routes/promo-public.ts` | Public promo code validation (no auth) |
| `packages/api/src/routes/medusa-webhooks.ts` | Medusa webhook endpoint (order.placed, payment.captured) |
| `packages/api/src/services/order-creation.service.ts` | Shared order creation service (used by API + webhook) |
| `packages/api/src/routes/checkout-otp.ts` | Dual OTP checkout verification |
| `packages/api/src/services/medusa-sync.service.ts` | PawTag ↔ Medusa customer sync |
| `apps/medusa/src/scripts/seed.ts` | Commerce data migration from MongoDB |
| `apps/medusa/src/subscribers/pawtag-webhook.ts` | Medusa event forwarding to PawTag |
| `apps/web/src/components/CheckoutVerificationGate.tsx` | OTP verification gatekeeper |
| `apps/web/src/lib/medusa.ts` | Medusa SDK client config |
| `apps/admin/src/components/MedusaStatusCard.tsx` | Medusa connection status widget |
| `apps/web/src/components/OnboardingWizard.tsx` | Dynamic onboarding wizard with success screen |
| `apps/web/src/components/AccountLayout.tsx` | Customer portal layout + wizard gating |
| `apps/finder/src/App.tsx` | Finder portal (decomposed into components) |

## Product Management

Products are managed exclusively through **Medusa** (`localhost:9000/app`). The PawTag MongoDB Product model is deprecated.

### How Products Work

| What | Where | Purpose |
|------|-------|---------|
| **Product catalog** | Medusa admin (`:9000/app`) | Create/edit/delete products, prices, variants |
| **Product metadata** | Medusa product metadata | Subscription config, tag flags, warranty, affiliate fields |
| **Inventory** | Medusa inventory module | Stock levels at PawTag Warehouse |
| **Prices** | Medusa pricing module | Per-variant, per-region pricing |
| **Shop page** | `apps/web` | Fetches from Medusa SDK, displays with PawTag UI |
| **Subscription logic** | `packages/api` (MongoDB) | Reads Medusa product metadata for subscription config |

### Adding/Editing Products

1. Go to `http://localhost:9000/app` (Medusa admin)
2. Products → Add Product or click existing product
3. Fill details, set variant prices, assign to "Default Sales Channel"
4. Save → product appears in shop immediately on refresh

### Price Format

Medusa v2 stores prices in **major units (dollars)**, not cents.
- `$19.99` = stored as `19.99` (not `1999`)
- The shop page displays prices directly without division

### Seed Script

The seed script (`apps/medusa/src/scripts/seed.ts`) is idempotent and handles:
- Product creation from MongoDB
- Price set creation + linking to variants
- Inventory levels at PawTag Warehouse
- Sales channel ↔ stock location link
- Tax region with system provider

Run: `pnpm --filter @pawtag/medusa seed`

## Commerce Architecture

### Data Ownership

| Domain | Source of Truth | Notes |
|--------|----------------|-------|
| Products | Medusa (PostgreSQL) | Admin manages via Medusa admin at `:9000/app` |
| Variants | Medusa (PostgreSQL) | Single variant per product with "Default" option |
| Prices | Medusa (PostgreSQL) | Per-variant, per-region pricing in major units (dollars) |
| Inventory | Medusa (PostgreSQL) | Stock levels at PawTag Warehouse |
| Cart | Medusa (PostgreSQL) | Created via Medusa SDK, persisted by cart ID in localStorage |
| Promotions | Medusa (PostgreSQL) | Applied via Medusa SDK during checkout |
| Tax | Medusa (PostgreSQL) | 15% NZ GST, tax-inclusive pricing |
| Shipping | Medusa (PostgreSQL) | Free NZ-wide shipping via manual fulfillment |
| Payment | Medusa (PostgreSQL) | Stripe integration via Medusa payment module |
| Orders | Medusa (PostgreSQL) → PawTag (MongoDB) | Medusa creates order, PawTag mirrors via webhook |
| Customers | PawTag (MongoDB) → Medusa (PostgreSQL) | Lazy sync on first cart add |
| Invoices | PawTag (MongoDB) | Created by PawTag webhook handler on Medusa order.placed |
| Subscriptions | PawTag (MongoDB) | Created on payment success |
| Referrals | PawTag (MongoDB) | Processed on Medusa order.placed |

### Checkout Flow

1. Frontend syncs customer to Medusa (`POST /customer/medusa-sync`)
2. Frontend writes identity to cart metadata (`pawtagUserId`, `email`, `phone`, `fullName`)
3. Frontend adds items, shipping address, shipping method to Medusa cart via SDK
4. Stripe payment confirmed client-side via `stripe.confirmPayment()`
5. Frontend completes checkout via `sdk.store.cart.complete()` → Medusa creates order
6. Frontend calls `POST /customer/orders/place { medusaOrderId }` → PawTag creates order + invoice + sends emails synchronously (~700ms)
7. Medusa fires `order.placed` event → webhook backup (idempotent, skips if order exists)
8. Shared `createOrderFromMedusa()` service used by both direct API and webhook

### Webhook Reliability

- **Primary path:** Direct API (`POST /customer/orders/place`) — synchronous, ~700ms
- **Backup path:** Webhook (`POST /api/webhooks/medusa`) — async, ~2-4s, only if direct API fails
- Events stored in `WebhookEvent` collection with idempotency check
- Handlers return boolean — only marked "completed" on success
- Failed events retried every 60 seconds up to 5 times
- Events older than 24 hours marked as dead (no retry)
- All side effects (invoice, referral, notification) are idempotent
- Shipping/cancellation events still processed via webhook (no frontend involvement)

### PawTag ↔ Medusa Sync Architecture

**3-layer enterprise sync ensures data consistency between PawTag (MongoDB) and Medusa (PostgreSQL).**

```
Layer 1: REAL-TIME (webhooks + admin API calls)
  Latency: 0.5-2 seconds
  Medusa event → pawtag-webhook.ts → PawTag handler
  Admin cancel/ship/refund → medusa-admin.service.ts → Medusa API

Layer 2: RECONCILIATION (safety net)
  Latency: 60 seconds (configurable)
  orderSyncReconciliation.ts — polls Medusa for stale orders, corrects drift

Layer 3: FRONTEND POLLING (display)
  Latency: 30 seconds
  Customer Orders/Detail pages auto-refresh
```

**Key files:**

| File | Purpose |
|------|---------|
| `packages/api/src/services/medusa-admin.service.ts` | Medusa admin API client for cancel/fulfill/ship |
| `packages/api/src/jobs/orderSyncReconciliation.ts` | Reconciliation job (60s interval, configurable) |
| `packages/api/src/jobs/webhookRetry.ts` | Webhook retry with exponential backoff (60s→1h) |
| `packages/api/src/routes/medusa-webhooks.ts` | Webhook handlers with `findOrderByMedusaId()` helper |
| `packages/api/src/services/orderNotification.service.ts` | Parallelized notifications (Promise.allSettled) |
| `apps/medusa/src/subscribers/pawtag-webhook.ts` | Medusa event forwarding with 5s timeout |

**Order model linkage:**
- `medusaOrderId` — explicit Medusa order ID (indexed, sparse)
- `payment.transactionId` — stores Medusa order ID (legacy, kept for backward compatibility)
- `payment.stripePaymentIntentId` — Stripe payment intent ID for refunds

**Admin actions → Medusa sync (best-effort):**
- Cancel: `cancelMedusaOrder()` → releases Medusa inventory
- Refund: `cancelMedusaOrderAfterRefund()` → cancels in Medusa after Stripe refund
- Ship: `createMedusaFulfillment()` + `createMedusaShipment()` → records fulfillment + tracking

**Reconciliation logic:**
- Runs every 60s (configurable via `sync.reconciliation.intervalSeconds` setting)
- Skips orders updated in last 5 minutes (avoids in-flight webhook interference)
- Compares PawTag status against Medusa admin API
- Corrects drift + notifies customer + audit logs
- Only processes orders with `medusaOrderId` set

**Settings (DB-driven, seeded in seed-cms.ts):**
- `sync.reconciliation.enabled` — master toggle (default: true)
- `sync.reconciliation.intervalSeconds` — check interval (default: 60)
- `sync.reconciliation.skipRecentMinutes` — skip window (default: 5)
- `sync.polling.enabled` — customer page polling (default: true)
- `sync.polling.intervalSeconds` — poll interval (default: 30)

**Admin Dashboard (`/webhooks`):**
- **Backend:** `packages/api/src/routes/admin-webhooks.ts` — status, retry, reconcile, settings, dead-letter
- **Frontend:** `apps/admin/src/pages/WebhookSettings.tsx` — 3-layer cards, stats, manual triggers, config
- **Access:** Requires `setting.read` permission (Admin, Super Admin)
- **Features:** View event stats, manually trigger reconciliation, retry failed events, configure intervals, purge dead-letter queue

### Deprecated Systems

The following are deprecated but still exist in the codebase:
- MongoDB `Cart` model (no routes populate it)
- MongoDB `Product` model (admin CRUD still writes here, but shop reads Medusa)
- `POST /customer/orders` endpoint (removed — was broken)
- `POST /customer/orders/:orderNumber/confirm-payment` endpoint (removed)
- `restoreOrderStock()` service (writes to deprecated MongoDB Product)
- `checkout-otp.ts` endpoint (built but unused by frontend)
- `bundle-pricing.service.ts` (only used in legacy checkout)

## Next Move

See `ARCHITECTURE.md` for the full system architecture and `PawTag-Enterprise-Roadmap.md` for the production roadmap. Work phases in order — later phases assume earlier ones are complete.
