# PawTag iOS + Android — Verified Mobile Audit and Implementation Plan

**Status:** Verified against the current uploaded PawTag repository snapshot  
**Primary codebase:** `apps/mobile` (Expo + React Native)  
**Audience:** Founder, technical lead, AI coding agent, QA/release owner  
**Purpose:** Bring the PawTag native mobile application from its current partial/early-beta state to a controlled iOS/Android production release without duplicating the web platform unnecessarily.

---

# 1. Executive Decision

PawTag does **not** currently have two separate applications for iOS and Android. It has **one shared Expo/React Native application** under `apps/mobile` that is intended to compile for both platforms.

That is the correct architectural direction for PawTag.

Do **not** split this into separate iOS and Android codebases.

The current app is best described as:

> **A meaningful native MVP scaffold / early beta, but not yet production or App Store / Play Store ready.**

Substantial functionality exists:

- authentication;
- registration;
- forgot password;
- MFA UI;
- pet listing;
- pet creation;
- pet detail/edit/delete;
- lost/found controls;
- QR tag scanning;
- NFC tag reading;
- tag redemption/linking;
- health record viewing/deleting;
- subscription viewing;
- order history;
- Guardian dashboard;
- push-token registration;
- secure token storage;
- EAS build configuration;
- three Maestro mobile flows.

However, several critical mobile workflows are incomplete or currently inconsistent with their backend integrations.

The highest-risk defects are:

1. Expo push tokens are registered by the app, while the backend sends with Firebase Admin as if they were raw FCM/APNs-compatible tokens.
2. push notification taps do not navigate anywhere;
3. MFA verification stores tokens but does not establish the authenticated React state, so MFA login can remain stuck on the auth flow;
4. logout does not unregister the device push token;
5. Guardian buttons navigate to routes that do not exist;
6. tag-redemption success screens navigate to a `Pets` route that is not registered in the root stack from which that screen is rendered;
7. health records are presented as manageable, but the mobile UI only reads/deletes them — the declared add state is unused;
8. real QR, NFC, push and deep-link behaviour has not been proven on physical iOS and Android devices;
9. root CI does not build the native app and Maestro is not an enforced CI/release gate;
10. production EAS/store submission configuration is incomplete;
11. there is no mobile crash reporting/observability integration;
12. the app has no mature Profile / Settings / Support / Privacy / Account-management area;
13. tablet/responsive behaviour is largely unimplemented despite `supportsTablet: true`;
14. offline/network recovery is minimal;
15. the current Maestro tests are useful scaffolds but do not prove the critical native capabilities they are named after.

If PawTag launches its first customers through the responsive web + Finder experience, the native apps should initially remain **internal beta / TestFlight / Play internal testing** until this plan is complete.

If the native apps are intended to be available to the first paying customer, the mobile production gate in this plan becomes a **launch blocker**.

---

# 2. Recommended Product Role for the Native App

Do not attempt to reproduce every web feature natively before launch.

The native mobile application's MVP role should be:

## Owner companion app

Native app owns the workflows that benefit materially from native capabilities:

- sign in / secure session;
- manage pets;
- manage lost mode;
- activate/link a physical QR/NFC tag;
- receive recovery alerts;
- receive important order/status alerts;
- view basic subscriptions;
- view order history;
- manage essential account/security settings.

## Finder stays web-first

A person finding a lost animal must **not** be forced to install PawTag.

QR/NFC finder links should continue to work immediately in the mobile browser.

## Commerce remains web-first for first native release

Do **not** duplicate the new premium web cart and checkout natively before first-customer release.

For native v1:

- shopping can open the responsive PawTag web storefront;
- cart/checkout/payment remain web-controlled;
- authenticated app-to-web transition should be deliberate and secure;
- orders/subscriptions can be displayed natively after purchase.

Revisit fully native commerce only after real usage demonstrates it is valuable.

This avoids maintaining two financially sensitive checkout implementations.

---

# 3. Current Mobile Architecture

Current structure:

```text
apps/mobile/
├── App.tsx
├── app.json
├── eas.json
├── e2e/
├── src/
│   ├── api/client.ts
│   ├── components/
│   ├── lib/
│   │   ├── auth-context.tsx
│   │   ├── tokenStorage.ts
│   │   ├── pushNotifications.ts
│   │   └── site-availability.ts
│   ├── navigation/RootNavigator.tsx
│   ├── screens/
│   └── theme/tokens.ts
```

Stack:

- Expo 54
- React Native 0.81.x
- React 19
- React Navigation 7
- Expo Camera
- Expo Notifications
- Expo SecureStore
- `react-native-nfc-manager`
- EAS build profiles
- Maestro E2E scaffolding

This architecture should be evolved incrementally, not replaced.

---

# 4. Verified Current-State Matrix

