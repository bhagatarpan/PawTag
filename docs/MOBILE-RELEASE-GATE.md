# Mobile Release Gate Checklist

> Work Packet 8.5 — Release readiness verification for PawTag mobile app.
>
> **Do not claim mobile release-ready until all items below are verified.**

---

## Pre-Release Requirements

### Build & Configuration
- [ ] `app.json` has correct bundle IDs (`co.nz.pawtag`)
- [ ] `app.json` has correct permissions (Camera, NFC, Location)
- [ ] `eas.json` has production build profile configured
- [ ] iOS: `appleId`, `ascAppId`, `appleTeamId` filled in `eas.json`
- [ ] Android: `serviceAccountKeyPath` configured in `eas.json`
- [ ] Push notification icon and color configured
- [ ] Splash screen matches brand (`#0d9488` background)

### Code Quality
- [ ] `pnpm typecheck` passes (excluding pre-existing GuardianDashboardScreen errors)
- [ ] No `as any` casts in critical paths (auth, API, token storage)
- [ ] All screens have proper error states
- [ ] All screens have proper loading states
- [ ] Safe area insets used on all screens with bottom bars
- [ ] Keyboard avoidance on all form screens

---

## Maestro E2E Flows

### Flow 1: QR Tag Activation (`e2e/qr-activation.yaml`)
- [ ] App launches successfully
- [ ] Login works with test credentials
- [ ] Navigate to Activate tab
- [ ] QR scanner screen loads
- [ ] Camera permission dialog appears (first time)
- [ ] Cancel scanner returns to Activate screen
- [ ] Manual tag entry works
- [ ] Activation success/error displays correctly

### Flow 2: NFC Tag Activation (`e2e/nfc-activation.yaml`)
- [ ] App launches successfully
- [ ] Login works with test credentials
- [ ] Navigate to Activate tab
- [ ] NFC scanner screen loads
- [ ] NFC instruction text visible
- [ ] Cancel returns to Activate screen
- [ ] *Note: Physical NFC tap cannot be automated*

### Flow 3: Lost Mode Toggle (`e2e/lost-mode.yaml`)
- [ ] App launches successfully
- [ ] Login works with test credentials
- [ ] Navigate to Lost Mode
- [ ] Lost Mode screen loads
- [ ] Empty state shows when no pets
- [ ] "Mark as Lost" toggle works with confirmation
- [ ] "Mark as Found/Safe" toggle works with confirmation
- [ ] Pull-to-refresh works
- [ ] Navigation back works

---

## Manual Verification (Physical Device Required)

### iOS Device
- [ ] App installs on iOS device
- [ ] Push notification permission requested
- [ ] Push notification received (foreground)
- [ ] Push notification received (background)
- [ ] Tapping notification navigates correctly
- [ ] Camera works for QR scanning
- [ ] NFC works (if device supports)
- [ ] Safe area respected (notch/Dynamic Island)
- [ ] Home indicator not obscured
- [ ] Keyboard avoids input fields
- [ ] App resume with expired token works
- [ ] Logout clears all data

### Android Device
- [ ] App installs on Android device
- [ ] Push notification permission requested
- [ ] Push notification received (foreground)
- [ ] Push notification received (background)
- [ ] Tapping notification navigates correctly
- [ ] Camera works for QR scanning
- [ ] NFC works (if device supports)
- [ ] Status bar handled correctly
- [ ] Back button behavior correct
- [ ] Keyboard avoids input fields
- [ ] App resume with expired token works
- [ ] Logout clears all data

---

## Run Maestro Flows

```bash
# From apps/mobile directory
cd apps/mobile

# Run all E2E flows
pnpm e2e

# Run individual flows
pnpm e2e:qr
pnpm e2e:nfc
pnpm e2e:lost
```

---

## Release Sign-Off

| Item | Verified By | Date |
|------|-------------|------|
| Maestro flows pass | | |
| iOS manual verification | | |
| Android manual verification | | |
| Push notifications work | | |
| QR scanning works | | |
| NFC scanning works | | |
| Safe areas correct | | |
| Build submitted to stores | | |

**Release approved:** [ ] Yes / [ ] No

**Notes:**
