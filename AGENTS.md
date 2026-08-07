# PawTag Development Guide

## Project Overview
PawTag is a pet recovery platform using QR code tags. Built as a pnpm monorepo.

## Architecture

```
PawTag/
├── packages/
│   ├── api/       → Express backend (port 5000)
│   ├── db/        → MongoDB models & connection
│   └── shared/    → Shared TypeScript types
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
- `/api/customer/*` — Pet management, orders, notifications
- `/api/finder/*` — Public tag lookup, location sharing

## Next Move

See `ARCHITECTURE.md` for the full system architecture and `PawTag-Enterprise-Roadmap.md` for the 26-phase production roadmap. Work phases in order — later phases assume earlier ones are complete.
