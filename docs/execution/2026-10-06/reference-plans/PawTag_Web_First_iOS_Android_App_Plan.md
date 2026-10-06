# PawTag Customer App — Web-First iOS & Android Architecture and Implementation Plan

## Decision

PawTag will use **one customer UI/business-flow implementation**: the existing React + Vite customer web application under `apps/web`.

The App Store and Google Play applications will be **thin native shells** around that same web application using Capacitor (or an equivalent native bridge only if later evidence requires it).

PawTag will **not** maintain separate React Native customer screens for iOS and Android.

There is **no Finder mobile app**. The public Finder/recovery experience remains web-based and must open without installation or authentication.

There is **no Admin mobile app in the current MVP**. A future admin app may reuse the same web-first shell strategy, but it is explicitly out of scope now.

---

# 1. What This Architecture Means

## Shared once

The following remain one implementation in `apps/web`:

- customer pages
- account pages
- product browsing
- cart
- checkout UI
- orders
- invoices
- subscriptions/membership management
- pet management
- health information
- notification center
- settings/profile
- forms and validation presentation
- responsive layouts
- design system usage
- API integration
- business presentation logic

A UI change to these areas is made once in the web application and is used by browser users and the native customer app build.

## Thin native layer only

The native shell exists only for capabilities that browsers/WebViews cannot reliably provide:

- App Store / Play Store packaging
- native splash screen
- native status bar
- safe-area handling
- push notifications (APNs/FCM)
- notification tap/deep-link handling
- camera / QR scanning
- NFC reading where required
- secure native credential/token storage where required
- biometric unlock if later desired
- app lifecycle events
- Android hardware back handling
- native permission dialogs
- universal links / Android App Links
- opening external browser surfaces when required

This is not a second PawTag UI implementation.

---

# 2. Recommended Repository Target

Keep the existing monorepo.

Recommended end state:

```text
apps/
  web/                 # ONE customer UI and customer business presentation
  mobile/              # thin Capacitor/native shell only
  admin/               # desktop-first admin web
  finder/              # public Finder WEB experience only

packages/
  shared/
  ui/
  design-tokens/
  api/
  db/
```

`apps/mobile` should stop being a separate React Native feature application.

It should eventually contain only:

```text
apps/mobile/
  package.json
  capacitor.config.ts
  ios/                  # generated/native project + required native config
  android/              # generated/native project + required native config
  scripts/              # build/sync helpers if required
  README.md              # shell-specific build/release instructions
```

No duplicate customer React screens should remain there after migration is proven.

The `ios/` and `android/` folders are native packaging/configuration projects, not separate PawTag business/UI codebases.

---

# 3. Important Clarification: Do Not Ship a Generic Remote Website WebView

Do not make the production app simply open `https://pawtag...` inside a generic WebView.

Preferred architecture:

1. Build `apps/web`.
2. Package the resulting compiled web assets into the Capacitor app.
3. The packaged application loads those local assets.
4. Those assets call the existing PawTag API over HTTPS.
5. CMS/data/server-controlled content can still change without an app release.
6. JavaScript/UI application-code changes go through normal mobile release/update processes.

Benefits:

- reliable startup
- app can render its shell when connectivity is poor
- less dependency on remote page bootstrap
- clearer versioning and rollback
- better store-review posture
- predictable web/native bridge behaviour

Do not introduce live-update/code-push mechanisms for MVP unless separately reviewed against Apple/Google rules and rollback/security requirements.

---

# 4. App Store / Play Store Constraint

A native shell must feel like a genuine PawTag application, not merely a website with the browser chrome removed.

The PawTag native app should therefore provide genuine native value:

- push recovery alerts
- camera/QR tag activation
- NFC tag interaction if required
- native deep links
- safe native credential handling
- native app lifecycle handling
- native splash/status bar
- proper offline/network recovery
- mobile-specific navigation/chrome

The shared React pages can still render almost all of the visual interface.

---

# 5. Finder Decision

There is **no Finder app**.

This does NOT mean removing the Finder web experience.

The public tag journey must remain:

```text
QR/NFC on pet tag
       ↓
system browser
       ↓
public Finder web page
       ↓
pet information / owner notification / recovery
```

A finder must never need:

- the PawTag app
- an App Store download
- a PawTag account
- an authenticated customer session

Universal Links / Android App Links for the customer application must be configured carefully so that public Finder URLs are not accidentally intercepted by the installed customer app.

---

# 6. Admin Mobile Decision

A dedicated Admin mobile app is **out of the current MVP**.

Do not spend current implementation effort building or packaging it.

The existing admin web application remains desktop-first.

When an Admin mobile app becomes valuable later, review whether the admin responsive web UI is suitable for the same native-shell strategy. Do not create it now merely because the customer shell exists.

---

# 7. Existing `apps/mobile` Migration Strategy

Do not immediately delete the current Expo/React Native application.

It contains useful evidence about intended mobile features:

- QR scanning
- NFC
- push notifications
- deep linking intent
- SecureStore
- native permissions
- Maestro flows
- mobile navigation expectations

Use it as a migration reference, not as the future UI architecture.

## Migration sequence

1. Freeze new product-feature development in the existing React Native screens.
2. Inventory all native-only behaviour currently implemented there.
3. Map each capability to a Capacitor/native bridge implementation.
4. Establish the web-first shell.
5. Achieve functional parity for required MVP native capabilities.
6. Run iOS/Android real-device validation.
7. Only after parity is proven, remove the obsolete React Native screens/dependencies.

Do not delete working native knowledge before the replacement proves it.

---

# 8. Phase A — Architecture Foundation

## Objective

Convert the mobile architecture from duplicated React Native UI to a thin native shell around `apps/web`.

## Tasks

- Adopt Capacitor for the customer app shell.
- Repurpose `apps/mobile` rather than create a second customer product.
- Add Capacitor core/CLI/iOS/Android packages.
- Generate iOS and Android native projects.
- Define stable bundle/application identifiers.
- Add root scripts that:
  - build shared packages
  - build `apps/web`
  - sync the web build into Capacitor
  - open/build iOS
  - open/build Android
- Establish development, staging and production native configurations.
- Ensure API base URLs differ safely by environment.
- Do not hardcode production credentials in native configuration.

## Acceptance

- One `apps/web` build is the UI loaded by browser, iOS shell and Android shell.
- No new React Native UI is required for ordinary PawTag customer pages.
- iOS simulator and Android emulator launch the shared web application successfully.

---

# 9. Phase B — App-Aware Web UI

## Objective

Make the existing web UI behave as a deliberate mobile application when running inside the native shell.

## Architecture

Add one platform abstraction, for example:

```text
apps/web/src/platform/
  platform.ts
  PlatformProvider.tsx
  capabilities.ts
```

It should expose concepts such as:

- `isNativeApp`
- `platform: web | ios | android`
- `openExternalUrl()`
- `scanQr()`
- `readNfc()`
- `registerPush()`
- `secureStorage`
- app lifecycle events

The rest of the app should not directly depend on Capacitor everywhere.

## UI changes

When `isNativeApp`:

- remove unnecessary marketing-site chrome from authenticated app screens
- use native-safe top/bottom padding
- account for notches/home indicators
- avoid desktop hover-dependent interactions
- use app-style back/navigation behaviour
- provide a persistent mobile navigation model
- support Android hardware back behaviour
- prevent accidental app exit during important flows
- make forms keyboard-safe
- ensure dialogs and bottom sheets fit small screens

## Recommended native app navigation

Use the same React Router routes but present app-oriented navigation such as:

```text
Home | Pets | Activate | Activity | Account
```

This is presentation/chrome around the existing pages, not duplicate screens.

---

# 10. Phase C — Authentication and Secure Session Handling

## Objective

Do not inherit insecure browser storage assumptions into the installed app.

## Tasks

- Finish the web authentication hardening already identified in the main MVP plan.
- Define one authentication contract that works for browser and native-shell contexts.
- Do not store long-lived refresh credentials in ordinary WebView localStorage.
- Prefer HttpOnly cookie authentication where the final API/domain architecture supports it reliably.
- Where native secret storage is required, bridge to iOS Keychain / Android Keystore through a maintained secure-storage plugin.
- Ensure logout clears:
  - browser/session state
  - native secure state
  - push registration association as required
