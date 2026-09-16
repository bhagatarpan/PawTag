# PawTag Classic Subscription Lifecycle — Implementation Tracker

**Feature Branch:** `feature/pawtag-classic-subscription-lifecycle`
**Created:** 2026-09-17
**Status:** Complete

---

## Business Model

- **PawTag Classic Product:** $20.99 (one-time physical tag)
- **Includes:** 3 months FREE PawTag Classic subscription
- **After free period:** $1.99/month
- **Auto-renew:** Toggle at checkout (default ON)
- **Grace period:** 1 month after free period ends
- **Expired:** Tag cannot be renewed — must buy new tag

---

## Progress

| Phase | Description | Status | Commit | Date |
|-------|-------------|--------|--------|------|
| 0 | Audit documentation | ✅ Complete | (previous) | 2026-09-17 |
| 1 | Delete CMS pricing settings + fix pricing source | ✅ Complete | `b4c1f2c` | 2026-09-17 |
| 2 | Fix tag seeding + checkout flow | ✅ Complete | `40617d5` | 2026-09-17 |
| 3 | Add auto-renew toggle to checkout | ✅ Complete | `e6f44bc` | 2026-09-17 |
| 4 | Fix subscription creation with correct pricing | ✅ Complete | (in b4c1f2c) | 2026-09-17 |
| 5 | Add new email templates | ✅ Complete | `26a4a84` | 2026-09-17 |
| 6 | Fix background jobs for lifecycle | ✅ Complete | (in 26a4a84) | 2026-09-17 |
| 7 | Fix finder expired tag handling | ✅ Complete | `0aefa9f` | 2026-09-17 |
| 8 | Update customer dashboard | ✅ Complete | `f7b8749` | 2026-09-17 |
| 9 | Testing | ✅ Complete | (verified) | 2026-09-17 |
| 10 | Documentation | ✅ Complete | (this commit) | 2026-09-17 |

---

## What Was Changed

### Pricing Source (Phase 1)
- Removed `annualPrice`, `monthlyPrice`, `freePeriodMonths`, `gracePeriodWeeks` from CMS settings
- Subscription price now reads from `Product.subscriptionConfig.monthlyPrice`
- Free period now reads from `Product.subscriptionConfig.freePeriodMonths`
- Grace period now reads from `Product.subscriptionConfig.gracePeriodWeeks`

### Product Seed Data (Phase 2)
- Set `isTagProduct: true` for PawTag Scan, Classic, Plus
- Updated `freePeriodMonths` from 12 to 3 for all tag products
- Added `monthlyPrice` to subscriptionConfig for each product

### Checkout Flow (Phase 2-3)
- Added `autoRenew` field to Order, PendingOrder, and Cart models
- Added auto-renew toggle to checkout cart review step
- Checkout now creates Tag + Subscription automatically for tag products

### Email Templates (Phase 5)
- Added `free-period-reminder-2week` email
- Added `free-period-reminder-3day` email
- Added `grace-period-reminder-3day` email
- Added `tag-expired` email

### Background Jobs (Phase 5-6)
- Updated `checkExpiringSubscriptions()` to send free period reminders
- Updated `checkGracePeriodExpiry()` to send tag expired email
- Updated `sendGracePeriodReminders()` to send 3-day grace warning

### Finder Portal (Phase 7)
- Added `tagActive`, `subscriptionStatus`, `message` to FinderData type
- Shows "Tag Expired" screen when `tagActive` is false

### Customer Dashboard (Phase 8)
- Shows "Buy a New PawTag" for expired subscriptions (not Renew)
- Shows "Renew" only for grace period subscriptions

---

## Files Changed

| File | Phase | Change |
|------|-------|--------|
| `packages/api/src/services/subscription.service.ts` | 1,5,6 | Read from Product, add email helpers |
| `packages/api/src/seeds/seed-cms.ts` | 1 | Remove 4 pricing settings |
| `packages/api/src/commerce/config.ts` | 1 | Remove 4 pricing settings |
| `apps/admin/src/pages/CommerceSettings.tsx` | 1 | Remove 4 settings from UI |
| `packages/api/src/seed-products.ts` | 2 | Fix isTagProduct, freePeriodMonths, monthlyPrice |
| `packages/db/src/models/Order.ts` | 2 | Add autoRenew field |
| `packages/db/src/models/PendingOrder.ts` | 2 | Add autoRenew field |
| `packages/api/src/routes/checkout.ts` | 2 | Pass autoRenew to service |
| `packages/api/src/commerce/services/checkout.service.ts` | 2 | Create Tag + Subscription, store autoRenew |
| `apps/web/src/pages/Checkout.tsx` | 3 | Add auto-renew toggle |
| `packages/api/src/services/email/templates/subscription-lifecycle.ts` | 5 | Add 4 new email templates |
| `packages/api/src/services/email/templates/index.ts` | 5 | Export new templates |
| `apps/finder/src/types.ts` | 7 | Add tagActive field |
| `apps/finder/src/App.tsx` | 7 | Handle expired tag |
| `apps/web/src/pages/account/Subscriptions.tsx` | 8 | Show Buy a New Tag for expired |

---

## Test Results

| Test | Result |
|------|--------|
| `tests/unit/upload-filename.test.ts` | ✅ 9/9 passed |
| `tests/unit/api-endpoints.test.ts` | ✅ 21/21 passed |
| Typecheck (API) | ✅ No subscription-related errors |
| Typecheck (Finder) | ✅ No errors |
| Typecheck (Web) | ✅ No errors |
