# Mobile Route & Component Matrix — Customer Web

**Phase:** A (route/component inventory) of the mobile UX spec (`docs/ux/PawTag_Mobile_Review_Package/PawTag_Mobile_UX_Audit_and_Implementation_Spec.md` §8), executed as part of Phase 08 (`phases/08_SHARED_WEB_MOBILE_APP_FOUNDATION.md`, tasks A + C).
**Source of truth:** `apps/web/src/App.tsx` as inspected on branch `feat/mobile-ux-phase-a-b`.
**Evidence method:** source review (class/layout evidence). Viewport rows in §4 are a **manual checklist — UNVERIFIED until executed**.

---

## 1. Route inventory

### 1.1 Public routes (PublicLayout: AnnouncementBar + Navbar + Footer)

| Route | Page | Phone-width status (source evidence) | Nav entry |
|---|---|---|---|
| `/` | `pages/Home.tsx` | CMS hero + sections, stacked sections | Navbar |
| `/shop` | `pages/Shop.tsx` | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — single col on phone | Navbar (CMS header) |
| `/shop/:id` | `pages/ProductDetail.tsx` | single column | from Shop |
| `/cart` | `pages/Cart.tsx` | `grid-cols-1 lg:grid-cols-12` (8/4 → 1 col < lg) + `lg:hidden fixed bottom-0` sticky bar (`safe-area-pb`) | Cart icon |
| `/checkout` | `pages/Checkout.tsx` | per-step `grid-cols-1 lg:grid-cols-12` + mobile sticky CTA bar | from Cart |
| `/login` | `pages/Login.tsx` | form | Navbar (Sign In) |
| `/register` | `pages/Register.tsx` | form | Login page |
| `/about` | `pages/About.tsx` | stacked | Navbar (CMS) |
| `/pet-recovery` | `pages/PetRecovery.tsx` | stacked | Navbar/landing |
| `/privacy`, `/terms`, `/faq`, `/contact` | respective pages | stacked/legal | Navbar/Footer |
| `/refer` | `pages/Refer.tsx` | stacked (no EmergencyLostPet) | campaign links |
| `/guardian` | `pages/GuardianLanding.tsx` | stacked | Navbar (Guardian) |
| `/membership` | `pages/Membership.tsx` | stacked | Navbar (Membership dropdown) |
| `/donate` | `pages/Donate.tsx` | form + Stripe Elements (no EmergencyLostPet) | Footer when `donation.publicEnabled` |

### 1.2 Public bare routes (no Navbar/Footer)

| Route | Page | Note |
|---|---|---|
| `/verify-account` | `pages/VerifyAccount.tsx` | email+phone verification continuation |
| `/verify-email` | `pages/VerifyEmail.tsx` | token landing |
| `/forgot-password`, `/reset-password` | auth pages | forms |
| `/donations/receipt/:token` | `pages/DonationReceiptView.tsx` | secure token document view |
| `/invoice/:token` | `pages/InvoiceView.tsx` | secure token document view |
| `*` | `pages/NotFound.tsx` | catch-all |

### 1.3 Customer routes (ProtectedRoute + AccountLayout — all single-column at phone width via `max-w-4xl px-4`)

| Route | Page | Section (sidebar/drawer) | Tab bar |
|---|---|---|---|
| `/account` | `account/Dashboard.tsx` | Dashboard | **Home** |
| `/account/pets` | `account/MyPets.tsx` | My Pets | **Pets** |
| `/account/profile` | `account/Profile.tsx` | Profile | **Account** |
| `/account/orders` | `account/Orders.tsx` | Orders | — |
| `/account/orders/:id` | `account/OrderDetail.tsx` | Orders | — |
| `/account/orders/:id/return` | `account/ReturnRequest.tsx` | Orders | — |
| `/account/invoices` | `account/Invoices.tsx` | Invoices | — |
| `/account/invoices/:id` | `account/InvoiceDetail.tsx` | Invoices | — (has own `lg:hidden` sticky bar → stacked **above** tab bar via `--app-bottom-nav-height`) |
| `/account/donations` | `account/MyDonations.tsx` | My Donations | — |
| `/account/subscriptions` | `account/Subscriptions.tsx` | Subscriptions | — |
| `/account/guardian` | `account/GuardianDashboard.tsx` | Guardian | — |
| `/account/guardian/points` | `account/GuardianPoints.tsx` | Guardian | — |
| `/account/guardian/rewards` | `account/GuardianRewards.tsx` | Guardian | — |
| `/account/upgrade` | `account/SubscriptionUpgrade.tsx` | Membership group | — |
| `/account/membership` | `account/MembershipManage.tsx` | Membership | — |
| `/account/membership/subscribe` | `account/MembershipSubscribe.tsx` | Membership | — |
| `/account/notifications` | `account/Notifications.tsx` | Notifications | **Activity** |
| `/account/notification-preferences` | `account/NotificationPreferences.tsx` | Notifications | — |
| `/account/redeem-tag` | `account/RedeemTag.tsx` | Activate Tag | **Activate** |
| `/account/tag-activation-fee` | `account/TagActivationFee.tsx` | activation flow | — |
| `/account/referrals` | `account/Referrals.tsx` | Referrals | — |
| `/account/settings` | `account/Settings.tsx` | Settings | — |

### 1.4 Not part of the customer shell

