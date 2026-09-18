---
name: commerce-safety
description: Implement or review PawTag commerce changes involving cart pricing, checkout, Stripe, PaymentIntents, orders, inventory, discounts, refunds, subscriptions, invoices, shipping, reconciliation, or webhooks. Use for financially sensitive code. Enforce server-authoritative pricing, ownership, idempotency, concurrency safety, persistent recovery, webhook authenticity, and production-safe configuration.
---

# Commerce Safety

Financial correctness outranks convenience. `AGENTS.md` remains authoritative.

## Model commerce as state transitions

Do not reason about checkout as one happy-path function. Identify states and transitions for payment, order, reservation, fulfillment, entitlement/subscription, refund, and webhook processing.

At every external or persistent step ask:

> What happens if the process dies immediately after this line?

## Required properties

### Pricing
- Server calculates authoritative product, customization, discount, tax/GST, shipping, and total values.
- Client-submitted totals are display/context only, never authority.
- Detect stale product price or unavailable inventory before final confirmation.

### Ownership
- PaymentIntent/order/cart/pending-order lookup must preserve user ownership.
- Never fall back from an ownership-constrained query to an unconstrained query to "recover" a workflow.

### Stripe/webhooks
- Verify signatures using the raw request body.
- Ensure middleware ordering preserves raw bodies.
- Persist provider event IDs and deduplicate replay.
- Reject unsafe production test/demo configuration.

### Idempotency
- Retried client requests and repeated provider webhooks must not create duplicate charges, orders, refunds, entitlements, or stock movements.
- Use durable keys/state, not process memory.

### Inventory
- Reservation/commit/release operations must be safe under concurrent checkouts.
- If partial reservation can occur, compensate or transact.

### Multi-step consistency
- Use Mongo transactions for tightly coupled database state where justified.
- External calls cannot participate in Mongo transactions; persist explicit intermediate/repairable states.
- Never silently log a financially important failure and still present the overall operation as complete without a repair workflow.

### Refunds
- Authorize refund capability separately.
- Make retries safe.
- Persist external refund IDs and reconcile PawTag state against Stripe.

## Verification

Add tests for duplicate requests, replayed webhooks, ownership violations, concurrent inventory, partial failures, and production configuration where the touched change creates those risks.