- Verify MFA inside the shell.
- Verify password reset and email-verification deep links.

## Acceptance

A customer can log in, MFA, restart the app, refresh credentials, log out and re-login without leaking credentials into unsafe storage or becoming stuck between web/native state.

---

# 11. Phase D — Native Push Notifications

## Objective

Make recovery alerts genuinely native while retaining the existing web notification center.

## Tasks

- Choose one correct push architecture.
- Native iOS registration must reach APNs through the selected provider.
- Native Android registration must reach FCM through the selected provider.
- Do not confuse Expo tokens with FCM/APNs tokens.
- Store token type/platform explicitly on the backend.
- Associate device tokens with the authenticated user/device installation.
- Remove/unregister associations on logout where appropriate.
- Handle invalid/expired device tokens.
- Notification taps must deep-link to the correct existing React route.
- Test foreground, background and terminated states.

## Required deep-link examples

- pet recovery/finder alert → relevant pet/recovery activity
- order status → order detail
- subscription issue → membership/subscription detail
- general notification → notifications page

---

# 12. Phase E — QR Camera Bridge

## Objective

Use native camera scanning but keep the existing web tag activation workflow.

Current `apps/web/src/pages/account/RedeemTag.tsx` is currently manual tag entry.

Enhance it so the same page can invoke a native capability:

```text
Activate Tag page
     ↓
Scan QR
     ↓
native camera plugin
     ↓
returns tag identifier / PawTag URL
     ↓
existing web activation form/service
```

The business action remains the existing backend/API flow.

Browser users retain manual entry (and browser camera scanning only if intentionally supported later).

## Acceptance

No duplicate "native activation screen" is required.

---

# 13. Phase F — NFC Bridge

## Objective

Support owner NFC workflows without introducing duplicate app UI.

NFC is a native capability boundary.

Do not assume normal web APIs inside WKWebView can provide production NFC parity.

Implement a native bridge that returns a normalized PawTag tag identifier/URL to the shared React activation workflow.

## Requirements

- iOS permission/capability configuration
- Android NFC permissions/features
- robust NDEF URI decoding
- unsupported-device handling
- user-cancel handling
- invalid-tag handling
- retry UX
- physical PawTag validation on real devices

---

# 14. Phase G — Deep Links and Public Finder Separation

## Objective

Installed customers should receive useful PawTag app links without breaking the stranger Finder journey.

## Customer-app deep links

Examples:

- account routes
- order detail
- pet detail/recovery state
- notifications
- activation where explicitly intended

## Finder URLs

Public Finder URLs must remain browser-first.

Do not configure broad wildcard association rules that cause an installed customer's PawTag app to intercept every public tag URL.

Test this explicitly on both platforms.

---

# 15. Phase H — Cart and Checkout in the Native Shell

## Principle

Continue using the single premium web Cart/Checkout implementation from the main MVP plan.

Do not rebuild it in React Native.

The 70/30 desktop layout naturally transforms into the existing designed mobile composition at small widths.

## Native-shell validation

Test:

- cart
- promo/rewards
- shipping selection
- address autocomplete
- keyboard interaction
- Stripe fields
- 3DS/SCA flows
- payment cancellation
- payment failure
- payment recovery
- order confirmation
- invoice access
- deep-link return behaviour

If the embedded WebView proves unreliable for a supported payment method, use a secure system-browser/app-to-web checkout fallback with a verified deep-link return rather than duplicating the complete checkout UI in native code.

---

# 16. Critical Store-Payments Decision

PawTag sells physical goods, but it also currently contains Gold/membership functionality that may be classified as a digital subscription/service.

These must not be treated identically.

## Physical PawTag products

Physical goods can continue using PawTag/Stripe payment methods, subject to normal implementation validation.

## Gold / digital membership

Before App Store/Play Store submission, classify exactly what Gold unlocks.