| Area | Current State | Verdict |
|---|---|---|
| Shared iOS/Android codebase | Expo/React Native | Good direction |
| Secure token persistence | Expo SecureStore | Good foundation |
| API refresh client | Shared async storage contract | Improved / sound direction |
| Login | Implemented | Needs native-flow validation |
| MFA | UI/API implemented | **Broken completion state** |
| Registration | Implemented | Needs policy/account lifecycle completion |
| Forgot password | Implemented | Needs deep-link/reset journey validation |
| Navigation | Implemented | **Contains invalid/dead routes** |
| Deep linking | App scheme declared | **Navigation integration incomplete** |
| Pet list/detail | Implemented | Functional scaffold |
| Pet create/edit/delete | Implemented | Needs UX/data parity review |
| Pet media/photos | Not materially implemented in native screens | Gap |
| Lost/found | Implemented | Needs device/E2E proof |
| QR activation | Scanner code fixed | Needs real-device E2E proof |
| NFC activation | NDEF decoding implemented | Native config/device proof required |
| Health records | View/delete | **Create/update incomplete** |
| Orders | Read-only history | Partial |
| Subscriptions | Read + external management portal | Partial but reasonable for v1 |
| Guardian | Dashboard | **Dead navigation actions** |
| Push registration | Expo token | Implemented client-side |
| Push delivery | Firebase backend | **Protocol mismatch** |
| Notification taps | Listener registered | **No navigation implemented** |
| Push logout cleanup | helper exists | **Not wired into logout** |
| Offline mode | Very limited | Needs work |
| Accessibility | Inconsistent | Needs work |
| Tablet layouts | No meaningful adaptive layout layer | Needs work |
| Native crash monitoring | Not present in mobile package | Needs work |
| Maestro | 3 flows | Weak production evidence |
| Real-device proof | Checklist exists | Not demonstrated by code/repo evidence |
| Native CI build | Not part of root build | Missing |
| iOS submission config | Placeholders remain | Incomplete |
| Android submission config | External service account expected | Needs secure CI setup |

---

# 5. Critical Verified Defects

## M-C1 — Expo push token / Firebase sender mismatch

### App

`apps/mobile/src/lib/pushNotifications.ts`

The app calls:

```ts
Notifications.getExpoPushTokenAsync()
```

and sends the resulting Expo token to:

```text
POST /customer/push-tokens
```

### Backend

`packages/api/src/services/push-notification.service.ts`

The backend sends every stored token through Firebase Admin:

```ts
messaging.send({ token, ... })
```

### Problem

An Expo push token is not the same thing as a raw FCM registration token.

This is a cross-system contract defect.

### Required decision

Use **one explicit push transport architecture**.

Recommended for PawTag mobile MVP:

> Use Expo Push Service for Expo push tokens.

Store token provider/type explicitly.

Suggested data model concept:

```text
PushToken
  userId
  token
  platform = ios | android | web
  provider = expo | fcm | apns | webpush
  deviceId/installId
  isActive
  lastUsedAt
```

Do not report push delivery as successful when no real production provider is configured.

---

## M-C2 — MFA login does not complete authenticated application state

`apps/mobile/src/screens/LoginScreen.tsx`

After MFA verification:

- access token is stored;
- refresh token is stored;
- returned `user` is read;
- but the auth context's `user` state is not updated;
- `refreshUser()` is not called.

The comment says the user will be set "on next refresh", but there is no immediate state transition.

### Required fix

Move MFA completion into the AuthContext or expose a dedicated `completeMfaLogin()` action that:

1. verifies OTP;
2. stores tokens;
3. establishes `user`;
4. registers push token after authenticated state exists;
5. transitions into MainTabs.

Authentication state must have one owner.

---

## M-C3 — Push notification tap handling is a no-op

`apps/mobile/src/navigation/RootNavigator.tsx`

The response listener checks `data.petId`, then only contains comments.

### Required fix

Create a root navigation ref and a typed notification routing contract.

Examples:

```text
pet_found      -> PetDetail / LostMode
finder_scan    -> PetDetail / LostMode
order_shipped  -> OrderDetail
subscription   -> Subscriptions
security       -> AccountSecurity
```

Handle:

- app foreground;
- background;
- cold start from notification;
- unauthenticated state;
- expired session;
- missing/deleted target resource.

---

## M-C4 — Push token persists after logout

`unregisterPushNotifications()` exists but `logout()` does not call it.

This can cause a signed-out/shared device to continue receiving another user's PawTag alerts.

### Required fix

Before clearing local auth:

1. deactivate the current device token for the authenticated user;
2. tolerate network failure by also rotating/install-binding tokens server-side;
3. clear local notification association;
4. then clear auth tokens.

Do not delete every user's tokens from the device indiscriminately if multi-device use is supported.

---

## M-C5 — Guardian dashboard navigates to screens that do not exist

