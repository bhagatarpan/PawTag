# Phase 02 — Checkout Quote, Reservations, Inventory, Rewards, Orders, and Shipping Integrity

## Objective

Make the full money/order state machine authoritative, concurrency-safe, idempotent, and repairable before further UX polish.

## Required skills

`work-packet-executor`, `commerce-safety`, `database-integrity`, `security-boundary-review`, `testing-regression`, `feature-completeness`

## Inspect

- `packages/api/src/routes/checkout.ts`
- `packages/api/src/commerce/services/checkout.service.ts`
- cart/pricing/shipping services
- `packages/api/src/commerce/services/inventory.service.ts`
- `packages/db/src/models/PendingOrder.ts`
- `packages/db/src/models/Cart.ts`, `Order.ts`, `PaymentTransaction.ts`, `PromoCode.ts`, `PawRewardsLedger.ts`
- order cancellation/refund/return services and jobs
- `packages/api/src/routes/shipping.ts`
- `packages/api/src/services/shipping.service.ts`
- shared checkout/cart contracts
- web checkout/cart consumers

## Required architecture

The server must produce one authoritative checkout quote containing product/variant/customisation pricing, discounts, rewards reservation, shipping method/cost, tax/GST semantics, and final payable total. The client selects IDs/options; it does not author financial values.

## Tasks

### A. Checkout quote

1. Define a shared `CheckoutQuote` contract.
2. Server recalculates from authoritative catalog/cart/membership/promo/rewards/shipping state.
3. Client-submitted stale monetary fields are ignored/rejected.
4. Quote has revision/expiry semantics sufficient to detect stale checkout state.
5. PaymentIntent amount derives only from the accepted server quote.
6. Handle zero-total orders explicitly without a fake Stripe payment.

### B. Shipping

1. Shipping selection accepts a stable method identifier, not client cost.
2. Fallback/default shipping methods must have IDs that the select path can resolve; do not expose synthetic IDs that later call `findById()` and fail.
3. Rate eligibility uses authoritative cart subtotal, not `0` or client values.
4. Prevent stale/racing rate responses from overwriting a newer address/cart quote.
5. Production fulfilment uses real provider integration or explicit manual fulfilment state—never fabricated tracking.

### C. Rewards and promo concurrency

1. PawRewards must be a real reservation: atomically prevent two checkouts from spending the same balance.
2. Reservation has owner, amount, checkout/pending-order identifier, expiry, status.
3. Payment/order success commits exactly once; failure/expiry releases exactly once.
4. Finalization must not allow a paid order with rewards discount applied if rewards cannot be committed. Such a state needs deterministic repair/compensation.
5. Promo per-user/global limits must be enforced authoritatively and concurrency-safe at finalization.
6. Retries must not increment usage twice.

### D. Inventory lifecycle

1. Reservation of multiple lines must compensate previous reservations if later lines fail.
2. Reservation expiry must execute release logic before data cleanup. Mongo TTL alone must not silently delete `PendingOrder` while stock remains reserved.
3. Create a durable expiry/cleanup job or equivalent state transition.
4. `confirmSale()` or equivalent must fail loudly if the expected atomic transition did not happen; silent no-op is not success.
5. Concurrent checkout tests must prove no negative/oversold stock beyond explicit policy.

### E. Order finalization

1. There must be one authoritative order/payment finalization service. Legacy paths should be removed, return explicit deprecation, or delegate without duplicating rules.
2. Ownership must always be constrained; never fall back from user-scoped lookup to payment-ID-only access.
3. Define durable states for `payment_succeeded_order_pending`, `order_created_entitlement_pending`, etc., wherever external/local atomicity is impossible.
4. Every partial state must have a reconciliation/repair path and alert.
5. Browser close/retry after successful payment must recover via idempotent status/finalization endpoint.

### F. Refunds/returns/cancellation

Verify server-calculated refundable amount, original payment destination, idempotent provider refund, order/return state transitions, warehouse/manual fulfilment rules, credit-note/invoice effects, customer/admin visibility, and reconciliation.

## Failure injection tests

At minimum test:
- two concurrent rewards reservations;
- duplicate promo finalization;
- reservation expiry/release;
- inventory line 3 fails after lines 1–2 reserve;
- atomic stock confirm condition fails;
- Stripe succeeds then DB/order write fails;
- DB state succeeds then response fails/client retries;
- duplicate checkout confirm;
- zero-total order;
- shipping method disappears/changes;
- stale quote and stale shipping response;
- duplicate refund/cancellation.

## Acceptance gate

No client can alter final payable amount, rewards cannot be double-spent, stock reservations cannot leak silently, payment/order retries are idempotent, and every provider/local partial state is traceable and repairable.

Stop before Phase 03.
