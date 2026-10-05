# Onboarding Verification + Default Home Address

**Branch:** `feature/onboarding-verification-home-address`  
**Status:** In progress  
**Scope:** Customer web (registration verification gate, onboarding wizard UX, onboarding address → default Home)  
**Last updated:** 2026-10-06

---

## Product requirements

1. During new customer registration, **email and mobile must be verified before customer onboarding can complete**.
2. During onboarding, **pre-populate** mobile and email in the wizard and **show verified ticks**.
3. If the user **changes** email or mobile in the wizard, **ask to reverify** and block progress until verified again.
4. When the customer adds their own address during onboarding, **save it as their default Home address** (address book).

## Locked decisions

| # | Decision |
|---|---|
| 1 | Admin-created owners must verify phone before onboarding **completes** |
| 2 | **Skip** onboarding without verification is allowed |
| 3 | Address = free-text `label: 'Home'` + `isDefault` (no `addressType` enum) |
| 4 | Web only this packet; mobile is a separate packet |
| 5 | Changing email/phone in wizard → must reverify before Next |
| 6 | Keep `otp.skipOtpDuringRegistration` (default `false`) as admin outage switch |

---

## Current vs target

```text
CURRENT (normal web happy path)
  register → pending_verification → verify email+phone → active+tokens
  → login → /account → wizard (no verification re-check)
  → PUT /auth/profile (legacy User.address only)

TARGET
  register → pending → verify email+phone → active+tokens → login
  → gate: both verified before wizard renders (frontend + server on complete)
  → wizard: email/phone prefilled + verified ticks
  → if user edits email/phone → warn + block Next until reverified
  → address step → PUT /auth/profile (legacy) + address book
       { label: 'Home', isDefault: true }
  → onboarding-complete requires both flags true
```

---

## Architecture / data flow

```text
Web AccountLayout
  ├─ user loaded && (!emailVerified || !phoneVerified)
  │     → Navigate /verify-account
  └─ both verified && onboarding incomplete
        → OnboardingWizard
              contact step → PUT /auth/profile
              address step → PUT /auth/profile (legacy address)
                           → GET/POST/PUT /customer/addresses
                                label: 'Home', isDefault: true
              complete → PUT /customer/settings/onboarding-complete
                           server: requireVerifiedChannels
              skip/dismiss → allowed without verification (product decision 2)
```

### Server gate

| Endpoint | Verification required? |
|---|---|
| `PUT /customer/settings/onboarding-complete` | **Yes** — `emailVerified && phoneVerified` |
| `PUT /customer/settings/onboarding-skip` | No |
| `PUT /customer/settings/onboarding-dismiss` | No |

Middleware: `requireVerifiedChannels` in `packages/api/src/middleware/verificationGuard.ts`  
- Loads user by JWT id  
- Blocks suspended/inactive  
- Returns `403` + `code: 'REQUIRES_VERIFICATION'` + `{ emailVerified, phoneVerified }` when either flag is not true  

This covers admin-created owners (`status=active`, `phoneVerified=false`) and contact-change bypasses (`status` stays `active` after profile update).

---

## Business rules

1. Onboarding **complete** is blocked server-side until both channels are verified.
2. Onboarding **skip** remains available without verification (return later).
3. Wizard does not mount for unverified users; redirects to `/verify-account`.
4. Changing email or phone in the wizard clears the corresponding server flag (existing `PUT /auth/profile` behavior) and blocks Next until reverified.
5. Profile phone updates are normalized (same as OTP/register paths).
6. Onboarding address:
   - always writes legacy `User.address` (Finder / shipping compatibility);
   - also syncs to address book as **default Home** (`label: 'Home'`, `isDefault: true`);
   - updates existing default Home or same street/city/zip entry when present;
   - creates a new entry when needed, respecting the max-5 limit;
   - does not invent `addressType` enums.
7. `otp.skipOtpDuringRegistration` remains an admin-controlled outage switch (default `false`).

---

## UI / UX states

### Contact step (onboarding)

| State | Behavior |
|---|---|
| Prefill race | Form syncs from authenticated `user` when it first loads (not one-shot `useState`) |
| Verified email/phone | Green `CheckCircle` + “Verified” |
| Unverified | Amber “Verify” link → `/verify-account` |
| User edits either field | Inline warning: changing contact requires re-verification |
| After save, flags cleared | Block Continue; show error + “Verify email/phone” CTA |
| Save API error | Surface message (no silent swallow) |

### Address step

| State | Behavior |
|---|---|
| Complete street/city/zip | Save legacy address + sync address book as default Home |
| Sync success | Optional “Saved as your default Home address” confirmation |
| Sync failure | Block Continue with clear error; user can retry |
| Address book at max 5 | Clear error; do not silently drop |

### Account layout

| State | Behavior |
|---|---|
| Auth loading | Spinner (no wizard flash) |
| Unverified | Redirect to `/verify-account` |
| Verified + incomplete onboarding | Mount wizard |
| Verified + completed/skipped | Normal account shell |

---

## Implementation checklist

- [x] Phase 0 — feature doc + branch
- [x] Phase 1 — `requireVerifiedChannels` + mount on onboarding-complete
- [x] Phase 2 — AccountLayout gate + wizard prefill/ticks/reverify
- [x] Phase 3 — `normalizePhone` on `PUT /auth/profile`
- [x] Phase 4 — onboarding address → default Home in address book + shared `Address` type
- [x] Phase 5 — integration tests + typecheck (api) / targeted lint
- [x] Phase 6 — docs + final summary + commit approval

---

## Risks

| Risk | Mitigation |
|---|---|
| Admin-created users stuck on verify-account until phone OTP | `/verify-account` already supports phone OTP |
| Contact change mid-onboarding forces detour | Intentional (decision 5); copy explains why |
| Address book sync fails after profile save | Surface error; retry path |
| Max 5 addresses | Clear error; no silent overwrite |
| Existing tests calling onboarding-complete | Helpers already seed `emailVerified`/`phoneVerified: true` |
| Legacy `User.address` still required by Finder | Keep writing both stores |

---

## Verification performed (this branch)

| Command / check | Result |
|---|---|
| `npx vitest run tests/integration/onboarding-verification.test.ts tests/integration/auth.test.ts tests/integration/audit-api.test.ts` | **PASS** — 46 tests |
| `pnpm --filter @pawtag/api typecheck` | **PASS** |
| `npx eslint packages/api/src/middleware/verificationGuard.ts` | **PASS** (no errors) |
| `npx tsc --noEmit -p apps/web` | **FAIL — pre-existing** `packages/ui` Lucide/React 19 type conflicts + duplicate `items` in `packages/ui/src/types.ts`. **No errors in `OnboardingWizard.tsx` or `AccountLayout.tsx`.** |
| `pnpm --filter @pawtag/web build` | **FAIL — same pre-existing `packages/ui` type errors** |
| Full `pnpm test:integration` | Ran entire suite; **many pre-existing failures** unrelated to this packet (finder/stripe/subscriptions/tag/mobile). Targeted onboarding + auth + audit tests pass. |
| Manual browser verification | **Not performed** (no interactive browser session in this environment) |

### Pre-existing failures (not introduced by this packet)

- `packages/ui` TypeScript: Lucide icons incompatible with React 19 types; `types.ts` duplicate `items` identifier
- Full integration suite: multiple finder/stripe/subscriptions/tag-redemption failures that predate this branch
- Root API eslint: large pre-existing warning/error backlog (not from verificationGuard)

---

## Progress log

- 2026-10-06 — Audit complete; decisions locked; branch created; implementation complete; targeted tests pass; awaiting commit/push approval.
