---
name: pawtag-ui-ux
description: Design, implement, or review PawTag customer, Finder, admin, and shared UI/UX. Use for new screens/components, visual redesigns, responsive behavior, forms, dialogs, drawers, empty/error/loading states, design-system work, accessibility, information hierarchy, or interaction polish. Preserve PawTag's existing design language while improving clarity, warmth, trust, premium feel, and consistency.
---

# PawTag UI/UX

Inspect the actual nearby implementation, `packages/ui`, design tokens, and `DESIGN.md` where relevant before creating a new visual language.

## Experience principles

PawTag should feel:
- trustworthy,
- warm but not childish,
- premium without being ornamental,
- clear under stress,
- commercially confident,
- accessible by default.

Clarity beats novelty. Recovery beats decoration.

## Reuse rule

Reuse an existing component when its contract genuinely fits. Extend a shared component when the new behavior belongs to the same abstraction. Create a new component when forcing reuse would make either implementation worse.

Avoid both copy-paste variants and premature "universal" abstractions.

## Required states

For meaningful interactive surfaces consider explicitly:
- initial/loading,
- empty,
- success,
- validation error,
- network/server error,
- disabled/unavailable,
- destructive confirmation,
- optimistic/pending state when used.

## Forms

- Visible labels associated with controls.
- Actionable inline errors.
- Preserve user input after recoverable failures.
- Correct keyboard/input modes on mobile.
- Do not rely on placeholder text as a label.

## Dialogs/drawers

Use correct semantics, focus trap/management, Escape/close behavior, focus restoration, backdrop behavior, accessible naming, and reduced-motion support.

## Responsive design

Design for the purpose of each breakpoint rather than shrinking desktop. Finder/customer flows are mobile-priority. Admin is desktop-priority unless the operation genuinely needs mobile support.

## Accessibility

Prefer semantic HTML/native controls. Ensure keyboard reachability, visible focus, accessible names, live announcements where dynamic status matters, usable contrast, and adequate touch targets.

## Motion

Motion explains hierarchy/state transitions. Do not use animation merely to make the product feel "modern".

## Cross-platform

Share design tokens, semantic component contracts, business logic, validation, and compatible headless logic. Do not force DOM components into React Native or vice versa.
