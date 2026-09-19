# Mobile Real-Device Validation Checklist

> Work Packet 8.4 — Physical device testing requirements for PawTag mobile app.

## Pre-Flight

- [ ] Expo development build installed on test devices
- [ ] iOS test device (iPhone with notch/Dynamic Island recommended)
- [ ] Android test device (with NFC support recommended)
- [ ] Test account with active subscription
- [ ] Test PawTag with QR code and NFC tag

## Authentication

- [ ] Email/password login works
- [ ] Login persists across app restart (SecureStore)
- [ ] Refresh token rotation works (login again after 30 days)
- [ ] Logout clears all tokens
- [ ] MFA flow works (if enabled)
- [ ] Keyboard avoids input fields on login/register screens

## QR Scanning

- [ ] Camera permission request works
- [ ] Camera permission denied shows helpful message
- [ ] QR code scanning works
- [ ] Invalid QR code shows error
- [ ] Duplicate scan debounce works (2s)
- [ ] Scan navigates to RedeemTag screen
- [ ] Bottom bar respects safe area (notch/home indicator)

## NFC Scanning

- [ ] NFC supported check works
- [ ] NFC not supported shows fallback message
- [ ] NFC tap reading works
- [ ] NDEF URI decoding works (https:// URLs)
- [ ] Invalid NFC tag shows error
- [ ] Cancel during scan works
- [ ] Bottom bar respects safe area

## Push Notifications

- [ ] Permission request works
- [ ] Permission denied shows settings link
- [ ] Push token registered with backend
- [ ] Notification received when app is foreground
- [ ] Notification received when app is background
- [ ] Tapping notification navigates to relevant screen
- [ ] Token unregistered on logout

## Pet Management

- [ ] Pet list loads correctly
- [ ] Add pet form works (all fields)
- [ ] Edit pet works
- [ ] Delete pet with confirmation works
- [ ] Mark lost/found works
- [ ] Health records modal works
- [ ] Pet photos upload works

## Lost Mode

- [ ] Toggle lost mode works
- [ ] Confirmation dialog shows
- [ ] Status updates correctly
- [ ] Found timer displays correctly

## Orders & Subscriptions

- [ ] Order history loads
- [ ] Order detail shows correctly
- [ ] Subscription status displays
- [ ] Subscription portal link works

## Navigation & UX

- [ ] Tab navigation works
- [ ] Stack navigation works
- [ ] Back button works (Android)
- [ ] Safe area respected on all screens
- [ ] Pull-to-refresh works on list screens
- [ ] Keyboard avoids inputs on forms
- [ ] Loading states show correctly
- [ ] Error states show correctly
- [ ] Empty states show correctly

## Network

- [ ] Offline detection works
- [ ] Offline screen shows when no connection
- [ ] Recovery after network loss works
- [ ] API errors show meaningful messages

## Performance

- [ ] App startup time < 3 seconds
- [ ] QR scan response < 1 second
- [ ] NFC read response < 2 seconds
- [ ] No excessive memory usage
- [ ] No battery drain when idle

## Platform-Specific

### iOS
- [ ] Dynamic Island/notch handled
- [ ] Home indicator respected
- [ ] Face ID/Touch ID works (if applicable)
- [ ] Push notification permissions work

### Android
- [ ] Status bar handled
- [ ] Navigation gesture bar respected
- [ ] NFC works (if device supports)
- [ ] Push notification channels work
- [ ] Back button behavior correct
