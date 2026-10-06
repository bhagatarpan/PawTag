# Phase 17 — Donation Reconciliation, Security, Observability, Production Rehearsal, and Public Enablement

## Objective

Prove the donation domain behaves correctly under failure, fraud-like abuse, provider retries, and real production delivery before enabling a public Donate CTA.

## Required skills

`work-packet-executor`, `donation-domain`, `release-readiness`, `production-readiness-review`, `security-boundary-review`, `background-jobs`, `testing-regression`

## A. Reconciliation/background work

Implement/verify durable jobs for:
- receipt generation retry;
- receipt email retry;
- one-time payment reconciliation;
- recurring donation/subscription reconciliation;
- webhook recovery/stale processing;
- failed-donation operational alert;
- receipt integrity check where justified.

Mismatch examples must produce repair/manual-review records rather than silent state mutation:
- Stripe paid / PawTag pending;
- Stripe recurring active / PawTag cancelled;
- Stripe invoice paid / local payment missing;
- Stripe refunded / local still succeeded;
- payment succeeded / receipt missing.

## B. Observability

Structured IDs and metrics for donation/customer/payment/subscription/receipt/webhook without card data or unnecessary donor PII. Alert repeated provider/document/email/reconciliation failure.

## C. Security test suite

Prove:
- Customer A cannot access B donation/receipt/subscription;
- guest cannot enumerate donations/receipts;
- invalid webhook signature rejected;
- duplicate webhook/request safe;
- amount/currency/frequency manipulation rejected;
- unauthorized admin refund/reissue/export rejected;
- card-testing rate/abuse controls behave reasonably;
- account enumeration prevented;
- receipt URL/token authorization/revocation works.

## D. Tax/receipt external gate

Before any “tax credit”, “tax deductible”, “IRD claimable” or equivalent public wording:

- approved donee status and organisation identifiers must be confirmed;
- receipt wording/fields must be approved by appropriate NZ professional;
- refund/tax-credit/GST treatment must be confirmed;
- final PDF manually reviewed.

If not confirmed, launch may use neutral donation/payment receipt wording only if the business/legal adviser approves that approach.

## E. Production mode separation

- test/staging: Stripe test, non-prod persistence, test recipients;
- production: Stripe live, real email, real private storage, real production database, monitoring;
- never silently fall back to fake/test.

## F. Controlled launch rehearsal

1. deploy with public donation feature flag disabled;
2. production build/config validation;
3. small controlled live one-time donation;
4. verify Stripe, local record, receipt/PDF, email, portal, admin, audit;
5. execute refund and verify full lifecycle;
6. small controlled monthly recurring donation;
7. verify first payment/receipt/portal/admin;
8. cancel and verify state/webhooks;
9. verify reconciliation and alerts;
10. only then enable public Donate navigation/home CTA.

## Rollback

Feature flag disables **new** donations but must not make existing financial records or recurring management inaccessible. Do not automatically cancel existing recurring donations during an incident.

## Acceptance gate

`verification/DONATION_RELEASE_MATRIX.md` is green with real evidence and external tax/legal blockers are either resolved or the public wording/feature scope explicitly excludes the unapproved claims.

Stop before Phase 18.
