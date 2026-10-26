# Mobile Implementation Package — implementation status & evidence

**Plan of record:** `docs/ux/PawTag_Mobile_Implementation_Package/IMPLEMENTATION_PLAN.md` (Phases 0–8)
**Run started:** 2026-10-26 · **Branch:** `feat/mobile-implementation-package` (off `main` @ `d6dc7a3`)
**Rules:** owner instruction (package) authorizes one continuous run; source authority = code > AGENTS/DESIGN > plan > images (composition only); every unrun check marked **UNVERIFIED**.

## Phase status

| Phase | Scope | Status | Evidence |
|---|---|---|---|
| 0 | Repo baseline + route inventory + validation capability | **COMPLETE** | commit `af7716b`; evidence below |
| 1 | Shared shell & reachability audit | **COMPLETE** | evidence below; gates: typecheck PASS · lint PASS (0 errors) · unit 1311 · smoke 6/6 · regression 33/33 · build PASS |
| 2 | Health Records modal → full page (`/account/pets/:id/health`) | **COMPLETE** | evidence below; gates: typecheck PASS · lint PASS (0 errors) · unit 1319 · smoke 6/6 · regression 33/33 · build PASS |
| 3 | Orders list + Order Details redesign | **COMPLETE** | evidence below; gates: typecheck PASS · lint PASS (0 errors) · unit 1327 · smoke 6/6 · regression 33/33 · build PASS |
| 4 | Invoice list + Invoice Details redesign | **COMPLETE** | evidence below; gates: typecheck PASS · lint PASS (0 errors) · unit 1328 · smoke 6/6 · regression 33/33 · build PASS |
| 5 | Remaining customer route review (every §4 row) | **COMPLETE** | evidence below; gates: typecheck PASS · lint PASS (0 errors) · unit 1328 · smoke 6/6 · regression 33/33 · build PASS |
| 6 | Finder mobile browser journey review | not started | |
| 7 | Accessibility / responsive / regression validation | not started | |
| 8 | Final route & scope reconciliation + report | not started | |

## Phase 0 — evidence (2026-10-26)

**Branch/tree:** `main` @ `d6dc7a3` (all prior mobile-UX packets merged, gates green at that commit per EXECUTION_STATUS) → new branch `feat/mobile-implementation-package`; only untracked item = the implementation package itself (committed in this phase).

