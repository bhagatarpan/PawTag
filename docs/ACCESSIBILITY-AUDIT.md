# Critical Web Accessibility Pass

> Accessibility is part of correctness. Critical flows must be usable before launch.
>
> Last updated: 2026-09-19

## Purpose

This document provides an accessibility audit checklist for PawTag's critical web flows. Accessibility is not optional — it is a legal and ethical requirement.

## Priority Order

1. Finder
2. Cart
3. Checkout
4. Login/Register/Verification
5. Pet/Lost Mode
6. Customer Account Dialogs
7. High-Risk Admin Dialogs

---

## 1. Finder (`apps/finder`)

### Checklist

| Check | Status | Notes |
|---|---|---|
| Labels on all form fields | | |
| Semantic buttons/links | | |
| Keyboard navigation works | | |
| Focus management in dialog | | |
| Modal/dialog semantics | | |
| Error associations (aria-describedby) | | |
| aria-live for async feedback | | |
| Color contrast (4.5:1 minimum) | | |
| Touch target sizes (44x44px minimum) | | |
| Reduced motion support | | |
| Heading hierarchy (h1 > h2 > h3) | | |

### Critical Elements

- `apps/finder/src/components/NotifyOwnerForm.tsx` — Form with contact inputs
- `apps/finder/src/components/LocationConsentBanner.tsx` — Location permission dialog
- `apps/finder/src/components/FinderPetView.tsx` — Pet information display

### Manual Tests

1. Tab through entire flow — can you reach all interactive elements?
2. Can you submit the form using only keyboard?
3. Are error messages announced to screen readers?
4. Does the dialog trap focus correctly?
5. Can you close the dialog with Escape?

---

## 2. Cart (`apps/web`)

### Checklist

| Check | Status | Notes |
|---|---|---|
| Labels on all form fields | | |
| Semantic buttons/links | | |
| Keyboard navigation works | | |
| Focus management in cart drawer | | |
| Modal/dialog semantics (CartDrawer) | | |
| Error associations (aria-describedby) | | |
| aria-live for async feedback | | |
| Color contrast (4.5:1 minimum) | | |
| Touch target sizes (44x44px minimum) | | |
| Reduced motion support | | |
| Heading hierarchy (h1 > h2 > h3) | | |

### Critical Elements

- `packages/ui/src/components/CartDrawer.tsx` — Mini-cart drawer
- `apps/web/src/pages/Cart.tsx` — Full cart page
- `apps/web/src/components/cart/CartItemCard.tsx` — Cart item with quantity controls
- `apps/web/src/components/cart/OrderSummary.tsx` — Order summary with promo code

### Manual Tests

1. Tab through cart — can you reach all items and controls?
2. Can you change quantity using only keyboard?
3. Can you remove items using only keyboard?
4. Does the cart drawer trap focus correctly?
5. Are price changes announced to screen readers?

---

## 3. Checkout (`apps/web`)

### Checklist

| Check | Status | Notes |
|---|---|---|
| Labels on all form fields | | |
| Semantic buttons/links | | |
| Keyboard navigation works | | |
| Focus management in checkout steps | | |
| Modal/dialog semantics | | |
| Error associations (aria-describedby) | | |
| aria-live for async feedback | | |
| Color contrast (4.5:1 minimum) | | |
| Touch target sizes (44x44px minimum) | | |
| Reduced motion support | | |
| Heading hierarchy (h1 > h2 > h3) | | |

### Critical Elements

- `apps/web/src/pages/Checkout.tsx` — Main checkout page
- Address forms
- Payment form (Stripe Elements)
- Order confirmation

### Manual Tests

1. Tab through entire checkout — can you complete purchase using only keyboard?
2. Are form errors announced to screen readers?
3. Can you navigate between checkout steps?
4. Is payment form accessible?
5. Is order confirmation announced?

---

## 4. Login/Register/Verification (`apps/web`)

### Checklist

| Check | Status | Notes |
|---|---|---|
| Labels on all form fields | | |
| Semantic buttons/links | | |
| Keyboard navigation works | | |
| Focus management in forms | | |
| Modal/dialog semantics | | |
| Error associations (aria-describedby) | | |
| aria-live for async feedback | | |
| Color contrast (4.5:1 minimum) | | |
| Touch target sizes (44x44px minimum) | | |
| Reduced motion support | | |
| Heading hierarchy (h1 > h2 > h3) | | |

### Critical Elements

- `apps/web/src/pages/Login.tsx` — Login form
- `apps/web/src/pages/Register.tsx` — Registration form
- `apps/web/src/pages/VerifyEmail.tsx` — Email verification
- `apps/web/src/pages/VerifyPhone.tsx` — Phone verification
- `apps/web/src/pages/ResetPassword.tsx` — Password reset

