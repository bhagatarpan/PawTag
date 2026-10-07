# Donation Domain Model (Phase 14)

## Product boundary

Donation is **not** a product SKU and **not** a commerce order/invoice.  
Supporters may have **no pet** and **no tag**.

## Logical entities

### Donation (one-time or recurring parent)

| Field | Type | Notes |
|---|---|---|
| id | string (Mongo `_id` as string) | Preserve format |
| supporterUserId | string | Customer account (existing identity) |
| emailSnapshot | string | For historical record |
| nameSnapshot | string | Donor display name |
| amount | integer **minor units** (NZD cents) | Server-authoritative |
| currency | `NZD` only (phase 15) | |
| frequency | `one_time` \| `monthly` | |
| status | see state machine | |
| stripeCustomerId | string | |
| stripePaymentIntentId | string? | one-time |
| stripeSubscriptionId | string? | monthly |
| registrationContext | `DONATION` | no pet onboarding |
| idempotencyKey | string | client create key |
| createdAt / updatedAt | Date | |

### DonationPayment

| Field | Notes |
|---|---|
| donationId | parent |
| amount / currency | |
| status | pending/processing/succeeded/failed/refunded |
| stripePaymentIntentId / stripeInvoiceId | provider refs |
| paidAt | |
| receiptId | after receipt issued |
| webhookEventId | idempotency link |

### DonationReceipt

| Field | Notes |
|---|---|
| receiptNumber | unique sequence e.g. `DNR-000001` |
| donationId / paymentId | |
| amount / currency / issuedAt | |
| status | issued \| void \| replaced |
| taxClassification | config-driven; **no IRD claim until confirmed** |
| pdfUrl | private storage |
| donorNameSnapshot | |

### Supporter identity

- Reuse `User` with `registrationContext: 'DONATION'` (or metadata).
- **No** separate donor auth system.
- Logged-out email match: **never** reveal account existence.
- Post-donation secure activation via existing token/magic-link patterns.

## State machines

### One-time donation

```text
PENDING → PROCESSING → SUCCEEDED | FAILED | CANCELLED
SUCCEEDED → PARTIALLY_REFUNDED | REFUNDED
```

### Monthly recurring

```text
PENDING → ACTIVE (after first Stripe payment success)
ACTIVE → PAST_DUE | CANCELLED
Each successful invoice → one DonationPayment + one receipt
```

**Authoritative success:** Stripe webhook (signed), **not** browser redirect alone.

## Domain invariants

1. Server owns amount/frequency/currency validation.  
2. Webhook/provider state authoritative for money success.  
3. Create/pay/receipt/email/refund idempotent.  
4. Never delete financial records.  
5. Receipts immutable after issue; corrections = void/replaced lineage.  
6. Never issue shop invoice meaning for a donation.  
7. Never claim IRD tax credit until external gate confirmed.  
8. No pet/tag required.  
9. Repository interfaces only — no Mongoose in domain services.
