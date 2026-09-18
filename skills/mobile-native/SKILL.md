---
name: mobile-native
description: Implement or review PawTag React Native/Expo mobile code, especially authentication storage, API integration, navigation, QR scanning, NFC/NDEF, push notifications, permissions, deep links, offline/network behavior, safe areas, keyboard behavior, app lifecycle, iOS/Android differences, and production builds. Use for any apps/mobile change or shared abstraction consumed by mobile.
---

# Mobile Native

Do not treat React Native as DOM React with different tags. `AGENTS.md` remains authoritative.

## Shared vs native

Prefer sharing:
- TypeScript DTOs/contracts,
- validation/business rules,
- formatting utilities,
- API endpoint definitions,
- design tokens,
- compatible headless state/hooks.

Keep platform-specific:
- navigation,
- camera/QR,
- NFC,
- push notifications,
- permissions,
- secure storage,
- gestures/native controls,
- lifecycle/background behavior.

## Authentication/storage

Use an explicitly asynchronous storage contract for SecureStore. Do not infer async behavior from function constructor names. Avoid `as any` to bridge incompatible token-storage contracts.

## QR

Verify callback enable/disable logic, scan debouncing, invalid payload handling, permission denial, repeated scans, navigation result, and physical-device behavior.

## NFC

Decode NDEF records with correct record-type semantics, including URI prefix identifiers. Do not treat raw payload bytes as a complete URL. Handle cancellation separately from real errors and show useful recovery.

## Push

Validate permission states, token acquisition, project/EAS configuration, token refresh/update, notification taps, foreground/background handling, and logout cleanup.

## Resilience

Account for offline/network interruption, app backgrounding, stale screens, retries, safe areas, keyboard overlap, and Android/iOS permission differences.

## Verification

A simulator cannot prove NFC, real camera scanning, production push delivery, background behavior, or all permission flows. Mark these as `Needs real-device validation` until tested on physical iOS/Android hardware.
