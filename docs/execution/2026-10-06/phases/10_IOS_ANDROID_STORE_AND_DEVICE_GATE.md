# Phase 10 — iOS/Android Physical-Device, Store, and Migration Gate

## Objective

Prove the Capacitor customer app on real devices, prepare store releases, and only then retire duplicated Expo/React Native UI.

## Required skills

`work-packet-executor`, `web-first-mobile-shell`, `release-readiness`, `security-boundary-review`, `testing-regression`, `pawtag-ui-ux`

## External prerequisites

See `03_EXTERNAL_OWNER_ACTIONS.md`: Apple/Google accounts, identifiers, physical devices, policy/payment decision for digital membership.

## Real-device matrix

Execute every applicable row in `verification/IOS_ANDROID_REAL_DEVICE_MATRIX.md` on at least:

- one supported physical iPhone;
- one supported physical Android phone with NFC where NFC is part of launch.

Do not mark rows complete from simulator/static inspection.

## Required scenarios

### Core app
- cold launch/warm launch;
- login/MFA;
- app restart with session;
- refresh/session expiry;
- logout/revocation;
- offline launch/reconnect;
- Android back behavior;
- safe areas/notch/home indicator;
- keyboard/form behavior.

### Native bridges
- camera permission allow/deny;
- real QR PawTag scan;
- invalid/duplicate scan;
- real NFC tag read on supported iOS and Android;
- unsupported NFC fallback;
- push permission allow/deny;
- foreground/background/terminated push;
- notification tap deep link;
- token removal on logout.

### Customer product
- pets/tag activation/lost mode;
- order history/invoice;
- Cart/Checkout with Stripe test payment;
- payment authentication/background/return;
- membership display/manage.

### Finder separation
Scan a public Finder tag on a phone with customer app installed and prove it opens/continues the browser Finder experience rather than requiring the app.

## Store readiness

### iOS
- production signing/profile;
- archive/build succeeds;
- privacy usage descriptions for camera/NFC/notifications as applicable;
- App Store privacy declarations based on actual collected data;
- TestFlight build/install/test;
- support/privacy URLs;
- review notes for native capabilities.

### Android
- release signing/AAB;
- permissions minimized;
- Play data-safety declarations based on actual collection;
- internal/closed track build/install/test;
- target SDK/current policy compliance;
- notification channel behavior.

## Digital membership gate

Do not expose an in-app Stripe purchase flow for a digital membership until current Apple/Google policy treatment has been confirmed. Existing members may view/use entitlement if policy permits. Implement the approved purchase adapter/flow before public release.

## Expo retirement

Only after all required Capacitor parity rows are `PROVEN`:

1. identify remaining unique behavior in `apps/mobile`;
2. migrate or deliberately drop it;
3. remove Expo/mobile UI from workspace/build/CI/docs;
4. preserve Git history; do not delete before proof;
5. update README/AGENTS/deployment docs.

## Acceptance gate

TestFlight and Play internal/closed builds are usable by real testers and native capability evidence is recorded. The installed app feels like PawTag, not a browser accidentally wrapped in a frame.

Stop before Phase 11.
