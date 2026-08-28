# PawTag Commerce — Architecture

**Last updated:** 2026-08-28

---

## Module Structure

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
├── services/
│   ├── index.ts                # Service exports
│   ├── product.service.ts      # Product catalog CRUD + pricing
│   ├── inventory.service.ts    # Stock tracking, reservation, adjustment
│   ├── pricing.service.ts      # Server-side price calculations
│   └── cart.service.ts         # Shopping cart management
└── providers/
    ├── stripe/                 # Stripe payment adapter (Phase 5)
    ├── nz-shipping/            # NZ domestic shipping adapter (Phase 6)
    └── simple-gst/             # NZ GST tax adapter (Phase 11)
```

## Design Principles

1. **PawTag owns business rules.** The commerce module defines what happens at each step.
2. **Providers are adapters.** External services implement interfaces but don't dictate logic.
3. **No hardcoded values.** All config via CMS settings (`commerce.*` prefix).
4. **Server-side validation.** Never trust client-submitted prices.
5. **Atomic operations.** Inventory uses MongoDB atomic ops to prevent overselling.
6. **Full audit trail.** Every important operation is audit-logged.

## Data Flow

```
Customer Browser
    │
    ▼
PawTag API (Express)
    │
    ├── Product Routes (GET /api/products)
    │       └── ProductService → MongoDB Product
    │
    ├── Cart Routes (POST /api/cart/*)
    │       └── CartService → MongoDB Cart
    │           ├── ProductService (price validation)
    │           └── InventoryService (stock check)
    │
    ├── Checkout Routes (Phase 4)
    │       └── CheckoutService
    │           ├── PricingService (server-side totals)
    │           ├── InventoryService (reservation)
    │           ├── PaymentProvider (Stripe)
    │           └── OrderService (order creation)
    │
    └── Admin Routes
            └── AdminCommerceService
                ├── ProductService (CRUD)
                ├── InventoryService (adjustments)
                └── OrderService (management)
```

## Key Patterns

### Pricing Priority
```
salePrice > price
compareAtPrice (display only)
```

### Stock Calculation
```
available = stock - reserved
canPurchase = available >= requested (when stockPolicy === 'deny')
```

### Cart Totals
```
subtotal = sum(lineTotal for each item)
lineTotal = (unitPrice + customisationTotal) × quantity
discount = promoDiscount (from promo code)
shipping = shippingCost (from shipping method)
tax = (subtotal - discount + shipping) × taxRate
total = subtotal - discount + shipping + tax
```

### Error Handling
All commerce errors extend `AppError` and map to HTTP status codes:
- `PaymentFailedError` → 402
- `InsufficientStockError` → 409
- `PriceMismatchError` → 422
- `ProductUnavailableError` → 410
- `InvalidCartError` → 400

### Audit Logging
Every payment, order, and refund operation is logged via `logCommerceEvent()`.
Audit events are fire-and-forget — they never block the operation.
