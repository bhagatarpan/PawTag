# Phase 08 — Shared Customer Web as Mobile-App Foundation

## Objective

Prepare `apps/web` to be the single customer UI source for desktop browser, mobile browser, and the future installed iOS/Android app without creating a second set of product screens.

## Product boundaries

- Customer: shared `apps/web`.
- Finder: `apps/finder`, browser only.
- Admin: `apps/admin`, desktop-first.
- Existing `apps/mobile`: legacy Expo reference during migration; no new product UI.

## Required skills

`work-packet-executor`, `web-first-mobile-shell`, `pawtag-ui-ux`, `api-urls`, `security-boundary-review`, `testing-regression`

## Tasks

### A. Mobile-responsive audit of customer web

Exercise at representative widths such as 320, 360, 375, 390, 430, tablet portrait/landscape, and desktop.

Audit/fix:
- auth/register/MFA/reset;
- dashboard/home;
- pet list/detail/forms/health;
- tag activation/manual entry;
- lost mode;
- notifications/activity;
- orders/order detail/invoices;
- membership/subscriptions;
- profile/settings/support;
- Cart and Checkout from Phase 04.

### B. App-aware platform abstraction

Create a small platform boundary in `apps/web`, for example:

```text
src/platform/
  capabilities.ts
  platform-context.tsx
  secure-storage.ts
  push.ts
  qr.ts
  nfc.ts
  deep-links.ts
  external-browser.ts
```

The web implementation returns supported browser behavior/fallbacks. Native bridge implementations will be added in Phase 09.

Application components should call semantic operations such as `platform.scanTag()` or `platform.openExternal()` rather than importing Capacitor plugins throughout the UI.

### C. App-aware navigation/chrome

Design a mobile installed-app mode that feels intentional rather than showing desktop marketing chrome.

Recommended customer app navigation:

```text
Home | Pets | Activate | Activity | Account
```

These tabs/routes still render shared React Router pages/components.

Do not create a separate React Native navigation tree.

### D. Native-shell-safe CSS/UX

Prepare for:
- safe-area CSS environment variables;
- fixed/sticky bottom bars above home indicator;
- software keyboard and viewport resizing;
- status-bar spacing;
- touch targets;
- pull-to-refresh decision;
- external links opening safely;
- file/PDF download behavior;
- offline/reconnect surface.

### E. Authentication contract preparation

Keep browser cookie auth working. Define how the future shell will store any native refresh/session credential without leaking it into localStorage. Do not implement unsafe token bridging merely to make WebView requests easy.

### F. Store-app product boundaries

Do not add Finder screens. Do not add Admin screens. Do not build native Cart/Checkout copies.

## Tests

- responsive component/browser tests;
- navigation at phone/tablet/desktop widths;
- keyboard/focus on forms;
- mobile Cart/Checkout behavior;
- platform abstraction browser fallback tests;
- app-mode navigation rendering tests.

## Acceptance gate

`apps/web` is genuinely usable as a polished mobile customer application surface before any Capacitor wrapper is introduced, and all native-only concerns are behind a small interface.

Stop before Phase 09.
