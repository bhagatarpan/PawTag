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
│   ├── web/       → Public site & shop (port 3000)
│   ├── customer/  → Customer portal (port 3002)
│   └── finder/    → Finder portal (port 3003)
├── mobile/        → Flutter app (future)
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
pnpm dev:web       # Public site on :3000
pnpm dev:customer  # Customer portal on :3002
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
