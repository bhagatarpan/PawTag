# Phase 15 — Donation Core Domain, Supporter Identity, and One-Time Stripe Donation

## Objective

Implement a production-hardened one-time donation flow end-to-end before recurring donations.

## Required skills

`work-packet-executor`, `donation-domain`, `commerce-safety`, `stripe-integration`, `financial-document-integrity`, `security-boundary-review`, `testing-regression`, `api-architecture`

## Domain contracts

Create shared types/schemas/error codes following current conventions, e.g. donation status/frequency/payment/receipt summary and request/response DTOs.

Use integer minor units for money where appropriate. Initial currency: NZD.

## Core entities/repositories

Actual physical representation follows accepted persistence architecture, but logical concepts include:
- Donation;
- DonationPayment;
- DonationReceipt or receipt job linkage;
- idempotency/event ledger linkage;
- donor snapshot required for historical financial record.

Do not create many tables/entities merely because the conceptual model names them; use access-pattern design.

## Supporter identity

1. Authenticated customer: reuse identity/Stripe customer.
2. New supporter: create/reuse safe PawTag customer identity in `DONATION` registration context without pet onboarding.
3. Do not require password/pet/mobile verification before donation unless fraud/security design explicitly requires it.
4. Do not reveal whether a logged-out email already has an account.
5. Provide separate secure account activation/magic-link/reset-style path after successful donation.
6. Protect concurrent duplicate identity creation.

## One-time payment state machine

```text
PENDING -> PROCESSING -> SUCCEEDED | FAILED | CANCELLED
SUCCEEDED -> PARTIALLY_REFUNDED | REFUNDED
```

Preferred flow:

```text
POST create donation/session with idempotency key
-> validate server amount/currency/rules
-> create/reuse supporter/customer
-> persist pending donation
-> create/reuse Stripe Customer
-> create PaymentIntent with safe metadata/idempotency
-> client confirms Stripe payment
-> signed webhook is authoritative
-> idempotently persist succeeded DonationPayment
-> enqueue/create receipt work
-> expose success/status endpoint
```

Browser redirect alone must never mark success.

## Public UX `/donate`

Warm, trustworthy, mobile-first; not a normal product checkout.

Recommended hierarchy:

```text
mission -> amount -> frequency -> donor details -> payment -> confirmation
```

Suggested amounts are configuration, not immutable hardcodes. Include custom amount with server limits. Marketing consent is separate and unchecked by default.

## Security/abuse

- rate limiting and anti-card-testing controls;
- server amount validation;
- opaque identifiers;
- webhook signature verification;
- idempotency;
- no card storage;
- safe Stripe metadata;
- no account enumeration;
- receipt/document access authorization.

## Receipt trigger

Successful authoritative payment creates exactly one receipt workflow. PDF/email can complete asynchronously; payment success must not be rolled back because document/email fails.

## Tests

Unit: amount/frequency/currency/state/idempotency/identity matching.  
Integration: guest/existing customer, duplicate request, Stripe success/failure/timeout, duplicate/out-of-order webhook, account enumeration, ownership, receipt job uniqueness.  
Browser E2E: guest one-time and existing-customer one-time donation in Stripe test mode.

## Acceptance gate

A supporter with no pet can complete one intentional one-time NZD donation; duplicate network/provider events do not duplicate donation/payment/receipt; authoritative payment state is traceable from PawTag to Stripe and back.

Stop before Phase 16.
