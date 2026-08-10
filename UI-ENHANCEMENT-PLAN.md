# PawTag UI Enhancement Plan — Enterprise Upgrade

## Overview

Comprehensive UI/UX upgrade across all PawTag frontends to achieve enterprise-grade quality.
The Audit Trail screen (`apps/admin/src/pages/AuditTrail.tsx`) was the first page rewritten and
serves as the gold standard for all subsequent work.

## Architecture

| App | Port | Purpose | Framework |
|-----|------|---------|-----------|
| Admin | 3001 | Internal operations (20+ pages) | React + Tailwind + lucide |
| Web | 3000 | Public site + customer portal (28 pages) | React + Tailwind + Puck CMS |
| Finder | 3003 | Lost pet recovery (1 page) | React + Tailwind |
| Mobile | Expo | Native app | React Native |

**Shared tech stack:** React 18, TypeScript, Tailwind CSS, lucide-react, Axios

## Design System

- **Primary palette:** teal (`#0d9488` 600, `#14b8a6` 500, `#0f766e` 700)
- **Icons:** lucide-react
- **API pattern:** `{ success, data?, error? }`
- **Auth:** JWT in localStorage
- **No existing shared UI library** — this is the gap Phase 0 addresses

---

## Phase 0: Shared Component Library (`packages/ui`)

**Status:** `completed`

### Goal
Create a reusable component library that all apps can import, ensuring visual consistency
and eliminating duplicated UI code.

### Components

| Component | Description | Files |
|-----------|-------------|-------|
| `SummaryCards` | Metric card grid with clickable filters | `SummaryCards.tsx` |
| `DataTable` | Table with skeleton, empty, error, responsive columns | `DataTable.tsx` |
| `DetailDrawer` | Right-side slide-in panel with tabs | `DetailDrawer.tsx` |
| `FilterChips` | Active filter chip display with Clear All | `FilterChips.tsx` |
| `SearchBar` | Prominent search with debounce/instant modes | `SearchBar.tsx` |
| `Pagination` | Modern pagination with page size selector | `Pagination.tsx` |
| `EmptyState` | Icon + message + action button | `EmptyState.tsx` |
| `ErrorState` | Error message with retry | `ErrorState.tsx` |
| `SkeletonTable` | Animated table row placeholders | `SkeletonTable.tsx` |
| `StatusBadge` | Color-coded status pill | `StatusBadge.tsx` |
| `ConfirmDialog` | Confirmation modal (replaces `window.confirm`) | `ConfirmDialog.tsx` |

### Infrastructure

| File | Purpose |
|------|---------|
| `packages/ui/package.json` | Package definition with peer deps |
| `packages/ui/tsconfig.json` | TypeScript config |
| `packages/ui/src/index.ts` | Barrel exports |
| `packages/ui/src/types.ts` | Shared TypeScript interfaces |
| `packages/ui/tailwind-preset.js` | Shared Tailwind config preset |
| `packages/ui/README.md` | Usage documentation |

### Verification
- [x] All components compile with TypeScript strict mode
- [x] All apps can import from `@pawtag/ui`
- [x] Admin build passes
- [x] Web build passes
- [x] Finder build passes
- [x] Existing tests still pass

---

## Phase 1: Admin — Users Page

**Status:** `completed`

### Current State
- 438 lines, 10-column dense table
- Modal-only edit, `alert()` errors
- Basic search (form submit), role filter dropdown
- "Loading..." text, "No users found" text

### Target State

| Feature | Detail |
|---------|--------|
| Summary cards | Total Users, Active, Suspinated, Pending Verification, Locked |
| Search | Debounced instant search (name, email, phone) |
| Filters | Status dropdown + Role dropdown + Filter chips |
| Table | Responsive: hide Phone/Score/OTP on smaller screens |
| Detail drawer | Click row → right panel: Profile, RBAC roles, linked pets, recent orders, MFA status |
| Actions | Edit, role assign, reset password, lock/unlock, soft-delete — from drawer |
| Loading | Skeleton rows |
| Empty | "No users found" with icon + Clear Filters |
| Error | "Couldn't load users. Try Again." |
| Export | CSV export of filtered results |
| Pagination | Page size selector (25/50/100), "Showing X–Y of Z" |

### Backend Changes
- `GET /admin/users/summary` — counts by status
- `GET /admin/users/export` — CSV/JSON

### Verification
- [x] Typecheck passes
- [x] Build passes
- [ ] All existing tests pass
- [ ] New summary/export endpoints tested

---

## Phase 2: Admin — Pets Page

**Status:** `completed`

### Goal
Rewrite `apps/admin/src/pages/Pets.tsx` with enterprise-grade UX.

### Current State
- 498 lines, 14-column extremely dense table
- Inline form edit, 9 filters
- No summary, no skeleton, no export

### Target State

| Feature | Detail |
|---------|--------|
| Summary cards | Total Pets, Lost, Found, Safe, by Pet Type |
| Search | Full-text (name, breed, petId, owner name/email) |
| Filters | Pet Type, Status, Breed, Color, Owner — with chips |
| Table | Responsive: hide Breed/Origin/2nd Breed/Color on smaller screens |
| Detail drawer | Pet profile, photos carousel, linked tag, owner info, health summary, lost history |
| Actions | Edit, status change, delete — from drawer |
| Loading | Skeleton rows with photo placeholders |
| Empty | "No pets found" with icon + Clear Filters |
| Error | "Couldn't load pets. Try Again." |
| Export | CSV export |
| Pagination | Page size selector |

