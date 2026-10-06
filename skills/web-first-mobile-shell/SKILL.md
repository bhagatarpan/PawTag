---
name: web-first-mobile-shell
description: Implement or review PawTag's customer iOS/Android strategy where `apps/web` is the single customer UI/business-flow source and a thin Capacitor native shell supplies App Store/Play Store packaging plus native capabilities. Use for Capacitor migration, app-aware web UI, secure native storage, push, QR, NFC, deep links, store builds, physical-device validation, or retiring duplicated Expo/React Native screens. No Finder native app and no Admin mobile app in the current MVP.
---

# Web-First Customer Mobile Shell

The target architecture is one customer React/Vite UI in `apps/web`, packaged into iOS/Android through a thin Capacitor shell. Do not build new duplicate React Native customer screens.

## Product boundaries

- `apps/web`: customer UI/business-flow source of truth for browser + installed customer app.
- `apps/finder`: public browser-only recovery experience. Never require app installation and do not deep-link Finder URLs into the customer app.
- `apps/admin`: desktop web for current MVP. Do not build an Admin native app now.
- current Expo/React Native code in `apps/mobile`: migration reference until native capability parity is proven; then retire duplicated UI deliberately.

## Native layer responsibilities

Keep native code thin and focused on capabilities the browser shell cannot reliably supply:
- App Store/Play Store packaging/signing;
- secure native token/storage bridge;
- push registration and notification taps;
- QR/camera;
- NFC/NDEF;
- universal/app links;
- permissions;
- splash/status bar/safe areas;
- Android back behavior and app lifecycle.

Business rules, API contracts, pricing, checkout, account screens, pets, orders, membership UI, and normal product UX remain in `apps/web`.

## Do not ship a low-value remote website wrapper

Bundle the built web app into the native binary through Capacitor rather than simply loading the public site URL as the entire app. App-aware UI should remove inappropriate browser chrome and provide mobile app navigation where useful while still rendering shared React routes/components.

## Commerce/store rules

Keep physical-product cart/checkout in the shared web UI. Validate payment authentication/background/return behavior on physical iOS/Android devices. If an embedded flow is unreliable, use a secure system-browser checkout plus deep link return rather than creating a second checkout.

Digital membership purchase inside store apps requires an explicit store-policy/payment decision before release; do not assume Stripe purchase of a digital entitlement is acceptable inside the store build.

## Migration gate

Do not delete the Expo app until Capacitor proves login/MFA/session, push, deep links, QR, NFC, checkout, offline/reconnect, and production builds on real iOS and Android devices.
