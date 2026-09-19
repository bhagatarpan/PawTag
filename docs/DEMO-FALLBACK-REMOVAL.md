# Remove Demo/Mock Fallbacks from Production Paths

> Search for demo/mock/fallback patterns and classify them.
> Production-dangerous behavior must be removed or guarded explicitly.
>
> Last updated: 2026-09-19

## Purpose

Demo/mock fallbacks in production paths can cause silent failures or incorrect behavior. This document defines the search patterns and classification.

## Search Patterns

```text
demo
mock
fake
testMode
fallback
placeholder
TODO
FIXME
sample
stub
```

## Classification

### 1. Test-Only

**Safe to keep** — Used only in test environments

**Examples:**
- Test fixtures
- Mock data in test files
- Test configuration

**Action:** Keep as-is

### 2. Development-Only

**Safe to keep** — Used only in development

**Examples:**
- Development seed data
- Local storage fallback
- Debug logging

**Action:** Keep as-is, ensure not in production

### 3. Safe Fallback

**Safe to keep** — Graceful degradation

**Examples:**
- Default values when optional config missing
- Fallback images
- Offline message

**Action:** Keep as-is, verify behavior

### 4. Production-Dangerous

**Must remove or guard** — Could cause incorrect behavior

**Examples:**
- Demo payment success
- Mock data in production responses
- Test mode bypass
- Placeholder credentials

**Action:** Remove or add explicit guard

## Current Findings

### Stripe Configuration

| Location | Pattern | Classification | Action |
|---|---|---|---|
| `packages/api/src/commerce/config.ts` | `testMode` | Production-dangerous | Guard with env check |
| `packages/api/src/commerce/providers/stripe/index.ts` | Demo mode | Production-dangerous | Remove in production |

### Environment Variables

| Variable | Default | Classification | Action |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_demo_key` | Production-dangerous | Required in production |
| `SMS_PROVIDER` | `demo` | Safe fallback | OK for development |
| `STORAGE_DRIVER` | `local` | Safe fallback | OK for development |

## Production Guards

### Payment Mode Guard

```typescript
// In validateEnv.ts
if (nodeEnv === 'production' && payment.testMode) {
  throw new Error('Test mode not allowed in production');
}
```

### Stripe Key Guard

```typescript
// In validateEnv.ts
if (nodeEnv === 'production' && stripeKey?.startsWith('sk_test_')) {
  throw new Error('Test Stripe key not allowed in production');
}
```

## Search Commands

```bash
# Search for demo patterns
grep -r "demo" packages/api/src --include="*.ts" | grep -v test

# Search for mock patterns
grep -r "mock" packages/api/src --include="*.ts" | grep -v test

# Search for testMode
grep -r "testMode" packages/api/src --include="*.ts"

# Search for fallback
grep -r "fallback" packages/api/src --include="*.ts"
```

## Related Documents

- `docs/DANGEROUS-ANY-REMOVAL.md` — Dangerous any removal
- `docs/ROUTE-SERVICE-REDUCTION.md` — Route/service reduction
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
