# Common Feedback Patterns

> Standardize UI feedback patterns across PawTag for consistency and accessibility.
>
> Last updated: 2026-09-19

## Purpose

PawTag should feel trustworthy, calm, modern, and premium. Consistent feedback patterns help users understand what happened and what to do next.

---

## 1. Toast Notifications

### When to Use

- Action completed successfully
- Non-critical error that doesn't block the current flow
- Informational message that auto-dismisses

### Structure

```
┌─────────────────────────────────────┐
│ ✓ Action completed successfully     │
│                                     │
│ [optional details]                  │
└─────────────────────────────────────┘
```

### Styles

| Type | Icon | Color | Duration |
|---|---|---|---|
| Success | ✓ | Green | 3-5 seconds |
| Error | ✗ | Red | 5-8 seconds |
| Warning | ⚠ | Amber | 5-8 seconds |
| Info | ℹ | Blue | 3-5 seconds |

### Rules

- Auto-dismiss after duration (except errors which require action)
- Stack toasts from bottom-right
- Max 3 visible at once
- Escape key dismisses
- Focus moves to toast when announced
- Use `role="status"` for non-critical, `role="alert"` for errors

### Code Example

```tsx
<Toast type="success" duration={4000}>
  <ToastIcon />
  <ToastContent>
    <ToastTitle>Order placed</ToastTitle>
    <ToastDescription>Your order #PT-2026-001 has been confirmed.</ToastDescription>
  </ToastContent>
</Toast>
```

---

## 2. Inline Errors

### When to Use

- Form validation errors
- Field-specific errors
- Errors that need to persist until fixed

### Structure

```
┌─────────────────────────────────────┐
│ Email                                │
│ ┌─────────────────────────────────┐ │
│ │ invalid-email                   │ │
│ └─────────────────────────────────┘ │
│ ✗ Please enter a valid email address │
└─────────────────────────────────────┘
```

### Styles

| Element | Color | Weight |
|---|---|---|
| Border | Red-500 | 1px |
| Text | Red-600 | Normal |
| Icon | Red-500 | 14px |

### Rules

- Show error below the field
- Use `aria-describedby` to associate error with field
- Use `aria-invalid="true"` on the field
- Use `role="alert"` for live error announcements
- Clear error when user starts typing
- Keep error visible until field is valid

### Code Example

```tsx
<div>
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    aria-invalid={hasError}
    aria-describedby="email-error"
  />
  {hasError && (
    <p id="email-error" role="alert" className="text-sm text-red-600">
      Please enter a valid email address
    </p>
  )}
</div>
```

---

## 3. Success Confirmations

### When to Use

- Important action completed
- Form submitted successfully
- Payment completed
- Order placed

### Structure

```
┌─────────────────────────────────────┐
│ ✓                                    │
│                                     │
│ Order Confirmed                     │
│                                     │
│ Your order #PT-2026-001 has been    │
│ placed successfully.                │
│                                     │
│ [View Order]                        │
└─────────────────────────────────────┘
```

### Styles

| Element | Style |
|---|---|
| Icon | Green circle with ✓ |
| Title | Bold, large |
| Description | Normal weight, muted |
| Action | Primary button |

### Rules

- Show immediately after success
- Include relevant details (order number, amount)
- Provide clear next action
- Use `role="status"` for screen readers
- Persist until user dismisses or navigates

---

## 4. Destructive Confirmations

### When to Use

- Delete account
- Cancel order
- Remove item
- Refund

### Structure

```
┌─────────────────────────────────────┐
│ Delete Account                      │
│                                     │
│ Are you sure you want to delete     │
│ your account? This action cannot    │
│ be undone.                          │
│                                     │
│ All your data, pets, and orders     │
│ will be permanently removed.        │
│                                     │
│ [Cancel]              [Delete]      │
└─────────────────────────────────────┘
```

### Styles

| Element | Style |
|---|---|
| Title | Bold |
| Description | Normal weight |
| Cancel | Secondary button |
| Confirm | Destructive button (red) |

### Rules

- Explain what will happen
- List consequences
- Require explicit confirmation
- Use destructive button color (red)
- Disable until user confirms understanding
- Use `aria-describedby` for description
- Focus trap within dialog

---

## 5. Skeleton/Loading Patterns

### When to Use

- Page loading
- Data fetching
- Form submission
- Image loading

### Structure

```
┌─────────────────────────────────────┐
│ ████████████████████████████████████ │
│ ████████████████                     │
│                                     │
│ ┌──────────┐ ┌──────────┐          │
│ │ ████████ │ │ ████████ │          │
│ │ ████████ │ │ ████████ │          │
│ └──────────┘ └──────────┘          │
└─────────────────────────────────────┘
```

