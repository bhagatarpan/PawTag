# Phase 09 — Capacitor iOS/Android Shell, Secure Session, Push, QR, NFC, and Deep Links

## Objective

Package the existing `apps/web` build as a real installable iOS/Android customer app with a thin native layer. Reuse the web UI; add only necessary native capabilities.

## Required skills

`work-packet-executor`, `web-first-mobile-shell`, `mobile-native` (legacy reference only), `security-boundary-review`, `testing-regression`, `api-architecture`

## Architecture decision

Prefer placing Capacitor configuration/native projects with `apps/web` so the customer app has one UI package, e.g.:

```text
apps/web/
  src/                 shared customer React UI
  dist/                Vite output
  capacitor.config.ts
  ios/                 generated/native project
  android/             generated/native project
```

If repository/tooling constraints justify a separate thin shell package, it must contain no duplicate PawTag product UI and must consume the `apps/web` build. Document the reason.

Keep current `apps/mobile` unchanged as a reference until Phase 10 proves parity; do not delete it in this phase.

## Tasks

### A. Capacitor build pipeline

1. Add compatible Capacitor dependencies/config using versions that match the current Node/Vite toolchain.
2. Define deterministic commands such as build web -> sync native -> open/build platform.
3. Configure environment-specific API/base URLs without embedding secrets.
4. Bundle built assets locally in app binary; do not implement the app as merely a remote `https://pawtag...` WebView.
5. Add app identifiers, display name placeholders, icon/splash wiring, orientation policy, status-bar behavior.

### B. Secure session bridge

1. Decide native-shell credential contract with the existing auth API.
2. Use secure platform storage for long-lived native credential if required.
3. Never copy browser HttpOnly refresh tokens into localStorage.
4. Verify login, MFA, refresh, restart, logout, password reset/change, account disable/revocation.
5. Logout removes device push registration/secure credential as applicable.

### C. Push notifications

1. Choose one explicit token/provider architecture. Store token type/provider/platform on the server; do not treat Expo tokens as Firebase tokens.
2. Register/update token after permission and authentication as appropriate.
3. Handle token rotation and logout/device removal.
4. Implement foreground/background/terminated notification behavior.
5. Notification tap routes into existing `apps/web` customer routes via deep link/navigation bridge.
6. Provider misconfiguration must report failure, not fake success.

### D. QR scanning

1. Reuse current Expo flow as behavioral reference only.
2. Implement native camera/barcode bridge behind `platform.scanTag()`.
3. Return normalized tag code/URL to existing React tag activation flow.
4. Permission denied/cancel/invalid/duplicate scan have explicit UX.
5. Manual entry remains fallback.

### E. NFC

1. Implement native NFC bridge behind `platform.scanNfcTag()`.
2. Correctly decode supported NDEF URI/text/tag payloads.
3. iOS/Android capability/permission differences are explicit.
4. Unsupported/cancel/error returns meaningful UI and QR/manual fallback.
5. Do not duplicate tag activation business logic in native code.

### F. Deep links / universal links / app links

Customer-app routes may include account/order/pet/notification destinations.

**Explicitly exclude public Finder URLs.** A finder scan should stay in the browser even when the owner app is installed.

### G. Checkout inside shell

Run the shared web Cart/Checkout unchanged where possible. Validate Stripe authentication/3DS, app background/foreground, external bank/browser handoff, return URL, duplicate submit, and confirmation.

If embedded payment authentication is unreliable, use secure system-browser checkout + deep-link return before considering a second native checkout implementation.

## Acceptance gate

Development/internal builds launch the same PawTag customer UI on iOS and Android; login/session, push registration, deep-link plumbing, QR, NFC bridge, and checkout integration are implemented with explicit error states. Physical-device proof occurs in Phase 10.

Stop before Phase 10.
