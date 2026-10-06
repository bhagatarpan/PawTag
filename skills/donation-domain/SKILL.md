---
name: donation-domain
description: Design, implement, or review PawTag donations including one-time and recurring Stripe payments, donor identity, donation records, receipts/PDFs, customer/admin portals, refunds, reconciliation, tax-status gating, email delivery, auditability, and security. Use whenever work touches `/donate`, donation persistence, donor accounts, recurring donations, donation receipts, donation webhooks, refunds, reporting, or donation operations.
---

# Donation Domain

Follow `AGENTS.md`, `commerce-safety`, `stripe-integration`, `financial-document-integrity`, and the current donation phase.

## Product boundary

Donation is a distinct financial domain, not a product line item and not a normal commerce invoice. Reuse PawTag customer identity, Stripe primitives, email/PDF/storage/audit infrastructure, and portal patterns where semantics match.

Initial supported scope unless the current plan says otherwise:
- NZD only;
- one-time donations;
- monthly recurring donations;
- guest/new supporter and existing customer;
- no pet required;
- secure later account activation;
- receipts, portal visibility, admin visibility, refunds, reconciliation.

## Financial invariants

- Server owns donation amount/frequency/currency validation.
- Webhook/provider state is authoritative for payment success.
- Donation creation, recurring subscription creation, webhook handling, receipt generation, email dispatch, cancellation, and refunds must be idempotent.
- Never delete financial records.
- Issued receipts are immutable; corrections create replacement/void lineage.
- Never generate duplicate receipt numbers.
- Never issue a donation receipt for a commercial purchase/sponsorship merely because UI says "donate".
- Never log card data, secrets, auth tokens, or unnecessary donor PII.

## Identity

Reuse existing PawTag customer identity. Do not create a separate donor login system. Avoid account enumeration for logged-out email matches. A donation-created supporter must not be forced through pet/tag onboarding. Portal access later requires proof of account control.

## NZ legal/tax gate

Do not let the coding agent decide donee status, tax-credit eligibility, GST/accounting treatment, legal entity identifiers, receipt legal wording, or refund tax treatment. Those are external business/professional inputs.

Until approved configuration proves eligibility, do not claim a donation is IRD tax-credit eligible. Keep receipt/tax wording configuration-driven.

## Persistence

Donation services must depend on repository interfaces rather than Mongoose APIs so they remain compatible with the DynamoDB direction. If DynamoDB is not yet authoritative for donations, use an adapter behind the repository contract rather than embedding Mongo assumptions in donation business logic.

## Completion proof

A donation feature is not done until payment, local record, receipt, PDF/storage, email, customer view, admin view, audit trail, retry/reconciliation, refund/cancellation where applicable, authorization, and production/test environment behavior are proven end-to-end.