`GuardianDashboardScreen.tsx` calls:

```text
GuardianPoints
GuardianRewards
```

Neither is registered in `RootStackParamList` or `RootNavigator`.

### Required fix

For MVP choose one:

- implement the screens; or
- remove/replace the actions with functionality that actually exists.

Recommended: implement lightweight read-only history/reward screens if backend contracts are stable; otherwise remove the buttons from launch UI.

No dead CTA is acceptable in production.

---

## M-C6 — Tag activation success navigation is invalid from root stack

`RedeemTagScreen.tsx` navigates to:

```ts
navigation.navigate('Pets', ...)
```

But `Pets` is a tab route nested under `MainTabs`, not a root stack route.

### Required fix

Use typed nested navigation, e.g. navigate to `MainTabs` with the Pets tab target, or reset the stack intentionally after successful activation.

Remove `any` navigation typing so this class of defect becomes a compile-time error.

---

## M-C7 — Health Records mobile management is incomplete

`HealthRecordsScreen.tsx` declares:

```ts
const [showAdd, setShowAdd] = useState(false)
```

but there is no implemented add flow using it.

The empty state tells the user to add a record, while there is no action for doing so.

Current mobile supports viewing and deleting, not full management.

### Required fix

Either:

A. implement create/edit for all supported health record types; or

B. make v1 explicitly read-only and remove misleading "Add" wording and destructive delete if parity cannot be supported safely.

Recommended for PawTag owner app: implement add/edit/delete with shared validation contracts.

---

## M-C8 — Native E2E tests do not prove the named capabilities

Current Maestro flows are scaffolds, not true acceptance tests.

Examples:

- QR E2E cancels the camera rather than scanning a QR code;
- QR manual activation accepts either success **or failure** as a passing outcome;
- NFC E2E explicitly does not tap a physical NFC tag;
- lost-mode flow depends on pre-existing environment data.

### Required fix

Keep Maestro for deterministic UI/navigation tests, but add a physical-device release checklist with controlled fixtures.

A test named "QR activation" must ultimately prove a real QR tag can be scanned and linked on at least one iOS and one Android device.

---

# 6. Architecture Decision: Shared Web + Mobile

Keep:

- shared API contracts;
- shared DTOs/types;
- shared validation rules where platform-neutral;
- shared business rules;
- shared design tokens;
- shared formatting utilities.

Do not force-share:

- React DOM components;
- React Native components;
- navigation;
- camera;
- NFC;
- push;
- permissions;
- secure storage;
- platform-specific forms/controls.

Recommended shape:

```text
packages/
  shared/
    api contracts
    DTOs
    formatters
    business rules
  design-tokens/
    colors
    spacing
    typography
    radius
    semantic tokens

apps/web/
  DOM UI

apps/mobile/
  React Native UI
  native adapters
```

The current `apps/mobile/src/theme/tokens.ts` should evolve toward consuming shared platform-neutral tokens rather than manually duplicating design values.

---

# 7. Native Mobile MVP Scope

## Must have before public native release

- reliable login/logout/session refresh;
- MFA completion;
- registration and account lifecycle;
- pet list/detail/create/edit;
- lost/found mode;
- QR activation;
- NFC activation where platform/device supports it;
- push registration and real delivery;
- notification tap routing;
- basic subscriptions;
- order history;
- Profile/Settings/Support/Privacy;
- loading/error/empty/success states;
- accessibility baseline;
- crash monitoring;
- real-device release testing;
- production EAS configuration;
- iOS/Android store release pipeline.

## Can remain web-first in mobile v1

- product browsing;
- premium cart;
- checkout;
- payment details;
- complex refunds/returns;
- advanced CMS/content;
- detailed loyalty administration.

## Must not be duplicated merely for parity

Do not rebuild web functionality natively unless it benefits the mobile use case.

---

# 8. Phased Implementation Plan

# Phase M0 — Mobile Release Decision and Scope Lock

## Objective

Define whether native apps are part of the first-customer launch or a controlled beta immediately after web launch.

## Autonomous decision

Unless the founder explicitly requires public native store availability for customer #1:

> Treat native mobile as **beta parallel track**, not a blocker for the web/Finder first-customer launch.

## Deliverables

Create/update:

- `docs/mobile/MOBILE_SCOPE.md`
- `docs/mobile/MOBILE_RELEASE_GATE.md`

Define native v1 features from Section 7.

## Gate

No new native commerce implementation starts during mobile hardening.

---

# Phase M1 — Reproducible Mobile Baseline

## Objective

Prove the app can be typechecked and built reproducibly before feature work.

## Files

- `apps/mobile/package.json`
- `apps/mobile/app.json`
- `apps/mobile/eas.json`
- root package/CI config

## Tasks

