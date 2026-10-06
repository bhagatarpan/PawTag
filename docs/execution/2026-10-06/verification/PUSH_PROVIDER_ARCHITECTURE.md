# Push Notification Provider Architecture (Phase 03)

## Decision

**Target provider for first-customer web launch:** Firebase Cloud Messaging (FCM) via Firebase Admin SDK.

**Native push after Capacitor migration:** FCM registration tokens through the Capacitor push bridge — **not** Expo push tokens.

## Current mismatch (legacy Expo)

| Item | Legacy Expo app | Current backend |
|---|---|---|
| Token type | Expo push tokens (`ExponentPushToken[...]`) | FCM registration tokens expected by Firebase Admin |
| Provider | Expo Push Service | Firebase Cloud Messaging |
| Interchangeable? | **No** | Treat as different token ecosystems |

**Rule:** Never treat Expo push tokens as FCM registration tokens. Sending Expo tokens to Firebase Admin will fail.

## Production delivery rule (Phase 01, preserved)

- Production without Firebase config: `sendPushToUser` returns `{ sent: 0, failed: N, error }` — never claims delivered.
- Dev/test demo path only logs DEMO PUSH.

## First-customer launch posture

| Surface | Push status |
|---|---|
| Customer browser (`apps/web`) | Web Push optional; email remains guaranteed recovery channel for active tags |
| Installed iOS/Android (Capacitor shell) | **DEFERRED** to Phase 09/10 — FCM token bridge + store push certs |
| Legacy Expo app | Reference only — do not add new Expo push paths |

## Evidence state

- Backend fail-closed delivery: **PROVEN (automated)** — `tests/unit/provider-fail-closed.test.ts`
- Live FCM device push: **CODED_NOT_RUNTIME_VALIDATED** — no physical device run this phase
- Expo → FCM migration: **NOT_STARTED** (Phase 09/10)
