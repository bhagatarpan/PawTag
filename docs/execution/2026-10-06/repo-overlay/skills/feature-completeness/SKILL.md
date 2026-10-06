---
name: feature-completeness
description: Trace a PawTag feature end-to-end before declaring it complete. Use for any new feature or material change where data creation, API exposure, customer/admin UI, email/notification links, external integrations, failure states, and operational support must work together. Prevents isolated "code exists" implementations from being mistaken for usable product capability.
---

# Feature Completeness

A route, model, screen, or test is not a complete feature.

Before coding, establish from repository evidence:
1. Who consumes the capability.
2. Trigger and complete user/system journey.
3. Data/state created or changed.
4. API/service path and authorization.
5. Customer/public/admin surfaces that consume it.
6. Notifications/emails/documents and whether their links resolve.
7. External providers and failure/retry behavior.
8. Operational/admin support path.
9. Acceptance criteria and tests.

Use existing patterns where they genuinely fit. Do not build an upstream producer without verifying the downstream consumer.

## Autonomy rule

Do not repeatedly ask the non-technical founder implementation-detail questions that can be resolved safely from source, current plans, established product rules, or conservative engineering judgment. Make a reasonable decision, document it, and proceed.

Stop for founder/external input only when the unresolved choice materially changes money, legal/tax treatment, irreversible data migration, privacy exposure, product semantics, or production credentials/access.

## Completion layers

For applicable features verify: persistence -> service/business rule -> API -> authorization -> frontend/public UI -> admin/operations -> communication/document delivery -> retry/reconciliation -> tests/observability.

If an applicable layer is missing, classify the feature as partial rather than complete.
