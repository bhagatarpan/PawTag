# Order Data Flows — Create, Cancel, Refund

**Last updated:** 2026-09-02
**Status:** Active — reference for all order lifecycle data structures

This document details exactly what data is sent, stored, and processed at each stage of the order lifecycle — for both Admin and Customer portals.

---

## Table of Contents

- [Order Creation](#order-creation)
- [Order Cancellation](#order-cancellation)
- [Order Refund](#order-refund)
- [Refund Lifecycle (Webhooks)](#refund-lifecycle-webhooks)
- [System Auto-Cancel](#system-auto-cancel)
- [Comparison Table](#comparison-table)

---

## Order Creation

### Overview

Orders are created through a 3-phase checkout process:
1. **Phase 1:** Create Payment Intent (server-side cart validation + Stripe PI creation)
2. **Phase 2:** Stripe Payment (client-side — card entry in Stripe Elements)
3. **Phase 3:** Confirm Checkout (order creation, invoice, stock deduction)

### Phase 1: Create Payment Intent

**Endpoint:** `POST /api/checkout/payment-intent`
**Auth:** JWT required

#### Frontend Sends

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shippingAddress.line1` | string | Yes | Street address |
| `shippingAddress.line2` | string | No | Apartment/suite |
| `shippingAddress.city` | string | Yes | City |
| `shippingAddress.state` | string | Yes | State/region |
| `shippingAddress.zip` | string | Yes | Postal code |
| `shippingAddress.country` | string | Yes | Country code |

#### API Processes

1. Validates cart exists and has items
2. Validates stock for all items via `inventoryService.canFulfill()`
3. Calculates totals server-side (ignores client prices):
   - `subtotal` — sum of all line totals
   - `discount` — promo code amount
   - `shipping` — shipping cost
   - `tax` — GST extracted (15% tax-inclusive)
   - `total` — `subtotal - discount + shipping`
4. Generates order number: `PT-NNNNNN` (atomic counter)
5. Creates Stripe PaymentIntent (see Stripe data below)
6. Creates `PendingOrder` document
7. Reserves stock

#### Stripe PaymentIntent Created

| Stripe Field | Value |
|-------------|-------|
| `amount` | `Math.round(total * 100)` (cents) |
| `currency` | `'nzd'` |
| `automatic_payment_methods` | `{ enabled: true }` |
| `receipt_email` | Customer email |
| `description` | CMS template, e.g., `"PawTag Order PT-000001"` |
| `statement_descriptor` | CMS setting (max 22 chars) |
| `metadata.orderId` | Order number |
| `metadata.orderNumber` | Order number |
| `metadata.environment` | `'development'` / `'production'` |
| `metadata.source` | `'pawtag'` |
| `metadata.userId` | User ID |

#### PendingOrder Document Created

| Field | Value |
|-------|-------|
| `userId` | ObjectId |
| `items` | `[{productId, productName, sku, unitPrice, customizationTotal, quantity, image, customisation}]` |
| `subtotal` | Server-calculated |
| `discount` | Server-calculated |
| `promoCode` | From Cart |
| `shipping` | Server-calculated |
| `shippingMethodId` | From Cart |
| `shippingMethodName` | From Cart |
| `tax` | Server-calculated (GST component) |
| `total` | Server-calculated grand total |
| `currency` | `'NZD'` |
| `stripePaymentIntentId` | Stripe PI ID |
| `stripeClientSecret` | For Stripe Elements |
| `shippingAddress` | From frontend |
| `status` | `'pending'` |
| `referralCode` | `cart.promoCode` |
| `expiresAt` | CMS setting TTL |
| `lastAccessedAt` | `new Date()` |

#### Response to Frontend

```json
{
  "success": true,
  "data": {
    "pendingOrderId": "...",
    "paymentIntentId": "pi_xxx...",
    "clientSecret": "pi_xxx_secret_xxx",
    "amount": 59.99,
    "currency": "NZD"
  }
}
```

### Phase 2: Stripe Payment (Client-Side)

- Customer enters card details in Stripe Elements (PCI-compliant — card data never touches PawTag)
- `stripe.confirmPayment()` executes client-side
- No PawTag API calls during this phase

### Phase 3: Confirm Checkout

**Endpoint:** `POST /api/checkout/confirm`
**Auth:** JWT required

#### Frontend Sends

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `paymentIntentId` | string | Yes | Stripe PaymentIntent ID |

#### API Processes

1. Finds PendingOrder by `stripePaymentIntentId`
2. Validates payment via Stripe API (`retrievePaymentIntent`)
3. Checks idempotency (order already exists for this PI)
4. Creates Order with retry (3 attempts on duplicate key)
5. Creates PaymentTransaction
6. Confirms stock (deducts reserved inventory)
7. Creates Invoice + InvoiceAccessToken
8. Marks PendingOrder as `converted`
9. Marks Cart as `converted`
10. Sends emails (fire-and-forget)

#### Order Document Created

| Field | Value |
|-------|-------|
| `orderNumber` | `'PT-000001'` (atomic counter) |
| `userId` | ObjectId |
| `items` | `[{productId, productName, sku, quantity, unitPrice, totalPrice}]` |
| `subtotal` | From PendingOrder |
| `shippingCost` | From PendingOrder |
| `tax` | From PendingOrder |
| `discount` | `{percent: 0, amount, reason: promoCode}` (if discount > 0) |
| `status` | `'paid'` |
| `payment.method` | `'card'` |
| `payment.status` | `'completed'` |
| `payment.transactionId` | Stripe PI ID |
| `payment.stripePaymentIntentId` | Stripe PI ID |
| `payment.cardBrand` | From Stripe (e.g., `'visa'`) |
| `payment.cardLast4` | From Stripe (e.g., `'4242'`) |
| `payment.amount` | Grand total |
| `payment.currency` | `'NZD'` |
| `payment.paidAt` | `new Date()` |
| `shippingAddress` | From PendingOrder |
| `referredByCode` | From PendingOrder |
| `notes` | `'Stripe PaymentIntent: pi_xxx...'` |
| `createdBy` | `"Customer (Sarah Johnson)"` |
| `createdByType` | `"Customer"` |
| `createdByPortal` | `'customer-web'` |
| `createdByDescription` | `"Order placed via Customer Web Portal by Sarah Johnson"` |
| `createdByEmail` | `"sarah@example.com"` |

#### Activity Log Entry

```json
{
  "type": "order_placed",
  "message": "Order placed and paid",
  "timestamp": "2026-09-02T10:30:00.000Z",
  "actor": "customer"
}
```

#### PaymentTransaction Created

| Field | Value |
|-------|-------|
| `orderId` | Order ObjectId |
| `orderNumber` | `'PT-000001'` |
| `type` | `'payment'` |
| `status` | `'succeeded'` |
| `amount` | Grand total |
| `currency` | `'NZD'` |
| `provider` | `'stripe'` |
| `providerTransactionId` | Stripe PI ID |
| `initiatedBy` | `'customer'` |

#### Invoice Created

| Field | Value |
|-------|-------|
| `orderId` | Order ObjectId |
| `userId` | ObjectId |
| `invoiceNumber` | `'INV-000001'` (atomic counter) |
| `amount` | Grand total |
| `currency` | `'NZD'` |
| `status` | `'paid'` |
| `paymentMethod` | `'card'` |
| `paidAt` | `new Date()` |

#### Emails Sent (Fire-and-Forget)

| Email | To | Subject | Content |
|-------|-----|---------|---------|
| Order Confirmation | Customer | `Order Confirmed — PT-000001 \| PawTag` | Items, totals, shipping address |
| Invoice | Customer | `Invoice INV-000001 from PawTag` | Full invoice HTML + secure URL |
| Admin Alert | `ADMIN_ALERT_EMAIL` | `New PawTag order: PT-000001` | Order number, customer, amount |

#### Notifications Created

| Notification | Audience | Type | Priority |
|-------------|----------|------|----------|
| Admin alert | `admin` | `new_order` | `high` |
| Customer notice | `customer` | `order` | — |

#### Response to Frontend

```json
{
  "success": true,
  "data": {
    "order": { "..." : "full Order document" },
    "invoice": { "..." : "full Invoice document" },
    "invoiceUrl": "http://localhost:3000/invoice/{token}?admin=1",
    "isNew": true
  }
}
```

---

## Order Cancellation

### Admin Cancel Order

**Endpoint:** `POST /api/admin/orders/:id/cancel`
**Auth:** JWT + `order.update` permission

#### Admin Frontend Sends

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | Yes | Selected from CMS dropdown |
| `notes` | string | Conditional | Required when reason is "Other" |

**Reason dropdown** populated from `GET /api/admin/commerce/cancellation-reasons` (8 default reasons).

#### API Validates

1. `reason` is non-empty trimmed string
2. Order exists
3. Status transition allowed: `pending`, `pending_payment`, `paid`, `packing` → `cancelled`
4. Resolves admin actor via `resolveActor()`

#### Order Fields Updated

| Field | Value |
|-------|-------|
| `status` | `'cancelled'` |
| `cancellationReason` | Selected reason (e.g., `"Changed my mind"`) |
| `cancellationNotes` | Free text (when "Other" selected) |
| `cancelledBy` | `"Dave Macenzie (Admin)"` via `formatCancelledBy()` |
| `cancelledByType` | `actor.displayName` (e.g., `"Admin"`) |
| `cancelledByPortal` | `'admin-web'` |
| `cancelledByDescription` | `"Order is Cancelled via Admin Web Portal by Dave Macenzie (Admin)"` |
| `cancelledAt` | `new Date()` |
| `payment.status` | `'refunded'` (if refund created) |
| `refundId` | Stripe refund ID (if refund created) |
| `refundStatus` | `'pending'` (if refund created) |
| `refundLastSyncedAt` | `new Date()` (if refund created) |

#### Stripe Refund Created (If Paid Order)

| Stripe Field | Value |
|-------------|-------|
| `payment_intent` | `order.payment.stripePaymentIntentId` |
| `amount` | `order.payment.amount` (always full amount) |
| `reason` | `'requested_by_customer'` |
| `metadata.orderId` | Order MongoDB ID |
| `metadata.orderNumber` | Order number |
| `metadata.cancelledBy` | `"Dave Macenzie (Admin)"` |
| `metadata.cancelledByType` | `"Admin"` |
| `metadata.cancelledByPortal` | `"admin-web"` |
| `metadata.cancellationReason` | Selected reason |
| `metadata.cancellationNotes` | Notes or empty string |
| `metadata.initiatedBy` | `"admin"` |
| `metadata.environment` | `"development"` / `"production"` |

**Note:** If refund fails, cancellation still proceeds (best-effort).

#### PaymentTransaction Created

| Field | Value |
|-------|-------|
| `orderId` | Order ObjectId |
| `orderNumber` | Order number |
| `type` | `'refund'` |
| `status` | `'succeeded'` or `'pending'` |
| `amount` | Full order amount |
| `currency` | `'NZD'` |
| `provider` | `'stripe'` |
| `providerTransactionId` | Stripe refund ID |
| `providerStatus` | Stripe refund status |
| `arn` | Acquirer Reference Number |
| `expectedArrival` | Date |
| `initiatedBy` | `'admin'` |
| `attemptCount` | `0` |
| `notes` | `"Changed my mind"` or `"Other — Found cheaper"` |

#### Activity Log Entry

```json
{
  "type": "cancelled",
  "message": "Order cancelled by Dave Macenzie (Admin): Changed my mind : AT : 2026-09-02T10:30:00.000Z",
  "timestamp": "2026-09-02T10:30:00.000Z",
  "actor": "admin",
  "metadata": {
    "reason": "Changed my mind",
    "notes": null,
    "cancelledBy": "Dave Macenzie (Admin)",
    "cancelledByType": "Admin",
    "cancelledByPortal": "admin-web",
    "cancelledAt": "2026-09-02T10:30:00.000Z",
    "refundCreated": true,
    "refundId": "re_xxx"
  }
}
```

#### Audit Event Created

| Field | Value |
|-------|-------|
| `action` | `'cancel_order'` |
| `eventType` | `'admin_order_cancel'` |
| `eventCategory` | `'FINANCIAL'` |
| `severity` | `'HIGH'` |
| `outcome` | `'SUCCESS'` |
| `changedFields` | `[{field: 'status', before: 'paid', after: 'cancelled'}]` |
| `metadata` | `{orderNumber, previousStatus, reason, notes, amount, stockRestored, cancelledBy, cancelledByType, cancelledByPortal, refundCreated, refundId}` |

#### Emails Sent

| Email | To | Subject |
|-------|-----|---------|
| Cancel notification | Customer | `Order PT-000001 cancelled` |
| Admin alert | `ADMIN_ALERT_EMAIL` | `Order PT-000001 cancelled` |

#### Stock Released

```typescript
inventoryService.releaseForOrder(orderId, items.map(item => ({
  productId: item.productId,
  quantity: item.quantity,
})))
```

---

### Customer Cancel Order

**Endpoint:** `POST /api/customer/returns/orders/:id/cancel`
**Auth:** JWT required (must own order)

#### Customer Frontend Sends

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | Yes | Selected from CMS dropdown |
| `notes` | string | Conditional | Required when reason is "Other" |
| `portal` | string | Yes | `'customer-web'` or `'customer-mobile'` |

**Reason dropdown** populated from `GET /api/public/commerce/cancellation-reasons` (no auth required).

#### API Validates

1. User owns the order (`order.userId === req.user.id`)
2. Same status transition check as admin
3. Resolves user name from DB

#### Order Fields Updated

| Field | Value |
|-------|-------|
| `status` | `'cancelled'` |
| `cancellationReason` | Selected reason |
| `cancellationNotes` | Free text (when "Other") |
| `cancelledBy` | `"Customer (John Smith)"` (always this format) |
| `cancelledByType` | `'Customer'` |
| `cancelledByPortal` | `'customer-web'` or `'customer-mobile'` |
| `cancelledByDescription` | `"Order is Cancelled via Customer Web Portal by John Smith"` |
| `cancelledAt` | `new Date()` |
| `payment.status` | `'refunded'` (if refund created) |
| `refundId` | Stripe refund ID (if refund created) |
| `refundStatus` | Stripe refund status (if refund created) |

#### Stripe Refund Created

Same as admin cancel, but with different metadata:

| Metadata Field | Value |
|---------------|-------|
| `cancelledBy` | `'Cancelled by Customer'` (hardcoded) |
| `cancelledByType` | `'Customer'` |
| `cancelledByPortal` | `'customer-web'` / `'customer-mobile'` |
| `initiatedBy` | `'customer'` |

**Key difference from admin:** If refund fails, the entire request fails with 502 error (customer expects refund).

#### PaymentTransaction Created

Same structure as admin, but `initiatedBy: 'customer'`.

#### Activity Log Entry

```json
{
  "type": "cancelled",
  "message": "Order cancelled by Customer (John Smith): Changed my mind : AT : 2026-09-02T10:30:00.000Z",
  "timestamp": "2026-09-02T10:30:00.000Z",
  "actor": "customer",
  "metadata": {
    "reason": "Changed my mind",
    "cancelledBy": "Customer (John Smith)",
    "cancelledByType": "Customer",
    "cancelledByPortal": "customer-web",
    "cancelledAt": "2026-09-02T10:30:00.000Z"
  }
}
```

**Note:** No `refundCreated` or `refundId` in metadata (unlike admin).

#### Audit Event

**None.** Customer cancel does NOT create an `AuditEvent` record. Only the activity log on the order is recorded.

#### Emails Sent

Same as admin cancel (customer notification + admin alert).

#### Stock Released

Same as admin cancel.

---

## Order Refund

### Admin Refund Order (Standalone)

**Endpoint:** `POST /api/admin/orders/:id/refund`
**Auth:** JWT + `order.update` permission

This is a **standalone refund** — the order is marked as `refunded` without being `cancelled` first. Used for delivered orders or already-cancelled orders.

#### Admin Frontend Sends

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | Yes | Selected from dropdown |
| `amount` | number | No | Defaults to full amount. Supports partial refund. |

#### API Validates

1. `reason` is non-empty trimmed string
2. Order exists
3. Status transition allowed: `paid`, `delivered`, `cancelled` → `refunded`
4. Has `stripePaymentIntentId` or `transactionId`
5. Not a demo payment (`pi_demo_`)
6. Refund amount: `0 < amount <= order.payment.amount`
7. Refund window: `daysSincePurchase <= commerce.refunds.maxDaysAfterPurchase`

#### Order Fields Updated

| Field | Value |
|-------|-------|
| `status` | `'refunded'` |
| `refundReason` | Selected reason (e.g., `"Wrong item shipped"`) |
| `refundId` | Stripe refund ID |
| `refundStatus` | `'pending'` |
| `refundLastSyncedAt` | `new Date()` |
| `payment.status` | `'refunded'` |

**Note:** Does NOT set `cancelledBy*` or `cancelledAt` fields.

#### Stripe Refund Created

| Stripe Field | Value |
|-------------|-------|
| `payment_intent` | `order.payment.stripePaymentIntentId` |
| `amount` | `refundAmount` (can be partial) |
| `reason` | `'requested_by_customer'` |
| `metadata.orderId` | Order MongoDB ID |
| `metadata.orderNumber` | Order number |
| `metadata.refundedBy` | `"Dave Macenzie (Admin)"` |
| `metadata.refundedByType` | `"Admin"` |
| `metadata.refundedByPortal` | `"admin-web"` |
| `metadata.refundReason` | Selected reason |
| `metadata.initiatedBy` | `"admin"` |
| `metadata.environment` | `"development"` / `"production"` |

**Key differences from cancel metadata:**
- Uses `refundedBy`/`refundedByType`/`refundedByPortal` (not `cancelledBy*`)
- Uses `refundReason` (not `cancellationReason`)
- No `cancellationNotes` field
- Amount can be partial

#### PaymentTransaction Created

| Field | Value |
|-------|-------|
| `orderId` | Order ObjectId |
| `orderNumber` | Order number |
| `type` | `'refund'` |
| `status` | `'succeeded'` or `'pending'` |
| `amount` | Refund amount (can be partial) |
| `currency` | `'NZD'` |
| `provider` | `'stripe'` |
| `providerTransactionId` | Stripe refund ID |
| `providerStatus` | Stripe refund status |
| `arn` | Acquirer Reference Number |
| `expectedArrival` | Date |
| `initiatedBy` | `'admin'` |
| `attemptCount` | `0` |
| `notes` | Reason string |

#### Activity Log Entry

```json
{
  "type": "refunded",
  "message": "Dave Macenzie (Admin) refunded order: Wrong item shipped : AT : 2026-09-02T10:30:00.000Z",
  "timestamp": "2026-09-02T10:30:00.000Z",
  "actor": "admin",
  "metadata": {
    "reason": "Wrong item shipped",
    "refundId": "re_xxx",
    "refundStatus": "pending",
    "amount": 59.99,
    "refundedBy": "Dave Macenzie (Admin)",
    "refundedByType": "Admin",
    "refundedByPortal": "admin-web",
    "refundedAt": "2026-09-02T10:30:00.000Z"
  }
}
```

#### Audit Event Created

| Field | Value |
|-------|-------|
| `action` | `'refund_order'` |
| `eventType` | `'admin_order_refund'` |
| `eventCategory` | `'FINANCIAL'` |
| `severity` | `'CRITICAL'` |
| `outcome` | `'SUCCESS'` |
| `changedFields` | `[{field: 'status', before: 'paid', after: 'refunded'}, {field: 'payment.status', before: 'completed', after: 'refunded'}]` |
| `metadata` | `{orderNumber, previousStatus, reason, refundId, amount, paymentTransactionId}` |

**On failure:**

| Field | Value |
|-------|-------|
| `action` | `'refund_order_failed'` |
| `eventType` | `'admin_order_refund_failed'` |
| `severity` | `'CRITICAL'` |
| `outcome` | `'FAILURE'` |
| `metadata.stripeError` | Error message from Stripe |

#### Emails Sent

| Email | To | Subject |
|-------|-----|---------|
| Refund notification | Customer | `Order PT-000001 refunded` |
| Admin alert | `ADMIN_ALERT_EMAIL` | `Order PT-000001 refunded` |

**Note:** Detailed refund status emails (processing, settled, failed) are sent later via Stripe webhooks.

---

## Refund Lifecycle (Webhooks)

### Webhook Events from Stripe

| Event | Handler | Purpose |
|-------|---------|---------|
| `refund.created` | `handleRefundCreated` | Marks refund as pending |
| `refund.updated` | `handleRefundUpdated` | Updates status (succeeded/failed/canceled) |
| `charge.refunded` | `handleChargeRefunded` | Confirms full settlement |

### `refund.created` — Initial Pending State

**Order fields updated:**
- `refundId` → Stripe refund ID
- `refundStatus` → `'pending'`
- `refundLastSyncedAt` → `new Date()`

### `refund.updated` — Status Changes

**Order fields updated:**
- `refundStatus` → new status
- `refundLastSyncedAt` → `new Date()`
- On success: `refundSettledAt` → `new Date()`
- On failure: `refundFailureReason` → Stripe failure reason

**Activity log entry:**

```json
{
  "type": "refund_succeeded",
  "message": "Refund succeeded: re_xxx (ARN pending)",
  "timestamp": "2026-09-02T10:35:00.000Z",
  "actor": "webhook",
  "metadata": {
    "refundId": "re_xxx",
    "previousStatus": "pending",
    "newStatus": "succeeded",
    "amount": 59.99,
    "failureReason": null
  }
}
```

### Emails Sent via Webhooks

| Status | Email Template | To | Subject |
|--------|---------------|-----|---------|
| `pending` | `refund-processing.ts` | Customer | `Refund Processing — PT-000001` |
| `succeeded` | `refund-settled.ts` | Customer | `Refund Settled — PT-000001` |
| `failed` | `refund-failed.ts` | Customer | `Refund Failed — PT-000001` |
| `failed` | Admin alert | `ADMIN_ALERT_EMAIL` | `[ACTION REQUIRED] Refund Failed — PT-000001` |

### Auto-Retry on Failure

| Setting | Default | Description |
|---------|---------|-------------|
| `commerce.refunds.maxAutoRetries` | `1` | Max retry attempts |
| `commerce.refunds.retryFirstHours` | `2` | First retry delay |
| `commerce.refunds.retrySecondHours` | `24` | Second retry delay |

**Retry metadata sent to Stripe:**

| Metadata Field | Value |
|---------------|-------|
| `retryAttempt` | `"1"` |
| `previousRefundId` | Previous refund ID |
| `initiatedBy` | Based on original canceller role |

---

## System Auto-Cancel

**Job:** `packages/api/src/jobs/orderAutoCancel.ts`
**Runs:** Every 60 seconds

Auto-cancels orders in `pending_payment` status older than `commerce.orders.autoCancelMinutes`.

### Order Fields Updated

| Field | Value |
|-------|-------|
| `status` | `'cancelled'` |
| `cancellationReason` | `"Auto-cancelled: no payment received within 30 minutes"` |
| `cancelledBy` | `"CANCELLED BY SYSTEM (AUTO)"` (hardcoded) |
| `cancelledByType` | `'System'` |
| `cancelledByPortal` | `'system'` |
| `cancelledByDescription` | `"Order is auto-cancelled by System after no payment received within 30 minutes"` |
| `cancelledAt` | `new Date()` |

**No refund** is created (payment was never completed).

### Activity Log Entry

```json
{
  "type": "cancelled",
  "message": "Order auto-cancelled by System: Auto-cancelled: no payment received within 30 minutes : AT : 2026-09-02T10:30:00.000Z",
  "timestamp": "2026-09-02T10:30:00.000Z",
  "actor": "system",
  "metadata": {
    "reason": "Auto-cancelled: no payment received within 30 minutes",
    "cancelledBy": "CANCELLED BY SYSTEM (AUTO)",
    "cancelledByType": "System",
    "cancelledByPortal": "system",
    "cancelledAt": "2026-09-02T10:30:00.000Z"
  }
}
```

---

## Comparison Table

### Cancel vs Refund

| Aspect | Admin Cancel | Customer Cancel | Admin Refund | System Auto-Cancel |
|--------|-------------|----------------|-------------|-------------------|
| **Endpoint** | `POST /admin/orders/:id/cancel` | `POST /customer/returns/orders/:id/cancel` | `POST /admin/orders/:id/refund` | Background job |
| **Auth** | `order.update` permission | JWT (must own order) | `order.update` permission | None (system) |
| **Allowed statuses** | `pending`, `pending_payment`, `paid`, `packing` | `pending`, `pending_payment`, `paid`, `packing` | `paid`, `delivered`, `cancelled` | `pending_payment` |
| **Refund created** | Yes (if paid) | Yes (if paid) | Yes (always) | No |
| **Refund amount** | Always full | Always full | Can be partial | N/A |
| **On refund failure** | Continues cancel | Fails with 502 | Fails with 400 | N/A |
| **Stock released** | Yes | Yes | No | Yes |
| **`cancelledBy`** | `"Name (Role)"` | `"Customer (Name)"` | Not set | `"CANCELLED BY SYSTEM (AUTO)"` |
| **`cancelledByType`** | `actor.displayName` | `'Customer'` | Not set | `'System'` |
| **`cancelledByPortal`** | `'admin-web'` | `'customer-web'`/`'customer-mobile'` | Not set | `'system'` |
| **Audit event** | `admin_order_cancel` (HIGH) | None | `admin_order_refund` (CRITICAL) | `logOrderEvent` |
| **Activity actor** | `'admin'` | `'customer'` | `'admin'` | `'system'` |
| **Stripe metadata key** | `cancellationReason` | `cancellationReason` | `refundReason` | N/A |
| **Stripe actor key** | `cancelledBy` | `cancelledBy` | `refundedBy` | N/A |
| **Webhook emails** | Deferred to Stripe events | Deferred to Stripe events | Deferred to Stripe events | N/A |
| **Final status** | `cancelled` | `cancelled` | `refunded` | `cancelled` |

### Order Model — All Cancel/Refund Fields

| Field | Type | Set by Cancel | Set by Refund |
|-------|------|:---:|:---:|
| `createdBy` | String (indexed) | No | No |
| `createdByType` | String (indexed) | No | No |
| `createdByPortal` | Enum | No | No |
| `createdByDescription` | String | No | No |
| `createdByEmail` | String | No | No |
| `cancellationReason` | String | Yes | No |
| `cancellationNotes` | String | Yes | No |
| `cancelledBy` | String (indexed) | Yes | No |
| `cancelledByType` | String (indexed) | Yes | No |
| `cancelledByPortal` | Enum | Yes | No |
| `cancelledByDescription` | String | Yes | No |
| `cancelledAt` | Date (indexed) | Yes | No |
| `refundReason` | String | No | Yes |
| `refundId` | String (indexed) | Yes* | Yes |
| `refundArn` | String | No (via webhook) | No (via webhook) |
| `refundStatus` | Enum (indexed) | Yes* | Yes |
| `refundExpectedArrival` | Date | No (via webhook) | No (via webhook) |
| `refundSettledAt` | Date | No (via webhook) | No (via webhook) |
| `refundLastSyncedAt` | Date | Yes* | Yes |
| `refundFailureReason` | String | No (via webhook) | No (via webhook) |
| `refundAttemptCount` | Number | No (via retry) | No (via retry) |

\* Only set when refund is created during cancel (paid orders with real Stripe payment).

---

## Backfill

A backfill script retroactively populates `createdBy` fields on existing orders:

```bash
npx tsx scripts/backfill-order-created-by.ts
```

**What it does:**
- Queries all orders where `createdBy` does not exist
- Joins `Order.userId → User` to get `fullName` and `email`
- Sets `createdBy`, `createdByType`, `createdByPortal`, `createdByDescription`, `createdByEmail`
- Safe to re-run (idempotent — only touches orders missing the field)

**Edge cases handled:**
- Hard-deleted users → name set to `"Unknown User"`, email to `null`
- All orders default to `createdByPortal: 'customer-web'` (only customer creation paths exist today)

---

## Invoice Backfill

A backfill script retroactively creates missing invoices for orders with completed/refunded payments:

```bash
npx tsx scripts/backfill-missing-invoices.ts
```

**What it does:**
- Queries all orders where `payment.status` is `completed` or `refunded` and no Invoice exists
- Creates Invoice with data from order: `invoiceNumber` (atomic counter), `amount`, `currency`, `status` (`paid`/`refunded`), `paymentMethod`, `stripePaymentIntentId`, `paidAt`
- Creates InvoiceAccessToken (24h expiry, verified immediately)
- Safe to re-run (idempotent — only touches orders missing an invoice)

**Admin endpoint for manual backfill:**
```bash
POST /api/admin/orders/:id/invoice
```
Requires `order.update` permission. Returns 409 if invoice already exists, 400 if payment status not completed/refunded.

---

## Refund Backfill

A backfill script retroactively populates `refundedBy` fields on existing refunded orders:

```bash
npx tsx scripts/backfill-order-refunded-by.ts
```

**What it does:**
- Queries all refunded orders where `refundedBy` does not exist
- Derives refund info from activity log metadata (`type: 'refunded'`) or PaymentTransaction records
- Sets `refundedBy`, `refundedByType`, `refundedByPortal`, `refundedByDescription`, `refundedAt`
- Safe to re-run (idempotent — only touches orders missing the field)

**Edge cases handled:**
- No activity log → falls back to PaymentTransaction, then assumes admin
- Sets default portal to `admin-web` (current refund path is admin-only)