1. Run/install clean dependencies using repository lockfile.
2. Run mobile typecheck.
3. Run mobile lint.
4. Start Expo development build.
5. Produce Android development build.
6. Produce iOS development build.
7. Record environment requirements.
8. Confirm `EXPO_PUBLIC_API_URL` for dev/staging/prod.
9. Add environment validation for mobile build profiles.
10. Confirm EAS project linkage and project ID.
11. Remove accidental production fallbacks to localhost.

### API URL rule

A production native build must never silently fall back to:

```text
http://localhost:5000/api
```

Production build should fail configuration validation if API URL is missing.

## CI

Add at minimum:

- mobile typecheck;
- mobile lint;
- Expo config/prebuild validation.

Add scheduled/release EAS native builds rather than building full iOS/Android binaries on every small PR if cost/time is excessive.

## Gate

Both platform development builds install and launch successfully.

---

# Phase M2 — Typed Navigation and Route Integrity

## Objective

Eliminate runtime navigation mistakes.

## Files

- `src/navigation/RootNavigator.tsx`
- all screens using `navigation: any` / `route: any`

## Tasks

1. Define typed root stack params.
2. Define typed tab params.
3. Define nested navigator types.
4. Replace `navigation: any` where feasible.
5. Fix RedeemTag -> Pets navigation.
6. Fix/remove GuardianPoints/GuardianRewards dead navigation.
7. Remove redundant custom back buttons where native header already exists.
8. Define post-success navigation/reset semantics.
9. Verify Android hardware back.
10. Verify iOS swipe-back.

## Tests

- navigation component tests where practical;
- Maestro route smoke tests.

## Gate

No production CTA targets an unregistered route.

---

# Phase M3 — Authentication and Session Completion

## Objective

Make auth correct across app restart, token expiry and MFA.

## Files

- `src/lib/auth-context.tsx`
- `src/lib/tokenStorage.ts`
- `src/api/client.ts`
- `LoginScreen.tsx`
- `RegisterScreen.tsx`
- `ForgotPasswordScreen.tsx`

## Tasks

1. Make AuthContext sole owner of login state transitions.
2. Implement `completeMfaLogin` inside auth domain.
3. After OTP verify: persist tokens + set user + register current push installation.
4. Validate access-token refresh on expired access token.
5. Validate revoked refresh token.
6. Validate account disabled/locked response.
7. On unrecoverable refresh failure, transition visibly to login.
8. Unregister/deactivate current device push registration on logout.
9. Do not log secrets/tokens.
10. Add secure recovery for app resume after long background period.
11. Verify password reset end-to-end. If reset requires web deep-link continuation, make the transition explicit and polished.

## Acceptance

- password login works;
- MFA login works without restart;
- app restart restores valid session;
- expired access token refreshes;
- invalid refresh signs user out;
- logout removes local credentials and current device association.

---

# Phase M4 — Push Notification Architecture

## Objective

Make push real and provider-consistent.

## Recommended implementation

Use Expo Push Service for mobile Expo tokens for v1.

## Backend files

- `packages/api/src/services/push-notification.service.ts`
- `packages/api/src/routes/push-tokens.ts`
- PushToken model
- notification producers

## Mobile files

- `src/lib/pushNotifications.ts`
- auth lifecycle

## Tasks

1. Add token provider/type to database model.
2. Register Expo tokens explicitly as provider=`expo`.
3. Send Expo tokens via Expo push service.
4. Keep Firebase only for raw FCM tokens if PawTag intentionally supports them.
5. Never pass an Expo token into Firebase Admin.
6. Process Expo push receipts and deactivate invalid tokens.
7. Associate token with an app installation/device identifier.
8. Make registration idempotent.
9. Deactivate current installation on logout.
10. Production missing provider config must be observable failure, not fake success.
11. Define retry/backoff for transient push failure.
12. Define notification priority/category.

## Required live tests

Real iPhone + Android device:

- pet finder alert;
- lost/recovery update;
- order shipped;
- foreground;
- background;
- terminated app.

## Gate

A controlled real event results in a real notification on both platforms.

---

# Phase M5 — Notification Routing and Deep Links

## Objective

Make tapping a notification useful.

## Files

- `RootNavigator.tsx`
- `pushNotifications.ts`
- new navigation service/ref
- Expo linking config

## Tasks

1. Add NavigationContainer ref.
2. Define a stable notification payload contract.
3. Implement cold-start notification handling.
4. Implement background response handling.
5. Implement foreground behavior.
6. Route to pet/order/subscription target.
7. Queue pending navigation while auth initializes.
8. If signed out, login then resume target.
9. If resource no longer exists, show safe fallback.
10. Configure `pawtag://` linking routes.
11. Decide whether PawTag web URLs should open app via universal/app links; do not hijack Finder URLs in a way that forces app installation.

## Gate

Every production notification category has a verified destination.

---

