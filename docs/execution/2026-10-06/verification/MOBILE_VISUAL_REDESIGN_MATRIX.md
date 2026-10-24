# Mobile Visual Redesign Matrix — Customer Portal

**Packet:** Customer portal full visual redesign (mobile-first, driven by the concept boards in `docs/ux/PawTag_Mobile_Review_Package/images/`).
**Branch:** `feat/mobile-visual-redesign` (stacked on `feat/mobile-ux-phase-a-b`).
**Scope:** presentation only — no API/auth/payment/entitlement/Finder-privacy changes. No new features. `apps/mobile` untouched.
**Evidence method:** source-based implementation + automated gates. **§3 viewport checklist is UNVERIFIED until executed.**

---

## 1. Design foundation (Batch 0)

| Deliverable | Location |
|---|---|
| `Button` + `buttonClassName()` (primary/secondary/success/danger/ghost, ≥44px, focus ring) | `packages/ui/src/components/Button.tsx` |
| `InfoCard` (tinted emphasis card) | `packages/ui/src/components/InfoCard.tsx` |
| `MetaRow` (icon meta list row) | `packages/ui/src/components/MetaRow.tsx` |
| `PhotoHero` (photography header) | `packages/ui/src/components/PhotoHero.tsx` |
| `SelectChips` (single-select chips, `aria-pressed`) | `packages/ui/src/components/SelectChips.tsx` |
| Teal chrome: account header + sidebar/drawer brand blocks | `apps/web/src/components/AccountLayout.tsx` |
| Elevated center Activate tab (4.5rem row, var-synced) | `apps/web/src/components/account/BottomNav.tsx`, `apps/web/src/index.css` |
| Rules authority | `docs/DESIGN.md` → "Mobile visual language" + "Mobile customer navigation" |

## 2. Screen changes by batch

| Batch | Screen | What changed | Verified-already-fine |
|---|---|---|---|
| 1 | **Dashboard** | Photo greeting hero (pet photo / teal gradient fallback), lost-pet danger banner surfaced immediately, pending escalations moved above the fold with `Button` actions, "Your pets" photo card with Manage CTA, cramped QuickActions row **removed** (duplicates tab bar — spec §6.3), panels → `rounded-2xl` + stronger titles, How-it-works → `InfoCard` trio, Guardian card → `InfoCard`, nudge/banner CTAs → `Button` | states (skeleton/error/empty) preserved |
| 1 | **Pets list** (`MyPets`) | Add Pet / Save / empty-state CTAs → tokens (no teal→cyan gradients), photo action overlay always visible on phones (`sm:` hover restore), breed tooltip keyboard-focusable (`group-focus-within`) | card grid, skeletons |
| 1 | **PetCard** | Status banners flat semantic tints (were saturated gradients w/ white text), photo fallback/tag/medical blocks → flat token tints, action row → `Button` grid 2×2 (≥44px, was tiny hover-dimmed), dead `.pet-card-actions` hover CSS removed | states, confirm dialogs |
| 2 | **Orders list** | Cards → `rounded-2xl`, icon wells rounded | structure, statuses, skeletons (already board-close) |
| 2 | Order detail / Invoices / Invoice detail | **Audited — already board-compliant** (order header hierarchy, full stepper card, `rounded-2xl` invoice card, icon wells, keyboard rows) | `OrderDetailView` behavior tests guard it |
| 3 | **Subscriptions** | All 6 gradient CTA buttons (emerald/amber) → single `buttonClassName()` primary style | tier/status hero gradients sanctioned (see DESIGN.md exception) |
| 3 | Donations / Membership / Guardian pages | **Audited — no ad-hoc CTA gradients or hover-only defects found**; tier heroes sanctioned | rounded-2xl cards, receipt actions |
| 4 | **Notifications** | `SelectChips` filter (All/Unread/Read with live counts, `aria-pressed`), filtered empty state, cards → `rounded-2xl` | unread badges, mark-all/clear actions |
| 4 | Profile / Settings / Notification Preferences | **Audited — zero gradient/hover defects**; already token-based single-column | forms |

## 3. Viewport checklist — **UNVERIFIED (not yet executed)**

