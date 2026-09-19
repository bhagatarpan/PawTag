# Reduce Giant Route/Service Files Incrementally

> Refactor only when touching the relevant functionality.
> Do not create interfaces/factories merely to make the architecture look enterprise-grade.
>
> Last updated: 2026-09-19

## Purpose

Large route/service files become difficult to maintain and test. This document defines the target pattern for incremental refactoring.

## Target Pattern

```
route
  -> validates request
  -> authenticates/authorizes
  -> invokes one domain service operation
  -> maps result to response

service
  -> owns business rule/orchestration

model/repository query
  -> persistence concern

integration provider
  -> Stripe/email/SMS/storage/shipping concern
```

## Current State

### Large Files to Monitor

| File | Lines | Risk |
|---|---|---|
| `packages/api/src/routes/admin.ts` | ~4400 | High |
| `packages/api/src/routes/customer.ts` | ~2500 | High |
| `packages/api/src/services/subscription.service.ts` | ~1600 | Medium |
| `packages/api/src/routes/finder.ts` | ~600 | Medium |
| `packages/api/src/routes/stripe-webhooks.ts` | ~500 | Medium |

## Refactoring Rules

### When to Refactor

- When adding new functionality to a large file
- When fixing a bug in a large file
- When the file size impedes understanding

### When NOT to Refactor

- Just because the file is large
- When the code is working correctly
- When refactoring would change behavior

### How to Refactor

1. **Extract one cohesive piece** — Don't split the entire file at once
2. **Keep the same behavior** — Refactoring should not change functionality
3. **Add tests** — Ensure the refactored code works correctly
4. **Run verification** — Typecheck, tests, build

## Example: Extracting from admin.ts

### Before

```typescript
// packages/api/src/routes/admin.ts (4400 lines)
router.post('/products', async (req, res) => {
  // 50 lines of product creation logic
});

router.put('/products/:id', async (req, res) => {
  // 50 lines of product update logic
});

router.delete('/products/:id', async (req, res) => {
  // 30 lines of product deletion logic
});
```

### After

```typescript
// packages/api/src/routes/admin-products.ts (150 lines)
import { requirePermission } from '../middleware/permission';
import { productService } from '../commerce/services/product.service';

router.post('/', requirePermission('product.create'), async (req, res) => {
  const product = await productService.create(req.body);
  res.status(201).json({ success: true, data: product });
});

router.put('/:id', requirePermission('product.update'), async (req, res) => {
  const product = await productService.update(req.params.id, req.body);
  res.json({ success: true, data: product });
});

router.delete('/:id', requirePermission('product.delete'), async (req, res) => {
  await productService.delete(req.params.id);
  res.json({ success: true });
});
```

## Guidelines

### Do

- Extract cohesive functionality
- Keep routes thin (validate, auth, call service, respond)
- Keep services focused on business rules
- Keep models focused on persistence
- Keep integrations focused on external calls

### Don't

- Create unnecessary abstractions
- Split files just to reduce line count
- Create factories for single implementations
- Over-engineer the architecture

## Related Documents

- `docs/SHARED-CONTRACTS.md` — Shared contracts
- `docs/API-CONTRACT-CLEANUP.md` — API contract cleanup
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
