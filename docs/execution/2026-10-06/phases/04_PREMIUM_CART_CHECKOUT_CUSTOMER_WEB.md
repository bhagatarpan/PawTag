# Phase 04 — Premium Cart, Persistent 70/30 Checkout, and Customer Web Quality

## Objective

Deliver the premium customer commerce experience the founder expects, using the corrected financial contracts from previous phases. This is not a cosmetic-only phase: state handling, accessibility, responsiveness, validation, and recovery are part of the product.

## Required skills

`work-packet-executor`, `cart-checkout-experience`, `pawtag-ui-ux`, `feature-completeness`, `testing-regression`, `api-urls`

## Primary files

- `apps/web/src/pages/Cart.tsx`
- `apps/web/src/components/cart/*`
- `packages/ui/src/components/CartDrawer.tsx`
- `apps/web/src/pages/Checkout.tsx`
- `apps/web/src/components/checkout/*`
- shared promo/shipping/auto-renew/rewards controls
- `apps/web/src/context/CartContext.tsx`, `CartInteractionContext.tsx`
- account Orders/OrderDetail/Invoices/InvoiceDetail/Subscriptions/Membership pages
- `packages/ui` and `docs/DESIGN.md`

## Product architecture

### Mini-cart drawer

Fast add-to-cart feedback and quick edits. Not the premium full cart.

Must include accessible drawer semantics, keyboard/focus behavior, concise line details, customization, quantity/remove, meaningful subtotal/estimated total, `View cart`, and `Checkout`.

### Full `/cart` desktop

Use a 12-column composition:

```text
8 columns (~67–70%): products, customization, quantity, stock/price issues, delivery/benefit context
4 columns (~30–33%): sticky financial summary + CTA
```

Do not put every item inside one undifferentiated flat white column. Each item needs a strong product-card composition and readable hierarchy.

Summary order should be understandable: subtotal -> discount/promo -> rewards/benefits -> shipping -> GST/tax statement -> final/estimated total -> primary checkout CTA -> trust/support cues.

### Checkout journey

Target:

```text
/cart
  -> Delivery & Contact
  -> Review
  -> Payment
  -> Confirmation
```

Cart editing belongs primarily on `/cart`. Checkout shows a concise order representation with an `Edit cart` route rather than becoming a second cart editor.

### Persistent desktop checkout shell

Every main checkout step must use the same structural shell:

```text
[progress/header]
[8/12 current step content] [4/12 sticky order summary]
```

Do not render Delivery in `max-w-2xl` single column and switch to 70/30 later. The summary component must be one shared implementation across Delivery, Review, and Payment.

### Mobile/tablet

Do not squeeze 70/30 onto a phone. Recompose to:

1. current step;
2. compact order summary/details;
3. supporting information;
4. optional sticky bottom total + primary CTA.

Handle software keyboard, safe-area-like bottom spacing for future shell, touch targets, and scroll-to-error/focus.

## Concrete defects to re-verify

Prior audits identified these; inspect current code and fix if still present:

- saved-address card displaying the selected form line instead of each address line;
- “save this address” control with no persisted behavior;
- inconsistent step layouts despite “70/30” comments;
- duplicated/stale shipping fields;
- racing shipping quote requests;
- giant `Checkout.tsx` orchestration;
- ad-hoc payment progress global state;
- incomplete zero-total behavior;
- verification friction not clearly justified;
- missing/weak loading, price-change, inventory, payment-recovery states.

Do not blindly patch an issue if current code already fixed it; prove current behavior first.

## Visual/interaction requirements

- Premium, warm, commercially confident—not ornamental.
- Product image and product identity are visually dominant.
- Variants/engraving are explicit; customization surcharge is transparent.
- Quantity changes show pending state and prevent accidental rapid conflicts.
- Stock/price changes appear near affected product and in summary if checkout-blocking.
- Promo/Gold/rewards do not compete as multiple loud banners.
- Motion communicates add/remove/quantity/step transitions only; respect reduced motion.
- Error language is actionable and retains user input.

## Accessibility

Keyboard access, semantic headings/forms, dialog/drawer focus, icon labels, live status for async updates, visible focus, contrast, field-error association, touch targets, reduced motion.

## Automated tests

Add/maintain unit/integration/component tests for totals/quote state and key UI behavior. Browser E2E is finalized in Phase 07, but this phase should add stable selectors/semantics rather than test-only IDs everywhere.

## Acceptance gate

- Desktop Cart is unmistakably a premium 8/4 composition with sticky summary.
- Delivery, Review, Payment all use the same persistent 8/4 checkout shell.
- Mobile is purpose-designed one-column, not squeezed desktop.
- All financial values come from server-authoritative state.
- Core accessibility/state handling is implemented.
- No duplicate business pricing rules were added to UI.

Stop before Phase 05.
