# Developer Setup

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9 (install: `npm install -g pnpm`)
- **MongoDB Atlas** account (or local MongoDB for development)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/bhagatarpan/PawTag.git
cd PawTag

# Install all dependencies
pnpm install

# Set up environment variables
cp packages/api/.env.example packages/api/.env
# Edit packages/api/.env with your values (see Environment Variables below)

# Seed the database (creates default admin + test data)
cd packages/api && pnpm seed && cd ../..

# Start all services in parallel
pnpm dev:all
```

This starts five services concurrently:

| Service | URL | Purpose |
|---------|-----|---------|
| API | http://localhost:5000 | Express backend |
| Web | http://localhost:3000 | Public site & shop |
| Admin | http://localhost:3001 | Admin portal |
| Customer | http://localhost:3002 | Customer portal |
| Finder | http://localhost:3003 | Finder page |

## Default Accounts

After seeding, these accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@pawtag.co.nz | PawTagAdmin2024! |
| Test Customer | john@example.com | TestPass123! |

## Environment Variables

Copy `packages/api/.env.example` to `packages/api/.env` and configure:

### Required

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for JWT signing (use a long random string) |

### Optional (have sensible defaults for local dev)

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_EXPIRES_IN` | Access token lifetime | `7d` |
| `STRIPE_SECRET_KEY` | Stripe API key (demo mode if unset) | — |
| `SMTP_*` | Email configuration (demo mode if unset) | — |
| `SMS_PROVIDER` | `demo` or `twilio` | `demo` |

See `packages/api/.env.example` for the full list.

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific suites
pnpm test:unit
pnpm test:integration
pnpm test:smoke

# Run with coverage
pnpm test:coverage

# Type-check all packages
pnpm typecheck
```

## Project Structure

```
PawTag/
├── packages/
│   ├── api/       → Express backend (port 5000)
│   ├── db/        → MongoDB models & connection
│   └── shared/    → Shared TypeScript types & validation
├── apps/
│   ├── admin/     → Admin portal (port 3001)
│   ├── web/       → Public site & shop (port 3000)
│   ├── customer/  → Customer portal (port 3002)
│   └── finder/    → Finder portal (port 3003)
├── tests/
│   ├── unit/      → Unit tests
│   ├── integration/ → Integration tests (MongoDB Memory Server)
│   └── smoke/     → API smoke tests
├── docker/        → Docker configurations
└── docs/          → Documentation
```

## Development Workflow

1. Create a feature branch from `main`
2. Make changes, ensure `pnpm typecheck` and `pnpm test` pass
3. Commit with a descriptive message
4. Push and create a pull request
5. CI runs tests automatically
6. Merge to `main` deploys to production (once CI/CD is configured)

## API Development

The API uses Express with:
- **Zod** for request validation
- **Mongoose** for MongoDB ODM
- **JWT + RBAC** for authentication/authorization
- **Helmet** for security headers
- **Rate limiting** for abuse prevention

Routes are in `packages/api/src/routes/`. Each route file handles a domain (auth, customer, admin, finder, etc.).

## Mobile App (React Native / Expo)

The mobile app lives in `apps/mobile` and uses React Native with Expo.

### Prerequisites
- **Expo CLI**: `npm install -g expo-cli` (or use `npx expo`)
- **Expo Go** app installed on your phone (from App Store / Google Play)
- For iOS development: Xcode (Mac only)
- For Android development: Android Studio

### Running the Mobile App

```bash
# Start the mobile app (requires API running on port 5000)
cd apps/mobile
npx expo start
```

Scan the QR code with your phone:
- **iPhone**: Open Camera app, point at QR code, tap the notification
- **Android**: Open Expo Go app, tap "Scan QR code"

The app will load and auto-refresh on code changes.

### Environment Variables

Create `apps/mobile/.env`:
```
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

For staging/production, set `EXPO_PUBLIC_API_URL` to the appropriate API URL.

### Architecture

- **Navigation**: React Navigation (stack navigator with auth gate)
- **Auth**: JWT tokens stored in `expo-secure-store` (encrypted, never AsyncStorage)
- **API Client**: Axios with automatic 401 → refresh token → retry interceptor
- **Design Tokens**: `src/theme/tokens.ts` (from DESIGN.md)
- **State Components**: `src/components/states/` (SkeletonLoader, Spinner, EmptyState, ErrorState, SuccessConfirmation)

## Frontend Development (Web)

Each web frontend is a **Vite + React + TypeScript + Tailwind CSS** application. They share:
- `packages/shared` for types and validation
- Similar project structure and conventions
- The same API client pattern (Axios with auth interceptors)

## Troubleshooting

### Port conflicts
If a port is already in use, stop the conflicting process or change the port in the app's `vite.config.ts`.

### Database connection
Ensure `MONGODB_URI` in `packages/api/.env` points to a valid MongoDB instance. For local development, you can use MongoDB Atlas free tier or a local MongoDB server.

### TypeScript errors
Run `pnpm typecheck` to see all type errors across the monorepo. The root `tsconfig.base.json` provides shared compiler options.
