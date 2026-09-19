# Share Contracts, Not Renderers

> Maximize reuse of contracts and logic, keep platform-specific rendering separate.
> Do not migrate to React Native Web, Tamagui, NativeWind, or another UI framework solely for code sharing.
>
> Last updated: 2026-09-19

## Purpose

PawTag targets high cross-platform reuse without forcing artificial 100% UI sharing. This document defines what should be shared and what should remain platform-specific.

---

## What to Share

### 1. API Client/Types

| Shared | Location |
|---|---|
| API endpoint definitions | `packages/shared/src/api/endpoints.ts` |
| Request/response types | `packages/shared/src/api/types.ts` |
| API client factory | `packages/shared/src/api/client-factory.ts` |
| Validation schemas | `packages/shared/src/validation/` |

### 2. Validation

| Shared | Location |
|---|---|
| Zod schemas | `packages/shared/src/validation/` |
| Form validation rules | `packages/shared/src/validation/` |
| Input sanitization | `packages/shared/src/utils/` |

### 3. Formatting

| Shared | Location |
|---|---|
| Currency formatting | `packages/shared/src/formatting/currency.ts` |
| Date formatting | `packages/shared/src/formatting/date.ts` |
| Phone formatting | `packages/shared/src/formatting/phone.ts` |
| Number formatting | `packages/shared/src/formatting/number.ts` |

### 4. Data Models/DTOs

| Shared | Location |
|---|---|
| API DTOs | `packages/shared/src/api/types.ts` |
| Domain models | `packages/shared/src/types/` |
| Status enums | `packages/shared/src/constants/` |

### 5. Business Rules

| Shared | Location |
|---|---|
| Cart calculations | `packages/shared/src/business/cart.ts` |
| Pricing rules | `packages/shared/src/business/pricing.ts` |
| Status transitions | `packages/shared/src/business/status.ts` |
| Validation rules | `packages/shared/src/validation/` |

### 6. Status Labels

| Shared | Location |
|---|---|
| Order status labels | `packages/shared/src/constants/status.ts` |
| Pet status labels | `packages/shared/src/constants/status.ts` |
| Subscription status labels | `packages/shared/src/constants/status.ts` |
| UI vocabulary | `docs/UX-VOCABULARY.md` |

### 7. Design Tokens

| Shared | Location |
|---|---|
| Colors, spacing, typography | `packages/design-tokens/` |
| Elevation, motion | `packages/design-tokens/` |
| Breakpoints | `packages/design-tokens/` |

### 8. Component Behavior Specifications

| Shared | Location |
|---|---|
| Component contracts | `packages/ui/src/types.ts` |
| Props interfaces | `packages/ui/src/types.ts` |
| State machine definitions | `packages/shared/src/state/` |

---

## What to Keep Platform-Specific

### Web (DOM)

| Keep | Reason |
|---|---|
| React components | DOM rendering |
| Tailwind CSS | Web styling |
| React Router | Web navigation |
| DOM events | Browser interaction |
| localStorage | Browser storage |
| Web animations | CSS/JS animations |

### Mobile (React Native)

| Keep | Reason |
|---|---|
| React Native components | Native rendering |
| React Navigation | Native navigation |
| Camera | Native capability |
| NFC | Native capability |
| Push notifications | Native capability |
| SecureStore | Native secure storage |
| Permissions | Native system permissions |
| Gestures | Native gesture handling |
| Safe areas | Native layout |

---

## Shared Package Structure

```
packages/
  shared/           # API, types, validation, formatting, business rules
  design-tokens/    # Platform-neutral design values
  ui/               # Web React components (NOT shared with mobile)
```

### packages/shared

Contains everything platform-neutral:

```typescript
// API endpoints
export const API = {
  auth: { login: '/api/auth/login', register: '/api/auth/register' },
  cart: { get: '/cart', addItem: '/cart/items' },
  // ...
};

// Types
export interface User { id: string; email: string; name: string; }
export interface Product { id: string; name: string; price: number; }

// Validation
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Formatting
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
```

### packages/design-tokens

Contains platform-neutral design values:

```typescript
export const colors = {
  primary: { 500: '#14b8a6' },
  // ...
};

export const spacing = {
  4: 16,
  8: 32,
  // ...
};
```

### packages/ui

Contains web React components (NOT shared with mobile):

```typescript
// Web-specific React components
export const Button = ({ children, ...props }) => <button {...props}>{children}</button>;
export const Input = ({ ...props }) => <input {...props} />;
```

---

## Migration Strategy

### Do Not

- Migrate to React Native Web
- Use Tamagui, NativeWind, or gluestack
- Force web components into React Native
- Create complex abstraction layers for 100% sharing

### Do

- Share API contracts and types
- Share validation schemas
- Share formatting utilities
- Share business rules
- Share design tokens
- Keep platform-specific rendering separate
- Use shared types for component contracts

---

## Example: Sharing a Feature

### Shared (packages/shared)

```typescript
// types.ts
export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

// business/cart.ts
export function calculateCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```

### Web (apps/web)

```typescript
// components/CartItemCard.tsx
import { CartItem } from '@pawtag/shared';
import { calculateCartTotal } from '@pawtag/shared/business/cart';

export function CartItemCard({ item }: { item: CartItem }) {
  return (
    <div className="cart-item">
      <span>{item.name}</span>
      <span>{calculateCartTotal([item])}</span>
    </div>
  );
}
```

### Mobile (apps/mobile)

```typescript
// components/CartItemCard.tsx
import { CartItem } from '@pawtag/shared';
import { calculateCartTotal } from '@pawtag/shared/business/cart';
import { View, Text } from 'react-native';

export function CartItemCard({ item }: { item: CartItem }) {
  return (
    <View style={styles.container}>
      <Text>{item.name}</Text>
      <Text>{calculateCartTotal([item])}</Text>
    </View>
  );
}
```

---

## Related Documents

- `docs/UX-VOCABULARY.md` — Shared vocabulary
- `packages/design-tokens/` — Shared design tokens
- `packages/shared/` — Shared contracts
- `packages/ui/` — Web-specific components
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
