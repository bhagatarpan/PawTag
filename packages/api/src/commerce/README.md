# PawTag Commerce Module

## Overview

The Commerce module provides the core infrastructure for PawTag's first-party commerce system. PawTag owns all commerce business logic directly.

## Architecture

```
packages/api/src/commerce/
├── index.ts                    # Module exports
├── config.ts                   # CMS-driven commerce configuration
├── errors.ts                   # Commerce-specific error types
├── audit.ts                    # Commerce audit logging helpers
├── interfaces/
│   ├── index.ts                # Interface exports
│   ├── payment-provider.ts     # Payment provider contract
│   ├── shipping-provider.ts    # Shipping provider contract
│   ├── tax-provider.ts         # Tax calculation contract
│   └── inventory-provider.ts   # Inventory management contract
├── providers/
│   ├── stripe/                 # Stripe payment adapter
│   ├── nz-shipping/            # NZ domestic shipping adapter
│   └── simple-gst/             # NZ GST tax adapter
└── README.md                   # This file
```

## Design Principles

1. **PawTag owns business rules.** The module defines what happens when payments succeed, orders are placed, stock runs low, etc.
2. **Providers are adapters.** External services (Stripe, NZ Post) implement provider interfaces but don't dictate business logic.
3. **No hardcoded values.** All configuration is CMS-driven via the `settings` collection.
4. **Consistent errors.** All commerce errors extend `AppError` for uniform handling.
5. **Full audit trail.** Every important commerce operation is audit-logged.

## Provider Interfaces

### IPaymentProvider

Handles payment intent creation, confirmation, refunds, and webhook verification.

Implementations:
- `providers/stripe/` — Production Stripe adapter

### IShippingProvider

Handles shipping rate calculation, shipment creation, and tracking.

Implementations:
- `providers/nz-shipping/` — NZ domestic shipping (flat rate / free)

### ITaxProvider

Handles tax calculation for orders.

Implementations:
- `providers/simple-gst/` — 15% NZ GST (tax-inclusive)

### IInventoryProvider

Handles stock tracking, reservation, and adjustment.

Implementations:
- `providers/mongodb-inventory/` — MongoDB-based inventory (Phase 2)

## Configuration

All settings are stored in the `settings` collection with the `commerce.*` prefix.

### Key Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `commerce.payment.provider` | `stripe` | Payment provider |
| `commerce.payment.testMode` | `true` | Demo mode toggle |
| `commerce.shipping.freeEnabled` | `true` | Free shipping |
| `commerce.shipping.freeThreshold` | `0` | Min amount for free shipping |
| `commerce.tax.rate` | `0.15` | Tax rate (15% GST) |
| `commerce.tax.inclusive` | `true` | Prices include tax |
| `commerce.inventory.enabled` | `true` | Track inventory |
| `commerce.inventory.lowStockThreshold` | `10` | Low stock alert level |
| `commerce.subscriptions.annualPrice` | `0.99` | Annual sub price (NZD) |
| `commerce.subscriptions.monthlyPrice` | `1.99` | Monthly sub price (NZD) |

### Accessing Settings

```typescript
import { getSetting, getNumberSetting, getBooleanSetting } from '../commerce';

const taxRate = await getNumberSetting('commerce.tax.rate');       // 0.15
const freeShipping = await getBooleanSetting('commerce.shipping.freeEnabled'); // true
const provider = await getSetting('commerce.payment.provider');    // 'stripe'
```

### Updating Settings (Admin)

```typescript
import { updateSetting } from '../commerce';

await updateSetting('commerce.tax.rate', '0.15', 'admin@pawtag.co.nz');
```

## Error Handling

All commerce errors extend `AppError` and can be caught uniformly:

```typescript
import { PaymentFailedError, InsufficientStockError, PriceMismatchError } from '../commerce';

try {
  await processCheckout(cart);
} catch (err) {
  if (err instanceof InsufficientStockError) {
    return res.status(409).json({ error: err.userMessage, available: err.available });
  }
  if (err instanceof PaymentFailedError) {
    return res.status(402).json({ error: err.userMessage });
  }
  throw err;
}
```

## Audit Logging

Every important commerce operation is audit-logged:

```typescript
import { logPaymentEvent, logOrderEvent, logRefundEvent } from '../commerce';

await logPaymentEvent('created', { paymentIntentId: 'pi_xxx', amount: 59.99, currency: 'NZD' }, req);
await logOrderEvent('placed', { orderId: 'xxx', orderNumber: 'PT-000001', amount: 59.99 }, req);
await logRefundEvent('succeeded', { orderId: 'xxx', orderNumber: 'PT-000001', amount: 29.99, currency: 'NZD' }, req);
```

## Adding a New Provider

1. Create a new directory under `providers/`
2. Implement the corresponding interface (e.g., `IPaymentProvider`)
3. Export the implementation
4. Add provider registration logic to the relevant service
5. Document the provider in its own `README.md`

## Testing

Commerce module tests are in `tests/unit/commerce/`:

```bash
pnpm test -- --run tests/unit/commerce/
```
