---
name: pawtag-ui-ux
description: Design, implement, or review PawTag customer web, public Finder web, admin desktop, and shared customer mobile-shell UI/UX. Use for screens/components, premium cart/checkout, responsive behavior, forms, dialogs, states, design-system work, accessibility, hierarchy, or interaction polish. Customer browser and installed iOS/Android app should share `apps/web` UI; Finder remains browser-only and Admin is desktop-first for MVP.
---

# PawTag UI/UX

PawTag should feel trustworthy, warm but not childish, premium without ornamental clutter, clear under stress, commercially confident, and accessible by default.

Inspect existing `packages/ui`, design tokens, `docs/DESIGN.md`, and nearby implementations before inventing new primitives.

## Platform intent

- Customer UI source: `apps/web` for browser + Capacitor iOS/Android shell.
- Finder: public web only, mobile-first, stress/weak-network optimized.
- Admin: desktop-first for MVP.
- Do not build duplicate React Native customer screens after the web-first mobile strategy is adopted.

## Reuse

Reuse when the contract genuinely fits; extend when behavior belongs to the abstraction; create a new component when forced reuse would worsen both sides. Avoid both copy-paste variants and premature universal components.

## Required quality

For meaningful surfaces explicitly handle loading, empty, success, validation, network/server error, unavailable/disabled, destructive confirmation, and pending/optimistic states.

Forms require visible labels, actionable errors, preserved recoverable input, appropriate mobile keyboard types, and accessible focus. Dialogs/drawers require semantics, focus management, Escape/close, restoration, naming, and reduced motion.

Responsive design should recompose rather than squeeze desktop. The premium cart/checkout desktop 70/30 structure must intentionally collapse to a one-column mobile hierarchy with an appropriate sticky total/CTA when useful.