| # | Check | 320 | 375 | 390 | 430 | Tablet | Result |
|---|---|---|---|---|---|---|---|
| 1 | Dashboard: hero greeting legible, lost banner visible without scroll, pets card thumbs tappable, no 5-up cramping | | | | | | |
| 2 | PetCard: actions fully visible (no hover), 2×2 buttons ≥44px, status pill readable on flat tint | | | | | | |
| 3 | Pets: Add Pet reachable, photo overlay visible on tap, tooltip opens by tap/keyboard | | | | | | |
| 4 | Orders: card wraps cleanly, status + amount scannable | | | | | | |
| 5 | Subscriptions: converted CTAs uniform, no layout shift | | | | | | |
| 6 | Notifications: chips scroll horizontally, filter + empty state correct, tap targets ok | | | | | | |
| 7 | Teal header: white controls AA contrast, avatar menu opens by tap, bell badge visible | | | | | | |
| 8 | Tab bar: elevated circle doesn't clip, labels aligned, Invoice sticky bar rests above it | | | | | | |
| 9 | All previously verified A/B checks still pass (drawer, tabs, keyboard) | | | | | | |

**Packet 1c (Profile tabs) rows:**

| # | Check | 320 | 375 | 390 | 430 | Tablet | Result |
|---|---|---|---|---|---|---|---|
| 10 | Identity row (avatar/name/email), 3 underline tabs scroll if needed, active tab obvious | | | | | | |
| 11 | `?tab=security`: verified pills + password form reachable by tap; `?tab=preferences` renders prefs | | | | | | |
| 12 | Tab deep link survives reload/back; `/account/notification-preferences` route still works standalone | | | | | | |
| 13 | Profile form save + avatar change still work after restructure | | | | | | |

**Packet 1d (notification categories) rows:**

| # | Check | 320 | 375 | 390 | 430 | Tablet | Result |
|---|---|---|---|---|---|---|---|
| 14 | 4 chips (All/Orders/Pets/Account) scroll if needed; counts match list; each bucket shows its rows; empty-filter copy reads correctly | | | | | | |
| 15 | Unread dots/badges + mark-all/clear-read still work after chip swap | | | | | | |

Physical-device/safe-area/Capacitor checks: **NOT_STARTED (Phase 09/10).**

## 4. Packet 1b — Pets journey board parity (image 1, screens 2–4)

**Capability audit (Step 0, executed before UI):** every board element checked against real API/data —
`GET /customer/pets/:id` exists (full doc, health arrays inline); `mark-lost`/`mark-found` exist;
`GET /customer/pets/:id/locations` returns real `LocationEvent`s (source `gps|qr_scan|manual`,
timestamp, notes); `GET /tags` supports the linkedTag join (detail endpoint does **not** join it);
finder link = same 3-branch origin logic the app already uses for Finder entry + `/finder/:tagId`
convention; `timeToFoundMs` returned by mark-found.

| Board screen | Built | Truthfulness notes |
|---|---|---|
| My Pets horizontal cards (photo left, status pill, meta rows, chevron) | ✅ `PetCard` rebuilt | whole-card link to detail; menu keeps Edit/Health/Unlink/Delete; "Adding another pet?" InfoCard added |
| Pet detail (`/account/pets/:id`) | ✅ new page | Tag status card uses `QrCode` well (no tag photo asset exists); "Last seen" shown **only** when a real LocationEvent exists, else "No shared locations yet"; health summary **entitlement-gated** (locked users see upsell, never counts); care-reminders row omitted (no reminder data); Mark Lost/Found moved here per board |
| Lost Mode (`/account/pets/:id/lost`) | ✅ new page | **"Location sharing is ON" toggle NOT built** — tags have no GPS; replaced by truthful finder-scan/sightings steps; shared-locations list shows real events; escalation contact card w/ resolve/forward; recovery-link copy; non-lost pet gets a calm guard view, never a false lost state |
| Mark Found reunion message | ✅ moved to detail/lost screens | uses real `timeToFoundMs` |

New checklist rows: detail hero/tab-order, health gate visible/locked, lost screen guard,
recovery-link copy, MyPets `?edit=` round-trip.

## 5. Automated evidence (Packets 1, 1b, 1c, 1d)

Executed on `feat/mobile-visual-redesign` (latest run at Packet 1d close, 2026-10-25):

| Command | Result |
|---|---|
| `pnpm typecheck` (full workspace, after final edits) | **PASS** |
| `pnpm lint` | **PASS** — 0 errors repo-wide (warnings pre-existing) |
| `pnpm test:unit` | **PASS** — 124 files / 1275 tests, zero failures |
| focused suites (category-chips + profile-tabs + detail/lost + primitives + nav + hero) | **PASS** — 48/48 |
| `pnpm test:smoke` | **PASS** — 6/6 |
| `pnpm test:regression` | **PASS** — 33/33 |
| `pnpm build` | **PASS** — api/admin/web/finder exit 0 |

**Manual/visual/device:** none executed — §3/§4 rows remain **UNVERIFIED**. No browser, emulator, or device run is claimed.  
**Pre-existing note:** `tests/unit/donation-receipt-prefix.test.ts` (historically flaky under parallel load, passes in isolation) **passed in every full unit run this session.**

