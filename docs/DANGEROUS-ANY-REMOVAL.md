# Remove Dangerous `any` in Boundaries

> Prioritize removing `any` at critical boundaries.
> Do not try to eliminate every `any` in one campaign.
>
> Last updated: 2026-09-19

## Purpose

`any` at critical boundaries hides type mismatches and can lead to runtime errors. This document defines priority areas for removing `any` types.

## Priority Areas

### 1. Authentication/Token Storage

**Risk:** Security vulnerabilities from undefined token behavior

**Files to Review:**
- `packages/shared/src/api/client-factory.ts`
- `apps/mobile/src/api/client.ts`
- `apps/web/src/lib/api.ts`

**Current Issues:**
```typescript
// ❌ Unsafe
const token = localStorage.getItem('token') as any;

// ✅ Safe
const token = localStorage.getItem('token') as string | null;
```

### 2. Checkout/Payment

**Risk:** Financial errors from undefined payment state

**Files to Review:**
- `packages/api/src/commerce/services/checkout.service.ts`
- `apps/web/src/pages/Checkout.tsx`
- `packages/shared/src/api/types.ts`

**Current Issues:**
```typescript
// ❌ Unsafe
const payment = await stripe.paymentIntents.create(data as any);

// ✅ Safe
const payment = await stripe.paymentIntents.create(data satisfies PaymentIntentCreateParams);
```

### 3. Cart Pricing/Customization

**Risk:** Incorrect pricing calculations

**Files to Review:**
- `packages/api/src/commerce/services/cart.service.ts`
- `apps/web/src/context/CartContext.tsx`
- `apps/web/src/components/cart/CartItemCard.tsx`

### 4. Public DTOs

**Risk:** Data exposure through undefined fields

**Files to Review:**
- `packages/shared/src/api/types.ts`
- `packages/api/src/routes/finder.ts`

### 5. Admin Financial Actions

**Risk:** Incorrect financial operations

**Files to Review:**
- `packages/api/src/routes/admin.ts`
- `packages/api/src/commerce/services/refund.service.ts`

### 6. External Webhook Payload Handling

**Risk:** Security vulnerabilities from unvalidated payloads

**Files to Review:**
- `packages/api/src/routes/stripe-webhooks.ts`
- `packages/api/src/services/webhook.service.ts`

## Replacement Strategies

### Use Real Interfaces

```typescript
// ❌ Unsafe
function processPayment(data: any) { ... }

// ✅ Safe
interface PaymentData {
  amount: number;
  currency: string;
  customerId: string;
}

function processPayment(data: PaymentData) { ... }
```

### Use Type Narrowing

```typescript
// ❌ Unsafe
if (response.data) { ... }

// ✅ Safe
if (response.data && typeof response.data === 'object') { ... }
```

### Use Schema Validation

```typescript
// ❌ Unsafe
const user = await User.findById(id) as any;

// ✅ Safe
const user = await User.findById(id);
if (!user) throw new Error('User not found');
```

## Verification Checklist

When removing `any`:

- [ ] Identify all usages of the `any` type
- [ ] Determine the actual type
- [ ] Add proper type annotations
- [ ] Verify TypeScript compiles
- [ ] Run relevant tests
- [ ] Check for runtime errors

## Related Documents

- `docs/SHARED-CONTRACTS.md` — Shared contracts
- `docs/API-CONTRACT-CLEANUP.md` — API contract cleanup
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
