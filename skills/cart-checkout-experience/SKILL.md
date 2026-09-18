---
name: cart-checkout-experience
description: Design, implement, or review PawTag cart and checkout UX. Use for CartDrawer, the full /cart page, checkout presentation, quantity controls, product/customization display, discounts, Guardian/Gold benefits, shipping, GST, totals, inventory/price-change messaging, responsive behavior, accessibility, and commerce motion. Enforces the PawTag mini-cart plus premium 70/30 desktop cart architecture.
---

# Cart and Checkout Experience

Use `pawtag-ui-ux` principles and `commerce-safety` for financial logic. Do not duplicate server pricing rules in UI components.

## Product architecture

### Mini-cart drawer

`CartDrawer` is a fast post-add-to-cart surface, not the full premium cart.

Keep it focused on:
- recent/current items,
- concise quantity changes,
- removal,
- key customization,
- subtotal/estimated total context,
- clear `View cart` and `Checkout` actions.

It must behave as an accessible dialog/drawer with focus management, Escape behavior, focus restoration, semantic labeling, and accessible icon controls.

### Full `/cart`

Desktop target: approximately 70/30 composition.

- Left ~70%: product management, images, variants, engraving/customization, quantity, per-unit/line pricing, stock/price messages, contextual benefits/delivery information.
- Right ~30%: sticky order summary with subtotal, discounts, Guardian/Gold benefit, shipping status/estimate, GST/tax statement, total/estimated total, checkout CTA, trust/support context.

The summary should remain sticky only where viewport/layout makes it usable.

## Responsive behavior

Do not squeeze 70/30 onto mobile.

Mobile order:
1. products,
2. problems/messages,
3. benefits/context,
4. order summary,
5. optional sticky bottom bar with total + checkout.

Preserve keyboard visibility, safe areas, and touch targets.

## Visual hierarchy

- Product title and image lead each line item.
- Variant/customization details are explicit, not hidden.
- Engraving/customization price is visible when applicable.
- Problems outrank promotional content.
- Total and checkout CTA dominate the summary.
- Avoid multiple competing upsell banners.

## States

Design intentionally for loading, empty, item removal, quantity update, price change, out-of-stock, low stock, promo success/failure, network error, guest state, and server recalculation.

## Motion

Use motion to communicate state only: drawer transition, add/remove, quantity/price update, validation/problem reveal. Respect reduced motion. Avoid decorative animation that competes with checkout.

## Acceptance standard

Premium means confidence, hierarchy, transparency, recovery, responsiveness, and accessibility—not visual density or excessive effects.