# Phase M6 — Pet Management Completion

## Objective

Make core pet ownership coherent and premium.

## Screens

- PetList
- PetDetail
- AddPet

## Tasks

1. Verify required fields match API validation.
2. Remove dead form state.
3. Add date-of-birth UI if model/business needs it.
4. Add pet photo upload/display if it is part of web owner identity experience.
5. Handle save conflicts/stale updates.
6. Warn before discarding unsaved edits.
7. Improve delete confirmation and consequences.
8. Verify tag unlink rules.
9. Refresh list/detail predictably after mutations.
10. Use typed Pet DTOs rather than local `any` shapes.
11. Normalize status names with backend.

## Gate

Create -> edit -> view -> lost/found -> unlink -> delete works on both platforms.

---

# Phase M7 — QR Activation Production Hardening

## Objective

Prove real QR activation.

## Current positive state

`onBarcodeScanned` is now correctly enabled while scanning and duplicate events are debounced.

## Tasks

1. Validate approved PawTag URL hosts instead of accepting arbitrary last path segment as tag ID.
2. Validate tag-ID format before API request.
3. Handle QR containing unrelated URLs.
4. Handle malformed encodings.
5. Add permission-denied permanent state with Settings shortcut.
6. Add visible retry.
7. Prevent repeated navigation after successful scan.
8. Test dark/bright lighting and older camera devices.
9. Define orientation behavior.

## Physical tests

- iPhone current + older supported OS;
- Android current + mid-range device;
- real production-format QR tags.

## Gate

A real printed PawTag QR activates/link flows correctly on both platforms.

---

# Phase M8 — NFC Platform Hardening

## Objective

Make NFC reliable where supported without pretending iOS/Android parity.

## Current positive state

NDEF URI prefix decoding is implemented.

## Tasks

1. Validate EAS native configuration for `react-native-nfc-manager`.
2. Confirm iOS NFC entitlement requirements in generated native project.
3. Confirm Android NFC manifest features/permissions.
4. Check NFC enabled vs unsupported states.
5. Handle cancellation consistently.
6. Validate only supported PawTag URI/tag formats.
7. Do not use raw hardware tag ID as a PawTag business tag ID unless explicitly supported.
8. Add haptic success/error.
9. Add fallback to QR/manual entry.
10. Test repeated reads and screen lifecycle cleanup.
11. Test app background/foreground interruption.

## Important business rule

Finder NFC must continue to work without the app. The physical tag's primary public NDEF URL should remain browser-compatible.

## Gate

Document exactly what works on supported iPhone and Android devices based on real tests.

---

# Phase M9 — Lost Mode and Recovery UX

## Objective

Make the most emotionally important owner workflow excellent.

## Tasks

1. Verify list and pet-detail lost-mode actions share business rules.
2. Require explicit confirmation.
3. Explain what marking lost does.
4. Explain what marking found does.
5. Prevent duplicate taps.
6. Handle API failure without ambiguous status.
7. Refresh from authoritative state after mutation.
8. Surface latest finder activity where appropriate.
9. Connect pet-found push tap to this journey.
10. Provide emergency contact guidance if relevant.
11. Ensure accessibility and large touch targets.

## Gate

Owner can mark lost, receive finder alert, open correct pet, and mark recovered on both platforms.

---

# Phase M10 — Health Records Completion

## Objective

Remove misleading partial health-management experience.

## Tasks

1. Replace local `any[]` with shared health DTOs.
2. Implement create/edit forms for supported record types or explicitly choose read-only v1.
3. Remove unused `showAdd` state if not used.
4. Add visible Add button if CRUD remains in scope.
5. Validate fields using shared schemas.
6. Confirm deletion ownership and API rules.
7. Add pull-to-refresh.
8. Improve empty-state wording.
9. Protect destructive actions.
10. Test keyboard/date pickers on iOS/Android.

## Recommended choice

Because health management is already presented as a feature, complete CRUD rather than leaving it half-present.

---

# Phase M11 — Orders, Invoices, Returns, Subscriptions

## Objective

Give owner useful post-purchase visibility without duplicating checkout.

## Orders

Add/verify:

- dedicated order detail;
- shipping/tracking;
- payment status;
- invoice open/download via authorized endpoint;
- cancellation eligibility;
- return/refund status where supported.

Do not implement refund business logic independently in mobile. Use backend authority.

## Subscriptions

Current portal-link approach is acceptable for v1 if:

- external browser return path is clean;
- portal is secure;
- status refreshes after return;
- inactive/payment-required states are represented correctly.

## Gate

Native app never claims an order/subscription state different from backend truth.

---

# Phase M12 — Guardian / Rewards Scope Repair

## Objective

Remove dead-end loyalty UI.

## Tasks