If Gold is a digital subscription or unlocks functionality consumed in the mobile app, Apple/Google billing policies may require platform billing.

Until that is resolved, the safest native-shell MVP policy is:

- allow existing entitled users to see/use their permitted account features
- do not expose an in-app Stripe purchase/upgrade CTA for a digital-only Gold membership in store builds
- keep web-browser purchasing separate where store rules permit
- or implement StoreKit/Google Play Billing plus backend entitlement reconciliation before enabling native in-app purchase

This decision is a genuine launch blocker for the store build if Gold is purchasable inside the app.

---

# 17. Phase I — App-Like UX and Store Review Quality

## Objective

Ensure users feel they are using PawTag, not a website trapped in a frame.

## Required app-level polish

- native splash
- correct app icon
- native status-bar styling
- safe areas
- mobile bottom navigation for account experience
- no browser-looking blank margins
- no hover-only controls
- no accidental text selection where inappropriate
- appropriate keyboard types
- sensible Android back behaviour
- app lifecycle restoration
- network retry state
- offline state
- loading/skeleton states
- native push
- QR/NFC capability
- deep links
- external links open safely
- file/photo upload tested
- responsive Cart/Checkout tested

Native features provide meaningful app-specific utility and reduce App Store "repackaged website" risk.

---

# 18. Phase J — Network and Offline Behaviour

The app does not need to become fully offline-first for MVP.

It does need predictable failure behaviour.

## Requirements

- packaged shell loads even if API is temporarily unreachable
- clear offline/network state
- retry API requests where safe
- never retry payments destructively
- preserve safe in-progress state where possible
- app resumes cleanly after backgrounding
- expired session redirects predictably
- WebView renderer/process recovery is handled where applicable

---

# 19. Phase K — Testing Strategy

One shared UI implementation dramatically reduces test duplication.

## Shared web tests

Continue using:

- unit tests
- API integration tests
- Playwright browser E2E
- responsive viewport tests

These prove most PawTag behaviour once.

## Native-shell tests

Native testing should focus only on the bridge/platform boundary:

- app launch
- authentication persistence
- Android back
- deep links
- push registration/delivery/tap
- QR permission + real scan
- NFC permission + real tap
- camera denial
- notification denial
- network loss/recovery
- external browser return
- checkout WebView/payment behaviour

Do not duplicate every web E2E test as native automation.

---

# 20. Phase L — Real-Device Matrix

Before release, execute rather than merely document the matrix.

## iOS

At minimum:

- current supported iPhone
- one older supported iPhone/iOS combination
- camera QR
- NFC on NFC-capable device
- push foreground/background/terminated
- deep links
- safe areas
- keyboard
- Stripe checkout and 3DS
- photo upload where applicable
- offline/reconnect

## Android

At minimum:

- recent Pixel/reference Android
- one Samsung/common OEM device
- recent supported Android version
- one older supported Android version
- camera QR
- NFC
- push
- app links
- Android hardware back
- keyboard
- Stripe checkout and 3DS
- offline/reconnect

---

# 21. Phase M — iOS Release Readiness

- Apple Developer account/team
- bundle ID
- signing/provisioning
- app icon
- launch screen
- permission purpose strings
- camera permission
- NFC entitlement/description if used
- push/APNs configuration
- Associated Domains
- privacy disclosures
- privacy manifest requirements
- App Store screenshots/metadata
- support/privacy URLs
- TestFlight internal test
- TestFlight external test if appropriate
- App Review notes explaining native functionality
- account/review credentials where required
- payment-policy review for Gold/membership

---

# 22. Phase N — Android Release Readiness

- application ID
- signing key management
- Play App Signing
- recent target API compliance
- Firebase/FCM configuration
- camera permission
- NFC permission/features
- Android App Links
- network security configuration
- Data Safety form
- content rating
- screenshots/metadata
- internal test track
- closed test if required
- production staged rollout
- payment-policy review for Gold/membership

---

# 23. Phase O — Controlled Migration Away From React Native

Only after the Capacitor shell has proven all required MVP capabilities:

1. confirm feature parity against required customer mobile scope
2. preserve any useful tests/specifications
3. remove obsolete React Native screens/navigation
4. remove Expo-only packages no longer needed
5. remove stale Expo/EAS configuration if Capacitor becomes final
6. update README/AGENTS/skills/docs
7. update CI
8. verify there is now one customer UI source of truth

Do not retain two customer app architectures indefinitely.

---

# 24. CI/CD Target

## Web validation

Every change:

- lint
- typecheck
- unit/integration tests
- web build
- Playwright critical paths

## Native validation

For release candidates:

- build web
- Capacitor sync
- iOS build
- Android build
- native bridge smoke automation
- signed staging/internal builds
- real-device checklist

Native app releases should reference the exact web application commit included in the binary.

---

# 25. Rollback Strategy

Because web code is bundled in the app, keep release versioning explicit.

If a native build is faulty:

- stop staged rollout where possible
- retain previous store version
- fix/rebuild/re-submit

Server-side feature flags may disable risky features, but must never be used to bypass security/payment correctness.

The backend must retain compatibility with a reasonable window of installed mobile versions; do not deploy breaking API changes without a version/compatibility strategy.

---

# 26. What We Are Explicitly NOT Doing

For the current MVP:

- no separate native iOS UI codebase
- no separate native Android UI codebase
- no React Native recreation of customer pages
- no Finder app
- no Admin mobile app
- no duplicate native Cart
- no duplicate native Checkout
- no duplicate native account management
- no React Native Web migration
- no Tamagui/gluestack migration merely for sharing
- no micro-frontend split for mobile

---

# 27. Definition of Done

The customer mobile strategy is complete when:

1. Browser and native app use the same customer React/Vite UI source.
2. iOS and Android packages are generated from one thin shell configuration.
3. Login/MFA/session handling is secure and reliable.
4. Push works on physical iOS and Android devices.
5. Push taps route into the existing React application correctly.
6. QR activation uses native camera access and the existing web business workflow.
7. NFC uses a native bridge and the existing web business workflow where required.
8. Finder public URLs remain browser-first and app-independent.
9. Cart and Checkout use the same premium web implementation on browser and installed apps.
10. Payment flows work on physical devices including required 3DS/recovery scenarios.
11. Gold/membership store-policy treatment is resolved before exposing purchase in store builds.
12. Offline/network errors are understandable and recoverable.
13. iOS TestFlight validation passes.
14. Android internal/closed testing passes.
15. App Store and Play Store policy/metadata/privacy requirements are complete.
16. The obsolete React Native UI implementation is removed only after replacement parity is proven.

---

# 28. Recommended Execution Order Relative to the Main MVP Plan

Do not build the shell before the shared web application is stable enough.

Recommended sequencing:

```text
Core API/payment/security correctness
        ↓
Premium shared Cart + Checkout
        ↓
Responsive customer account polish
        ↓
Capacitor foundation
        ↓
App-aware UI shell
        ↓
Auth/session bridge
        ↓
Push/deep links
        ↓
QR/NFC
        ↓
Payment/store-policy validation
        ↓
Native device testing
        ↓
TestFlight / Play internal
        ↓
Store submission
```

Parallel work is acceptable for App Store accounts, signing setup, icons, privacy disclosures and device provisioning, but do not let store packaging distract from core financial/security correctness.

---

# 29. AI Agent Execution Instruction

Use this when handing the plan to the coding agent:

> PawTag has adopted a web-first customer mobile architecture. `apps/web` is the single customer UI/business-presentation source of truth. iOS and Android must be thin native shells around this web application, not separate React Native feature implementations. There is no Finder mobile app and no Admin mobile app in the current MVP. Execute this plan phase by phase in dependency order. Do not duplicate customer screens in native code. Introduce native code only for platform capabilities that cannot be provided reliably by the shared web application. Preserve the existing Expo app until required native capability parity has been proven, then remove the obsolete React Native implementation in a controlled cleanup phase. Follow AGENTS.md and the relevant repository skills. Do not proceed to the next phase until the current phase acceptance criteria and tests are complete.