### Manual Tests

1. Tab through login form — can you reach all fields?
2. Can you submit form using only keyboard?
3. Are error messages announced to screen readers?
4. Is password visibility toggle accessible?
5. Can you complete verification flow using only keyboard?

---

## 5. Pet/Lost Mode (`apps/web`)

### Checklist

| Check | Status | Notes |
|---|---|---|
| Labels on all form fields | | |
| Semantic buttons/links | | |
| Keyboard navigation works | | |
| Focus management in dialogs | | |
| Modal/dialog semantics | | |
| Error associations (aria-describedby) | | |
| aria-live for async feedback | | |
| Color contrast (4.5:1 minimum) | | |
| Touch target sizes (44x44px minimum) | | |
| Reduced motion support | | |
| Heading hierarchy (h1 > h2 > h3) | | |

### Critical Elements

- Pet creation/edit forms
- Lost mode activation
- Tag activation

### Manual Tests

1. Tab through pet forms — can you complete them using only keyboard?
2. Can you activate lost mode using only keyboard?
3. Are confirmation dialogs accessible?
4. Is status change announced to screen readers?

---

## 6. Customer Account Dialogs (`apps/web`)

### Checklist

| Check | Status | Notes |
|---|---|---|
| Labels on all form fields | | |
| Semantic buttons/links | | |
| Keyboard navigation works | | |
| Focus management in dialogs | | |
| Modal/dialog semantics | | |
| Error associations (aria-describedby) | | |
| aria-live for async feedback | | |
| Color contrast (4.5:1 minimum) | | |
| Touch target sizes (44x44px minimum) | | |
| Reduced motion support | | |
| Heading hierarchy (h1 > h2 > h3) | | |

### Critical Elements

- Account settings forms
- Notification preferences
- Profile editing

### Manual Tests

1. Tab through account settings — can you reach all controls?
2. Can you save changes using only keyboard?
3. Are confirmation dialogs accessible?

---

## 7. High-Risk Admin Dialogs (`apps/admin`)

### Checklist

| Check | Status | Notes |
|---|---|---|
| Labels on all form fields | | |
| Semantic buttons/links | | |
| Keyboard navigation works | | |
| Focus management in dialogs | | |
| Modal/dialog semantics | | |
| Error associations (aria-describedby) | | |
| aria-live for async feedback | | |
| Color contrast (4.5:1 minimum) | | |
| Touch target sizes (44x44px minimum) | | |
| Reduced motion support | | |
| Heading hierarchy (h1 > h2 > h3) | | |

### Critical Elements

- Refund dialogs
- Order cancellation dialogs
- User role/permission changes
- Delete confirmations

### Manual Tests

1. Tab through admin dialogs — can you reach all controls?
2. Can you confirm destructive actions using only keyboard?
3. Are confirmation dialogs accessible?

---

## Automated Testing

### Install axe-core

```bash
npm install --save-dev @axe-core/react axe-core
```

### Add to React App

```tsx
// In main.tsx or App.tsx (development only)
if (import.meta.env.DEV) {
  import('axe-core').then(axe => {
    import('react-axe').then(ReactAxe => {
      ReactAxe.default(React, ReactDOM, 1000);
    });
  });
}
```

### Manual Audit Tools

- [axe DevTools](https://www.deque.com/axe/devtools/) — Browser extension
- [WAVE](https://wave.webaim.org/) — Web accessibility evaluation tool
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) — Built into Chrome DevTools

---

## Accessibility Standards

### WCAG 2.1 AA Compliance

PawTag targets WCAG 2.1 AA compliance:

- **Perceivable** — Information must be presentable in ways users can perceive
- **Operable** — Interface components must be operable
- **Understandable** — Information and UI operation must be understandable
- **Robust** — Content must be robust enough for diverse user agents

### Key Requirements

| Requirement | Standard |
|---|---|
| Color contrast | 4.5:1 for normal text, 3:1 for large text |
| Touch targets | 44x44px minimum |
| Keyboard navigation | All interactive elements reachable |
| Focus indicators | Visible focus ring on all interactive elements |
| Screen reader support | ARIA labels, roles, live regions |
| Reduced motion | Respect `prefers-reduced-motion` |
| Heading hierarchy | Logical h1 > h2 > h3 structure |

---

## Related Documents

- `docs/FEEDBACK-PATTERNS.md` — Common feedback patterns
- `docs/pawtag-ui-ux/` — UI/UX guidelines
- `packages/ui/` — Shared UI components
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