1. Verify Guardian endpoints/contracts.
2. Fix tier progress calculation against backend semantics.
3. Implement or remove Points History CTA.
4. Implement or remove PawRewards CTA.
5. Do not implement reward spending locally; use backend commerce contracts.
6. Remove duplicated hard-coded tier thresholds/benefits if authoritative values exist server-side/shared.

## Gate

No dead buttons; displayed balances/tier match backend.

---

# Phase M13 — Profile, Settings, Support, Privacy

## Objective

Add the account shell expected from a production native app.

## Add screens

- Profile
- Account & Security
- Notification Preferences
- Privacy
- Support / Contact
- About / app version
- Sign out
- Account deletion flow

## Tasks

1. Move logout out of Home dashboard.
2. Allow profile/contact updates where supported.
3. Allow password/security management.
4. Allow push notification preference management.
5. Provide privacy/terms links from live configuration.
6. Implement in-app account deletion/request workflow consistent with backend data policy.
7. Show app version/build number for support.
8. Add support contact pathway.

## Gate

A user can manage their account without requiring hidden web routes for essential security/privacy actions.

---

# Phase M14 — Mobile Information Architecture and Premium UI

## Objective

Move from functional screen collection to coherent PawTag product.

## Recommended bottom navigation

```text
Home | Pets | Activate | Alerts/Activity | Account
```

Do not overload Home with eight equally weighted action cards.

## Home should prioritize

1. lost-pet critical state;
2. active pets/tags;
3. recent finder activity;
4. activation CTA when relevant;
5. important subscription/order state.

## Visual rules

- consume shared semantic design tokens;
- replace emoji navigation icons with consistent iconography;
- use native-safe typography;
- use consistent cards/buttons/status badges;
- use skeleton/empty/error components consistently;
- avoid hand-rolled one-off inline styles;
- use motion only to communicate state;
- maintain PawTag premium/warm/trustworthy tone.

## Gate

Founder reviews iOS and Android builds, not screenshots only.

---

# Phase M15 — Accessibility

## Objective

Provide production accessibility baseline.

## Tasks

1. Add accessibility roles/labels/hints to icon and custom buttons.
2. Ensure controls have adequate touch targets.
3. Test VoiceOver.
4. Test TalkBack.
5. Verify Dynamic Type / font scaling behavior.
6. Prevent text clipping.
7. Ensure color is not sole status indicator.
8. Announce loading/error/success where appropriate.
9. Provide accessible camera/NFC instructions/fallbacks.
10. Verify modal focus and screen-reader order.

## Gate

Critical journeys are usable with VoiceOver and TalkBack.

---

# Phase M16 — Phone + Tablet Responsiveness

## Current issue

`ios.supportsTablet` is true, but the app has little evidence of adaptive tablet layouts.

## Tasks

1. Introduce reusable responsive hooks based on `useWindowDimensions`.
2. Set readable maximum widths for forms.
3. Improve tablet list/detail presentation.
4. Handle landscape where supported.
5. Verify foldable/large Android viewport behaviour.
6. Keep scanner screens full-screen.

Do not make everything multi-column. Use adaptive composition where it materially improves tablet UX.

---

# Phase M17 — Network, Offline and Lifecycle Resilience

## Objective

Make the app behave predictably on real cellular networks.

## Tasks

1. Add network connectivity awareness.
2. Distinguish server-maintenance state from user's lost network.
3. Current status fetch failure must not masquerade as authoritative ONLINE indefinitely.
4. Add retry UI to failed important screens.
5. Cache only safe, useful read data if needed.
6. Do not queue financially/destructively significant mutations blindly offline.
7. Handle app background/resume refresh.
8. Handle expired auth after resume.
9. Prevent duplicate mutation from retry taps.
10. Test network drop during lost-mode and activation flows.

## Gate

Poor-network tests have defined, non-destructive outcomes.

---

# Phase M18 — Observability and Crash Reporting

## Objective

Know when the app is failing after release.

## Tasks

1. Add mobile crash/error monitoring.
2. Separate dev/staging/prod environments.
3. Upload native source maps/symbols as applicable.
4. Attach release/build version.
5. Capture navigation context safely.
6. Capture API correlation/request IDs where available.
7. Redact tokens, health details, location and other sensitive PII.
8. Alert on auth crash loops, activation failures and push failures.

## Gate

A deliberate staging crash/error appears in monitoring with usable stack information and no sensitive payload.

---

# Phase M19 — Test Architecture

## Objective

Make mobile quality repeatable.

## Unit/component tests

Add tests for:

- auth state machine;
- MFA completion;
- token refresh behavior;
- QR parsing/validation;
- NFC URI decoding;
- notification payload routing;
- key forms/validation;
- lost-mode state transitions;
- health-record forms.

## Integration tests

Verify mobile API contracts against server test environment where feasible.

## Maestro

Rewrite flows so they have deterministic fixtures.

At minimum:

1. login;
2. MFA login;
3. add pet;
4. manual tag activation;
5. QR scanner permission/error UI;
6. lost -> found;
7. subscription list;
8. order list/detail;
9. settings/logout.

Do not make "success OR failure" a valid acceptance condition for business success tests.

## Physical-device tests

Remain separate because real NFC/camera/push cannot be fully proven in CI simulation.

---

# Phase M20 — iOS Production Readiness

## Objective

Produce a controlled TestFlight candidate.

## Current config positives

- bundle identifier exists: `co.nz.pawtag`;
- camera/location/NFC usage descriptions exist;
- EAS production profile exists.

## Current gaps

`eas.json` contains blank iOS submission values.

## Tasks

1. Configure Apple Developer account outside source control.
2. Configure App Store Connect app.
3. Configure EAS project.
4. Configure signing/certificates/profiles securely.
5. Configure push/APNs through Expo/EAS.
6. Validate NFC entitlements on generated production build.
7. Configure app icons/splash at production quality.
8. Prepare privacy declarations based on actual SDK/data behavior.
9. Prepare store screenshots/metadata.
10. Prepare review account if login is required.
11. Validate account deletion/privacy paths against current App Store requirements at submission time.
12. Test TestFlight install from scratch.
13. Test upgrade from previous beta build.
14. Test notification permission flows.
15. Test camera and NFC permissions.

## Gate

TestFlight candidate passes the complete real-device matrix.

---

# Phase M21 — Android Production Readiness

## Objective

Produce a controlled Play internal-testing candidate.

## Current config positives

- Android package exists: `co.nz.pawtag`;
- camera/NFC/notifications/location permissions declared;
- AAB production profile exists.

## Tasks

1. Configure Play Console app.
2. Store service-account credentials only in secure release/CI secret storage.
3. Validate target SDK/Expo-generated manifest.
4. Validate Android 13+ notification permission.
5. Validate Android NFC enabled/disabled states.
6. Validate camera permissions.
7. Validate app links if used.
8. Prepare Data Safety declarations from actual behavior.
9. Prepare store listing/assets.
10. Test internal track fresh install.
11. Test upgrade.
12. Test low-memory/background termination.
13. Test representative mid-range hardware, not only flagship device.

## Gate

Internal testing release passes complete Android matrix.

---

# Phase M22 — Real-Device Verification Matrix

Use actual devices.

Minimum controlled matrix:

## iOS

- one current-generation iPhone;
- one older supported iPhone if practical;
- optional iPad if tablet support remains enabled.

## Android

- recent Pixel/Samsung class device;
- representative mid-range device;
- at least one NFC-capable Android device.

## Required test cases

### Install/update

- clean install;
- update install;
- first launch;
- denied notification permission;
- denied camera permission;
- denied location permission if used.

### Auth

- password login;
- wrong password;
- MFA;
- logout;
- restart session;
- token expiry/refresh;
- network lost during auth.

### Pets

- add;
- edit;
- view;
- delete;
- lost;
- found;
- tag unlink.

### Tag activation

- manual ID;
- real QR;
- invalid QR;
- NFC supported;
- NFC unsupported;
- wrong NFC tag;
- repeated scan.

### Push

- foreground;
- background;
- terminated;
- tap routing;
- logout then verify old account notifications stop.

### Network

- Wi-Fi;
- cellular;
- airplane mode;
- connection drops mid-mutation;
- slow connection.

### UX/accessibility

- keyboard;
- large text;
- VoiceOver;
- TalkBack;
- dark mode only if PawTag chooses to support it;
- safe areas/notches;
- Android back.

All results must be captured with build number and device/OS version.

---

# Phase M23 — Staged Release

## Recommended sequence

```text
Developer builds
      ↓
Internal team devices
      ↓
TestFlight + Play internal
      ↓
Small external beta
      ↓
Fix observed defects
      ↓
Limited production rollout
      ↓
Broader release
```

Do not launch both stores to 100% of users immediately after the first passing build.

Monitor:

- crashes;
- auth failures;
- tag-activation failures;
- notification delivery;
- lost-mode mutations;
- API errors by app version;
- support tickets.

---

# 9. What Should NOT Be Done

Do not:

- rewrite the mobile app in Flutter/native Swift/Kotlin;
- force React Native Web into the web platform merely for component reuse;
- implement a second native checkout before launch;
- add large state frameworks without an evidenced need;
- assume Expo push and Firebase tokens are interchangeable;
- claim NFC works because a simulator screen renders;
- claim push works because a token is stored in MongoDB;
- keep dead buttons/screens for perceived feature completeness;
- silently report provider demo success in production;
- make iOS/Android identical where platform behavior legitimately differs.

---

# 10. Mobile Definition of Done

The iOS/Android app is public-release ready only when all of the following are true:

