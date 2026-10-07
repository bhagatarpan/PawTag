# Donation Payment & Webhook Matrix (Phase 14)

## One-time flow

```text
Client POST /api/donations
  body: { amount, currency, frequency: 'one_time', email, name, marketingConsent?, idempotencyKey }
  → server validates amount (config min/max), currency NZD
  → create/reuse User (DONATION context) — no enumeration on email exists
  → create/reuse Stripe Customer
  → persist Donation status=pending
  → create Stripe PaymentIntent (amount minor units, metadata.donationId)
  → return { donationId, clientSecret, publishableKey }
Client confirms with Stripe.js
Stripe webhook payment_intent.succeeded / payment_intent.payment_failed
  → verify signature (raw body)
  → WebhookEvent {source:stripe, eventId} idempotent
  → DonationPayment + Donation status update
  → enqueue receipt job
Client GET /api/donations/:id/status
  → only pending/processing until webhook confirms success
```

## Recurring flow (Phase 16)

```text
POST frequency=monthly
  → Stripe Customer + Subscription (Billing)
  → Donation status=pending/active per first invoice webhook
invoice.payment_succeeded (billing_reason=subscription_create|subscription_cycle)
  → one DonationPayment + one receipt per invoice
invoice.payment_failed
  → status past_due; email; no fake active
customer.subscription.deleted
  → cancellation idempotent; existing records remain
```

## Webhook event handling

| Stripe event | PawTag effect | Idempotency |
|---|---|---|
| `payment_intent.succeeded` | DonationPayment succeeded; status SUCCEEDED; receipt job | eventId + paymentIntentId |
| `payment_intent.payment_failed` | status FAILED | eventId |
| `invoice.payment_succeeded` | Recurring payment + receipt | stripeInvoiceId unique |
| `invoice.payment_failed` | past_due | eventId |
| `customer.subscription.deleted` | CANCELLED | eventId |
| `charge.refunded` / `refund.*` | REFUNDED lineage; receipt void/replaced | refundId |

## Security matrix

| Threat | Control |
|---|---|
| Amount tampering | Server validates; PI amount from server only |
| Fake success via redirect | Status only after signed webhook |
| Duplicate webhook | WebhookEvent unique eventId |
| Duplicate create POST | idempotencyKey on Donation |
| Card testing | Rate limit donate create; CAPTCHA optional setting |
| Donor enumeration | Generic success messaging on email match |
| XSS/PII logs | No card data; minimize donor PII in logs |
| Unauthorized refund | RBAC `donation.refund` + audit |

## Failure / recovery

| Failure | Behavior |
|---|---|
| Stripe PI created, DB write fails | Pending repair marker; reconcile job |
| Webhook OK, receipt job fails | EmailAudit/receipt job retry; payment remains succeeded |
| Client retries confirm | Idempotent status endpoint |
| Stripe paid, local pending | Phase 17 reconciliation alert |
