# Correlation IDs Across Critical Flows

> Ensure important logs can be traced by correlation IDs.
> Never log full auth tokens, card data, secrets, OTP values, or unnecessary sensitive medical/location data.
>
> Last updated: 2026-09-19

## Purpose

Correlation IDs allow tracing a single request or operation across multiple log entries, services, and time periods. This is essential for debugging, incident response, and audit trails.

## Correlation ID Requirements

### Request/Correlation ID

Every incoming request should generate or accept a correlation ID:

| Source | Header | Usage |
|---|---|---|
| Client-generated | `X-Request-ID` | Client provides for end-to-end tracing |
| Server-generated | `X-Request-ID` | Server generates if not provided |

The correlation ID should be:
- Generated once at the API boundary
- Propagated through all log entries for that request
- Returned to the client in response headers
- Stored in audit events

### Business Entity IDs

In addition to the request correlation ID, log entries should include relevant business entity IDs:

| Entity | ID Field | When to Log |
|---|---|---|
| User | `userId` | When safe (not in public Finder logs) |
| Order | `orderId`, `orderNumber` | All order-related operations |
| Payment | `paymentIntentId` | All payment-related operations |
| Stripe Event | `stripeEventId` | All webhook processing |
| Pet | `petId` | All pet-related operations |
| Tag | `tagId` | All tag-related operations |
| Escalation | `escalationId` | All escalation operations |
| Finder Scan | `finderScanId` | All Finder-related operations |

## Critical Flow Correlation

### 1. Checkout Flow

```
Request: POST /api/checkout/confirm
├── Correlation ID: req_abc123
├── User ID: user_xyz789
├── Cart ID: cart_def456
├── PaymentIntent ID: pi_stripe123
├── Order ID: order_ghi789
└── Order Number: PT-2026-001
```

Log entries for this flow:
- `checkout.confirm.initiated` — req_abc123, user_xyz789, cart_def456
- `checkout.payment.created` — req_abc123, pi_stripe123
- `checkout.order.created` — req_abc123, order_ghi789, PT-2026-001
- `checkout.completed` — req_abc123, order_ghi789

### 2. Stripe Webhook Flow

```
Request: POST /api/webhooks/stripe
├── Correlation ID: req_webhook456
├── Stripe Event ID: evt_stripe789
├── Event Type: payment_intent.succeeded
├── PaymentIntent ID: pi_stripe123
└── Order ID: order_ghi789 (if order exists)
```

Log entries for this flow:
- `webhook.received` — req_webhook456, evt_stripe789, payment_intent.succeeded
- `webhook.processing` — req_webhook456, evt_stripe789
- `webhook.completed` — req_webhook456, evt_stripe789, order_ghi789

### 3. Finder Notification Flow

```
Request: POST /api/finder/:tagId/notify
├── Correlation ID: req_finder123
├── Tag ID: tag_abc123
├── Pet ID: pet_def456
├── Finder Scan ID: scan_ghi789
└── User ID: user_xyz789 (pet owner)
```

Log entries for this flow:
- `finder.notify.initiated` — req_finder123, tag_abc123, pet_def456
- `finder.notify.sending` — req_finder123, scan_ghi789
- `finder.notify.completed` — req_finder123, scan_ghi789

### 4. Refund Flow

```
Request: POST /api/customer/orders/:orderId/refund
├── Correlation ID: req_refund789
├── Order ID: order_ghi789
├── User ID: user_xyz789
├── Refund ID: rf_stripe456
└── PaymentIntent ID: pi_stripe123
```

Log entries for this flow:
- `refund.initiated` — req_refund789, order_ghi789, user_xyz789
- `refund.processing` — req_refund789, rf_stripe456
- `refund.completed` — req_refund789, rf_stripe456, order_ghi789

### 5. Escalation Flow

```
Job: processOverdueEscalations
├── Correlation ID: job_escalation123
├── Escalation ID: esc_abc123
├── Pet ID: pet_def456
├── User ID: user_xyz789 (pet owner)
└── Emergency Contact ID: ec_ghi789
```