- [ ] clean production build succeeds for iOS;
- [ ] clean production build succeeds for Android;
- [ ] API endpoint configuration is correct and cannot fall back to localhost in production;
- [ ] normal login works;
- [ ] MFA login works;
- [ ] session refresh works;
- [ ] logout terminates local session and device push association;
- [ ] no dead navigation routes remain;
- [ ] real QR scan works on iOS;
- [ ] real QR scan works on Android;
- [ ] NFC is validated/documented on supported iOS devices;
- [ ] NFC is validated/documented on supported Android devices;
- [ ] tag redemption/linking is end-to-end successful;
- [ ] lost/found is end-to-end successful;
- [ ] Expo push delivery works to real iOS device;
- [ ] Expo push delivery works to real Android device;
- [ ] notification tap deep-links to correct target;
- [ ] logged-out devices no longer receive previous user's private notifications;
- [ ] pet CRUD is reliable;
- [ ] health record scope is coherent (full CRUD or explicit read-only);
- [ ] order/subscription state matches backend truth;
- [ ] Profile/Settings/Privacy/Support are present;
- [ ] accessibility pass completed;
- [ ] slow/offline network behavior tested;
- [ ] crash monitoring is active;
- [ ] Maestro deterministic regression suite passes;
- [ ] real-device verification matrix passes;
- [ ] TestFlight candidate approved internally;
- [ ] Play internal candidate approved internally;
- [ ] current Apple/Google policy requirements have been checked at submission time;
- [ ] rollback/hotfix procedure is documented.

---

# 11. Recommended Priority Relative to Main PawTag Master Plan

Insert the mobile program into the overall PawTag plan **after backend production contracts are stable**, especially:

- auth/session contracts;
- pet/tag APIs;
- lost/found flow;
- notification system;
- order/subscription state;
- production environment rules.

But start **M0-M5 immediately in parallel**, because push and auth contract defects affect architecture and should not be postponed until store submission.

Recommended parallel execution:

```text
CORE WEB/BACKEND HARDENING             MOBILE TRACK
-------------------------              ------------
auth/payment/notification APIs  <----> M0-M5 contracts/auth/push
pet/tag/finder hardening        <----> M6-M9 owner journeys
orders/subscriptions stable     <----> M11-M12 read surfaces
production deployment          <----> M18-M21 observability/store builds
staging E2E                    <----> M22 real-device matrix
```

---

# 12. AI Coding Agent Execution Prompt

Use this when handing the plan to OpenCode:

> Read `AGENTS.md`, the current verified PawTag master implementation plan, and `PawTag_iOS_Android_Verified_Audit_and_Implementation_Plan.md`.
>
> The source code is the source of truth. Existing mobile documentation and checklists are evidence only when backed by executed validation.
>
> Execute the mobile plan phase by phase in dependency order. Work on one phase at a time. Inspect current implementation before editing. Do not implement native cart/checkout unless a later explicit decision changes the approved mobile v1 scope.
>
> For each phase:
> 1. establish baseline behavior;
> 2. identify exact files and contracts involved;
> 3. implement the smallest coherent solution;
> 4. add/update risk-appropriate automated tests;
> 5. run typecheck/lint/tests;
> 6. record any physical-device validation still required;
> 7. update mobile implementation status with command/test/device evidence;
> 8. stop at the phase gate if external credentials, physical devices, App Store Connect, Play Console, EAS or provider access is genuinely required.
>
> Never mark QR, NFC, push, deep links, store build or production notification delivery complete solely from static code inspection or simulator behavior.
>
> Do not proceed to the next phase until the current phase's software-verifiable acceptance criteria are green.

---

# 13. Technical Lead Recommendation

The native app has enough real code to justify continuing it. It is **not** a throwaway prototype.

But today it should not be described as production-ready or feature-complete.

The strongest parts are:

- sensible Expo/RN foundation;
- SecureStore;
- shared API client direction;
- pet/tag/lost-mode scaffolding;
- QR scanner fix;
- improved NFC decoding;
- existing EAS/Maestro starting point.

The biggest remaining risks are integration risks rather than visual polish:

- authentication state after MFA;
- push transport mismatch;
- push/deep-link routing;
- device lifecycle/privacy on logout;
- native route integrity;
- incomplete health workflow;
- unproven native NFC/push behavior;
- weak mobile release automation and evidence.

Therefore:

> **Keep building the current React Native/Expo app, do not rewrite it, but treat it as a dedicated production-hardening workstream with its own iOS/Android release gate.**

For the first real PawTag customer, the safest release strategy is:

1. production-grade responsive web + Finder first;
2. native app in controlled TestFlight/Play internal beta;
3. complete this mobile plan;
4. promote to public stores only after real-device evidence is green.

If public native app availability is a business requirement for customer #1, then M1 through M22 become mandatory pre-launch work.
