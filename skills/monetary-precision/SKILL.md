# Monetary Precision

Financial correctness outranks convenience. `AGENTS.md` remains authoritative.

## Single source of truth

All monetary arithmetic, rounding, and Stripe conversion goes through `packages/shared/src/money.ts`:

```typescript
import { toCents, fromCents, roundToCents, toStripeAmount, addMoney, subtractMoney } from '@pawtag/shared';
```

Never inline `Math.round(x * 100)` or `x / 100` in feature code — use the shared helpers.

## Rules

### Where to round

| Boundary | Action |
|----------|--------|
| Stripe API call | `toStripeAmount(amount, currency)` — currency-aware minor units |
| Database persistence | `roundToCents(amount)` — always 2dp before write |
| Intermediate calculation | **Do NOT round** — avoid cumulative errors |
| Display | `formatCurrency(amount)` from `@pawtag/shared` |

### Arithmetic

Use `addMoney`, `subtractMoney`, `multiplyMoney` for money math that must not accumulate float dust. They operate in integer cents internally.

### Tax-inclusive pricing (NZ GST default)

When `commerce.tax.inclusive = true`:

```
total = subtotal - discount - accessoryDiscount + shipping
```

**Do NOT add extracted tax on top of tax-inclusive prices.** The tax is informational (for display/reporting), not additive. Adding it double-counts (~13% overcharge).

When tax-exclusive:

```
total = subtotal - discount - accessoryDiscount + shipping + tax
```

### Refund balance validation

Always use integer cents for remaining-refundable math:

```typescript
const capturedCents = toCents(order.payment.amount);
const refundedCents = toCents(alreadyRefunded);
const requestedCents = toCents(requestedAmount);
const remainingCents = Math.max(0, capturedCents - refundedCents);
if (requestedCents > remainingCents) throw new Error('Exceeds refundable');
```

Never compare raw floats for money equality.

### PawRewards at checkout

`buildCheckoutQuote` folds `rewardsToApply` into the discount. The quote total already has rewards subtracted. Do NOT subtract again when persisting to PendingOrder.

### Accessory discount

`totals.accessoryDiscount` from `cart.service.calculateTotals` must be included in checkout totals. Do not drop it between cart and checkout.

## Currency awareness

Stripe zero-decimal currencies (JPY, KRW, etc.) have no minor unit. Use `toStripeAmount(amount, currency)` which handles this automatically. Never assume 2 decimal places for all currencies.

## Common bugs to avoid

1. **GST double-count**: adding extracted tax on inclusive prices
2. **Rewards double-subtraction**: subtracting rewards from an already-reduced total
3. **Dropped accessory discount**: forgetting `totals.accessoryDiscount` in checkout
4. **Float comparison**: `if (a > b)` on raw floats for money
5. **Inline rounding**: `Math.round(x * 100)` instead of shared helpers
6. **Hardcoded GST rates**: `total * 0.85` / `total * 0.15` in UI instead of server values
7. **Missing customization**: line totals omitting `customizationTotal` in invoices/emails

## Testing

Regression tests live in:
- `tests/unit/money-utilities.test.ts` — shared helper edge cases
- `tests/unit/checkout-total-precision.test.ts` — checkout total correctness, WO-000494 regression
- `tests/unit/return-refund-balance.test.ts` — cents-based refund balance

Add tests for any new monetary calculation. Include: whole amounts, values needing round-up/down, very small amounts, full/partial/multiple refunds, and the specific float values that previously produced artifacts.