**Route inventory rebuilt from live source (not the ZIP):**
- `apps/web/src/App.tsx`: 24 public/auth routes + 24 `/account/*` routes + `/invoice/:token` + catch-all — reconciles to plan §4.1/§4.2 with **exactly one missing row: `/account/pets/:id/health` does not exist** (plan's proposed new UI route → Phase 2).
- `apps/finder/src/App.tsx`: `/`, `/:tagId`, `*` fallback — reconciles to §4.3.
- Account tabs: five destinations (Home / Pets / Activate / Activity / Account) via `components/account/navigation.ts` + `BottomNav.tsx` (shipped prior packets).

**Plan findings re-checked against live tree (all confirmed):**
1. `HealthRecords.tsx` is modal-only: takes `{ pet, onClose }`, renders `fixed inset-0 bg-black/50 z-50` overlay with a horizontally scrolling category strip (`flex border-b overflow-x-auto`); no standalone route. Owner rejects this design → Phase 2.
2. Finder routes/public access confirmed as specified.
3. Prior "Orders/Invoices already board-compliant" matrix claims are **superseded by this plan** (owner explicitly dislikes current presentation) → Phases 3–4 reopen them.

**Validation capability:** root scripts `pnpm typecheck/lint/test:unit/test:smoke/test:regression/build` available (used green through prior packets); `@playwright/test` installed but **no authenticated fixtures/staging — browser E2E UNVERIFIED unless run this phase**; physical-device/store checks out of scope (no native project edits).

**Route title/breadcrumb coverage (`accountNavItemForPath`):** every §4.2 route resolves a meaningful section/detail label **except three** — `/account/upgrade`, `/account/tag-activation-fee`, `/account/notification-preferences` fall back to generic "Account" (no nav-item prefix matches; `notification-preferences` is not under the `notifications` prefix). → Phase 1 fix candidates via navigation presentation config only. `/account/orders/:id/return` resolves as "Order Details" (DETAIL_LABELS prefix) — acceptable, noted.

**Baseline gates run at branch start:** `pnpm typecheck` → **PASS** (all 9 workspace projects, 2026-10-26). `pnpm test:unit` → **PASS 128 files / 1307 tests** (2026-10-26). Lint/smoke/regression/build were green at the identical tree (`d6dc7a3`) per EXECUTION_STATUS; re-run per phase as changes land.

## Phase 1 — evidence (2026-10-26)

**Audited (verified in live code):** AccountLayout (5-tab model intact, drawer/Escape/focus behavior tested), BottomNav (sizing contract `4.5rem` preserved), scroll restoration (exists in `App.tsx` — restoreY + reset-to-top), route protection (ProtectedRoute on all 24 account routes), fixed/sticky bars (`--app-bottom-nav-height` contract verified in prior packets), public/Finder/account chrome kept distinct, no duplicate shell chrome (invoice/auth chrome fixed in prior packets).

**Defects found & fixed (presentation/navigation only):**
1. Three sub-pages fell back to generic "Account" title **and rendered with no active sidebar item and no active tab**: `/account/upgrade`, `/account/tag-activation-fee`, `/account/notification-preferences`.
2. Fix = one override-aware resolver: `ROUTE_OVERRIDES` (prefix + label + owning `sectionPath`) in `navigation.ts`; `accountNavItemForPath` is now the single source for breadcrumb/header title **and** active state.
3. `AccountLayout` sidebar/drawer and `BottomNav` both resolve through it — BottomNav converted from `NavLink` to `Link` + explicit `aria-current="page"` (same pattern as sidebar) so styling and assistive-tech state cannot disagree.

**Tests:** `mobile-account-nav.test.tsx` +4 (sub-route labels/sections ×3 cases, Activity tab lights on preferences, Activate tab lights on activation fee, sidebar+header title on sub-page) → focused run **14/14 PASS**.

**Unverified:** physical-device/store checks remain out of scope; browser E2E still UNVERIFIED (no authenticated fixtures) — carried to Phase 7.

## Phase 2 — evidence (2026-10-26)

**Delivered:** `/account/pets/:id/health` registered in `App.tsx` inside `ProtectedRoute + AccountLayout`; `HealthRecords.tsx` converted from `fixed inset-0` modal to page workspace (identity header + visible "Back to {pet}" + wrapped 9-category selector + section card with inline add/edit); title/breadcrumb via new `ROUTE_OVERRIDES` suffix matcher (`/health` → "Health Records", section My Pets); PetDetail **and** MyPets now navigate (`onHealth` closure) — no component mounts the modal anymore.

**Entitlement/data safety:** page re-checks `pet_health_records` with the same endpoint/flag logic as PetDetail (locks to membership card without it — direct URLs never show data); pet payload seeds sections via the same `pets.detail` endpoint; section save/delete/desexing endpoints, payload shapes, `confirm()` delete and toasts unchanged; `sectionApiName()` deduplicates the previously tripled section→API-segment mapping (behavior identical).

**Defect found & restored:** desexing Edit was dead code — the modal set `editing/showForm` but `tab === 'desexing'` always won the render branch, and no desexing form existed. `DesexingForm` now renders for that state, saving through the same `PUT /pets/:id/desexing` with the record's own fields (isDesexed/date/performedBy/clinic/notes) — reachability restored, no contract change.

**A11y (plan §5.4):** category selection exposed via `aria-current="page"` (Profile-tabs pattern); all 48 form labels now associated (`htmlFor`/`hr-*` ids — one form renders at a time); record edit/delete buttons are labeled (`aria-label="Edit/Delete {primary field}"`) ≥44px; Save/Cancel inline at form end (keyboard-open safe); loading skeleton + error InfoCard + locked state all present.

**Not copied from concept images (source authority):** alternate bottom tabs, "Overdue/Due soon" computed statuses, 500-char counter, per-category marketing copy, image label renames — product terms and data kept.

**Tests:** new `tests/unit/health-records-page.test.tsx` (8: route wiring source guards ×2, identity/9-categories/no-modal, category switching, add→POST endpoint, edit-prefill + delete→sectionItem, desexing form→PUT regression, entitlement lock). Focused run with pet-detail + nav suites: **29/29 PASS**.

**Phase 5 carry-over noted during grep:** legacy `teal-*` token drift remains in AccountLayout breadcrumb hover, Dashboard, MyPets forms, NotificationPreferences, Notifications, Referrals, public Faq/NotFound/Membership/InvoiceView etc. — to be swept per-screen in Phase 5/6 review (not defects, consistency debt).

## Phase 3 — evidence (2026-10-26)

**Owner-supersession honored:** the plan explicitly overrides the earlier "Orders already board-compliant" claim; both concept images (24/25) reviewed before editing. The detail image's big-H1 header was NOT copied — the founder's own 2026-10-26 order-header mock (icon tile + eyebrow + number + bottom pill row) already satisfies plan §5.2's header requirements (number, date, state, payment state) and is a direct owner instruction; owner > generated image (source-authority §2.4).

**Orders list card rebuilt** per plan §5.2 + image 24: single-`<Link>` card (CopyButton removed from the list → no nested interactive controls), rows = identity/state (status pill + **separate** refund pill) → first-item image + variant/qty summary → compact stepper or status banner (unchanged money copy) → footer `Total` + amount + "View order ›" outlined span. **Demoted off the card face** (now detail-only): card brand/last4, city, invoice number, item-count row, activity timeline row, payment-status pill, "View Details" span. Dead presentation helpers removed with their imports (`getLatestMilestone`, `getActivityIcon/Color`, `getRelativeTime`, `MILESTONE_ACTIVITY_TYPES`, unused `getTrackingUrl`/`getPaymentStatus*` imports).

**Order detail hierarchy** per plan §5.2: section order confirmed task-first (header → banner/stepper → refund/pending notices → items+totals | payment/tracking/invoice/address/cancellation/refund grid) with the **action area hoisted to a full-width section after the grid** (was buried mid-right-column); `OrderActions` restacked `flex-col`→`sm:flex-row` (320px-safe) with `buttonClassName` danger/secondary tokens (was raw `red-500`/gray outline). All eligibility rules inside `OrderActions` untouched (self-hides: return for paid/packing/shipped/delivered, cancel pre-shipment only, none for cancelled/refunded).

**Returns:** `ReturnRequest.tsx` reviewed — readable-width form measure, plain form semantics, "Back to Order {n}" return path; **no concrete usability issue → unchanged** (recorded here rather than an "already compliant" assumption).

**Preserved (gate checks):** polling, all status/refund/payment labels and distinctions, tracking (incl. shipped-without-tracking amber notice), invoice card + `onViewInvoice`, cancellation reasons (`CancellationInfoCard`), refund summary card + destination copy, `checkout-cpf-disclosure` source guards (strings intact), return request flow.

**Tests:** `orders-list-card.test.tsx` (new, 5: card content/subtitle, demoted-metadata absence, single-link/no-nested-controls, cancelled banner, refund≠status pills — one fixture corrected to real `refundStatus: 'pending'` after the shared helper's contract check); `order-detail-view.test.tsx` +3 action-area tests (return+cancel below grid & stacked, return-only for delivered, hidden for cancelled) → focused runs **16/16** then **34/34** (with cpf-disclosure guards).

## Phase 4 — evidence (2026-10-26)

**Both invoice images reviewed before editing.** **List rebuilt** per plan §5.3 + image: individual `<article>` document cards on the page surface (loading/empty/pagination keep white surfaces); type tile tinted by document type (teal invoice / red credit note); head = type label → number (`break-all`, wraps not clips) + configured status pill → date, amount right; controls = full-label **View details** (`Link` → secure detail route) + **Download PDF** (real `downloadAuthenticatedFile` → server endpoint), stacked below `sm`. **The `role="button"` row is gone entirely** (plan forbids the pattern — better than guarding it): no row keydown/onClick, no nested controls, `useNavigate`/list-level doc-view handler removed (document view lives on detail, per the plan's two-control list spec).

**Credit-note sign:** new `invoiceDisplayAmount(type, amount)` in `packages/shared/src/customer-invoices.ts` — credit notes display `NZ$-…` per plan §5.3/image; stored values never mutated; negative-payload guard prevents double-minus. **Detail summary:** card now leads with type tile + type label + number + inline status pill + issue date/original reference, then a 2-col figures row; the duplicate grid Status cell removed (pill owns status); totals (`Total`/`Total credited`) made visually distinct (`text-primary-700 font-bold`). Fixed mobile action bar, secure HTML/PDF flows, pagination contract and credit-note scope untouched (cpf-disclosure guards green).

**Deliberate deviations recorded:** no filter chips (needs a list-API `type` param — API changes excluded); no order/item context line (list API returns only `orderId` — omitted, never faked); status filter/date-range UI not invented.

**Tests:** `invoice-portal-ui.test.tsx` rewritten to the new contract (7: shared labels + display-sign helper, card semantics/type/status/signed amount, chrome guard, no button-like rows + View details navigates, Download hits `pdf` endpoint with `responseType: 'blob'`, detail summary label) — focused run with cpf-disclosure **22/22 PASS**.

## Phase 5 — evidence (2026-10-26): every §4 row with a recorded outcome

**Fixes applied this phase:** (a) `teal-*` → `primary-*` token sweep — **225 occurrences across 31 files** (apps/web/src + packages/ui/src; verified value-identical: `primary` in tailwind.config IS the teal scale, so zero visual change); one prose comment ("Teal-tinted") intentionally left; (b) `MyDonations` inner `max-w-3xl px-4 py-8` wrapper removed (the carry-over defect flagged during the invoice pass — plan §5.5 "duplicated wrappers"); (c) Finder confirmed already token-clean (no `teal-` hits).

### §4.1 Public routes

| Route(s) | Outcome |
|---|---|
| `/` Home | Reviewed — CMS hero per prior packets; no concrete issue (sweep: n/a) |
| `/shop`, `/shop/:id` | Redesigned (Packet 3 + A7 full-bleed/price-in-button); ProductDetail 12 token literals swept |
| `/cart`, `/checkout` ×2 steps | Redesigned (Packet 3 + A7/A8); standing exclusions documented (collapsible summary, step merge) |
| Auth ×6 | Full mobile pass this run (`AuthLayout` shell, tokens, autofill, progress — committed d6dc7a3) |
| About/Privacy/Terms/FAQ/Contact | Reviewed — shared CMS template, no concrete layout issue; Faq CTA token swept |
| `/pet-recovery` | Reviewed — no concrete issue |
| `/guardian`, `/membership`, `/refer` | Reviewed — token sweeps (3/4/7); brand gradients now primary-* (identical values) |
| `/donate`, receipt/invoice token views | Reviewed — donation phases own these; InvoiceView 5 tokens swept; secure flows untouched |
| catch-all NotFound | Reviewed — token sweep (2) |

### §4.2 Account routes

| Route(s) | Outcome |
|---|---|
| `/account` Dashboard | Prior board fixes (A1); 10 tokens swept |
| `/account/pets` MyPets | Redesign (1b/A2); health entry now navigates to the page route (Phase 2); 19 tokens swept |
| `/account/pets/:id` PetDetail | A3 hero overlay/chips; health row → route (Phase 2) |
| **`/account/pets/:id/health`** | **NEW — full-page redesign (Phase 2)** |
| `…/lost` Lost Mode | Board fixes (A4) + 1b; share button/labels shipped |
| `/account/redeem-tag` | Reviewed — functional card pattern, no concrete issue |
| Profile / Notifications / Notification prefs / Settings | Tabs+chips (1c/1d/A5); token sweeps (5/3/3/9) |
| Orders + `/:id` | **Redesigned (Phase 3)** |
| `/:id/return` ReturnRequest | Reviewed — form measure + return path OK (recorded, not assumed); 9 tokens swept |
| Invoices + `/:id` | **Redesigned (Phase 4)** |
| `/account/donations` | **Wrapper defect fixed** (inner max-w/px removed); no tokens needed |
| Subscriptions / SubscriptionUpgrade | Prior CTA unification + sweeps (5/1) |
| Guardian ×3 | Reviewed — tier gradients remain the sanctioned DESIGN exception; 6 dashboard literals swept (identical values) |
| Membership ×2, Referrals, TagActivationFee | Reviewed — Referrals swept (3); Membership/TagFee token-clean, no concrete issue |

### §4.4 States + shared components

Loading/empty/error/success verified per touched surface (health page adds all four; invoice list keeps loading/empty/pagination; orders keep skeletons/banner states); checkout auth/step progression untouched. Sticky-bar conflicts + bottom-nav overlap ruled out by prior verified packets (invoice bar `--app-bottom-nav-height`, FAB fix, checkout sticky). **Keyboard-obstruction/zoom/reduced-motion rows: UNVERIFIED → Phase 7.** Shared components swept: AccountLayout(4), AvatarUpload(3), OtpInput(1), OrderSummary(1), StripePaymentForm(1), EngagementTicker(3), FloatingLoyaltyBadge(1), Footer(7), GuardianSection(1), PageHero(2), InfoCard(1), MembershipCheckboxes(4), ProductCard(1), puck config(14).
