# Phase 14 — Donation External Gate and Architecture Audit

## Agent directive

Do not build the donation UI/payment domain until this architecture phase is complete. Legal/tax unknowns must remain configuration/blockers, not guesses.

## Objective

Reconcile the proposed donation specification with the **current** PawTag implementation after preceding hardening/migration work, identify reusable primitives, and finalize a safe first-release donation architecture.

## Required skills

`work-packet-executor`, `donation-domain`, `commerce-safety`, `stripe-integration`, `financial-document-integrity`, `security-boundary-review`, `feature-completeness`, `dynamodb-migration` if DynamoDB is current persistence.

## Source requirements from the donation specification

Preserve the intent that donation is a complete financial domain supporting a supporter who may have no pet, reusing PawTag identity/Stripe/document/email/admin infrastructure where semantics match. The proposed specification also explicitly warns not to promise NZ tax-credit eligibility without confirmed donee status and receipt requirements.

## External gate

Read `03_EXTERNAL_OWNER_ACTIONS.md` and record each donation legal/accounting item as `CONFIRMED` or `BLOCKED_EXTERNAL`.

Engineering may proceed with neutral receipt/payment infrastructure while donee status is pending, but it must not enable tax-credit claims or final regulated wording without confirmation.

## Repository architecture audit

Inspect current:
- customer registration/account activation/identity merge behavior;
- Stripe client/provider, one-time payment, subscription/Billing, webhook ledger, idempotency;
- refund/reconciliation services;
- invoice/PDF renderer and object storage;
- email CMS/templates/audit/provider webhook;
- customer portal documents/navigation;
- admin financial tables/detail/RBAC/export;
- audit event infrastructure;
- background jobs/worker;
- persistence/repository conventions after Dynamo phases;
- shared contracts/Zod/error codes;
- analytics/observability.

Create:

```text
docs/donations/00-architecture-audit.md
docs/donations/01-domain-model.md
docs/donations/02-payment-webhook-matrix.md
docs/donations/03-receipt-rules.md
docs/donations/04-security-privacy.md
docs/donations/05-implementation-plan.md
```

## First-release scope decision

Default implementation scope:
- NZD only;
- one-time donations;
- monthly recurring donations;
- suggested + custom amount with server min/max;
- existing customer or new supporter;
- no pet/tag required;
- no normal pet onboarding requirement;
- secure later account activation;
- Stripe Customer/payment/subscription linkage;
- webhooks/idempotency;
- donation payment records;
- donation receipt/PDF/online view/email;
- customer portal;
- admin portal/RBAC/refund/reconciliation/audit;
- mobile-responsive `/donate` that also works in the shared customer shell where policy/product allows.

Defer yearly/weekly/quarterly, corporate/international, tribute, donor wall, complex campaigns, cover-fees, advanced analytics unless explicitly promoted.

## Identity decision

Do not create a separate donor authentication system. Use existing customer identity with an explicit donation/supporter registration context/state. Logged-out email matching must not reveal account existence. Later portal access requires secure proof of control.

## Receipt decision

Donation receipt is a distinct financial document type. Reuse PDF/storage/email/access primitives, not commerce invoice meaning.

## Persistence decision

Donation services depend on repository interfaces. If DynamoDB is authoritative, design access patterns/keys consistently with the accepted migration architecture. If full migration was intentionally deferred, provide a repository adapter without embedding Mongoose calls in donation business logic.

## Acceptance gate

Architecture audit names exact reusable components, gaps, file changes, external blockers, domain states, access patterns, API surface, security boundaries, and test plan. No speculative tax/legal claim has been coded.

Stop before Phase 15.
