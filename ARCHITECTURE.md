# PawTag — Architecture

## Overview

PawTag is a pet recovery platform using QR code and NFC tags. A pet owner purchases a tag, links it to their pet's profile, and when the pet is lost, anyone who finds it can scan the tag to notify the owner and facilitate a reunion.

## High-Level Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   apps/web   │  │ apps/admin  │  │apps/customer│  │ apps/finder │
│  Public Site │  │ Admin Portal│  │ Customer    │  │ Finder Page │
│  & Shop      │  │ (CRUD/RBAC) │  │ Portal      │  │ (Public)    │
│  :3000       │  │ :3001       │  │ :3002       │  │ :3003       │
└──────┬───────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                 │                │                 │
       └─────────────────┴────────────────┴─────────────────┘
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

A single Express API (`packages/api`) serves all clients — web, admin, customer portal, finder page, and the future mobile app. There is no API duplication; each client consumes the same endpoints with different permission levels.

- **Port 5000** in development
- JWT-based authentication with RBAC (role-based access control)
- Zod validation on all inputs
- Consistent `{ success, data?, error? }` response shape

## Four Web Frontends

Each frontend is a separate Vite + React + TypeScript + Tailwind CSS application, built and deployed independently. They are not merged because each serves a different audience with a different security posture:

| App | Port | Audience | Auth | Purpose |
|-----|------|----------|------|---------|
| `apps/web` | 3000 | Public | Optional | Marketing site, shop, checkout, account pages |
| `apps/admin` | 3001 | Staff | Admin RBAC | Full CRUD, dashboard, order management, CMS |
| `apps/customer` | 3002 | Pet owners | Customer | Pet management, orders, subscriptions, notifications |
| `apps/finder` | 3003 | Strangers | None | Public tag lookup — must be tiny and fast |

The finder page is intentionally kept minimal — it's the page a stressed stranger opens on their phone with poor signal to report a found pet. Bundling it with heavier apps would hurt the one interaction that matters most for reunions.

## Mobile Strategy — React Native (Expo)

A React Native (Expo) app will be built in `apps/mobile` for pet owners. It will:

- Import `packages/shared` directly for types, validation, and API client — no duplication of business logic
- Use the same JWT auth system (extended with refresh tokens)
- Provide native capabilities the web cannot: camera-based QR scanning, NFC tag activation, push notifications

The finder role gets **no app** — both NFC taps and QR scans open the existing `apps/finder` web page. The physical NFC chip is programmed to open the finder URL; no finder-side download is needed.

## Shared Package

`packages/shared` contains TypeScript types, validation schemas, and utility functions used by all clients. Changes to data models here propagate to every frontend at build time.

## Database

MongoDB Atlas with Mongoose ODM. 35+ models covering users, pets, tags, orders, subscriptions, invoices, notifications, CMS content, and more. See `docs/database-schema.md` for the full model reference.

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

| Service | Purpose |
|---------|---------|
| MongoDB Atlas | Database |
| Stripe | Payments, subscriptions |
| Postmark | Transactional email |
| Twilio | SMS/OTP |
| Cloudflare R2 | Object storage (photos, PDFs) |
| Sentry | Error tracking |
| Better Stack | Logging, uptime monitoring |
| Expo | Mobile push notifications |

## Environment Strategy

Three environments with complete separation:

- **Local** — `pnpm dev:all`, local MongoDB or memory server, Stripe test mode
- **Staging** — Separate Atlas cluster, Stripe test-mode account, deployed via `develop` branch
- **Production** — Separate Atlas cluster, Stripe live account, deployed via `main` branch
