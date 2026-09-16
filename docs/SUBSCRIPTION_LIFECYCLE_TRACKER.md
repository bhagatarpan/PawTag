# PawTag Classic Subscription Lifecycle — Implementation Tracker

**Feature Branch:** `feature/pawtag-classic-subscription-lifecycle`
**Created:** 2026-09-17
**Status:** In Progress

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
| 1 | Delete CMS pricing settings + fix pricing source | ⏳ Pending | — | — |
| 2 | Fix tag seeding + checkout flow | ⏳ Pending | — | — |
| 3 | Add auto-renew toggle to checkout | ⏳ Pending | — | — |
| 4 | Fix subscription creation with correct pricing | ⏳ Pending | — | — |
| 5 | Add new email templates | ⏳ Pending | — | — |
| 6 | Fix background jobs for lifecycle | ⏳ Pending | — | — |
| 7 | Fix finder expired tag handling | ⏳ Pending | — | — |
| 8 | Update customer dashboard | ⏳ Pending | — | — |
| 9 | Testing | ⏳ Pending | — | — |
| 10 | Documentation | ⏳ Pending | — | — |

---

## Files Changed

Track all files modified during this feature:

| File | Phase | Change Description |
|------|-------|-------------------|
| `docs/SUBSCRIPTION_LIFECYCLE_TRACKER.md` | 0 | Created |
