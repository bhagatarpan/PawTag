# Phase 03 — Email, Invoices, Notifications, Subscription Entitlements, and Fulfilment Delivery

## Objective

Prove that critical post-transaction outcomes reach the correct customer/staff recipient and that financial documents/entitlements are generated from authoritative state rather than optimistic frontend/provider assumptions.

## Required skills

`work-packet-executor`, `financial-document-integrity`, `email-cms-templates`, `membership-lifecycle`, `commerce-safety`, `testing-regression`, `feature-completeness`

## Inspect

- `packages/api/src/services/email.service.ts`
- CMS email template routes/models/services
- `packages/api/src/services/email-audit.service.ts`
- `packages/api/src/routes/resend-webhooks.ts`
- `packages/db/src/models/EmailAudit.ts`
- invoice models/services/routes: `Invoice.ts`, `InvoiceAccessToken.ts`, `invoice-html.service.ts`, `invoice-access.ts`
- order/subscription invoice creation
- notification delivery + push token models/services
- membership/subscription services/routes/jobs
- shipment/tracking/fulfilment services and jobs
- customer/admin order/invoice/subscription pages

## Tasks

### A. Transactional communication durability

For launch-critical communications (verification, password reset, finder alert, order confirmation, invoice/credit note, refund/cancellation, subscription payment/activation/failure):

1. persist dispatch intent/result or equivalent audit state;
2. distinguish queued/sending/sent/delivered/bounced/failed where provider supports it;
3. retries must be idempotent;
4. provider failure must not falsify business state;
5. recipients are derived from authoritative user/order/subscription data;
6. production must never return “sent” when no provider call happened.

### B. Resend webhook

1. Confirm effective route path is exactly documented/configured once.
2. Verify webhook authenticity/signature according to provider capability.
3. Reject spoofed events.
4. Map provider message ID to PawTag email audit state.
5. Duplicate events are idempotent.

### C. Financial documents

1. Customer and admin access enforce ownership/permission.
2. Emailed links reference persisted/revocable access records if unauthenticated access is intended.
3. Invoice PDF/HTML/portal/email all derive from the same authoritative invoice record.
4. Credit notes/refunds remain linked to source order/invoice.
5. Numbering is concurrency-safe and immutable after issue.
6. Private object storage and access token rules are tested.

### D. Subscription/membership entitlement state

1. Map provider states explicitly: incomplete/trialing/active/past_due/canceled/etc.
2. Local paid/active entitlement must not precede authoritative successful payment unless product explicitly supports a free/trial state.
3. Frontend callback cannot be the only activator.
4. Webhook is idempotent safety/authority path.
5. Welcome/activation email only reflects true entitlement state.
6. Cancellation/resume/upgrade/downgrade are auditable and reconciliation-safe.

### E. Notification provider alignment

Before Capacitor migration, document the current push token/provider mismatch and choose the target provider architecture. Do not attempt to treat Expo tokens as FCM registration tokens. Web first-customer launch may mark native push `DEFERRED`, but backend must not report fake delivery.

## Verification matrices

Update:
- `verification/EMAIL_INVOICE_NOTIFICATION_MATRIX.md`
- subscription event/state matrix
- fulfilment/shipment notification matrix

Each row must show trigger, recipient, template/document, route/link target, retry path, provider evidence, and automated coverage.

## Acceptance gate

A successful transaction has a deterministic downstream communication/document/entitlement story, and a communication failure is visible/retryable rather than silently lost.

Stop before Phase 04.