### Backend Changes
- `GET /admin/pets/summary` — counts by status and type
- `GET /admin/pets/export` — CSV/JSON
- `GET /admin/pets/:id/activity` — status change timeline

### Verification
- [ ] Typecheck passes
- [ ] Build passes
- [ ] All existing tests pass

---

## Phase 3: Admin — Tags + Products + Orders Pages

**Status:** `completed`

### Goal
Enhance all three admin entity pages to enterprise quality.

### Tags Enhancements
- Summary cards: Total, Active, QR, NFC, Lost, Expiring Soon
- Detail drawer: Tag info, linked pet, owner, subscription status, scan history, QR preview
- Show subscription status in table
- Time-ago for last scanned
- Toast feedback on copy actions

### Products Enhancements
- Summary cards: Total, Active, Low Stock, Total Inventory Value
- Detail drawer: Full product info, images gallery, variants table, stock levels
- Filter chips (not just count)
- Stock level visual indicator

### Orders Enhancements
- Summary cards: Total, Pending, Paid, Shipped, Delivered
- Detail drawer: Order Info (details, invoice, actions), Items table, Shipping & Payment tabs
- Status transition buttons (Start Packing, Create Shipment, Mark Delivered, Cancel, Refund)
- Invoice actions: View, Email, Print
- CSV export
- Filter chips for status and search

### Backend Changes
- `GET /admin/tags/summary`
- `GET /admin/products/summary`

### Verification
- [ ] Typecheck passes
- [ ] Build passes
- [ ] All existing tests pass

---

## Phase 4: Customer Portal (Web Account Pages)

**Status:** `completed`

### Goal
Upgrade customer portal with enterprise UX patterns.

### What Was Done

| Page | Key Enhancements |
|------|-----------------|
| **Dashboard** (NEW) | Summary cards (Pets, Lost, Tags, Subscriptions, Notifications), quick actions grid, recent orders/pets/subscriptions/notifications panels |
| **Settings** (REWRITTEN) | Account info with status badges, MFA toggle, change password link, notification preferences link, data export, delete account with confirmation |
| **Orders** (UPGRADED) | @pawtag/ui StatusBadge with icons, skeleton loading, error state with retry, EmptyState |
| **Notifications** (UPGRADED) | @pawtag/ui EmptyState, typed interfaces, skeleton loading, better visual hierarchy |
| **Types** | Added Pet, Tag, Subscription, Notification, DashboardData interfaces |

### Routing Changes
- `/account` → Dashboard (was MyPets)
- `/account/pets` → MyPets (new route)
- Sidebar updated with Dashboard nav item

### Verification
- [x] Typecheck passes
- [x] Build passes

---

## Phase 5: Public Website (Marketing Pages)

**Status:** `pending`

### Goal
Polish public-facing pages for conversion and brand quality.

### Pages

| Page | Key Enhancements |
|------|-----------------|
| Shop | Better product cards, comparison table polish, stock indicators |
| ProductDetail | Image gallery polish, variant selector, related products |
| Checkout | Progress indicator, order summary sidebar |
| Home | Hero slider performance, engagement ticker animation |
| Login/Register | Form validation feedback, password strength indicator |
| Contact | Form submission states, success confirmation |

### Verification
- [ ] Typecheck passes
- [ ] Build passes
- [ ] All existing tests pass

---

## Phase 6: Finder Portal

**Status:** `pending`

### Goal
Refactor the monolithic finder page into maintainable components with better UX.

### Current State
- Single 435-line `App.tsx`
- Functional but monolithic

### Target State

| Feature | Detail |
|---------|--------|
| Component extraction | StatusBanner, PhotoCarousel, PetDetails, NotifyForm, LocationConsent, FoundTimer |
| Loading | Skeleton card instead of spinner |
| Error | Better "Tag Not Found" page with scan instructions |
| SEO | Open Graph tags, meta description, structured data |
| Accessibility | aria-labels, focus management, keyboard navigation |
| Offline | Service worker for cached pet info |

### Verification
- [ ] Typecheck passes
- [ ] Build passes
- [ ] All existing tests pass

---

## Progress Tracker

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 0: Shared UI Library | `completed` | 2026-08-10 | 2026-08-10 |
| Phase 1: Admin Users | `completed` | 2026-08-10 | 2026-08-10 |
| Phase 2: Admin Pets | `completed` | 2026-08-10 | 2026-08-10 |
| Phase 3: Admin Tags + Products + Orders | `completed` | 2026-08-10 | 2026-08-10 |
| Phase 4: Customer Portal | `completed` | 2026-08-10 | 2026-08-10 |
| Phase 5: Public Website | `pending` | — | — |
| Phase 6: Finder Portal | `pending` | — | — |

---

## Estimated Effort

| Phase | Days |
|-------|------|
| Phase 0 | 3-4 |
| Phase 1 | 2-3 |
| Phase 2 | 3-4 |
| Phase 3 | 2-3 |
| Phase 4 | 3-4 |
| Phase 5 | 2-3 |
| Phase 6 | 2-3 |
| **Total** | **17-24** |
