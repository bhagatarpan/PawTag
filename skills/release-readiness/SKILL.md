---
name: release-readiness
description: Perform PawTag staging and first-customer launch readiness checks without immediately changing code. Use before a staging release, production deployment, first real customer, app-store submission, or when asked whether PawTag is ready to launch. Review critical flows, environment/configuration, backups, monitoring, workers, integrations, tests, rollback, and real-device requirements, then classify blockers factually.
---

# Release Readiness

Start with assessment, not refactoring. Do not call the system production-ready based on builds/tests alone.

## Release gate areas

Review evidence for:
- production authentication/session behavior,
- authorization and admin permissions,
- Finder scan/notify/recovery under production-like configuration,
- public-data privacy projection,
- Stripe live/test-mode safeguards,
- webhook signature processing,
- checkout/order/inventory consistency,
- refund/cancellation behavior if enabled,
- worker/job ownership and retry behavior,
- email/SMS/push provider production configuration,
- database backup and tested restore,
- file/object storage,
- secrets and startup validation,
- health checks and observability,
- actionable alerts,
- deployment/rollback procedure,
- critical browser E2E,
- physical-device mobile validation if mobile is in release scope.

## Classify each area

Use only:
- `BLOCKER`
- `REQUIRES VALIDATION`
- `READY`
- `DEFERRED / OUT OF LAUNCH SCOPE`

Give evidence and the exact condition required to clear each blocker.

## First-customer standard

Approve only when the core PawTag business loop can be demonstrated end-to-end in production-equivalent conditions:

`account/pet/tag -> lost mode -> Finder scan -> owner notification/contact -> recovery`

and any enabled paid flow can survive retries/failures without unsafe financial or ownership state.

## Rollout

Prefer a controlled first-customer release with monitoring and a known rollback/disable path over a broad launch. Do not expand scope merely because secondary features exist in the repository.
