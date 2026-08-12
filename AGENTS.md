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
