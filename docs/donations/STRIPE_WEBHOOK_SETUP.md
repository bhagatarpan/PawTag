# Stripe webhook — one endpoint for all payments

**There is only one Stripe webhook URL.** Shop, membership, and donations all use it.

## Endpoint

```text
https://<your-api-host>/api/webhooks/stripe
```

Local API default: `http://localhost:5000/api/webhooks/stripe`

## Events to subscribe

| Event | Used for |
|---|---|
| `payment_intent.succeeded` | Shop orders + one-time donations |
| `payment_intent.payment_failed` | Failed payments |
| `invoice.payment_succeeded` | Membership renewals + monthly donations |
| `invoice.payment_failed` | Dunning |
| `customer.subscription.deleted` | Cancellations |
| `charge.refunded` / `refund.*` | Refunds |

## Signing secret

One secret only:

```bash
# packages/api/.env.local
STRIPE_WEBHOOK_SECRET=whsec_...
```

Use the secret from **Stripe Dashboard → Developers → Webhooks** (or Stripe CLI).

## Local development (Stripe CLI)

```bash
# Install: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to http://localhost:5000/api/webhooks/stripe
```

Copy the printed `whsec_...` into `.env.local`, restart the API, then donate with a test card (e.g. `4242 4242 4242 4242`).

## How payments complete

| Path | Primary | Backup |
|---|---|---|
| Shop | `POST /api/checkout/confirm` after Stripe card | Webhook |
| Membership | `POST /api/membership/activate` after Stripe card | Webhook |
| Donation | `POST /api/donations/:id/confirm` after Stripe card | Webhook |

**Do not configure a second webhook.** One endpoint covers all domains.

## Fake mode note

`PAYMENT_MODE=fake` is local-only without real Stripe. Your environment is `stripe_test` — use CLI or dashboard webhooks above.
