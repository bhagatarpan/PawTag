# PawTag — Pet Recovery Platform

A comprehensive pet recovery platform using QR code and NFC tags. When a pet goes missing, anyone who finds it can scan the tag to notify the owner and facilitate a reunion.

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Application Architecture](#application-architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Database](#database)
- [Running the Application](#running-the-application)
- [Application Workflows](#application-workflows)
- [User Roles and Permissions](#user-roles-and-permissions)
- [Admin Portal](#admin-portal)
- [API Documentation](#api-documentation)
- [Authentication and Security](#authentication-and-security)
- [Testing](#testing)
- [Build](#build)
- [Deployment](#deployment)
- [Background Jobs and Scheduled Tasks](#background-jobs-and-scheduled-tasks)
- [Integrations](#integrations)
- [Notifications](#notifications)
- [Logging and Monitoring](#logging-and-monitoring)
- [Troubleshooting](#troubleshooting)
- [Development Guidelines](#development-guidelines)
- [Git Workflow](#git-workflow)
- [Known Limitations](#known-limitations)
- [Future Considerations](#future-considerations)

---

## Project Overview

PawTag is a pet recovery platform that solves the problem of reuniting lost pets with their owners. The platform uses QR code and NFC tags attached to pet collars. When a pet goes missing, anyone who finds it can scan the tag with their phone, which opens a finder portal where they can report the found pet and notify the owner.

**Primary Purpose:** Enable fast, reliable pet reunions through technology

**Target Users:**
- **Pet Owners:** Purchase tags, create pet profiles, manage health records, receive notifications when pets are found
- **Finders:** Scan QR/NFC tags to report found pets, share location, notify owners
- **Administrators:** Manage the platform, orders, products, users, and content

---

## Key Features

### Pet Recovery
- QR code and NFC tag scanning
- Real-time owner notifications
- Location sharing from finders
- 30-minute escalation system for unresponsive owners
- Emergency contact notification

### Pet Management
- Complete pet profiles (breed, color, photos, medical records)
- Vaccination tracking
- Microchip information
- Medication and allergy records
- Health conditions and surgery history
- Weight tracking

### E-Commerce
- Product catalog with variants
- Shopping cart and checkout
- Stripe payment processing
- Order lifecycle management
- Subscription management
- Invoice generation

### Mobile App (React Native/Expo)
- QR code scanning
- NFC tag activation
- Push notifications
- Offline-capable pet profiles
- Lost mode toggle

### Admin Portal
- Full CRUD for all entities
- Role-based access control (RBAC)
- Analytics dashboard
- CMS content management
- Order fulfillment
- Subscription management

### Security
- JWT authentication with refresh tokens
- Multi-factor authentication (email/phone OTP)
- Rate limiting (DB-driven, configurable)
- CAPTCHA protection
- Account lockout after failed attempts
- Enterprise audit logging with SHA-256 hash chain

---

## Application Architecture

```mermaid
flowchart TD
    subgraph Frontends
        Web["apps/web<br/>Public Site + Shop<br/>Customer Portal<br/>:3000"]
        Admin["apps/admin<br/>Admin Portal<br/>:3001"]
        Finder["apps/finder<br/>Finder Portal<br/>:3003"]
        Mobile["apps/mobile<br/>React Native App"]
    end

    subgraph Backend
        API["packages/api<br/>Express API<br/>:5000"]
    end

    subgraph Database
        MongoDB[(MongoDB Atlas)]
    end

    subgraph External Services
        Stripe["Stripe<br/>Payments"]
        Resend["Resend<br/>Email"]
        Twilio["Twilio<br/>SMS"]
        Firebase["Firebase<br/>Push Notifications"]
        R2["Cloudflare R2<br/>File Storage"]
        Sentry["Sentry<br/>Error Tracking"]
    end

    Web --> API
    Admin --> API
    Finder --> API
    Mobile --> API

    API --> MongoDB
    API --> Stripe
    API --> Resend
    API --> Twilio
    API --> Firebase
    API --> R2
    API --> Sentry
```

### One Backend

A single Express API (`packages/api`) serves all clients. There is no API duplication; each client consumes the same endpoints with different permission levels.

- **Port 5000** in development
- JWT-based authentication with RBAC
- Zod validation on all inputs
- Consistent `{ success, data?, error? }` response shape

### Frontends

| App | Port | Audience | Auth | Purpose |
|-----|------|----------|------|---------|
| `apps/web` | 3000 | Public/Pet owners | Optional | Marketing site, shop, checkout, auth, customer portal |
| `apps/admin` | 3001 | Staff | Admin RBAC | Full CRUD, dashboard, order management, CMS |
| `apps/finder` | 3003 | Strangers | None | Public tag lookup — must be tiny and fast |

The finder page is intentionally kept minimal — it's the page a stressed stranger opens on their phone with poor signal to report a found pet.

### Mobile App

The mobile app (`apps/mobile`) is a React Native (Expo) app for pet owners with:
- Camera-based QR scanning
- NFC tag activation
- Push notifications
- Secure token storage via `expo-secure-store`

---

## Technology Stack

### Backend
- **Runtime:** Node.js >= 18
- **Framework:** Express.js 4.18
- **Language:** TypeScript 5.5 (strict mode)
- **Database:** MongoDB Atlas with Mongoose 7
- **Authentication:** JWT (jsonwebtoken) + bcryptjs
- **Validation:** Zod 3.23
- **Rate Limiting:** express-rate-limit (DB-driven)
- **Security:** Helmet, CORS
- **Logging:** Pino, Morgan
- **Error Tracking:** Sentry

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite 5.4
- **Language:** TypeScript 5.5
- **Styling:** Tailwind CSS 3.4
- **Routing:** React Router v6
- **State Management:** React Context
- **HTTP Client:** Axios
- **Icons:** Lucide React

### Mobile
- **Framework:** React Native 0.81 (Expo SDK 54)
- **Navigation:** React Navigation 7
- **Camera:** expo-camera
- **NFC:** react-native-nfc-manager
- **Push Notifications:** expo-notifications
- **Secure Storage:** expo-secure-store

### Database
- **Database:** MongoDB Atlas
- **ODM:** Mongoose 7
- **Models:** 43+ models

### Package Management
- **Package Manager:** pnpm 9+
- **Monorepo:** pnpm workspaces

### Testing
- **Test Runner:** Vitest 4.1
- **API Testing:** Supertest
- **E2E Testing:** Maestro (mobile)

### Build & Deployment
- **Containerization:** Docker
- **Web Server:** Nginx (for frontend static files)
- **CI/CD:** GitHub Actions (pending)

---

## Repository Structure

```text
PawTag/
├── apps/
│   ├── admin/          → Admin portal (port 3001)
│   │   └── src/
│   │       ├── components/
│   │       ├── context/
│   │       ├── lib/
│   │       └── pages/
│   ├── finder/         → Finder portal (port 3003)
│   │   └── src/
│   │       └── components/
│   ├── mobile/         → React Native (Expo) app
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── context/
│   │   │   ├── screens/
│   │   │   └── theme/
│   │   ├── e2e/        → Maestro E2E tests
│   │   └── app.json
│   └── web/            → Public site, shop, auth & customer portal (port 3000)
│       └── src/
│           ├── components/
│           ├── context/
│           └── pages/
├── packages/
│   ├── api/            → Express backend (port 5000)
│   │   └── src/
│   │       ├── config/
│   │       ├── lib/
│   │       ├── middleware/
│   │       ├── routes/
│   │       ├── seeds/
│   │       └── services/
│   ├── db/             → MongoDB models & connection
│   │   └── src/
│   │       └── models/
│   ├── shared/         → Shared TypeScript types & validation
│   │   └── src/
│   └── ui/             → Shared React component library
│       └── src/
│           └── components/
├── tests/
│   ├── integration/    → Integration tests (MongoDB Memory Server)
│   ├── regression/     → Regression tests
│   ├── smoke/          → API smoke tests
│   └── unit/           → Unit tests
├── docker/             → Docker configurations
├── docs/               → Documentation
├── scripts/            → Build and utility scripts
├── ARCHITECTURE.md     → System architecture
├── DESIGN.md           → Design system
├── AGENTS.md           → AI development guide
└── package.json        → Root package.json
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `apps/*` | Frontend applications (web, admin, finder, mobile) |
| `packages/api` | Express backend with all routes, services, and middleware |
| `packages/db` | Mongoose models and database connection |
| `packages/shared` | TypeScript types, enums, and validation constants |
| `packages/ui` | Shared React components (DataTable, StatusBadge, etc.) |
| `tests/` | Test suites (unit, integration, smoke, regression) |
| `docker/` | Dockerfiles and docker-compose configuration |
| `docs/` | Documentation files |

---

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9 (install: `npm install -g pnpm`)
- **MongoDB Atlas** account (or local MongoDB for development)
- **Git**

### Optional (for full functionality)
- **Stripe account** (for payments)
- **Resend account** (for email)
- **Twilio account** (for SMS)
- **Cloudflare R2 account** (for file storage)
- **Sentry account** (for error tracking)

---

## Installation

```bash
# Clone the repository
git clone https://github.com/bhagatarpan/PawTag.git
cd PawTag

# Install all dependencies
pnpm install

# Set up environment variables
cp packages/api/.env.example packages/api/.env
# Edit packages/api/.env with your values (see Environment Configuration)

# Seed the database (creates default admin + test data)
cd packages/api && pnpm seed && cd ../..

# Start all services in parallel
pnpm dev:all
```

### Default Accounts (After Seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@pawtag.co.nz | PawTagAdmin2024! |
| Test Customer | john@example.com | TestPass123! |

---

## Environment Configuration

Copy `packages/api/.env.example` to `packages/api/.env` and configure:

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_URL` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/pawtag` |
| `JWT_SECRET` | Secret key for JWT signing (min 32 chars) | `your-random-secret-here` |

### Authentication & Sessions

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_ACCESS_EXPIRES_IN` | `30m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | `30` | Refresh token lifetime in days |

### Seed Credentials

| Variable | Default | Description |
|----------|---------|-------------|
| `BOOTSTRAP_ADMIN_EMAIL` | `admin@pawtag.co.nz` | Admin account email |
| `BOOTSTRAP_ADMIN_PASSWORD` | *(random if unset)* | Admin account password |
| `BOOTSTRAP_TEST_EMAIL` | `john@example.com` | Test customer email |

### Frontend URLs

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_URL` | `http://localhost:3000` | Public web app URL |
| `ADMIN_URL` | `http://localhost:3001` | Admin portal URL |
| `FINDER_URL` | `http://localhost:3003` | Finder page URL |
| `ALLOWED_ORIGINS` | `localhost:3000-3003` | Comma-separated CORS allowed origins |

### Payment (Stripe)

| Variable | Default | Description |
|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | *(demo mode)* | Stripe API secret key |

### Email (SMTP/Resend)

| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | `localhost` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_SECURE` | `false` | Use TLS for SMTP connection |
| `SMTP_USER` | *(empty)* | SMTP username |
| `SMTP_PASS` | *(empty)* | SMTP password |

### SMS (Twilio)

| Variable | Default | Description |
|----------|---------|-------------|
| `SMS_PROVIDER` | `demo` | `demo` (logs OTP to console) or `twilio` |
| `TWILIO_ACCOUNT_SID` | *(empty)* | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | *(empty)* | Twilio Auth Token |
| `TWILIO_FROM_NUMBER` | *(empty)* | Twilio phone number |

### Object Storage (Cloudflare R2)

| Variable | Default | Description |
|----------|---------|-------------|
| `R2_ACCESS_KEY_ID` | *(empty)* | R2 API access key ID |
| `R2_SECRET_ACCESS_KEY` | *(empty)* | R2 API secret access key |
| `R2_BUCKET_NAME` | *(empty)* | R2 bucket name |
| `R2_ENDPOINT` | *(empty)* | R2 endpoint URL |
| `R2_PUBLIC_URL` | *(empty)* | Public URL for serving uploaded files |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | API server port |
| `NODE_ENV` | `development` | `development`, `staging`, or `production` |
| `LOG_LEVEL` | `info` | Logging level: `silent`, `fatal`, `error`, `warn`, `info`, `debug`, `trace` |

### Monitoring

| Variable | Default | Description |
|----------|---------|-------------|
| `SENTRY_DSN` | *(empty)* | Sentry DSN for error tracking |

### Environment Strategy

| Environment | DB | Stripe | Email | SMS |
|-------------|-----|--------|-------|-----|
| **Local** | Local MongoDB or Atlas free tier | Test mode (`sk_test_...`) | Console logging | `demo` |
| **Staging** | Separate Atlas cluster | Test mode | Real SMTP (staging) | `demo` or Twilio |
| **Production** | Atlas paid tier with backups | Live mode (`sk_live_...`) | Real SMTP (production) | Twilio |

---

## Database

### MongoDB Atlas

PawTag uses MongoDB Atlas with Mongoose ODM. The database contains 43+ models covering:

- **Core Business:** Users, Pets, Tags, Orders, Products, Subscriptions, Invoices
- **Finder & Escalation:** FinderScan, LocationEvent, EscalationRecord
- **Notifications:** Notification, PushToken, TagExpiryNotification
- **Auth & Security:** RefreshToken, VerificationToken, InvoiceAccessToken
- **RBAC:** Role, Permission, PermissionGroup, PermissionScope, RolePermission, UserRole
- **CMS:** CmsPage, CmsNavigation, CmsFooter, CmsEmailTemplate, CmsSmsTemplate, CmsOnboarding, and more
- **Other:** Setting, FeatureFlag, Cart, ReferralCode, Referral, SupportRequest, AuditEvent

### Seeding

```bash
# Seed RBAC permissions and roles
cd packages/api && pnpm seed

# Seed CMS content and settings
cd packages/api && pnpm seed:cms

# Seed products
cd packages/api && pnpm seed:products
```

### Database Indexes

The database includes 120+ indexes for performance optimization. Key indexes include:
- User: email, phoneNumber, roles, status
- Pet: petId (unique), ownerId + deletedAt + createdAt
- Tag: tagId (unique), petId + deletedAt
- Order: orderNumber (unique), userId + createdAt
- Subscription: userId + tagId, status + currentPeriodEnd

See `docs/database-schema.md` for the full model reference.

---

## Running the Application

### Development Mode

```bash
# Start all services in parallel
pnpm dev:all

# Or start individual services
pnpm dev:api       # API on :5000
pnpm dev:admin     # Admin on :3001
pnpm dev:web       # Public site on :3000
pnpm dev:finder    # Finder on :3003
```

### Mobile App

```bash
# Start the mobile app (requires API running on port 5000)
cd apps/mobile
npx expo start
```

Scan the QR code with your phone:
- **iPhone:** Open Camera app, point at QR code, tap the notification
- **Android:** Open Expo Go app, tap "Scan QR code"

### Production Build

```bash
# Build all packages
pnpm build

# Build individual packages
pnpm build:api
pnpm build:admin
pnpm build:web
pnpm build:finder
```

### Production Start

```bash
# Start the API in production mode
cd packages/api
node dist/index.js
```

---

## Application Workflows

### Tag Recovery Flow

```mermaid
sequenceDiagram
    participant Owner
    participant Pet
    participant Tag
    participant Finder
    participant API
    participant OwnerNotification

    Owner->>Pet: Creates pet profile
    Owner->>Tag: Purchases and activates tag
    Tag->>API: Links tag to pet
    Pet->>Pet: Status set to "lost"
    Finder->>Tag: Scans QR/NFC tag
    Tag->>API: Opens finder portal
    Finder->>API: Submits contact info
    API->>OwnerNotification: Sends notification
    Owner->>Finder: Contacts finder
    Owner->>Pet: Status set to "safe"
```

### E-Commerce Flow

1. Browse shop → add to cart
2. Checkout → Stripe payment
3. Order confirmed → admin notified
4. Fulfillment → shipping label → tracking
5. Delivered → customer activates tag

### Order Lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> pending_payment : Card payment
    pending --> paid : Non-card payment
    pending --> cancelled : Admin cancel
    pending_payment --> paid : Stripe webhook
    pending_payment --> cancelled : Payment failed
    paid --> packing : Admin fulfillment
    paid --> cancelled : Admin cancel
    paid --> refunded : Admin refund
    packing --> shipped : Shipping label
    packing --> cancelled : Admin cancel
    shipped --> delivered : Mark delivered
    delivered --> refunded : Post-delivery refund
    cancelled --> [*]
    refunded --> [*]
```

### Escalation System

When a pet is found and the owner doesn't respond within 30 minutes:
1. `EscalationRecord` created with `escalationDeadline`
2. `escalation.service.ts` polls every 1 minute for overdue escalations
3. Emergency contact receives email + in-app notification
4. Owner can manually forward to emergency contact via dashboard

---

## User Roles and Permissions

### RBAC Model

PawTag implements Role-Based Access Control with the following hierarchy:

```mermaid
flowchart LR
    User["User"] --> UserRole["UserRole"]
    UserRole --> Role["Role"]
    Role --> RolePermission["RolePermission"]
    RolePermission --> Permission["Permission"]
    RolePermission --> PermissionScope["PermissionScope"]
    Permission --> PermissionGroup["PermissionGroup"]
```

### Available Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `SUPER_ADMIN` | Full system access | All resources, all scopes |
| `ADMIN` | Administrative access | Most resources, configurable scopes |
| `CUSTOMER_SERVICE` | Customer support | User management, orders, support |
| `WEBSITE_EDITOR` | Content management | CMS content, pages, navigation |
| `CUSTOMER` | Pet owner | Own pets, orders, subscriptions |

### Permission Structure

Permissions follow the pattern `resource.action` with optional scope:

- **Resource:** The entity being accessed (e.g., `users`, `pets`, `orders`)
- **Action:** The operation (e.g., `create`, `read`, `update`, `delete`)
- **Scope:** `OWN` (own records only) or `ALL` (all records)

### Key Permissions

| Permission | Description |
|------------|-------------|
| `users.create` | Create new users |
| `users.read` | View user details |
| `users.update` | Update user information |
| `users.delete` | Delete users |
| `pets.create` | Create pet profiles |
| `pets.read` | View pet details |
| `pets.update` | Update pet information |
| `pets.delete` | Delete pets |
| `orders.create` | Create orders |
| `orders.read` | View order details |
| `orders.update` | Update order status |
| `products.create` | Create products |
| `products.read` | View products |
| `products.update` | Update products |
| `settings.read` | View system settings |
| `settings.update` | Update system settings |

### Super Admin Bypass

Roles with `isSuperAdmin: true` bypass all permission checks entirely.

---

## Admin Portal

The Admin Portal is the operational control centre of the application. It provides full CRUD operations for all entities with RBAC enforcement.

### Available Administrative Areas

| Area | Purpose |
|------|---------|
| **Dashboard** | Analytics overview (revenue, orders, tags, scans, reunions) |
| **Users** | User management with role assignments |
| **Pets** | Pet profile management |
| **Tags** | Tag management, NFC writing, activation |
| **Products** | Product catalog with variants and subscriptions |
| **Orders** | Order fulfillment, shipping, refunds |
| **Subscriptions** | Subscription lifecycle management |
| **Invoices** | Invoice generation and access |
| **CMS Pages** | Content pages with versioning and rollback |
| **CMS Navigation** | Header, footer, sidebar navigation |
| **CMS Email Templates** | Email template management |
| **CMS SMS Templates** | SMS template management |
| **CMS Onboarding** | Onboarding wizard configuration |
| **CMS Homepage** | Homepage sections management |
| **CMS Shop Pages** | Shop page content |
| **CMS Auth Pages** | Login/register page customization |
| **CMS Pet References** | Pet breed, color, pattern reference data |
| **CMS Announcements** | Banner and popup announcements |
| **CMS Media** | Media library management |
| **CMS Redirects** | URL redirect management |
| **Feature Flags** | Feature flag management |
| **Settings** | System configuration (DB-driven) |
| **Audit Trail** | Enterprise audit logging with hash chain |
| **Support** | Support request management |
| **Roles & Permissions** | RBAC configuration |

### Admin Portal Features

- Full CRUD operations on all entities
- Role-based access control
- Audit logging for all admin actions
- Toast notifications for user feedback
- Search, filtering, and pagination
- Detail drawers for entity inspection
- Confirmation dialogs for destructive actions
- Responsive design

---

## API Documentation

### Base Path

```
http://localhost:5000/api
```

### API Documentation (Swagger)

```
http://localhost:5000/api/docs
```

### Response Format

All API responses follow the format:

```json
{
  "success": true,
  "data": { ... }
}
```

or on error:

```json
{
  "success": false,
  "error": "Error message"
}
```

### Major Endpoints

#### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new user | No |
| POST | `/login` | User login | No |
| POST | `/verify-email` | Verify email address | No |
| POST | `/verify-phone` | Verify phone number | No |
| POST | `/forgot-password` | Request password reset | No |
| POST | `/reset-password` | Reset password | No |
| POST | `/refresh-token` | Refresh access token | No |
| POST | `/mfa/send-otp` | Send MFA OTP | No |
| POST | `/mfa/verify` | Verify MFA OTP | No |
| GET | `/captcha` | Get CAPTCHA challenge | No |
| GET | `/me` | Get current user | Yes |

#### Customer (`/api/customer`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/pets` | List user's pets | Yes |
| POST | `/pets` | Create pet | Yes |
| GET | `/pets/:petId` | Get pet details | Yes |
| PUT | `/pets/:petId` | Update pet | Yes |
| DELETE | `/pets/:petId` | Delete pet | Yes |
| GET | `/tags` | List user's tags | Yes |
| POST | `/tags/redeem` | Activate a tag | Yes |
| GET | `/orders` | List user's orders | Yes |
| GET | `/orders/:orderNumber` | Get order details | Yes |
| POST | `/orders/:orderNumber/confirm-payment` | Confirm demo payment | Yes |
| GET | `/subscriptions` | List user's subscriptions | Yes |
| POST | `/subscriptions/:id/cancel` | Cancel subscription | Yes |
| PUT | `/settings/mfa` | Toggle MFA | Yes |
| GET | `/notifications` | List notifications | Yes |
| PUT | `/notifications/:id/read` | Mark notification read | Yes |
| POST | `/escalations/:id/forward` | Forward to emergency contact | Yes |

#### Admin (`/api/admin`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users` | List all users | Yes (RBAC) |
| GET | `/users/:id` | Get user details | Yes (RBAC) |
| PUT | `/users/:id` | Update user | Yes (RBAC) |
| PUT | `/users/:id/status` | Update user status | Yes (RBAC) |
| GET | `/pets` | List all pets | Yes (RBAC) |
| GET | `/pets/:id` | Get pet details | Yes (RBAC) |
| GET | `/tags` | List all tags | Yes (RBAC) |
| GET | `/products` | List all products | Yes (RBAC) |
| POST | `/products` | Create product | Yes (RBAC) |
| PUT | `/products/:id` | Update product | Yes (RBAC) |
| DELETE | `/products/:id` | Delete product | Yes (RBAC) |
| GET | `/orders` | List all orders | Yes (RBAC) |
| GET | `/orders/:orderNumber` | Get order details | Yes (RBAC) |
| PUT | `/orders/:orderNumber/status` | Update order status | Yes (RBAC) |
| POST | `/orders/:orderNumber/ship` | Ship order | Yes (RBAC) |
| POST | `/orders/:orderNumber/cancel` | Cancel order | Yes (RBAC) |
| POST | `/orders/:orderNumber/refund` | Refund order | Yes (RBAC) |
| GET | `/analytics/overview` | Dashboard analytics | Yes (RBAC) |

#### Finder (`/api/finder`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/tags/:tagId` | View pet information | No* |
| POST | `/tags/:tagId/notify` | Notify owner | No* |
| POST | `/tags/:tagId/location` | Share location | No* |
| GET | `/tags/:tagId/found-timer` | Get found timer status | No |
| POST | `/tags/:tagId/reminders` | Set reminders | No |

*Rate-limited and CAPTCHA-protected in production

#### Public CMS (`/api/public/cms`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/pages/:slug` | Get page content | No |
| GET | `/navigation` | Get navigation | No |
| GET | `/footer` | Get footer | No |
| GET | `/settings` | Get public settings | No |
| GET | `/announcements` | Get active announcements | No |
| GET | `/homepage` | Get homepage sections | No |
| GET | `/onboarding` | Get onboarding config | No |

---

## Authentication and Security

### Authentication Mechanism

PawTag uses JWT-based authentication with refresh tokens:

- **Access Token:** Short-lived (30 minutes), contains `{ id, email, role }`
- **Refresh Token:** Long-lived (30 days), stored in database, rotated on each use
- **Token Storage:** localStorage (web), expo-secure-store (mobile)

### Token Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB

    Client->>API: POST /auth/login
    API->>DB: Verify credentials
    API->>Client: { accessToken, refreshToken }
    
    Client->>API: GET /resource (with accessToken)
    API->>API: Verify JWT
    API->>Client: { data }
    
    Note over Client,API: When accessToken expires...
    
    Client->>API: POST /auth/refresh-token
    API->>DB: Verify refresh token
    API->>Client: { new accessToken, new refreshToken }
```

### Security Measures

- **Password Hashing:** bcrypt with 12 salt rounds
- **JWT Signing:** HS256 with configurable secret
- **Rate Limiting:** DB-driven, configurable per endpoint
- **CAPTCHA:** Math-based, required after 2+ failed login attempts
- **Account Lockout:** After 5 failed attempts, locked for 30 minutes
- **MFA:** Email/phone OTP, configurable per role
- **CORS:** Origin allowlisting
- **Security Headers:** Helmet (CSP, CORP disabled for dev)
- **Input Validation:** Zod schemas on all endpoints
- **Audit Logging:** SHA-256 hash chain for tamper evidence

### Dev-Time Email Routing

In development, when `mfa.testMode` is `true` (default via seed):
- Registration/email-verification links → sent to test email (`mfa.testEmail`)
- Login MFA OTPs → sent to test email
- Phone (SMS) OTPs → printed in API terminal + emailed to test email

This allows registration with any email while receiving links/codes in a real inbox.

---

## Testing

### Test Structure

```text
tests/
├── unit/              → Unit tests
├── integration/       → Integration tests (MongoDB Memory Server)
├── smoke/             → API smoke tests
├── regression/        → Regression tests
└── setup.ts           → Test setup
```

### Test Commands

```bash
# Run all tests
pnpm test

# Run specific suites
pnpm test:unit
pnpm test:integration
pnpm test:smoke
pnpm test:regression

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch
```

### Test Configuration

- **Test Runner:** Vitest 4.1
- **Test Environment:** Node.js
- **Database:** MongoDB Memory Server (in-memory)
- **Coverage Provider:** v8
- **Coverage Thresholds:** 15% lines, 15% functions, 10% branches, 15% statements

### Test Statistics

- **Test Files:** 54
- **Tests:** 799 passing
- **Duration:** ~38 seconds

---

## Build

### Build Commands

```bash
# Build all packages
pnpm build

# Build individual packages
pnpm build:api
pnpm build:admin
pnpm build:web
pnpm build:finder

# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint
```

### Build Output

- **API:** Compiled to `packages/api/dist/`
- **Admin:** Compiled to `apps/admin/dist/`
- **Web:** Compiled to `apps/web/dist/`
- **Finder:** Compiled to `apps/finder/dist/`

### Build Verification

```bash
# Run build and verify no errors
pnpm build

# Run type-check
pnpm typecheck

# Run lint
pnpm lint

# Run tests
pnpm test
```

---

## Deployment

### Docker Deployment

```bash
# Build and start all services
docker-compose -f docker/docker-compose.yml up -d

# Build individual services
docker-compose -f docker/docker-compose.yml build api
docker-compose -f docker/docker-compose.yml build web
docker-compose -f docker/docker-compose.yml build admin
docker-compose -f docker/docker-compose.yml build finder
```

### Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| api | 5000 | Express backend |
| web | 3000 | Public site |
| admin | 3001 | Admin portal |
| finder | 3003 | Finder portal |

### Production Deployment (Pending)

Production deployment requires:

1. **Render account** for API hosting
2. **Vercel account** for frontend hosting
3. **MongoDB Atlas** production cluster
4. **Stripe** live-mode account
5. **Resend/Twilio** production accounts
6. **Cloudflare R2** bucket for file storage
7. **Sentry** project for error tracking

### Deployment Architecture

```mermaid
flowchart TD
    subgraph Frontend
        Vercel["Vercel<br/>(Web, Admin, Finder)"]
    end
    
    subgraph Backend
        Render["Render<br/>(API)"]
    end
    
    subgraph Database
        Atlas["MongoDB Atlas"]
    end
    
    subgraph Services
        Stripe["Stripe"]
        Resend["Resend"]
        Twilio["Twilio"]
        R2["Cloudflare R2"]
        Sentry["Sentry"]
    end
    
    Vercel --> Render
    Render --> Atlas
    Render --> Stripe
    Render --> Resend
    Render --> Twilio
    Render --> R2
    Render --> Sentry
```

---

## Background Jobs and Scheduled Tasks

### Scheduled Services

| Service | Interval | Purpose |
|---------|----------|---------|
| `startReminderService()` | 1 hour | Finder reminders (24h after scan) + onboarding nudges |
| `startSubscriptionService()` | 1 minute | Subscription expiry checks, grace period transitions, auto-renewal |
| `startEscalationService()` | 1 minute | Overdue escalation detection (30-min deadline after pet found) |
| `startLowStockService()` | 24 hours (1h initial delay) | Low stock alerts via email + in-app notification to admin |

### Job Behavior

- **Retry:** Jobs run on fixed intervals, no retry logic
- **Failure Handling:** Jobs log errors and continue on next interval
- **Concurrency:** Jobs run in the main process, no separate workers

---

## Integrations

### Stripe (Payments)

- **Purpose:** Payment processing, subscriptions, customer portal
- **Communication:** REST API + Webhooks
- **Authentication:** API key (`STRIPE_SECRET_KEY`)
- **Failure Impact:** **Critical** — no purchases or subscriptions
- **Demo Mode:** Fallback when key not set

### Resend (Email)

- **Purpose:** Transactional email (verification, notifications, invoices)
- **Communication:** REST API
- **Authentication:** API key
- **Failure Impact:** **High** — emails logged to console
- **Dev Mode:** Sends from `onboarding@resend.dev`

### Twilio (SMS)

- **Purpose:** Phone verification OTP
- **Communication:** REST API
- **Authentication:** Account SID + Auth Token
- **Failure Impact:** **Medium** — OTP falls back to demo mode (logged to console)

### Firebase (Push Notifications)

- **Purpose:** Push notifications to mobile and web
- **Communication:** Firebase Cloud Messaging
- **Authentication:** Service account key
- **Failure Impact:** **Medium** — push notifications fail silently

### Cloudflare R2 (File Storage)

- **Purpose:** Pet photos, product images, PDFs
- **Communication:** S3-compatible API
- **Authentication:** Access key + Secret key
- **Failure Impact:** **Low** — falls back to local disk in dev

### Sentry (Error Tracking)

- **Purpose:** Error tracking and performance monitoring
- **Communication:** Sentry SDK
- **Authentication:** DSN
- **Failure Impact:** **Low** — errors only visible in server logs

---

## Notifications

### Notification Types

| Type | Trigger | Channels |
|------|---------|----------|
| `pet_lost` | Owner marks pet as lost | In-app, Push, Email |
| `pet_found` | Finder reports found pet | In-app, Push, Email |
| `finder_scan` | Finder scans tag | In-app, Push |
| `order_update` | Order status changes | In-app, Push, Email |
| `system` | System announcements | In-app |
| `finder_reminder` | 24h after finder scan | In-app, Email |
| `subscription_expiring` | Subscription expiring | In-app, Email |
| `referral_reward` | Referral bonus | In-app, Email |
| `tag_expiry_warning` | Tag expiring | In-app, Email |
| `new_order` | New order placed | In-app, Email (admin) |

### Notification Delivery

The `notification-delivery.service.ts` handles unified delivery:
1. Creates in-app notification record
2. Optionally sends push notification (if user has push token)
3. Optionally sends email (if user has email notifications enabled)
4. Respects user notification preferences

### User Notification Preferences

```typescript
{
  email: true,
  push: true,
  inApp: true,
  channels: {
    petFound: true,
    orderUpdate: true,
    subscriptionReminder: true,
    referral: true,
    marketing: false
  }
}
```

---

## Logging and Monitoring

### Application Logging

- **API Logging:** Pino (structured JSON logging)
- **HTTP Logging:** Morgan (request/response logging)
- **Log Levels:** `silent`, `fatal`, `error`, `warn`, `info`, `debug`, `trace`

### Audit Logging

Enterprise-grade audit system with:
- **SHA-256 hash chain:** Each event links to the previous via `previousEventHash`
- **UUIDv7 event IDs:** Time-sortable
- **Actor types:** USER, ADMIN, CSR, WEB_EDITOR, SERVICE, SYSTEM, FINDER, etc.
- **Event categories:** AUTH, CREATE, UPDATE, DELETE, READ, EXPORT, FINANCIAL, SECURITY, etc.
- **Severity levels:** INFO, LOW, MEDIUM, HIGH, CRITICAL
- **Sensitive field redaction:** Passwords, tokens, API keys automatically redacted
- **Policy engine:** Configurable per-category and per-actor toggles
- **Retention policies:** Configurable per category (90 days standard, 7 years for auth/financial)
- **Legal holds:** Place/remove holds on specific events

### Error Tracking

- **Sentry:** Initialized in production, captures errors with context
- **Health Check:** `GET /health` endpoint for uptime monitoring

---

## Troubleshooting

### Port Conflicts

If a port is already in use, stop the conflicting process or change the port in the app's `vite.config.ts`.

### Database Connection

Ensure `DB_URL` in `packages/api/.env` points to a valid MongoDB instance. For local development, use MongoDB Atlas free tier or a local MongoDB server.

### TypeScript Errors

Run `pnpm typecheck` to see all type errors across the monorepo. The root `tsconfig.base.json` provides shared compiler options.

### Build Failures

1. Clean node_modules: `pnpm clean`
2. Reinstall dependencies: `pnpm install`
3. Run typecheck: `pnpm typecheck`
4. Run build: `pnpm build`

### Test Failures

1. Ensure MongoDB Memory Server is running (should be automatic)
2. Check for port conflicts
3. Run specific test suite: `pnpm test:integration`

### Email Not Sending

- Check `SMTP_*` environment variables
- In development, emails are logged to console
- Verify Resend API key if using Resend

### SMS Not Sending

- Check `SMS_PROVIDER` is set to `twilio` (not `demo`)
- Verify Twilio credentials
- In demo mode, OTPs are printed in console

---

## Development Guidelines

### Code Conventions

- **TypeScript:** Strict mode enabled
- **Formatting:** Prettier (semi, trailing comma, single quotes, 100 char width)
- **Linting:** ESLint with TypeScript plugin
- **Imports:** Absolute imports using `@pawtag/*` aliases
- **Naming:** camelCase for variables/functions, PascalCase for components/classes

### Database Conventions

- **Model Files:** `packages/db/src/models/ModelName.ts`
- **Schema Fields:** Use `required`, `default`, `enum`, `min`, `max` validators
- **Indexes:** Define in schema with `{ index: true }` or `schema.index()`
- **Soft Deletes:** Use `deletedAt` field instead of hard deletes
- **Timestamps:** Enable `createdAt` and `updatedAt` where appropriate

### API Conventions

- **Route Files:** `packages/api/src/routes/routeName.ts`
- **Response Format:** `{ success: boolean, data?: any, error?: string }`
- **Validation:** Zod schemas in `middleware/schemas.ts`
- **Authentication:** `authenticate` middleware for protected routes
- **Authorization:** `requirePermission('resource.action')` middleware
- **Audit Logging:** Automatic via `audit.ts` middleware

### Frontend Conventions

- **Component Files:** PascalCase filenames (e.g., `UserProfile.tsx`)
- **Page Files:** PascalCase with `Page` suffix (e.g., `DashboardPage.tsx`)
- **Context Files:** PascalCase with `Context` suffix (e.g., `AuthContext.tsx`)
- **Styling:** Tailwind CSS utility classes
- **State Management:** React Context for global state

### Testing Conventions

- **Test Files:** `*.test.ts` or `*.test.tsx`
- **Test Location:** Colocated with source or in `tests/` directory
- **Test Structure:** Describe/It blocks with clear descriptions
- **Mocking:** Use `vi.mock()` for module mocking
- **Database Tests:** Use MongoDB Memory Server

---

## Git Workflow

### Branch Strategy

- `main` — Production-ready code
- `develop` — Development integration branch
- `feature/*` — Feature branches
- `fix/*` — Bug fix branches
- `release/*` — Release preparation branches

### Commit Conventions

Use conventional commits:

```
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting changes
refactor: code refactoring
test: adding tests
chore: maintenance tasks
```

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes, ensure `pnpm typecheck` and `pnpm test` pass
3. Commit with descriptive message
4. Push and create pull request
5. CI runs tests automatically
6. Review and merge to `develop`
7. `develop` merges to `main` for production deployment

---

## Known Limitations

### Current Limitations

1. **Token Storage:** JWT tokens stored in localStorage (vulnerable to XSS)
   - See `docs/security_improvement.md` for improvement plan
2. **Password Rules:** Minimum 8 characters (industry best practice is 12+)
3. **No HIBP Integration:** Breached passwords not checked
4. **Rate Limiting:** Per-process in-memory (not Redis-backed for multi-instance)
5. **E2E Tests:** Playwright E2E tests not implemented
6. **Frontend Sentry:** API-side Sentry done, frontend error boundaries pending

### Pending Implementation

1. **CI/CD Pipeline:** Requires Render/Vercel accounts (Phase 16)
2. **E2E Tests:** Playwright test suite (Phase 21)
3. **Frontend Sentry:** Error boundaries for all frontend apps
4. **Affiliate Marketplace:** Phases 27-32 not started

### Technical Debt

- Legacy `role: string` field on User model (being replaced by RBAC)
- Some hardcoded values that should be DB-driven
- Missing IP-based rate limiting on some auth endpoints

---

## Future Considerations

### Planned Features (Phases 27-32)

- Affiliate marketplace with Amazon Associates integration
- Affiliate storefront with browse and product pages
- Click tracking and redirect service
- Conversion and commission ingestion

### Potential Improvements

- Migrate JWT tokens to httpOnly cookies
- Add HIBP integration for breached password checking
- Add Redis-backed rate limiting for multi-instance deployment
- Add TOTP (authenticator app) support for MFA
- Implement E2E test suite with Playwright

---

## License

Not currently documented / unable to determine from the repository.

---

## Documentation

| Document | Purpose |
|----------|---------|
| `ARCHITECTURE.md` | System architecture overview |
| `DESIGN.md` | Design system |
| `AGENTS.md` | AI development guide |
| `docs/developer-setup.md` | Local development setup |
| `docs/environments.md` | Environment variable reference |
| `docs/database-schema.md` | All 43+ Mongoose models |
| `docs/business-workflows.md` | Business logic flows |
| `docs/security_improvement.md` | Security audit and improvement plan |
| `docs/launch-checklist.md` | Pre-launch verification |
| `docs/disaster-recovery.md` | Infrastructure failure recovery |
| `docs/support-runbook.md` | Customer support procedures |
| `docs/mobile-ux-audit.md` | Mobile UX quality audit |
| `docs/release-process.md` | How to ship safely |
| `docs/rollback.md` | How to undo deployments |
| `docs/deployment/staging.md` | Staging deployment guide |
| `docs/deployment/production.md` | Production deployment guide |
| `docs/deployment/mobile-release.md` | Mobile app store submission |
