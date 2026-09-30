# Feature: Full-Page User Detail View

**Branch:** `feature/full-page-user-detail`
**Created:** 2026-09-30
**Status:** In Progress

---

## Objective

Replace the cramped admin user detail drawer with a full-page detail view that has ALL edit capabilities. Keep the drawer as a quick-view option. Ensure zero functionality loss.

## Strategy

Extract `UserDetailContent` from the existing `DetailDrawer` (~1200 lines of edit logic). Use it in both:
1. **Drawer** — thin wrapper with overlay/panel (backward compatible)
2. **Full-page view** — full-width layout with back navigation

---

## Progress Tracker

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Extract `UserDetailContent` from `DetailDrawer` | ✅ Complete |
| 2 | Rewrite `UserDetailPage.tsx` to use `UserDetailContent` | ✅ Complete |
| 3 | Update table row click (drawer) + full-page icon | ✅ Complete |
| 4 | Verify all 14 edit actions | ✅ Complete |
| 5 | Verify audit/system logging | ✅ Complete |
| 6 | Update documentation (README, AGENTS, DESIGN) | ✅ Complete |
| 7 | Extract reusable skill if applicable | ⏭️ Skipped (pattern too specific) |
| 8 | Final commit and push | ⬜ Pending |

---

## Edit Actions to Migrate (14 total)

| # | Tab | Action | API Endpoint |
|---|-----|--------|-------------|
| 1 | Profile | Edit Profile (bulk save) | `PUT /admin/users/:id` |
| 2 | Profile | Address Management | `AddressManager` component |
| 3 | RBAC | Assign Role | `PUT /admin/users/:id/role` |
| 4 | Settings | Toggle MFA | `PUT /admin/users/:id` |
| 5 | Settings | Toggle Skip Invoice OTP | `PUT /admin/users/:id/skip-invoice-otp` |
| 6 | Settings | Change Status | `PUT /admin/users/:id/status` |
| 7 | Settings | Finder Privacy Toggle | `PUT /admin/users/:id` |
| 8 | Settings | Notification Preferences (8 toggles) | `PUT /admin/users/:id` |
| 9 | Settings | Reset Password | `POST /admin/users/:id/reset-password` |
| 10 | Settings | Lock Account | `PUT /admin/users/:id/lock` |
| 11 | Settings | Unlock Account | `PUT /admin/users/:id/unlock` |
| 12 | Settings | Soft-Delete User | `DELETE /admin/users/:id` |
| 13 | Subscriptions | Renew Subscription | `PUT /admin/subscriptions/:id/status` |
| 14 | Invoices | View Invoice | `GET /admin/invoices/:id/view` |

---

## Design Tokens (from DESIGN.md)

| Element | Token |
|---------|-------|
| Page background | `bg-gray-50` |
| Cards | `bg-white rounded-2xl shadow-sm border border-gray-100` |
| Section headings | `text-sm font-semibold text-gray-900` |
| Primary button | `bg-primary-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-primary-700` |
| Destructive button | `bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700` |
| Toggle (on) | `bg-green-100 text-green-600` |
| Toggle (off) | `bg-gray-100 text-gray-400` |
| Input | `w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500` |
| Tabs (active) | `border-b-2 border-primary-600 text-primary-600` |

---

## Audit/System Logging

The existing backend already logs these actions:
- Profile updates → audit event in `PUT /admin/users/:id`
- Role changes → audit event in `PUT /admin/users/:id/role`
- Status changes → audit event in `PUT /admin/users/:id/status`
- Password resets → audit event in `POST /admin/users/:id/reset-password`
- Account lock/unlock → audit events
- User deletion → audit event
- Subscription renewals → audit events

No new audit logging needed — all actions use existing endpoints that already log.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/admin/src/pages/Users.tsx` | Extract `UserDetailContent`, keep `DetailDrawer` as wrapper, add full-page icon to table |
| `apps/admin/src/pages/UserDetailPage.tsx` | Rewrite to use `UserDetailContent` in full-width layout |
| `apps/admin/src/App.tsx` | No change needed (route already exists) |
| `docs/PLANS/full-page-user-detail.md` | This file |
