---
name: finder-recovery
description: Implement or review PawTag's public web Finder/lost-pet recovery flow in `apps/finder` and related APIs, including QR/NFC browser landing, public pet data, notify-owner actions, location sharing, abuse controls, escalation, duplicate submissions, privacy, poor-network behavior, and accessibility. The current product has no Finder native app; never require installation or customer-app login for a finder.
---

# Finder Recovery — Web Only

Finder is a launch-critical **public web** experience. There is no Finder iOS/Android app in the current product plan.

Primary journey: `scan public tag -> browser opens -> identify pet -> understand status -> contact/notify owner -> optionally share location -> clear confirmation`.

## Rules

- No app installation or PawTag account requirement.
- Customer-app universal/app links must not hijack Finder URLs.
- Fast first meaningful render, mobile-first controls, clear weak-network recovery.
- Explicit safe public DTO/projection; never serialize internal Pet/User/health records by convenience.
- Precise finder location requires meaningful consent and retention policy.
- Production abuse controls must work end-to-end; local bypasses are not evidence.
- Repeated taps/retries must not produce uncontrolled duplicate escalation/notification.
- Distinguish a finder report from owner-confirmed recovery unless product rules explicitly equate them.

Test production-like scan, invalid/deactivated tag, notify owner, denied location, repeated submission, refresh/retry, recovery acknowledgment, and public-data minimization.
