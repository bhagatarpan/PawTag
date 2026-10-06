# iOS / Android Real-Device Matrix — Capacitor Customer App

Use `PROVEN`, `FAILED`, `BLOCKED_EXTERNAL`, `NOT_APPLICABLE`. Static code/simulator is not `PROVEN` for physical capabilities.

| Scenario | iOS device | Android device | Evidence/notes |
|---|---|---|---|
| Production-like app build installs | | | |
| Cold/warm launch | | | |
| Login | | | |
| MFA | | | |
| Session survives restart | | | |
| Refresh/session expiry | | | |
| Logout clears session/device registration | | | |
| Password reset/deep link | | | |
| Offline launch | | | |
| Reconnect recovery | | | |
| Safe areas/status/navigation bars | | | |
| Keyboard/form avoidance | | | |
| Android back behavior | N/A | | |
| Push permission allow | | | |
| Push permission deny/settings recovery | | | |
| Foreground push | | | |
| Background push | | | |
| Terminated push | | | |
| Notification tap -> correct shared route | | | |
| Push token rotation/update | | | |
| Camera permission allow | | | |
| Camera permission deny/fallback | | | |
| Real PawTag QR scan | | | |
| Invalid/duplicate QR handling | | | |
| Manual tag entry fallback | | | |
| NFC support detection | | | |
| Real PawTag NFC read | | | |
| Unsupported/disabled NFC fallback | | | |
| NFC cancel/error | | | |
| Pet list/manage | | | |
| Lost mode | | | |
| Order history/invoice | | | |
| Cart mobile UX | | | |
| Checkout Stripe test success | | | |
| Checkout payment failure | | | |
| 3DS/authentication/background-return | | | |
| Membership display/manage | | | |
| Public Finder tag remains browser flow | | | |
| External links/PDF behavior | | | |
| Crash monitoring receives test event | | | |

## Store evidence

### iOS
- [ ] archive succeeds
- [ ] TestFlight build processed/installed
- [ ] privacy usage descriptions accurate
- [ ] app privacy declaration reviewed
- [ ] support/privacy URLs valid

### Android
- [ ] signed AAB succeeds
- [ ] internal/closed track install works
- [ ] permissions minimized
- [ ] data safety declaration reviewed
- [ ] target SDK/policy requirements satisfied
