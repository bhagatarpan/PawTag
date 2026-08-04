# PawTag — Business Workflows

## Order Lifecycle State Machine

The order status follows a strict state machine enforced server-side by `packages/api/src/services/orderStatus.service.ts`. Invalid transitions are rejected with a `400 Bad Request`.

### State Diagram

```
                    ┌─────────────┐
                    │   pending   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌──────────────┐ ┌────────┐ ┌───────────┐
     │pending_payment│ │  paid  │ │ cancelled │
     └──────┬───────┘ └───┬────┘ └───────────┘
            │              │            ▲
            │         ┌────┼────┐       │
            ▼         ▼    ▼    ▼       │
       ┌────────┐ ┌────────┐ ┌──────────┤
       │  paid  │ │packing │ │refunded  │
       └────────┘ └───┬────┘ └──────────┘
                      │            ▲
                      ▼            │
                ┌──────────┐       │
                │ shipped  │       │
                └───┬──────┘       │
                    │              │
                    ▼              │
              ┌──────────┐         │
              │ delivered │────────┘
              └──────────┘
```

### Valid Transitions

| From | To | Trigger |
|------|----|---------|
| `pending` | `pending_payment` | Order created with card payment |
| `pending` | `paid` | Order created with non-card payment (bank transfer) |
| `pending` | `cancelled` | Admin cancels before payment |
| `pending_payment` | `paid` | Stripe webhook `payment_intent.succeeded` |
| `pending_payment` | `cancelled` | Stripe webhook `payment_intent.payment_failed` or admin cancel |
| `paid` | `packing` | Admin begins fulfillment |
| `paid` | `cancelled` | Admin cancels a paid order |
| `paid` | `refunded` | Admin refunds without shipping |
| `packing` | `shipped` | Shipping label created via courier API |
| `packing` | `cancelled` | Admin cancels during packing |
| `shipped` | `delivered` | Admin marks as delivered (or courier webhook) |
| `delivered` | `refunded` | Post-delivery refund |
| `cancelled` | — | Terminal state |
| `refunded` | — | Terminal state |

### State Descriptions

| State | Meaning |
|-------|---------|
| `pending` | Order created, awaiting payment method selection |
| `pending_payment` | Payment initiated (Stripe PaymentIntent created), awaiting confirmation |
| `paid` | Payment confirmed, ready for fulfillment |
| `packing` | Order is being prepared for shipment |
| `shipped` | Shipping label created, package handed to courier |
| `delivered` | Package confirmed delivered |
| `cancelled` | Order cancelled (stock restored if applicable) |
| `refunded` | Payment refunded to customer |

### Order Creation Flow

1. Customer adds items to cart
2. Customer submits order with shipping address
3. API validates stock, calculates totals, applies bundle discounts
4. Stripe PaymentIntent is created
5. Order is created with status `pending_payment` (card) or `pending` (other methods)
6. `clientSecret` is returned to the frontend for card confirmation
7. On successful payment, Stripe fires `payment_intent.succeeded` webhook
8. Webhook handler flips order to `paid`, creates subscriptions, sends confirmation email
9. On failed payment, `payment_intent.payment_failed` webhook cancels order and restores stock

### Payment Confirmation (Demo Mode)

For local development without real Stripe credentials:
1. Frontend detects demo mode (`clientSecret` contains "demo")
2. Frontend calls `POST /api/customer/orders/:orderNumber/confirm-payment`
3. Endpoint flips order to `paid` and triggers post-payment workflows

---

## Tag Redemption Flow

See Phase 11 (planned) for the full tag redemption workflow. The basic flow:

1. Customer receives physical tag in mail
2. Customer enters tag ID (or scans QR/NFC) in customer portal
3. API validates tag exists and is unclaimed
4. Tag is linked to customer's account
5. Customer links tag to a pet profile
