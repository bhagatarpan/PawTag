# Mobile Release Guide

How to build, test, and submit the PawTag mobile app to the App Store and Google Play.

---

## Prerequisites

1. **Expo account** — sign up at [expo.dev](https://expo.dev)
2. **EAS CLI** — install globally: `npm install -g eas-cli`
3. **Login**: `eas login` (use your Expo account credentials)
4. **Apple Developer Account** — required for iOS submission ($99/year)
5. **Google Play Developer Account** — required for Android submission ($25 one-time)

---

## First-Time Setup

### Link project to Expo

```bash
cd apps/mobile
eas project:init
```

Choose "Create a new project" when prompted. This links your local project to your Expo account.

### Configure credentials

```bash
# iOS credentials (run on macOS or CI)
eas credentials --platform ios

# Android credentials
eas credentials --platform android
```

For Android, you'll need to generate a keystore or let EAS manage it automatically.

---

## Build Commands

### Development build (for testing on device)

```bash
cd apps/mobile
eas build --profile development
```

- Installs a development client on your device
- Allows hot-reloading from your dev machine
- iOS: installs on simulator or device via TestFlight-like flow
- Android: installs APK directly

### Preview build (internal testing)

```bash
eas build --profile preview
```

- Production-like build for internal testing
- iOS: distributed via TestFlight
- Android: APK file for direct install

### Production build (store submission)

```bash
eas build --profile production
```

- Final build for App Store / Google Play
- iOS: IPA file for App Store Connect
- Android: AAB bundle for Play Console

---

## E2E Testing

### Install Maestro

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### Run E2E tests

```bash
cd apps/mobile

# Run all E2E tests
pnpm e2e

# Run individual tests
pnpm e2e:qr      # QR activation flow
pnpm e2e:nfc     # NFC activation flow (Android only)
pnpm e2e:lost    # Lost mode toggle flow
```

### E2E Test Files

| File | Flow | Notes |
|------|------|-------|
| `e2e/qr-activation.yaml` | QR scan → tag activate | Camera permission needed |
| `e2e/nfc-activation.yaml` | NFC tap → tag activate | Android only, physical NFC required |
| `e2e/lost-mode.yaml` | Toggle lost/found with confirmation | Requires at least one pet |

---

## iOS Submission (TestFlight → App Store)

### 1. Build for production

```bash
eas build --profile production --platform ios
```

### 2. Submit to App Store Connect

```bash
eas submit --platform ios
```

This uploads the IPA to App Store Connect automatically.

### 3. TestFlight (optional)

- Log in to [App Store Connect](https://appstoreconnect.apple.com)
- Go to your app → TestFlight
- Add internal/external testers
- Testers receive an email with install link

### 4. App Store submission

- In App Store Connect, go to your app → App Store
- Fill in:
  - App description, keywords, screenshots
  - Privacy policy URL
  - Support URL
  - App review information (test account credentials)
- Submit for review

### Required before submission

- [ ] App icon (1024×1024 PNG) — replace placeholder in `assets/icon.png`
- [ ] App Store screenshots (6.7" iPhone, 6.1" iPhone, iPad optional)
- [ ] Privacy policy URL (set in `app.json` and App Store Connect)
- [ ] Test account credentials for App Review team
- [ ] Permission descriptions reviewed and accurate

---

## Android Submission (Internal Testing → Play Console)

### 1. Build for production

```bash
eas build --profile production --platform android
```

### 2. Submit to Play Console

```bash
eas submit --platform android
```

This uploads the AAB to Google Play Console automatically.

### 3. Internal testing

- Log in to [Play Console](https://play.google.com/console)
- Go to your app → Testing → Internal testing
- Add testers by email
- Testers get a download link

### 4. Production release

- In Play Console, go to your app → Production
- Create a new release
- Fill in:
  - Release notes
  - Screenshots
  - Content rating questionnaire
  - Privacy policy URL
  - Data safety section
- Roll out to production

### Required before submission

- [ ] App icon (512×512 PNG) — replace placeholder in `assets/adaptive-icon.png`
- [ ] Play Store screenshots (phone, tablet optional)
- [ ] Privacy policy URL
- [ ] Data safety form completed
- [ ] Content rating questionnaire completed
- [ ] Test account credentials for review

---

## Permission Descriptions (already configured in app.json)

| Permission | iOS Key | Description |
|------------|---------|-------------|
| Camera | `NSCameraUsageDescription` | Scan QR codes on pet tags during activation and when finding lost pets |
| NFC | `NSNFCReaderUsageDescription` | Read NFC tags during activation — tap phone to tag |
| Location | `NSLocationWhenInUseUsageDescription` | Share location when a lost pet is found, helping reunite pets with owners |

| Permission | Android | Description |
|------------|---------|-------------|
| Camera | `CAMERA` | Scan QR codes on pet tags |
| NFC | `NFC` | Read NFC tags during activation |
| Notifications | `POST_NOTIFICATIONS` | Push alerts for pet-found events and order updates |
| Location | `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | Share location when finding a lost pet |

---

## Placeholder Assets (need founder replacement)

The following assets are solid teal placeholders — replace before store submission:

| File | Size | Purpose |
|------|------|---------|
| `assets/icon.png` | 1024×1024 | App icon (iOS + Android) |
| `assets/adaptive-icon.png` | 1024×1024 | Android adaptive icon foreground |
| `assets/splash.png` | 1284×2778 | Splash screen background |

**To replace:** Create proper branded assets following Apple's [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons) and Google's [Adaptive Icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive) documentation.

---

## Troubleshooting

### "No credentials found"

Run `eas credentials` to set up iOS/Android signing credentials.

### Build fails with "Unable to find a matching scheme"

Ensure `app.json` → `expo.scheme` is set (already configured as `pawtag`).

### Camera permission not working on iOS

Check that `NSCameraUsageDescription` is set in `app.json` → `expo.ios.infoPlist`.

### NFC not working on Android

- NFC must be enabled in device settings
- Some emulators don't support NFC — test on a physical device
- The NFC scanner requires the device to be held within ~4cm of the tag

### Push notifications not working

- iOS: Push notifications require APNs key configured in Expo
- Android: FCM is configured automatically by Expo
- Test with `expo-notifications` debug tool: `npx expo start --dev-client`
