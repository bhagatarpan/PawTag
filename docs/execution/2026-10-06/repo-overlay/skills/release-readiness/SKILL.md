---
name: release-readiness
description: Perform PawTag staging, store, or first-customer release gating. Use before enabling production payments, public donations, App Store/Play release, database cutover, or first real customers. Verify executed evidence across E2E, security, providers, backups/rollback, observability, web/mobile devices, and operational runbooks. Do not modify code first; identify blockers and only remediate under an explicit work packet.
---

# Release Readiness

A written checklist is not evidence that validation happened.

Require executable/runtime evidence appropriate to the release: automated critical journeys, production-like configuration, real provider test-mode workflows, backup restore/rollback rehearsal, alert delivery, security abuse checks, physical-device tests for native capabilities, and manual real-person UX where specified.

For first-customer release, block on unresolved financial/security/data-integrity defects. For iOS/Android public release, also require store-build/signing, push, deep links, QR/NFC where promised, payment/store-policy decision, privacy metadata, and real-device evidence.

For DynamoDB domain cutover, require normalized data comparison, concurrency/failure-injection tests, explicit rollback trigger/procedure, and one source of truth per domain.

For donations, require legal/accounting configuration gates plus live smoke/refund/reconciliation proof before public CTA enablement.

Report only: `BLOCKER`, `REQUIRES VALIDATION`, `READY`, or `DEFERRED` with evidence.
