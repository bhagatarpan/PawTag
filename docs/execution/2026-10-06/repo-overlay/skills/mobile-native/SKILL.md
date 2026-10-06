---
name: mobile-native
description: Review PawTag's existing Expo/React Native mobile implementation only as a legacy/reference source during migration to the web-first Capacitor customer app. Use when extracting existing QR, NFC, push, SecureStore, deep-link, permission, or real-device behavior from `apps/mobile`. Do not add new duplicate customer product screens; use `web-first-mobile-shell` for target mobile implementation.
---

# Legacy Expo Mobile Reference

Follow `AGENTS.md` and `web-first-mobile-shell` first.

The founder's target is **not** separate React Native customer UI. `apps/web` becomes the one customer UI source and Capacitor supplies the thin iOS/Android shell.

Use current Expo code to recover proven requirements/implementation details for:
- QR/camera scanning;
- NFC/NDEF parsing;
- push registration/handling;
- native secure storage;
- permissions;
- deep links;
- safe areas/lifecycle;
- iOS/Android release configuration.

Do not:
- build new customer feature screens in React Native;
- make Expo parity a prerequisite after the Capacitor cutover is approved;
- delete Expo code before equivalent native-shell behavior is proven on physical devices.

When migrating a capability, record what was reused, what changed, device tests performed, and when the old implementation can be retired.