Log entries for this flow:
- `escalation.processing` — job_escalation123, esc_abc123
- `escalation.notifying` — job_escalation123, esc_abc123, ec_ghi789
- `escalation.completed` — job_escalation123, esc_abc123

## Sensitive Data Logging Rules

### Never Log

- Auth tokens (JWT, refresh tokens)
- Card data (full card numbers, CVV)
- API keys/secrets
- OTP values
- Passwords
- Webhook signing secrets
- Stripe secret keys

### Safe to Log (with context)

- User ID (not email/phone unless necessary for debugging)
- Order ID/order number
- PaymentIntent ID
- Stripe Event ID
- Pet ID/tag ID
- Request correlation ID
- Error messages (without sensitive payloads)
- Status codes
- Latency/duration

### Example: Safe vs Unsafe Logging

```typescript
// ❌ Unsafe - logs sensitive data
logger.info({
  userId: user._id,
  email: user.email,
  phone: user.phoneNumber,
  token: req.headers.authorization,
}, 'User logged in');

// ✅ Safe - logs only necessary context
logger.info({
  userId: user._id,
  correlationId: req.correlationId,
}, 'User logged in');
```

## Implementation Guide

### Adding Correlation ID to Request

```typescript
// In middleware
app.use((req, res, next) => {
  req.correlationId = req.headers['x-request-id'] || generateId();
  res.setHeader('X-Request-ID', req.correlationId);
  next();
});
```

### Using Correlation ID in Logs

```typescript
// In route handler
logger.info({
  correlationId: req.correlationId,
  orderId: order._id,
  orderNumber: order.orderNumber,
}, 'Order created');
```

### Propagating to External Services

```typescript
// When calling external services
await stripe.paymentIntents.create({
  amount: 1000,
  currency: 'nzd',
}, {
  idempotencyKey: req.correlationId,
});
```

## Log Entry Structure

Every log entry should follow this structure:

```json
{
  "timestamp": "2026-09-19T12:00:00.000Z",
  "level": "info",
  "correlationId": "req_abc123",
  "event": "checkout.completed",
  "context": {
    "userId": "user_xyz789",
    "orderId": "order_ghi789",
    "orderNumber": "PT-2026-001"
  },
  "message": "Checkout completed successfully"
}
```

## Audit Event Structure

Audit events should include additional context:

```json
{
  "timestamp": "2026-09-19T12:00:00.000Z",
  "eventType": "order.created",
  "correlationId": "req_abc123",
  "actor": {
    "type": "USER",
    "id": "user_xyz789"
  },
  "target": {
    "type": "ORDER",
    "id": "order_ghi789"
  },
  "action": "create",
  "outcome": "SUCCESS",
  "metadata": {
    "orderNumber": "PT-2026-001",
    "amount": 39.00,
    "currency": "NZD"
  }
}
```

## Tracing Across Services

When a request spans multiple services (e.g., API → Worker → External), ensure:

1. Correlation ID is passed in headers/context
2. Each service logs with the same correlation ID
3. External service calls use the correlation ID as idempotency key where possible

## Debugging with Correlation IDs

### Finding All Logs for a Request

```bash
# Search logs by correlation ID
grep "req_abc123" /var/log/pawtag/*.log

# Or in structured logging (e.g., CloudWatch)
fields @timestamp, @message
| filter correlationId = "req_abc123"
| sort @timestamp asc
```

### Finding All Logs for an Order

```bash
# Search logs by order ID
grep "order_ghi789" /var/log/pawtag/*.log
```

### Finding All Logs for a User

```bash
# Search logs by user ID
grep "user_xyz789" /var/log/pawtag/*.log
```

## Related Documents

- `docs/ACTIONABLE-ALERTS.md` — Alert configuration
- `docs/JOB-ERROR-POLICY.md` — Background job error handling
- `docs/LOGGING.md` — Logging configuration
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
