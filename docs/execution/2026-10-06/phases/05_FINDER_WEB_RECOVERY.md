# Phase 05 — Finder Web Recovery, Privacy, and Poor-Network Reliability

## Product decision

**There is no Finder native app.** This phase is exclusively the public browser flow in `apps/finder` plus its APIs/services.

## Objective

Make a stranger's lost-pet recovery path fast, minimal, private, abuse-resistant, and reliable without account/app installation.

## Required skills

`work-packet-executor`, `finder-recovery`, `security-boundary-review`, `pawtag-ui-ux`, `testing-regression`, `production-readiness-review`

## Inspect

- `apps/finder`
- `packages/api/src/routes/finder.ts`
- Finder schemas/middleware/rate limits/CAPTCHA
- `FinderScan`, `LocationEvent`, `EscalationRecord`, `Notification`
- finder-related notification/email/SMS paths
- tag/pet public DTO projection
- privacy-retention job/docs
- customer app universal-link plan to ensure Finder URLs remain browser-only

## Journey to prove

```text
scan QR/NFC public tag
-> browser opens
-> pet/recovery-safe public data loads
-> finder understands lost status
-> notify/contact owner
-> optionally share location with clear consent
-> clear submission/delivery status
-> owner receives actionable alert
-> retries/refresh do not spam
```

## Tasks

1. Re-audit public response projection: expose only intentional recovery fields.
2. Verify owner phone/contact field mapping and privacy rules.
3. Validate latitude/longitude numerically and server-stamp consent metadata.
4. CAPTCHA/rate limiting must have a complete production frontend/backend contract.
5. Make duplicate submission idempotent enough to prevent repeated uncontrolled escalation.
6. Distinguish report/sighting from owner-confirmed recovery unless current domain rules deliberately equate them.
7. Move nonessential analytics work off critical response latency where safe.
8. Provide denied-location/manual-location alternative and recoverable network errors.
9. Define retention/expiry for finder PII/location/IP-derived data and prove cleanup behavior.
10. Ensure future customer-app universal links exclude Finder public routes.

## E2E scenarios

- active lost tag;
- active not-lost tag;
- invalid/deactivated/expired tag;
- finder notify success;
- denied geolocation;
- poor/offline network then retry;
- refresh/re-submit;
- rate-limit/CAPTCHA production semantics;
- owner alert delivery state;
- public DTO privacy assertions.

## Acceptance gate

A finder can help without installing PawTag, public data is minimal, recovery remains usable on weak mobile conditions, and duplicate/abuse behavior is controlled.

Stop before Phase 06.
