# Smart Lost Pet Detection & Reunification Flow

**Status:** implemented (branch `feat/scan-lost-alert-flow`, 2026-10-26) — founder-approved business rule.
**Scope:** presentation + customer/finder API. No payment/entitlement/subscription changes; entitlement registry reused as-is.

## The business rule

Every PawTag scan helps the owner decide whether their pet might be lost. **A scan alone never marks a pet lost** — only the owner's explicit confirmation does. Two alert levels (founder decision):

| Level | Trigger | Channels | Priority |
|---|---|---|---|
| **1 — scan** | A finder simply opens the tag page | In-app only (`finder_scan` notification) | normal |
| **2 — finder contact** | Finder submits "Notify Owner I Found Their Pet" | In-app + push + email (`pet_found`, unchanged) | high |

- Level-1 prompt copy: *"Your PawTag was scanned around **<IP locality>**. … Is <pet> safe with you, or should you mark them as Lost…?"* with actions **Confirm Pet Is Lost / My Pet Is Safe / View Scan Details**.
- **Prompt pacing (Option B, founder decision 2026-10-27):** scan prompts are **one-at-a-time per tag** — while an unread prompt is still open, scans never duplicate it (the unanswered prompt is the persistent state, so storms are impossible); once the owner responds (ack, or Lost Mode auto-resolves it) the next scan may prompt again, never sooner than the floor **`scanAlert.remindFloorMinutes`** (Setting, default **15 min**, `0` allowed) to prevent tap-spam loops. Every scan still lands in history regardless.
- **Skip** when the pet is already `lost` (owner knows — Lost Mode is the home for sightings) or terminal (`deceased/transferred/donated/sold`).
- Gated by the `in_app_notifications` entitlement (registry-driven, same as `pet_found`).
- **Approximate location:** existing server-side IP geolocation (`geo-location.ts`, geoip-lite + ip-api fallback) — locality name only (city/region), never coordinates, never a permission prompt. No reverse-geocoder was added (decision). If unavailable → "scanned recently" copy; the workflow never blocks.

## Flow

1. **Scan** (`GET /api/finder/:tagId`) → `FinderScan` (existing) + `PetHistoryEvent: scan_received` + deduped `finder_scan` notification + `owner_prompted` history. Failure-isolated — a history/alert failure never breaks the finder.
2. **Owner alert** — `LostPetAlertHost` mounted in `AccountLayout` (fetch on mount + on unread-count change): persistent red **PET IS LOST — &lt;pet&gt;** banner (server-derived from `pet.status` → survives refresh/other devices) + strongest unread alert (Level-2 first). "View Scan Details" → pet detail `#pet-history`.
3. **Confirm lost** — dialog (`Are you sure your pet is lost?`) → existing `POST /pets/:id/mark-lost` (now **idempotent**: repeat confirmations never inflate `lostCount` or duplicate history; auto-reads the pet's scan/found prompts; writes `lost_activated`).
4. **Lost Mode theme** — PetDetail gets a light-red surface (`bg-red-50` wrapper) purely from persisted `pet.status`; reunion restores automatically; scoped per pet. LostMode page keeps its red hero.
5. **Reunion** — `Mark as Found` (PetDetail **and** LostMode) gated by `Has your pet been safely reunited with you?` dialog → existing `mark-found` → `reunion_confirmed` history; history is never deleted; future scans create new events, never reopening the episode.
6. **History timeline** — new `PetHistoryEvent` model + `GET /customer/pets/:id/history` (owner-scoped, `limit` 1–100, `before` cursor) + `PetHistorySection` on PetDetail. Approximate vs precise location labelled distinctly (`precision` field); `notification_attempted` stores **real per-channel outcomes** (`email: sent|failed`, `inApp: created|failed|skipped_not_entitled`, `push: sent|failed`) — nothing claims delivery the server didn't observe.

## Finder contract change (founder rule)

`POST /api/finder/:tagId/notify`: **phone now required** (zod + client mirror + inline error); name/email/message remain optional. Email now also accepts `''` (previously an empty email string failed validation — latent bug). CAPTCHA, 5/h rate limit, 5-minute dedupe unchanged.

## Ack semantics

`PUT /customer/notifications/:id/ack` = explicit owner decision (marks read **and** writes `owner_prompt_dismissed`) — deliberately separate from plain `markRead` (viewing ≠ deciding).

## Key files

- `packages/db/src/models/PetHistoryEvent.ts` (new) · `Notification` interface + timestamps typing
- `packages/api/src/lib/pet-history.ts`, `lib/lost-pet-alerts.ts` (new) · `routes/finder.ts`, `routes/customer.ts` (scan alert, history/active-alerts/ack endpoints, idempotent mark-lost)
- `packages/shared/src/api/endpoints.ts` (`pets.history`, `notifications.activeAlerts`, `notifications.ack`)
- `apps/web/src/components/LostPetAlertHost.tsx` (new) + `AccountLayout.tsx` mount · `PetDetail.tsx` (dialogs, theme, history) · `LostMode.tsx` (reunion dialog) · `PetHistorySection.tsx` (new)
- `apps/finder/src/components/NotifyOwnerForm.tsx` (phone-required)

## Tests

- `tests/integration/scan-lost-alert.test.ts` (new, 11): scan never flips status; dedupe (1 prompt / 3 scans); lost-pet skip; idempotent mark-lost + prompt resolution; reunion keeps history; ownership 404s; history order/limits/pagination; honest channel statuses; active-alerts ordering/hiding; ack semantics + ownership.
- Updated to the new contract: `finder.test.ts` (email-only now 400), `finder-full.test.ts`, `mobile-features.test.ts` (phone added), `pet-detail-lost-mode.test.tsx` (confirmation dialogs first).
- `tests/unit/scan-alert-words.test.ts` (new): labels cover every emitted type; area wording never repeats city / never emits coordinates.
- Shared harness fix: `tests/integration/helpers.ts` `createCustomerWithRBAC` is now idempotent (permission inserts were single-call-per-test only).

## Verification run (2026-10-26)

`typecheck` ✓ · `lint` 0 errors ✓ · `test:unit` **1349/1349** ✓ · `test:integration` **952/952 (+2 pre-existing skips)** ✓ · `smoke` 6/6 ✓ · `regression` 33/33 ✓ · `build` all 4 ✓ · runtime Playwright captures: host banner + alert card + confirm dialog, and PetDetail red theme + history timeline with precision/delivery chips.

## Known limitations / follow-ups

- Push delivery truth depends on Firebase config (service fails closed when unconfigured — history will honestly record `push: failed`).
- No reverse-geocoded street/place names from precise GPS (decision: IP locality only, v1).
- The unused `POST /:tagId/share-location` endpoint stays unwired; consented GPS attaches via the notify payload (existing path). Wiring grant-time auto-share would need LocationEvent dedupe work — deferred.
- `status: 'found'` + `foundTimer`/`finder_reminder` remain write-orphaned legacy (report only — deliberately untouched).
- Background/closed-app visibility relies on OS push permissions (in-app modal alone cannot guarantee it — platform limitation).