### Styles

| Element | Color | Animation |
|---|---|---|
| Skeleton | Gray-200 | Pulse |
| Shimmer | Gray-300 | Left-to-right |

### Rules

- Match actual content layout
- Use `aria-busy="true"` on container
- Use `aria-live="polite"` for loading announcements
- Show loading state immediately
- Transition smoothly to content
- Respect `prefers-reduced-motion`

### Code Example

```tsx
<div aria-busy={isLoading} aria-live="polite">
  {isLoading ? (
    <Skeleton>
      <SkeletonText lines={3} />
      <SkeletonImage width={200} height={200} />
    </Skeleton>
  ) : (
    <Content />
  )}
</div>
```

---

## 6. Empty States

### When to Use

- No data to display
- No search results
- No items in cart
- No orders yet

### Structure

```
┌─────────────────────────────────────┐
│                                     │
│         ┌─────────┐                 │
│         │   📦    │                 │
│         └─────────┘                 │
│                                     │
│       No orders yet                 │
│                                     │
│   When you place an order, it will  │
│   appear here.                      │
│                                     │
│      [Browse Products]              │
│                                     │
└─────────────────────────────────────┘
```

### Styles

| Element | Style |
|---|---|
| Icon/Illustration | Large, muted |
| Title | Bold, medium |
| Description | Normal weight, muted |
| Action | Primary button |

### Rules

- Use relevant icon/illustration
- Explain why it's empty
- Provide clear next action
- Keep description helpful but brief
- Use `role="status"` for screen readers

---

## 7. Status Badges

### When to Use

- Order status
- Payment status
- Pet status
- Tag status

### Styles

| Status | Color | Text |
|---|---|---|
| Active/Live | Green | Active |
| Pending | Yellow | Pending |
| Processing | Blue | Processing |
| Cancelled/Failed | Red | Cancelled |
| Expired | Gray | Expired |
| Found | Green | Found |
| Lost | Red | Lost |

### Rules

- Use consistent colors across app
- Include icon when helpful
- Use `aria-label` for screen readers
- Don't rely on color alone (add text/icon)

### Code Example

```tsx
<Badge variant="success" icon={<CheckIcon />}>
  Active
</Badge>

<Badge variant="warning" icon={<ClockIcon />}>
  Pending
</Badge>

<Badge variant="error" icon={<XIcon />}>
  Failed
</Badge>
```

---

## 8. Currency Formatting

### Rules

- Always use NZD for PawTag
- Format: `$XX.XX` (e.g., `$39.00`)
- Include currency in totals
- Use consistent decimal places (2)

### Code Example

```typescript
// Format currency
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Examples
formatCurrency(39);      // "$39.00"
formatCurrency(39.5);    // "$39.50"
formatCurrency(1234.56); // "$1234.56"
```

---

## 9. Date Formatting

### Rules

- Use relative time for recent events (e.g., "2 hours ago")
- Use absolute time for older events (e.g., "19 Sep 2026")
- Include time for important events (e.g., "19 Sep 2026, 2:30 PM")
- Use NZ timezone by default

### Code Example

```typescript
// Format date
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Examples
formatDate(new Date());           // "Today"
formatDate(new Date('yesterday'));// "Yesterday"
formatDate(new Date('2026-09-01'));// "1 Sep 2026"
```

---

## 10. Accessibility

### General Rules

- Use semantic HTML
- Provide accessible names for icon buttons
- Use ARIA attributes correctly
- Support keyboard navigation
- Respect `prefers-reduced-motion`
- Test with screen readers

### Specific Patterns

| Pattern | Accessibility |
|---|---|
| Toast | `role="status"` or `role="alert"` |
| Inline error | `role="alert"`, `aria-describedby` |
| Modal | Focus trap, `aria-modal`, `aria-labelledby` |
| Loading | `aria-busy`, `aria-live="polite"` |
| Badge | `aria-label` if icon-only |

---

## Implementation Checklist

When implementing feedback patterns:

- [ ] Use consistent styles from this document
- [ ] Add appropriate ARIA attributes
- [ ] Support keyboard navigation
- [ ] Test with screen readers
- [ ] Respect reduced motion
- [ ] Use consistent currency formatting
- [ ] Use consistent date formatting
- [ ] Provide clear action labels
- [ ] Explain what happened and what to do next

---

## Related Documents

- `docs/DESIGN.md` — Design system
- `docs/pawtag-ui-ux/` — UI/UX guidelines
- `packages/ui/` — Shared UI components
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
