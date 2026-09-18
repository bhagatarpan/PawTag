---
name: finder-recovery
description: Implement or review PawTag Finder and lost-pet recovery flows, including QR/NFC landing, public pet data, notify-owner actions, location sharing, CAPTCHA/rate limiting, escalation, duplicate submissions, owner response, poor-network handling, privacy, and accessibility. Use whenever code affects apps/finder, public tag endpoints, FinderScan, lost/found status, recovery notifications, or escalation.
---

# Finder Recovery

The Finder flow is launch-critical. Optimize for a stranger on a phone, possibly stressed, outdoors, on poor connectivity, with no account and little time.

## Primary journey

`scan -> identify pet -> understand lost status -> contact/notify owner -> optionally share useful location -> receive clear confirmation`

Do not add steps unless they materially improve safety or recovery success.

## UX requirements

- No account requirement for the legitimate finder path.
- Fast first meaningful render.
- Large touch targets and simple language.
- Clear denied-location and unavailable-location alternatives.
- Clear invalid/deactivated/expired tag states.
- Preserve useful state across refresh/retry when safe.
- Make network failure recoverable.
- Avoid modal chains and unnecessary fields.

## Abuse protection

- Server-side rate limiting and validation are required.
- CAPTCHA/risk controls must have a complete frontend/server production contract.
- Prefer low-friction or progressive abuse controls where possible.
- Test production-mode behavior; development bypasses are not evidence.

## Privacy

- Use a purpose-built Finder/public DTO or projection.
- Do not expose internal Pet/health/contact subdocuments by default.
- Share only information required to recover the pet.
- Treat precise location, finder contact data, owner contact data, microchip details, and veterinary data as sensitive.
- Preserve explicit consent records where location is collected.

## Status semantics

Distinguish a finder report/sighting from owner-confirmed recovery unless product rules explicitly define them as equivalent.

## Duplicate/retry behavior

Repeated submissions, refreshes, or network retries must not create uncontrolled duplicate escalation or notifications.

## Verification

Prioritize cross-layer E2E tests under production-like configuration for scan, notify, owner notification/state, denied location, invalid tag, repeated submission, and recovery acknowledgment.