| Surface | Location | Rule |
|---|---|---|
| Finder | `apps/finder` (`/`, `/:tagId`) | public browser-only; never routed into owner chrome; deep-link exclusion already in `apps/web/src/platform/capabilities.ts` (`isFinderPublicPath`) — verified present, untouched |
| Admin | `apps/admin` | desktop-first, out of scope |
| Legacy Expo | `apps/mobile` | migration reference only — **no changes made** |

---

## 2. Navigation coverage after Phase B

Single config: `apps/web/src/components/account/navigation.ts` → `ACCOUNT_NAV_ITEMS` → drives sidebar, drawer, and `BottomNav` (new).

- Phone `< md`: hamburger drawer (all 13 sections) **+** fixed 5-destination bottom tab bar.
- `md+`: sidebar (unchanged layout).
- Public pages: `Navbar` — mobile disclosure now has `aria-expanded`/`aria-controls`/`aria-label` + Escape-to-close with focus return.
- Header account menu: now click/touch toggle (`aria-expanded`), backdrop click, Escape with focus return (was hover-only — unreachable on touch).

---

## 3. Gaps register

| # | Gap found in inventory | Disposition |
|---|---|---|
| 1 | No bottom tab navigation anywhere in `apps/web` (Phase 08 task C unimplemented) | **FIXED_IN_B** — `account/BottomNav.tsx` |
| 2 | No Activity route/page exists | **RESOLVED** — Activity tab maps to `/account/notifications` (founder decision, spec §6.10) |
| 3 | Header account dropdown was hover-only | **FIXED_IN_B** — click/touch toggle + Escape + focus return |
| 4 | `safe-area-pb` class used in `Cart.tsx`/`Checkout.tsx` but defined nowhere (dead class) | **FIXED_IN_B** — defined once in `apps/web/src/index.css` |
| 5 | `InvoiceDetail` sticky bar would sit under a bottom tab bar | **FIXED_IN_B** — `bottom-[var(--app-bottom-nav-height)]` |
| 6 | Navbar mobile menu: no accessible name/expanded state/Escape | **FIXED_IN_B** |
| 7 | `pages/account/HealthRecords.tsx` exists but has **no route** in `App.tsx` | **FLAG_FOR_FOUNDER** — orphaned page; routing it is a product decision (not silently routed) |
| 8 | Breadcrumb/page title falls back to "Account" for `/account/notification-preferences`, `/account/upgrade`, `/account/tag-activation-fee` (no section entry matches) | **PRE_EXISTING** — unchanged behavior; needs section-grouping config, not a UI hotfix |
| 9 | `PlatformProvider` / `initCapacitorPlatform()` have zero call sites (app-mode detection dormant) | **DEFER_PHASE_09** — deep-link/bridge wiring, out of A–B scope |
| 10 | Playwright has no mobile viewport projects (desktop Chromium only) | **DEFER** — spec Phase G; this packet relies on unit tests + manual checklist |

---

## 4. Manual viewport checklist — **UNVERIFIED (not yet executed)**

Run against a logged-in session. Record results + date here.

| # | Check | 320 | 375 | 390 | 430 | Tablet 768 | Result |
|---|---|---|---|---|---|---|---|
| 1 | No horizontal scroll on `/account`, pets, orders, notifications, invoices | | | | | | |
| 2 | All 5 tabs visible, ≥44px targets, labels not clipped | | | | | | |
| 3 | Tab tap navigates + active tab obvious (not colour-only) | | | | | | |
| 4 | Drawer opens/closes with keyboard + Escape; focus visible | | | | | | |
| 5 | Account menu opens by tap (no hover), Escape closes, focus returns to toggle | | | | | | |
| 6 | Invoice detail: View/Download bar sits **above** tab bar, both usable | | | | | | |
| 7 | Last content row on long lists not hidden behind tab bar | | | | | | |
| 8 | Bottom bar clears home indicator on a notched device (safe area) | | | | | | |
| 9 | Software keyboard doesn't hide primary action on `/account/profile` | | | | | | |
| 10 | `md+`: sidebar present, tab bar absent (no double nav) | | | | | | |
| 11 | Cart/Checkout sticky bars unchanged (public layout has no tab bar) | | | | | | |
| 12 | Direct URL load + browser back behave on all 5 tab destinations | | | | | | |

Physical-device / Capacitor-shell checks (safe area, home indicator, app back button): **NOT_STARTED — Phase 09/10.**

---

## 5. Automated evidence

Executed on `feat/mobile-ux-phase-a-b` (2026-10-24):

| Command | Result |
|---|---|
| `pnpm typecheck` (full workspace — baseline before edits) | **PASS** |
| `pnpm --filter @pawtag/web typecheck` (after final edits) | **PASS** |
| `pnpm lint` | **PASS** — 0 errors (warnings pre-existing) |
| `pnpm vitest run tests/unit/mobile-account-nav.test.tsx` (new) | **PASS** — 9/9 |
| `pnpm test:unit` | 1252 passed / 1 pre-existing failure (below) |
| `pnpm test:smoke` | **PASS** — 6/6 |
| `pnpm test:regression` | **PASS** — 33/33 |
| `pnpm build` | **PASS** — api/admin/web/finder exit 0 |

**Pre-existing failure (present at baseline, before this packet's edits):** `tests/unit/donation-receipt-prefix.test.ts > uses configured prefix format` times out (15s) under full-suite parallel load — **passes in isolation** (verified: 2/2 with `tag-usage-indicator.test.tsx`). Baseline run: 117/118 files with this same timeout + a worker-start error; unrelated to mobile UX scope.

**Manual/visual/device:** none executed. §4 checklist rows remain **UNVERIFIED** — no browser, emulator, or device run is claimed by this packet.
