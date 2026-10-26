# Mobile Implementation Package — implementation status & evidence

**Plan of record:** `docs/ux/PawTag_Mobile_Implementation_Package/IMPLEMENTATION_PLAN.md` (Phases 0–8)
**Run started:** 2026-10-26 · **Branch:** `feat/mobile-implementation-package` (off `main` @ `d6dc7a3`)
**Rules:** owner instruction (package) authorizes one continuous run; source authority = code > AGENTS/DESIGN > plan > images (composition only); every unrun check marked **UNVERIFIED**.

## Phase status

| Phase | Scope | Status | Evidence |
|---|---|---|---|
| 0 | Repo baseline + route inventory + validation capability | **COMPLETE** | see below |
| 1 | Shared shell & reachability audit | not started | |
| 2 | Health Records modal → full page (`/account/pets/:id/health`) | not started | |
| 3 | Orders list + Order Details redesign | not started | |
| 4 | Invoice list + Invoice Details redesign | not started | |
| 5 | Remaining customer route review (every §4 row) | not started | |
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
