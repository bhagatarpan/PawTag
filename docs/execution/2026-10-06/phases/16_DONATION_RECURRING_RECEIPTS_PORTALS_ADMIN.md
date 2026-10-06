# Phase 16 — Recurring Donations, Receipts/PDFs, Customer Portal, Admin, Refunds

## Objective

Complete the durable donor lifecycle: monthly recurring giving, each-payment receipts, secure portal access, admin operations, refund/correction flows, and auditable documents.

## Required skills

`work-packet-executor`, `donation-domain`, `stripe-integration`, `financial-document-integrity`, `email-cms-templates`, `security-boundary-review`, `testing-regression`, `feature-completeness`

## A. Monthly recurring donations

Reuse existing Stripe Billing/customer/subscription primitives where semantics match, but maintain donation-specific domain state.

- recurring creation idempotent;
- initial payment/activation based on authoritative Stripe Billing state;
- every successful recurring payment creates one DonationPayment + one receipt;
- failed/past-due state visible and retry/reconciliation-safe;
- customer cancellation idempotent and server-side;
- duplicate/out-of-order subscription/invoice webhooks safe;
- do not create a second generic subscription framework unnecessarily.

## B. Donation receipt

Distinct type from commerce invoice.

Receipt record/content should include only fields required by confirmed business/legal configuration, such as unique receipt number/version/status, organisation identity, donor name, amount/date/currency, donation statement, payment reference, tax classification/wording, signatory details if approved, PDF/storage reference, issue time.

Rules:
- unique sequence under concurrency;
- immutable after issue;
- correction -> original void/replaced + new replacement receipt;
- refund does not delete original history;
- email/portal use same authoritative PDF/record;
- storage private/authorized/signed;
- no predictable public IDs without authorization.

If donee/tax status is not confirmed, use neutral configured wording and do not show claimable-tax language.

## C. Email templates

Implement through existing CMS-first email system where possible:
- donation received/receipt;
- recurring created;
- recurring payment receipt;
- payment failed;
- recurring cancelled;
- refunded;
- receipt replaced/reissued;
- supporter account activation.

Persist delivery status and retry without generating new receipts.

## D. Customer portal

Add `My Donations`/appropriate account navigation with:
- total/history;
- payment-by-payment recurring history;
- receipt view/download;
- recurring status/next payment where provider data supports it;
- cancel/manage payment method through safe provider/PawTag flow;
- secure activation for donation-created supporter.

Ownership enforced server-side.

## E. Admin portal

Desktop admin capabilities:
- dashboard/list/detail;
- donor lookup;
- recurring donations;
- receipt status/view/resend/reissue;
- refund;
- reconciliation;
- permission-protected export;
- audit history;
- safe Stripe references.

Use explicit permissions such as view/manage/refund/receipts/export/reconciliation according to current RBAC naming conventions.

## F. Refunds

Admin authorization + confirmation -> Stripe refund -> authoritative webhook/provider result -> DonationRefund/payment state -> receipt/refund document treatment -> donor notification -> audit. Idempotent under duplicate admin request + duplicate webhook.

## Tests

- monthly subscription success/failure/cancel;
- duplicate invoice paid;
- receipt-number concurrency;
- PDF required-field validation based on configured legal profile;
- ownership negative tests;
- admin RBAC;
- refund concurrency;
- receipt replacement history;
- email retry same receipt;
- customer portal E2E;
- admin E2E.

## Acceptance gate

Every successful donation payment has exactly one durable payment record and appropriate receipt lifecycle; recurring state is safe under retries; customer/admin can manage what they are authorized to manage; corrections/refunds preserve history.

Stop before Phase 17.
