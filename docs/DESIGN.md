# PawTag Design System

**Last updated:** 2026-10-03
**Status:** Active — authoritative reference for all PawTag UI (web, customer, admin, finder, mobile)

---

## Returns & refunds (customer/admin)

| Surface | Pattern | Tokens |
|---|---|---|
| Customer return status on order detail | Card with status, reason, requested amount, tracking, refund result | White card `bg-white rounded-2xl shadow-sm border border-gray-100`; body-sm |
| Customer return instructions | Calm note: no PawTag return shipping; warehouse address in email when configured | `text-xs text-gray-500` |
| Admin Returns list/status | Table + status pills | Existing admin table; status colors in Returns.tsx |
| Admin Process Refund | Explicit amount + reason + warehouse received / exception | Money action uses purple confirm; exception uses amber |
| **Pending returns badge (sidebar)** | Amber count pill when pending > 0 | `bg-amber-500 text-white text-[10px] rounded-full` — **not** blinking |
| **Dashboard Pending Returns tile** | Static StatCard; amber icon bg when count > 0; click → `/returns?status=pending` | Same StatCard pattern as other ops cards |
| Failed refund | Support path; no fake success | `red-50` / `red-700` |
| Refund destination | Always original payment method | Shared `formatRefundDestination*` |

Full process, decision tree, and mockups: `docs/RETURNS-REFUNDS-WORKFLOW.md`.  
Specialist skill: `skills/returns-refunds/`.

Do not invent a new visual language for returns. Use existing status-card and form patterns.  
**Do not use blinking/flashing alerts** for admin ops — counts and badges are sufficient.

---

## Checkout contact status

| State | Pattern | Tokens |
|---|---|---|
| Fully verified | Collapsible single row: Contact ✓ + email/phone; expand for details + Edit | White card, green check, `text-xs` muted contact |
| Not fully verified | Compact strip: status pill + one CTA per missing channel | Amber pill `bg-amber-100 text-amber-700`; teal primary links |
| Active OTP / verify task | Full `CheckoutVerificationGate` form | Unchanged |

Do not stack two large green verification cards when already verified.

---

## Refund destination display

Refunds always return to the **original payment method**. UI must state that clearly and never invent a card.

| Surface | Pattern | Tokens |
|---|---|---|
| Customer cancel modal footnote | `formatRefundDestinationSentence` copy + list | `text-primary-800` on footnote; body-sm |
| Customer order detail refund card | Destination + amount + refund ID + timing | Status card uses semantic bg (`blue-50` pending, `green-50` succeeded, `red-50` failed) with matching border/text |
| Customer orders list | Short label `Refund to Visa ••••1234` | `text-xs text-gray-600` |
| Admin refunds / order refund card | Destination + amount + ARN + dates | Same status semantic colors; admin desktop density |
| Failed refund copy | Support will arrange alternate method | Red semantic (`red-50` / `red-700`) |

Shared formatters live in `@pawtag/shared` (`formatRefundDestination*`) and are re-exported from `@pawtag/ui`.

Do not introduce a new visual language for refunds. Use existing status-card patterns and teal/gray tokens for secondary labels.

---

## Brand Character

PawTag is a pet-recovery service, often used by someone stressed or worried about a missing pet. The design must feel:

- **Warm & Reassuring** — calm colors, gentle transitions, friendly language. Never cold or clinical.
- **Modern & Professional** — clean layout, consistent spacing, trustworthy. Like a vet you trust, not a toy store.
- **Approachable** — plain language, obvious actions, no jargon. A non-technical person should feel confident using every screen.

The brand lives in the intersection of "tech product you can trust" and "pet brand that cares." Too sterile loses the warmth; too playful loses the trust. Aim for the middle.

---

## Color Palette

### Primary — Teal

The primary palette is teal, formalized from the existing Tailwind teal scale used across all four web apps. This is the brand color — it appears in the logo, buttons, links, active states, and focus rings everywhere.

| Token | Hex | Usage |
|---|---|---|
| `primary-50` | `#f0fdfa` | Hover backgrounds, subtle highlights |
| `primary-100` | `#ccfbf1` | Badge backgrounds, avatar backgrounds |
| `primary-200` | `#99f6e4` | Light borders, step indicators |
| `primary-300` | `#5eead4` | Photo borders, decorative |
| `primary-400` | `#2dd4bf` | Active tab borders, secondary accents |
| `primary-500` | `#14b8a6` | Focus rings, progress bars, active indicators |
| `primary-600` | `#0d9488` | Primary buttons, links, active nav, logo text |
| `primary-700` | `#0f766e` | Hover on primary buttons, logo icon gradient end |
| `primary-800` | `#115e59` | Dark text on primary backgrounds |
| `primary-900` | `#134e4a` | Darkest primary, used sparingly |

**Why teal:** Teal communicates trust, calm, and health — it's associated with medical/veterinary contexts without being sterile. It's distinct enough from competitor blues to be memorable, and it works well at both small (icons) and large (hero sections) scales.

### Neutral — Gray

Standard Tailwind gray scale for text, borders, backgrounds, and disabled states.

| Token | Usage |
|---|---|
| `gray-50` | Page backgrounds (customer, admin, finder), hover states |
| `gray-100` | Subtle borders, skeleton loader backgrounds |
| `gray-200` | Standard borders, table borders, toggle backgrounds |
| `gray-300` | Input borders, disabled backgrounds |
| `gray-400` | Disabled text, placeholder text, muted icons |
| `gray-500` | Muted text, descriptions, secondary labels |
| `gray-600` | Body text, nav links, table content |
| `gray-700` | Form labels, secondary headings |
| `gray-800` | Dark headings (used sparingly) |
| `gray-900` | Body text, dark backgrounds (admin sidebar, footer) |

### Semantic Colors

| Color | Hex Range | Usage |
|---|---|---|
| **Red** | `red-50` → `red-700` | Errors, destructive actions, lost pet status, medical alerts |
| **Green** | `green-50` → `green-700` | Success messages, verified status, safe pet status, completed steps |
| **Amber** | `amber-50` → `amber-700` | Warnings, grace period, low stock, found pet status |
| **Blue** | `blue-50` → `blue-700` | Informational, location consent, email actions |
| **Purple** | `purple-50` → `purple-700` | Featured/premium badges, shipped status |
| **Teal** | `teal-50` → `teal-700` | Subscription active, Guardian membership, points earned |
| **Orange** | `orange-50` → `orange-700` | Grace period, payment retry, dunning alerts |
| **Gold** | `yellow-50` → `yellow-700` | Gold membership, premium tier, PawRewards balance |

### Gradients

| Gradient | Usage |
|---|---|
| `from-teal-600 to-teal-700` | Logo icon background (navbar, auth pages) |
| `from-teal-500 to-teal-600` | Footer logo icon |
| `from-teal-700 to-teal-600` | Hero banners, shop banners |
| `from-teal-50 to-teal-100` | Image placeholders, upload areas |
| `from-yellow-400 to-amber-500` | Gold membership cards |
| `from-gray-300 to-gray-500` | Platinum membership cards |
| `from-gray-800 to-black` | Black membership cards |

---

## Typography

### Font Family

All platforms use the **system font stack** — no custom fonts. This is intentional: system fonts load instantly, feel native to each platform, and require no font loading infrastructure.

**Stack:**
```
ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
"Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans",
sans-serif, "Apple Color Emoji", "Segoe UI Emoji"
```

**Monospace** (for tag IDs, OTP inputs, codes):
```
ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
"Liberation Mono", monospace
```

### Type Scale

| Name | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `display` | 2.25rem (36px) | 800 | 1.2 | Hero headlines, "Pet reunited" celebrations |
| `h1` | 1.875rem (30px) | 700 | 1.3 | Page titles |
| `h2` | 1.5rem (24px) | 700 | 1.35 | Section headings |
| `h3` | 1.25rem (20px) | 600 | 1.4 | Card titles, subsection headings |
| `body-lg` | 1.125rem (18px) | 400 | 1.6 | Lead paragraphs, descriptions |
| `body` | 1rem (16px) | 400 | 1.5 | Default body text |
| `body-sm` | 0.875rem (14px) | 400 | 1.5 | Secondary text, form helpers |
| `caption` | 0.75rem (12px) | 500 | 1.4 | Labels, timestamps, badges |
| `mono` | 0.875rem (14px) | 400 | 1.5 | Tag IDs, codes, OTP inputs |

---

## Spacing Scale

A consistent 4px base unit, multiplied to create a predictable rhythm:

| Token | Value | Usage |
|---|---|---|
| `0` | 0px | — |
| `0.5` | 2px | Tight gaps (icon to text) |
| `1` | 4px | Minimal gaps |
| `1.5` | 6px | — |
| `2` | 8px | Compact spacing, inline elements |
| `3` | 12px | Small padding, card internals |
| `4` | 16px | Standard padding, gaps between related items |
| `5` | 20px | — |
| `6` | 24px | Card padding, section gaps |
| `8` | 32px | Large section gaps, page margins |
| `10` | 40px | — |
| `12` | 48px | Major section separators |
| `16` | 64px | Page-level vertical spacing |
| `20` | 80px | Hero section padding |
| `24` | 96px | Maximum spacing |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `none` | 0px | — |
| `sm` | 4px | Small inline elements, tags |
| `md` | 6px | Form inputs, compact buttons |
| `lg` | 8px | Standard buttons, cards (admin) |
| `xl` | 12px | Primary buttons, logo icon, nav elements |
| `2xl` | 16px | Feature cards, hero sections, login cards |
| `3xl` | 24px | Large feature cards |
| `full` | 9999px | Avatars, pills, badges |

**Standard:** Use `rounded-xl` (12px) for buttons and interactive elements, `rounded-2xl` (16px) for cards and containers.

---

## Copy Button

Reusable copy-to-clipboard button for IDs, codes, and reference numbers.

### Design Tokens

| Element | Token/Class |
|---------|-------------|
| Default icon color | `text-gray-400` |
| Hover color | `text-primary-600` |
| Success (copied) color | `text-green-500` |
| Transition | `transition-colors duration-150` |
| Icon | Lucide `Copy` (default) / `Check` (after copy) |
| Icon size | 10-16px depending on context |
| Spacing | `ml-1.5` or `gap-1` (gap between ID text and icon) |

### Component

**Web:** `CopyButton` from `@pawtag/ui`

```tsx
import { CopyButton } from '@pawtag/ui';
<CopyButton text="PT-123456" size={12} />
```

**Mobile:** `CopyButton` from `../../components/CopyButton`

```tsx
import { CopyButton } from '../../components/CopyButton';
<CopyButton text="PT-123456" size={14} />
```

### Behavior

- Click copies text to clipboard
- Icon briefly changes to checkmark (1.5 seconds)
- Uses `navigator.clipboard.writeText()` (web) or `expo-clipboard` (mobile)
- Fallback to `document.execCommand('copy')` for older browsers

### Usage Pattern

```tsx
{/* Inline with ID text */}
<div className="flex items-center gap-1.5">
  <span className="font-mono font-bold">{tagId}</span>
  <CopyButton text={tagId} size={12} />
</div>
```

---

## Shadows / Elevation

| Level | Tailwind Classes | Usage |
|---|---|---|
| **None** | — | Flat elements, inline text |
| **Subtle** | `shadow-sm` | Cards at rest, input fields |
| **Medium** | `shadow-md` | Dropdown menus, modals |
| **Elevated** | `shadow-lg` | Floating elements, hover state on cards |
| **High** | `shadow-xl` | Dialogs, overlays |

---

## Component Patterns

### Buttons

| Variant | Classes | Usage |
|---|---|---|
| **Primary** | `bg-primary-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-primary-700 active:bg-primary-800 transition-all` | Main actions (Checkout, Save, Submit) |
| **Secondary** | `border border-primary-600 text-primary-600 rounded-xl font-semibold px-6 py-3 hover:bg-primary-50 transition-all` | Alternative actions, "Learn more" |
| **Ghost** | `text-primary-600 font-medium hover:text-primary-700 transition-colors` | Inline links, text buttons |
| **Destructive** | `bg-red-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-red-700 active:bg-red-800 transition-all` | Delete, Cancel, "Mark as lost" |
| **Disabled** | `opacity-50 cursor-not-allowed pointer-events-none` | All variants when disabled |

### Cards

| Type | Classes | Usage |
|---|---|---|
| **Standard** | `bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:border-primary-200 hover:shadow-lg transition-all duration-300` | Product cards, feature cards |
| **Compact** | `bg-white rounded-lg border border-gray-200 p-5` | Admin dashboard cards |
| **Interactive** | Standard card + `cursor-pointer` | Clickable cards, list items |

### Form Inputs

| Element | Classes |
|---|---|
| **Input** | `w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors` |
| **Label** | `block text-sm font-medium text-gray-700 mb-1` |
| **Helper text** | `text-sm text-gray-500 mt-1` |
| **Error** | `text-sm text-red-600 mt-1` |

### Badges / Pills

| Type | Classes |
|---|---|
| **Primary** | `inline-block px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold` |
| **Success** | `inline-block px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold` |
| **Warning** | `inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold` |
| **Error** | `inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold` |

### Icon Picker

Use the shared `IconPicker` from `@pawtag/ui` for selecting icons. It provides a visual grid picker with search, categorized icons (~50 from Lucide), and a clean dropdown UI.

**Component:** `IconPicker` from `@pawtag/ui`
**Props:** `{ value: string; onChange: (iconName: string) => void; className?: string }`
**Exported helper:** `ICON_MAP` — a `Record<string, LucideIcon>` for resolving icon names to components.

**Icon categories:** Shipping, Quality, Communication, Commerce, General.

**Usage pattern:**

```tsx
import { IconPicker, ICON_MAP } from '@pawtag/ui';

// In form:
<IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />

// For rendering selected icons:
const IconComponent = ICON_MAP[iconName] || Check;
<IconComponent size={16} className="text-primary-600" />
```

### Gated premium features (membership lock)

Pattern for features the entitlement registry gates (paid tier **or** the
free 3-month activation window — `docs/ACTIVATION-ENTITLEMENTS.md`):

| Rule | Implementation |
|---|---|
| **Visible when locked** | Never hide the feature — show it with the `✦` marker and primary-tinted lock styling (`bg-primary-50 text-primary-700 border-primary-100` + `title` tooltip). Hidden features don't convert. |
| **One gate per feature** | A single shared handler decides: entitled → open the feature; locked → SPA-navigate to `/membership` (`useNavigate`, never `window.location.href`). |
| **One fetch per page** | Entitlements are fetched once by the page container and passed to list items as props — never per card/row (N+1). |
| **Consistent iconography** | Same icon for a feature across surfaces (e.g. `Stethoscope` for Health everywhere). |
| **Server is authoritative** | Client gating is display only; APIs return `403 { error, upgradeUrl: '/membership' }` with **registry-neutral** copy — never hardcode tier names. |
| **Registry decides values** | Access comes from `membershipEntitlementService` — admins change it on `/membership/entitlements`, code and copy never mention tiers. |

Reference implementation: `apps/web/src/components/PetCard.tsx` (`handleHealthClick`) +
`MyPets.tsx` (page-level fetch) + `customer.ts` `requireHealthRecordsAccess`.

### Modals & Confirmation Dialogs

Use the shared `ConfirmDialog` from `@pawtag/ui` rather than creating custom modals. The component is reusable and supports reason selection, notes, and footnote.

**Pattern (cancellation / destructive confirmation):**

| Section | Classes / Behavior |
|---------|--------------------|
| **Container** | `fixed inset-0 z-50 flex items-center justify-center` with `bg-black/40` backdrop |
| **Card** | `relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 mx-4 max-h-[90vh] flex flex-col` |
| **Header** | Icon circle (`w-10 h-10 rounded-full`) + title (`text-lg font-semibold text-gray-900`) + close button (top-right, `text-gray-400 hover:text-gray-600`) |
| **Icon circle** | `danger`: `bg-red-100` / `text-red-600` · `warning`: `bg-amber-100` / `text-amber-600` · `primary`: `bg-primary-100` / `text-primary-600` |
| **Reason dropdown** | Placed FIRST, label "Reason *" with red asterisk, `border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500` |
| **Description** | `text-sm text-gray-500 mt-3` |
| **Footnote** | `mt-3 bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm text-primary-900` — for "What happens next?" callouts |
| **Notes textarea** | Same form-input styling as select, `resize-none`, required when "Other" selected |
| **Sticky footer** | `flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100 bg-white` |
| **Cancel button** | `px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50` |
| **Confirm button (danger)** | `px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50` |
| **Confirm button (warning)** | `bg-amber-600 hover:bg-amber-700` |
| **Confirm button (primary)** | `bg-primary-600 hover:bg-primary-700` |
| **Disabled state** | `disabled:opacity-50 cursor-not-allowed pointer-events-none` — Confirm disabled when required fields are missing |

**Validation:** Confirm button is disabled when:
- A reason is required but not selected
- Notes are required (`notesRequired={true}`) but empty or whitespace

**Reuse rule:** Do not create custom modals for confirmations. Extend `ConfirmDialog` with optional props (reasons, notes, footnote) instead. This keeps destructive actions consistent across the app.

### Bottom Sheet

For mobile-friendly selection/confirmation tasks that don't need a full modal overlay. Slides up from the bottom with a very light backdrop that doesn't obscure the page.

**When to use:**
- Reason selection (pause auto-renew, cancel reason)
- Simple option pickers (change plan)
- Quick confirmations with optional notes
- Form modals on mobile

**When NOT to use:**
- Complex multi-tab forms (use DetailDrawer)
- Destructive confirmations requiring focused attention (use ConfirmDialog)
- Full-page views (use DetailDrawer or dedicated page)

**Component:** `BottomSheet` from `@pawtag/ui`

**Props:** `{ open, onClose, title, description?, children, footer? }`

**Pattern:**

| Section | Classes |
|---------|---------|
| Backdrop | `fixed inset-0 bg-black/10 z-50` |
| Container | `absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[85vh] flex flex-col animate-slide-up` |
| Drag handle | `w-10 h-1 rounded-full bg-gray-300 mx-auto mt-3 mb-2` |
| Header | `px-6 pb-4` — title + description + close button |
| Content | `flex-1 overflow-y-auto px-6 pb-4` |
| Footer | `px-6 py-4 border-t border-gray-100 flex justify-end gap-3` |

**Behavior:**
- Click backdrop → close
- Escape key → close
- Body scroll locked when open
- Focus trapped within sheet

**Reuse rule:** Use `BottomSheet` instead of creating ad-hoc centered modals for selections and simple forms. This keeps interactions consistent and mobile-friendly.

### Mobile customer navigation

The customer account shell (`AccountLayout` in `apps/web`) has two navigation surfaces driven by **one config** — `apps/web/src/components/account/navigation.ts` (`ACCOUNT_NAV_ITEMS`). Destinations, labels and icons are declared once; sidebar, drawer and tab bar all read from it so they cannot drift.

| Surface | Viewport | Composition |
|---|---|---|
| Sidebar + hamburger drawer | all widths (sidebar visible `md+`) | full destination list (13 items) |
| Bottom tab bar (`BottomNav`) | `< md` (mobile browser **and** Capacitor shell) | five primary destinations |

**Tab model (Phase 08):** `Home → /account` · `Pets → /account/pets` · `Activate → /account/redeem-tag` · `Activity → /account/notifications` · `Account → /account/profile`.

- **Activity maps to the notification centre** — one Activity/Notifications destination, not a separate page.
- Secondary destinations (Orders, Invoices, Guardian, Membership, Referrals, Settings…) stay in the drawer. The tab bar is primary wayfinding only.
- Active state: `border-primary-600 bg-primary-50 text-primary-700 font-semibold` + `aria-current="page"` — never colour alone.
- **Activate** uses the elevated center treatment: teal circle (`h-14 w-14`, `bg-primary-600`, raised `-translate-y-3`) darkening to `bg-primary-700 ring-2` when active — a normal NavLink with the same route/`aria-current`.
- Row height is fixed at **4.5rem (72px)**; labels `text-[11px]` share one baseline (`justify-end pb-2`); icons `lucide-react` inline SVG only (no emoji).
- **Header:** the account shell header, sidebar brand block, and drawer brand block use the solid teal (`bg-primary-600`) chrome from the concept boards with white controls. Public site pages keep the white `Navbar`.

**Bottom stacking contract (CSS, `apps/web/src/index.css`):**

- `.safe-area-pb` — lifts any bottom bar above the home indicator: `padding-bottom: calc(var(--safe-area-pb-base, 0.75rem) + env(safe-area-inset-bottom))`. Bars with no extra bottom padding opt out via `[--safe-area-pb-base:0px]` (the tab bar does).
- `--app-bottom-nav-height` — **must mirror BottomNav** (`4.5rem tab row + 1px border + inset`) and is set to `0` outside `.app-bottom-nav-scope` / at `md+`. Page-level sticky action bars (e.g. invoice View/Download) position with `bottom-[var(--app-bottom-nav-height)]` so they rest **above** the tab bar.

**Rules:** do not add a sixth tab ad-hoc (extend `navigation.ts` + this table); public site pages use the `Navbar` disclosure, not the tab bar; Finder stays browser-only and outside customer chrome.

### Mobile visual language

Primitives extracted from the mobile concept boards (`docs/ux/PawTag_Mobile_Review_Package/images/`). All are exported from `@pawtag/ui`, styled on `primary-*`/semantic tokens only. **New customer UI must compose these instead of hand-rolling teal/gray markup** — this is what keeps one coherent look across screens.

| Primitive | Use for | Notes |
|---|---|---|
| `Button` + `buttonClassName()` | every action | variants `primary/secondary/danger/ghost`, sizes `md`(≥44px)/`lg`(≥48px), `full` for sticky CTAs; `buttonClassName()` for router `<Link>` |
| `StatusBadge` (existing) | status pills ("Tag active", "Shipped") | `success/danger/warning/info/neutral/primary` variants — extend, don't restyle |
| `InfoCard` | teal-tinted emphasis cards ("On the way", "Adding another pet?") | tones `primary/success/danger/amber`, icon well + title + trailing slot |
| `MetaRow` | icon-led list rows (pet meta, order actions, settings) | icon well + title/subtitle + right value + chevron; wrap in Link/Button for interactivity |
| `PhotoHero` | photography-led headers (dashboard greeting, pet/product hero) | bottom scrim keeps white text AA-legible; caller sets aspect/rounding |
| `SelectChips` | single-select filter chip rows (Activity filters) | `aria-pressed` buttons, horizontal scroll on phones — distinct from removable `FilterChips` |
| `EmptyState` / `ErrorState` / `OrderProgressStepper` / `CopyButton` / `StatusBadge` (existing) | states + progress | unchanged responsibilities; restyle only via tokens |

**Rules:** no ad-hoc gradients on account surfaces (the old `from-teal-600 to-cyan-600` PetCard treatment is retired); hover-only affordances are forbidden on touch-reachable controls; every screen keeps loading/empty/error/success states. **Sanctioned exception:** tier/status *identity* cards (gold/platinum/black membership heroes, Guardian tier headers, lost/found status heroes) keep deliberate brand gradients — they are semantics, not decoration.

### Order detail header (founder mobile mock, 2026-10-26)

Shared component `OrderHeader` inside `packages/ui` `OrderDetailView` (customer-only). Mobile-first; desktop renders the same card. Structure — no per-page hardcoded variants:

| Element | Spec (tokens/primitives only) |
|---|---|
| Card | `bg-white rounded-2xl border border-gray-100 p-4` — two rows: top `flex items-start gap-4` (tile + text), bottom pills row (below) |
| Icon tile | 48px `rounded-xl bg-primary-50 text-primary-600` + lucide `Package` — **neutral by design**: state lives in the pills (a green tile would read "confirmed" on refunded orders) |
| Eyebrow | `text-xs font-semibold uppercase tracking-widest text-gray-400` — label "Order" (uppercase via CSS, single source) |
| Number | `text-2xl font-bold` — order number **without** the "Order" prefix + existing `CopyButton` |
| Date line | existing `formatDateTime(order.createdAt)` ("Placed on …") — no separate date format code |
| Pills | **own bottom row** `flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100`, `StatusBadge size="md"` — payment state first, order status (with icon) below/next; wraps on narrow phones; sits below the number row so the order number always spans **full card width** (founder follow-up, 2026-10-26); variants from the existing status/badge maps |
| Stepper states | completed `bg-gray-500 text-white` + Check icon; **current** `bg-primary-600 text-white ring-2 ring-offset-2 ring-primary-200`; upcoming `bg-gray-100 text-gray-400`; labels: current `text-gray-900 font-semibold`, completed `text-gray-600`, upcoming `text-gray-400`. Accessible group name `"Order progress"` (replaces the old visible title) |
| Breadcrumb labels | detail routes resolve from `DETAIL_LABELS` in `apps/web/src/components/account/navigation.ts` (`/account/orders/:id → Order Details`, `/account/invoices/:id → Invoice Details`) — config, not string literals in JSX |

**Reuse rule:** new order headers/similar detail headers extend this pattern + `StatusBadge`/`Button` primitives — never inline one-off colors or label lists.

### Order list card + detail action area (implementation-package Phase 3, plan §5.2)

**List** (`apps/web/src/pages/account/Orders.tsx`): each order is **one `<Link>` card with nothing interactive nested inside** (no CopyButton in the list — copy lives on detail). Scannable rows, top→bottom:

| Row | Spec |
|---|---|
| Identity/state | mono order number + `formatDate at formatTime` left; order-status pill (`ORDER_STATUS_LABELS`/`getStatusBadgeVariant` + icon) and, when real, the **separate** refund pill (`getOrderRefundDisplay` → `getRefundDisplayLabel`) right — refund state is never merged into order status |
| Item summary | first item image (`w-14 h-14 rounded-xl object-cover`, token-tile fallback) + product name; meta = variant · qty · "+N more" |
| Progress | existing compact `OrderProgressStepper`, or `OrderStatusBanner` + refund notes for terminal/refund states (money-state copy untouched) |
| Footer | `Total` label + bold amount left; **"View order ›" outlined span** right — visual affordance only, not a control (it lives inside the link) |

**Demoted from card face to detail** (plan §5.2): card brand/last4, shipping city, invoice number, item-count row, activity/timeline row, payment-status pill.

**Detail** (`packages/ui` `OrderDetailView`): order = header card (founder mock) → banner/stepper + refund/pending notices → 2-col grid at `lg` (items+totals | payment/tracking/invoice/address/cancellation/refund) → **full-width action area last**: `OrderActions` self-hides unless return/cancel are eligible, stacks `flex-col` below `sm` (320px-safe), buttons via `buttonClassName` (`secondary`/`danger`, `lg`). Phone widths are always single-column (`grid-cols-1 lg:grid-cols-5`).

### Invoice document cards + detail summary (implementation-package Phase 4, plan §5.3)

**List** (`apps/web/src/pages/account/Invoices.tsx`) — plain `<article>` cards on the page surface (`space-y-3`, loading/empty/pagination keep their own white surfaces). **No button-like row exists anymore** — the previous `role="button"` wrapper (and its keydown guard) was removed outright because plan §5.3 forbids nesting controls inside a row; navigation is the explicit control:

| Element | Spec |
|---|---|
| Type tile | 44px `rounded-xl` — `bg-primary-50 text-primary-600` for invoices, **`bg-red-50 text-red-600` for credit notes** (document-type identity, image convention) |
| Head | type label ("Invoice"/"Credit note") → number (`break-all` — long numbers **wrap**, never clip) + status pill (`getInvoiceStatusLabel`) → date; amount right (`shrink-0`) via **`invoiceDisplayAmount(type, amount)`** from `@pawtag/shared` — credit notes render `NZ$-…` (sign at presentation, stored value untouched, double-minus guarded) |
| Controls | full-label **"View details"** (`Link` → detail route, `buttonClassName primary`) + **"Download PDF"** (`secondary`, real `downloadAuthenticatedFile` → server endpoint) — `flex-col` below `sm`, side-by-side from `sm` |
| Deliberate deviations from image | **no filter chips** (All/Invoices/Credit notes would need a new list-API param — excluded); **no order/item context line** (list API returns only `orderId`, no displayable order number — omitted, never faked) |

**Detail** (`InvoiceDetail.tsx`) — leads with the compact document summary: type tile + type label + number (`break-all`) + status pill inline + issue date/original reference, then a 2-col figures row (Amount, Paid/Due…), then existing line items → totals → context cards. Totals rows (`Total`, `Total credited`) are visually distinct (`text-primary-700 font-bold text-base`). The mobile fixed action bar (View/Download above the tab bar via `--app-bottom-nav-height`) is unchanged. Credit-note scope rendering and all cpf-disclosure source-guard strings untouched.

**Donations reuse the same structure** (owner request 2026-10-26): `MyDonations` = invoice-twin cards (Heart tile, frequency + status pills from `DONATION_FREQUENCY_LABELS`/`getDonationStatusLabel` — `pastDue` keeps the configured "Payment pending" — amount right, **View details** link + receipt-gated **Download PDF**, secondary Cancel monthly, impact stats computed client-side with the total hiding on mixed currencies) + a board subtitle. New **`/account/donations/:id`** detail (`DonationDetail.tsx`): compact summary (type·receipt line + status pill + big amount + given/cancelled dates), payment history demoted from the list, receipt View/Download sticky on desktop + fixed above the tab bar on mobile (only when receipt actions exist). Data = existing `donations.me` projection selected by id (**no API change**); receipt helpers shared in `apps/web/src/lib/donationReceipt.ts`; breadcrumb label via `ROUTE_OVERRIDES` ("Donation Details").

### Account page chrome (shell owns it)

`AccountLayout` already renders, for every `/account/**` route: the mobile header title (from `accountNavItemForPath` + `DETAIL_LABELS`), the `Home › Section` breadcrumb, content width (`max-w-4xl`), horizontal padding, and tab-bar clearance (`pb-28`). **Child pages must not re-declare any of it** (founder mobile packet, 2026-10-26 — invoices had a second `max-w-3xl px-4` wrapper plus a "Back to Account" link, making them narrower than sibling screens and stacking four header rows):

- page root = plain container (`space-y-6` etc.), no `max-w-*`/`px-*`/`pt-*` of its own;
- no "Back to Account" links when the breadcrumb covers the same destination — keep a back link only when it points somewhere the breadcrumb does not (e.g. detail → list);
- a page keeps **extra bottom padding only when it adds a fixed bottom action bar** above the tab bar (invoice detail: `pb-24 lg:pb-8` on top of the shell's `pb-28`);
- fixed action bars stack via `--app-bottom-nav-height` and must `flex-wrap` so 320px never overflows;
- list rows that contain inner action buttons guard `onKeyDown` with `e.target !== e.currentTarget` so Enter on an action never also triggers row navigation;
- touch-reachable controls ≥ 44px (`min-w-[44px] min-h-[44px]` for icon buttons).

**Status copy:** customer-facing invoice status text resolves from `INVOICE_STATUS_LABELS` / `getInvoiceStatusLabel()` in `packages/shared/src/customer-invoices.ts` — never render the raw enum.

### Auth screens (Login / Register / Verify / Reset)

All six authentication screens (`apps/web/src/pages/{Login,Register,VerifyAccount,VerifyEmail,ForgotPassword,ResetPassword}.tsx`) render through the shared **`apps/web/src/components/AuthLayout.tsx`** shell — spec §6.2 of `docs/ux/PawTag_Mobile_Review_Package/PawTag_Mobile_UX_Audit_and_Implementation_Spec.md`, implemented 2026-10-26.

| Rule | Spec |
|---|---|
| Shell | `AuthLayout` owns the brand header: logo tile (`from-primary-600 to-primary-700`), CMS `company.name`, CMS `site.tagline`, then the page `title`/`subtitle` (CMS `authPage` values with page fallbacks). Pages never hand-roll logo/gradient blocks. |
| Card vs bare | `card` (default `true`) wraps children in the white `rounded-2xl` card; `card={false}` for pages built from their own tinted cards on gray (VerifyAccount). |
| Buttons | Every CTA uses the `Button` primitive (`size="lg" full` for primary submits) or `buttonClassName(...)` when it's a `<Link>` — never raw `bg-teal-600`/`bg-primary-600` strings. |
| Inputs | `rounded-xl border-gray-300`, focus `focus:ring-primary-500 focus:border-primary-500`, label tied via `htmlFor`/`id`. |
| Mobile form behavior | Every field declares autofill/keyboard hints: `autoComplete` `email` · `name` · `tel` (+`inputMode="tel"`) · `current-password` / `new-password` · `one-time-code` (+`inputMode="numeric"`); `inputMode="email"` on email fields. |
| Verification progress | VerifyAccount renders **two distinct progress items** — numbered circles + "Step 1 of 2" (Email) and "Step 2 of 2" (Mobile) — from existing verification state only; no policy change. Resend cooldown text stays server/logic-driven. |
| No emoji icons | Brand icon is the lucide `PawPrint` in the shell — emoji tiles are retired (design rule: no emoji as primary navigation/action icons). |

**Reuse rule:** a new unauthenticated page joins the system by wrapping in `AuthLayout` + `Button`/token inputs — do not start a fourth copy of the logo/header block.

### Health records page (durable route, no modal)

Pet Health Records renders at **`/account/pets/:id/health`** inside `AccountLayout` (implementation-package Phase 2; the owner rejected the old centered-modal design). Authority: `apps/web/src/pages/account/HealthRecords.tsx` + `tests/unit/health-records-page.test.tsx`.

| Rule | Spec |
|---|---|
| Never a modal | Viewing and add/edit are page/inline states of the route. `AccountLayout` owns chrome, breadcrumb (via `ROUTE_OVERRIDES` suffix `/health` → "Health Records", section My Pets), width and tab-bar clearance. PetDetail **and** MyPets navigate here; neither mounts an overlay. |
| Category selector | `nav aria-label="Health record categories"` — wrapped icon+label button grid (`grid-cols-3 sm:grid-cols-5`), **no horizontal swiping strip**; selection exposed as `aria-current="page"` (Profile-tabs pattern). All nine product categories, product labels unchanged. |
| Entitlement | Re-checks `pet_health_records` exactly like PetDetail; without it the page locks to the membership card — direct URLs never show data. |
| Data layer | Pet payload seeds the nine sections; per-section `fetch/save/delete` endpoints, payload shapes, `confirm()` delete and toast semantics are unchanged. `sectionApiName()` is the single section→segment mapping (was duplicated). |
| Forms | Inline in the section card (form replaces list, same position — page scroll keeps Save/Cancel reachable above the software keyboard). Every field label is associated via `htmlFor`/`id` (`hr-*` ids — one form renders at a time so ids are unique per DOM). Inputs `rounded-xl` + `focus:ring-primary-500`. |
| Record cards | `border-gray-100 rounded-xl p-4`; edit/delete are labeled ≥44px icon buttons (`aria-label="Edit {primary field}"` / `Delete …` — primary field per category from `PRIMARY_FIELD`). |
| Desexing | `DesexingForm` renders when `tab === 'desexing' && showForm` (the old modal's branch order made Edit dead — restored, same `PUT /pets/:id/desexing` payload). |
| Not invented | No overdue/due-soon computation, no reminder rows, no char counters, no status chips beyond fields the API actually returns (image concepts were composition guidance only). |

### Order Status Colors

All order status displays (badges, steppers, banners, left borders) must use these design tokens. No hardcoded colors.

| Status | Badge Variant | Badge Classes | Border Left |
|---|---|---|---|
| `pending` | warning | `bg-amber-100 text-amber-700` | `border-l-amber-400` |
| `pending_payment` | warning | `bg-amber-100 text-amber-700` | `border-l-amber-400` |
| `paid` | primary | `bg-primary-100 text-primary-700` | `border-l-primary-500` |
| `packing` | primary | `bg-primary-100 text-primary-700` | `border-l-primary-500` |
| `shipped` | info | `bg-blue-100 text-blue-700` | `border-l-blue-500` |
| `delivered` | success | `bg-green-100 text-green-700` | `border-l-green-500` |
| `cancelled` | danger | `bg-red-100 text-red-700` | `border-l-red-400` |
| `refunded` | success | `bg-green-100 text-green-700` | `border-l-green-400` |

### Payment Status Colors

Payment status is a separate, independent system from order status. Always display both when showing order details.

| Status | Badge Variant | Badge Classes | Label |
|---|---|---|---|
| `pending` | warning | `bg-amber-100 text-amber-700` | Awaiting Payment |
| `completed` | success | `bg-green-100 text-green-700` | Payment Confirmed |
| `failed` | danger | `bg-red-100 text-red-700` | Payment Failed |
| `refunded` | neutral | `bg-gray-100 text-gray-600` | Refunded |

**Cross-state display rules (order status + payment status → what to show):**

| Order Status | Payment Status | Order Banner | Payment Badge | Refund Card |
|---|---|---|---|---|
| `pending` / `pending_payment` | `pending` | None | "Awaiting Payment" | None |
| `paid` / `packing` / `shipped` / `delivered` | `completed` | None | "Payment Confirmed" | None |
| `cancelled` | `completed` | "Order Cancelled" (red) | "Payment Confirmed" | None (not yet refunded) |
| `cancelled` | `refunded` | "Order Cancelled" (red) | "Refunded" | None |
| `refunded` | `refunded` | "Refund Complete" (green) | "Refunded" | Shown if `refundStatus` exists |

**Customer portal:** Always show payment status badge on order cards and order detail page. Show refund pending card when `order.status === 'cancelled'` AND `order.payment.status === 'completed'` (prompt to process refund).

**Admin portal:** Always show payment status indicator on orders table and order detail. Show "Process Refund" button when `order.status === 'cancelled'` AND `order.payment.status === 'completed'`.

### Refund Status Colors

The refund lifecycle has its own status (separate from the order status):

| Status | Label | Card Style | Icon |
|--------|-------|-----------|------|
| `pending` | Refund Processing | `bg-blue-50 border-blue-200 text-blue-700` | Clock |
| `succeeded` | Refund Succeeded | `bg-green-50 border-green-200 text-green-700` | CheckCircle |
| `failed` | Refund Failed | `bg-red-50 border-red-200 text-red-700` | XCircle |
| `canceled` | Refund Canceled | `bg-gray-50 border-gray-200 text-gray-700` | XCircle |

### Subscription Status Colors

Subscription status displays (badges, cards, steppers) must use these design tokens. No hardcoded colors.

| Status | Badge Variant | Badge Classes | Card Gradient | Border Left |
|---|---|---|---|---|
| `active` | success | `bg-green-100 text-green-700` | `from-emerald-600 to-teal-700` | `border-l-green-400` |
| `grace_period` | warning | `bg-amber-100 text-amber-700` | `from-amber-500 to-orange-600` | `border-l-amber-400` |
| `expired` | danger | `bg-red-100 text-red-700` | `from-gray-700 to-gray-900` | `border-l-red-400` |
| `cancelled` | neutral | `bg-gray-100 text-gray-600` | `from-gray-500 to-gray-700` | `border-l-gray-400` |
| `pending_payment` | warning | `bg-amber-100 text-amber-700` | `from-amber-500 to-orange-600` | `border-l-amber-400` |

### Tag Status Colors

Tag status displays (badges, dots, indicators) must use these design tokens. No hardcoded colors.

| Status | Badge Classes | Text Color | Dot Color | Icon | Meaning |
|---|---|---|---|---|---|
| `active` | `bg-green-100 text-green-700` | `text-green-700` | `bg-green-500` | CheckCircle | Tag is operational |
| `inactive` | `bg-gray-100 text-gray-600` | `text-gray-600` | `bg-gray-400` | Info | Not yet activated |
| `limited` | `bg-amber-100 text-amber-700` | `text-amber-700` | `bg-amber-500` | AlertTriangle | Active period expired, no membership |
| `lost` | `bg-red-100 text-red-700` | `text-red-700` | `bg-red-500 animate-pulse` | AlertCircle | Pet is lost |
| `expired` | `bg-red-100 text-red-700` | `text-red-700` | `bg-red-500` | Clock | Warranty expired |
| `terminated` | `bg-gray-100 text-gray-500` | `text-gray-500` | `bg-gray-400` | XCircle | Pet terminal (deceased/sold) |
| `replaced` | `bg-blue-100 text-blue-700` | `text-blue-700` | `bg-blue-400` | RefreshCw | Superseded by new tag |
| `deleted` | `bg-gray-100 text-gray-400` | `text-gray-400` | `bg-gray-300` | Trash | Admin removed |

### Tag Status Transitions (HYBRID 2 Model)

| From | To | Trigger |
|---|---|---|
| (new) | `inactive` | Tag created at fulfillment |
| `inactive` | `active` | Customer redeems/activates tag |
| `active` | `limited` | Active Period expires (no membership) |
| `limited` | `active` | Customer purchases membership |
| `active` | `lost` | Pet marked lost |
| `lost` | `active` | Pet marked found |
| `active` | `expired` | Warranty period expires |
| `limited` | `expired` | Warranty period expires |
| `active` | `terminated` | Pet marked terminal |
| `active` | `replaced` | Replacement tag activated |
| any | `deleted` | Admin soft-deletes tag |

### Tag Period Status (HYBRID 2)

When displaying tag status, also show the Active Period and Warranty Period status:

| Period | Status | Display |
|---|---|---|
| Active Period | Active | Green badge: "Active until [date]" |
| Active Period | Expiring soon (<30 days) | Amber badge: "Expires in [X] days" |
| Active Period | Expired | Red badge: "Expired [date]" |
| Warranty Period | Active | Green badge: "Warranty until [date]" |
| Warranty Period | Expiring soon (<30 days) | Amber badge: "Warranty expires in [X] days" |
| Warranty Period | Expired | Red badge: "Warranty expired [date]" |

### Finder Mode Status (HYBRID 2)

When a finder scans a tag, the response includes:

| Mode | Response | Finder Behavior |
|---|---|---|
| Active | `tagActive: true, tagLimited: false` | Full functionality, can notify owner |
| Limited | `tagActive: true, tagLimited: true` | Show pet info, cannot notify owner |
| Expired | `tagActive: false, tagLimited: false` | "Tag Expired" screen |

### Membership Tier Colors

Membership tier displays (badges, cards, progress indicators) must use these design tokens.

| Tier | Badge Classes | Card Background | Icon Color |
|---|---|---|---|
| **Gold** | `bg-yellow-100 text-yellow-700` | `bg-yellow-50` | `text-yellow-600` |
| **Platinum** | `bg-gray-100 text-gray-700` | `bg-gray-50` | `text-gray-600` |
| **Black** | `bg-gray-800 text-white` | `bg-gray-900` | `text-white` |

### Membership Upgrade-While-Cancelling Pattern (Option A)

When a member has scheduled cancellation (`cancelledAt` set, status still active) and opens `/account/membership/subscribe`:

| Element | Classes / Behavior |
|---------|-------------------|
| **Cancelling banner** | `mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl` |
| **Banner icon** | Lucide `AlertTriangle` `size={18} className="text-amber-600 shrink-0 mt-0.5"` |
| **Banner title** | `text-sm font-semibold text-amber-900` — "Your membership is scheduled to cancel" |
| **Banner body** | `text-sm text-amber-700` — benefits until date + upgrade will **resume** membership |
| **Estimate resume note** | Estimate panel includes resume sentence + `text-xs text-amber-700 mt-2 font-medium` confirmation line |
| **Success resume box** | `mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl` — "Membership resumed" / auto-renew on |
| **Payment method recovery** | On error `code=membership.payment_method_required`, red alert + `bg-red-600 text-white` "Update payment method" → Billing Portal |

Server contract:

- Estimate: `isCancelling`, `willResumeOnUpgrade`
- Change-tier success: `data.resumedOnUpgrade`
- Change-tier errors: `{ error, code }` with codes like `membership.payment_method_required`, `membership.subscription_missing`, `membership.subscription_not_active`

### Guardian Points Display

Guardian Points progress and balance displays must use these design tokens.

| Element | Classes | Usage |
|---|---|---|
| **Points earned** | `text-teal-600 font-semibold` | Points earned in current period |
| **Points balance** | `text-primary-600 font-bold text-lg` | Total points balance |
| **Points progress bar** | `bg-teal-500` | Progress toward next tier |
| **Points label** | `text-xs text-gray-500 uppercase tracking-wide` | "Guardian Points" label |
| **PawRewards balance** | `text-green-600 font-semibold` | Redeemable rewards balance |
| **PawRewards label** | `text-xs text-gray-500 uppercase tracking-wide` | "PawRewards" label |

**ARN display:** Always shown when available (bank reference for the refund). Customer and admin both see it.

**Order Progress Stepper:** Active/completed step dots use `bg-primary-500` / `border-primary-500`. Labels use `text-primary-600`. Progress bar fill uses `bg-primary-500`.

### Alerts

| Type | Classes |
|---|---|
| **Error** | `bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 p-4` |
| **Success** | `bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 p-4` |
| **Warning** | `bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 p-4` |
| **Info** | `bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 p-4` |

### Homepage Hero (Photography-Led Carousel)

CMS-managed (`hero_slide` sections) — three approved core-product stories; never statistics, testimonials, or prices. Implementation: `apps/web/src/components/hero/*`; spec: `docs/ux/HERO-SLIDER-IMPLEMENTATION.md`; image briefs: `docs/ux/HERO-IMAGE-CREATIVE-BRIEFS.md`.

| Element | Specification |
|---|---|
| Canvas | Full-bleed `bg-[#071f22]`; photography (or fallback gradient) covers the entire hero via an absolute `inset-0` media layer — no boxed image card |
| Height | Responsive `min-h`: 600px (<1024px), 620px (lg), 680px (xl); grid-shared across slides so height never shifts mid-carousel |
| Layout desktop (≥768px) | Left-anchored content (max `max-w-2xl`) inside the `max-w-7xl` site grid, vertically centered; media + scrim full-bleed behind |
| Layout mobile | Same full-bleed canvas; content anchored low (`justify-end`), clear of the bottom controls |
| Readability scrim | `HERO_SCRIM_CLASS` (`hero.types.ts`): mobile bottom-weighted `linear-gradient(to bottom, rgba(7,31,34,.45), rgba(7,31,34,.6) 50%, rgba(7,31,34,.95))`; desktop (≥768px) left-weighted `to right` from `.9` → `.05` so the subject on the right stays clear |
| Eyebrow | `text-xs font-semibold uppercase tracking-[0.2em] text-primary-300` |
| Headline | `text-3xl sm:text-4xl lg:text-5xl xl:text-[3.4rem] font-extrabold tracking-tight text-white leading-[1.1]` |
| Supporting text | `text-base sm:text-lg text-white/85 max-w-xl` |
| Primary CTA | `bg-primary-600 text-white px-7 py-3 rounded-xl font-semibold hover:bg-primary-700 min-h-[48px]` |
| Secondary CTA | `border border-white/70 text-white rounded-xl hover:bg-white/10 min-h-[48px]` |
| Media | `<picture>`: mobile crop `<source media="(max-width: 767px)">` when `mobileImageUrl` set, desktop `<img>` `object-cover` otherwise; per-breakpoint focal classes (`HERO_FOCAL_CLASSES` mobile / `HERO_FOCAL_DESKTOP_CLASSES` ≥768px); first slide eager + `fetchpriority=high` (LCP), later slides lazy |
| Fallback (no photo) | **Deep teal→charcoal gradient** `bg-gradient-to-br from-primary-900 via-gray-900 to-primary-800` (`HERO_FALLBACK_GRADIENT_CLASS`) filling the whole canvas — no paw watermark, no broken-image icons, no stock placeholders |
| Controls | Bar indicators (`h-1.5`, active `w-8 bg-white`, inactive `w-4 bg-white/50`) lower-left; pause/play + prev/next (`h-10 w-10 rounded-full border-white/40 bg-white/10 text-white`) lower-right on desktop, clustered left on mobile (clear of the emergency FAB); white focus rings |
| Motion | Crossfade `opacity` 600ms ease-out; instant under `prefers-reduced-motion` |
| Autoplay | 7s default; pauses on hover, focus-within, page hidden, reduced motion, and any manual interaction (resumable via control) |

---

## Motion & Interaction Specification

This app is often used in a stressful moment — someone's pet is missing. Motion should feel **quick and reassuring**, never sluggish, never playful in a way that trivializes a lost pet.

### Transition Durations

| Type | Duration | Easing | Usage |
|---|---|---|---|
| **Micro-interaction** | 150ms | ease-out | Button press feedback, toggle switch, checkbox |
| **Small UI feedback** | 200ms | ease-out | Tooltip appear, dropdown open, toast notification |
| **Screen transition** | 300ms | ease-in-out | Navigation between screens, modal open/close |
| **Page load** | 500ms | ease-out | Content fade-in on first load |

### Named Easing Curves

| Name | CSS | Usage |
|---|---|---|
| **ease-out** | `cubic-bezier(0.16, 1, 0.3, 1)` | Elements entering screen, toast notifications |
| **ease-in** | `cubic-bezier(0.7, 0, 0.84, 0)` | Elements leaving screen |
| **ease-in-out** | `cubic-bezier(0.65, 0, 0.35, 1)` | Screen transitions, modal presentation |
| **spring** | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy feedback (success checkmark, celebration) |

### Haptic Feedback

| Interaction | Haptic Type | When |
|---|---|---|
| **Tag scan success** | Light (`Haptics.ImpactFeedbackStyle.Light`) | QR/NFC tag successfully read |
| **Tag activation complete** | Medium (`Haptics.ImpactFeedbackStyle.Medium`) | Tag linked to pet |
| **Pet reunited** | Success (`Haptics.NotificationFeedbackType.Success`) | Lost pet confirmed found |
| **Mark pet as lost** | Warning (`Haptics.NotificationFeedbackType.Warning`) | Before confirming this significant action |
| **Delete / destructive** | Heavy (`Haptics.ImpactFeedbackStyle.Heavy`) | Before irreversible actions |
| **Button tap** | None | Standard buttons — no haptic on every tap |

### Existing Web Animations (to port to mobile)

| Name | Duration | Description |
|---|---|---|
| `fade-in` | 500ms ease-out | Content appears with 12px upward slide |
| `slide-up` | 300ms ease-out | Content appears with 16px upward slide |
| `slide-in-right` | 300ms ease-out | Content slides in from right edge |
| `pulse-once` | 2s ease-in-out × 3 | Subtle scale pulse (1 → 1.08 → 1) for attention |

### Scroll-Triggered Animations

Content below the fold fades/slides in when scrolled into view. This creates a progressive reveal that improves perceived quality and keeps users engaged.

**Component:** `<FadeIn>` from `@pawtag/ui` (uses native `IntersectionObserver`, zero extra dependencies)

| Section | Animation | Rationale |
|---------|-----------|-----------|
| HeroSlider | None (above fold) | Loads immediately |
| EngagementTicker | `direction="up"` | Counter starts only when visible |
| HowItWorks | `direction="up"` | Steps reveal as user scrolls |
| TrustSection | `direction="up"` | Trust badges reveal on scroll |
| ResponsibilityScore | `direction="left"` | Slides in from side for variety |
| Testimonials | `direction="up"` | Cards reveal on scroll |
| EmergencyLostPet | None (fixed FAB) | Always positioned, no scroll needed |

**Props:**
- `delay` (seconds) — offset before animation starts
- `direction` — `up` | `down` | `left` | `right` | `none`
- `duration` (seconds) — animation length (default: 0.6)
- `distance` (px) — travel distance (default: 24)
- `once` — animate only on first scroll-into-view (default: true)
- `stagger` — children animate in sequence with 100ms delay each

**Accessibility:** Respects `prefers-reduced-motion: reduce` — elements appear immediately without animation.

---

## States Catalog

Every screen in the app must use these shared patterns for loading, empty, error, and success states. This ensures consistency and prevents each screen from inventing its own handling.

### Loading State

**Skeleton screens** for content-heavy screens (pet list, order history, pet detail). A skeleton mirrors the shape of the content it replaces — rectangles for text lines, circles for avatars, with a subtle shimmer animation.

**Spinner** for quick actions under ~1 second (button press, form submission, tag scan).

**Pattern:**
- Skeleton: `bg-gray-200 rounded-lg animate-pulse` shaped to match content layout
- Spinner: centered `ActivityIndicator` (native) or rotating icon, with optional "Loading..." text

### Empty State

An icon/illustration + a friendly one-line message + a clear call-to-action button.

**Pattern:**
- Icon: 48px, `text-gray-300`
- Message: `text-gray-500 text-body` — warm, plain language. Never just "No data."
- CTA: Primary button linking to the relevant creation flow

**Examples:**
- No pets yet: "You haven't added any pets yet. Add your first pet to get started." + "Add a Pet" button
- No orders: "No orders yet. When you purchase a tag, it'll show up here."
- No notifications: "You're all caught up! No new notifications."

### Error State

A retry action + plain-language message. Never show raw error codes to the user.

**Pattern:**
- Icon: warning triangle, `text-red-400`
- Title: `text-gray-900 font-semibold` — "Something went wrong"
- Message: `text-gray-500 text-body-sm` — "We couldn't load your pets. Please try again."
- CTA: Secondary button "Try again" that retries the failed action

### Success / Confirmation State

Important actions deserve a genuine confirmation, not a generic toast. The "pet reunited" moment in particular should feel celebratory — this is the emotional peak of the entire product.

**Pattern:**
- Checkmark icon: animated, `text-green-500`, using the spring easing curve
- Title: `text-gray-900 font-semibold` — action-specific
- Message: `text-gray-500 text-body` — what happened and what to do next
- For "pet reunited": larger celebration with confetti-style animation, warm message, haptic feedback

---

## Logo

The PawTag logo is code-based — a **PawPrint icon** inside a **teal gradient rounded square**, followed by the text "PawTag" where "Tag" is in primary-600 color.

**Icon treatment:**
- Shape: `rounded-xl` (12px border-radius)
- Size: 36×36px (navbar), 32×32px (auth pages)
- Gradient: `from-teal-600 to-teal-700` (light mode), `from-teal-400 to-teal-500` (dark backgrounds)
- Icon: Lucide `PawPrint`, white, 20×20px

**Text treatment:**
- "Paw" — `text-gray-900 font-bold text-xl` (or `text-white` on dark backgrounds)
- "Tag" — `text-primary-600 font-bold text-xl` (or `text-primary-400` on dark backgrounds)

**No image logo files exist.** The logo is assembled from code. This is fine for web but the mobile app will need actual image assets for the app icon and splash screen (handled in Phase 25).

---

## Imagery & Photography Style

- **Pet photos:** Warm, well-lit, candid. Pets with their owners preferred. Avoid stock-photo perfection — real photos feel more authentic for a pet brand.
- **Icons:** Lucide icon set (already used in web apps). Consistent 20px/24px sizes, stroke-based.
- **Illustrations:** Minimal. If used, simple line-art style in teal/gray. Not cartoonish.
- **Empty state illustrations:** Simple, friendly line-art of a pet or paw print. Not sad or clinical.

---

## Tone of Voice

- **Plain language** over system language. "Your pet" not "Pet entity." "Mark as lost" not "Update pet status."
- **Warm and calm** — like a friend who happens to know what to do. Never cold or robotic.
- **Never cute at the expense of clarity** — especially in lost-pet flows. A worried owner needs clear instructions, not jokes.
- **Action-oriented** — tell the user what they can do next, not just what happened.
- **Reassuring** — "Your pet's tag is active and working" not just "Tag status: active."

---

## System Availability Components

### Maintenance Banner

A full-width, fixed-position banner displayed at the top of the page when the site is in Maintenance Mode.

**Design Rules:**
- **Position:** `fixed; top: 0; left: 0; right: 0; z-index: 50`
- **Height:** 10-15% of viewport height (minimum 80px)
- **Background:** `red-600` (`#dc2626`)
- **Text:** White (`#ffffff`)
- **Icon:** `AlertTriangle` from Lucide, `red-200` color
- **Animation:** Slow dissolve pulse — opacity cycles between 1 and 0.7 over 3 seconds, infinite
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` — static, no animation
- **Non-dismissible:** No close button, no dismiss action, no localStorage/sessionStorage
- **Content:** Title and message from CMS settings (`site.maintenanceTitle`, `site.maintenanceMessage`)
- **Responsive:** Full-width on all screen sizes, text size adapts

**Body Offset:** When the maintenance banner is visible, add `padding-top: 80px` to `body.has-maintenance-banner` to prevent content from being hidden behind the banner.

### System Offline Page

A full-page branded experience displayed when the site is in Offline Mode.

**Design Rules:**
- **Layout:** Centered content, full viewport height
- **Background:** `gray-50` (`#f9fafb`)
- **Icon:** PawPrint (Lucide), 40px, `primary-600` color, inside a `primary-100` circle (80px diameter)
- **Title:** `h2` (24px, bold, `gray-900`)
- **Message:** `body-lg` (18px, regular, `gray-600`)
- **Footer:** `caption` (12px, `gray-400`) — "PawTag — Reuniting lost pets with their families"
- **No Navbar/Footer:** The offline page replaces the entire normal application chrome
- **Content from CMS:** Title and message from `site.offlineTitle`, `site.offlineMessage`

### Status Badge Usage

Use the existing `StatusBadge` component from `@pawtag/ui` to display the current availability state:

| State | Variant | Label |
|-------|---------|-------|
| Online | `success` | ONLINE |
| Maintenance | `warning` | MAINTENANCE |
| Offline | `danger` | OFFLINE |

---

## Admin Portal Design System

The PawTag Admin Portal uses a **modern enterprise SaaS administration pattern** while retaining PawTag's warm, trustworthy brand identity.

The approved direction combines:
- A **dark PawTag teal sidebar** for strong navigation hierarchy and brand recognition.
- A **clean white/light-gray workspace** for high-density administrative content.
- A **persistent top utility bar** containing global search and the authenticated administrator.
- **Breadcrumb navigation** above page content.
- **Hierarchical navigation** supporting parent items, children, and deeper sub-children.
- Restrained use of **semantic/icon colors** to improve scanability without making the UI playful.
- Clear active states, generous spacing, and predictable interaction patterns.

The admin portal should feel comparable to a high-quality modern enterprise SaaS product, not a generic template or a consumer dashboard.

### Admin Visual Principles

1. **Navigation is dark; workspace is light.**
   - Sidebar: deep PawTag teal.
   - Main workspace: `gray-50` / white.
   - Cards: white with subtle borders and restrained shadows.

2. **PawTag teal remains the primary action color.**
   - Primary buttons, active navigation, focus states, links and important indicators use the existing `primary-*` tokens.
   - Do not introduce a new brand color.

3. **Use color to communicate meaning, not decoration.**
   - Navigation icons may use restrained semantic colors where useful.
   - Avoid rainbow-colored navigation.
   - Icon color should reinforce category recognition while text remains neutral/white.

### Membership Entitlements Table

The Membership Entitlements page (`/membership/entitlements`) uses a spreadsheet-like grid pattern:

**Layout:**
- Full-width table with category grouping rows
- Benefit name + description in left column
- Tier value cells (Gold, Platinum, Black) in center columns
- Type badge and actions in right columns

**Cell interactions:**
- Boolean cells: toggle button with `bg-green-100 text-green-600` (enabled) / `bg-gray-100 text-gray-400` (disabled)
- Number cells: inline edit on click, input with `focus:ring-2 focus:ring-primary-500`
- Saving state: `Loader2` spinner with `text-primary-600 animate-spin`

**Category grouping:**
- Category header row: `bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider`
- Categories: Shipping, Loyalty, Notifications, Exclusive, Recovery, Health, General

**Design tokens:**
| Element | Classes |
|---------|---------|
| Table header | `bg-gray-50 border-b border-gray-200` |
| Row hover | `hover:bg-gray-50/50` |
| Category row | `bg-gray-100 px-4 py-2` |
| Benefit name | `font-medium text-gray-900` |
| Benefit description | `text-xs text-gray-400 mt-0.5` |
| Toggle (on) | `bg-green-100 text-green-600 hover:bg-green-200 rounded-lg` |
| Toggle (off) | `bg-gray-100 text-gray-400 hover:bg-gray-200 rounded-lg` |
| Number edit button | `bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg min-w-[60px]` |
| Type badge | `text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500` |
| Delete button | `text-red-400 hover:text-red-600` |

4. **Information hierarchy must be obvious.**
   - Brand → navigation → breadcrumb → page title → actions → content.
   - Avoid visually competing elements.

5. **Enterprise density without visual clutter.**
   - Admin screens may be denser than customer-facing screens.
   - Keep controls aligned, labels readable, and groups clearly separated.
   - Prefer whitespace and hierarchy over heavy borders.

6. **No unnecessary visual effects.**
   - Avoid excessive gradients, glassmorphism, oversized shadows, decorative blobs, or playful animations.
   - Motion should communicate state and improve usability.

---

### Admin Application Shell

The desktop shell follows this structure:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  SIDEBAR       │  Search anything...              🔔  Admin User  ▾      │
│                ├──────────────────────────────────────────────────────────┤
│  PawTag        │  Home > Settings > Loyalty > Guardian Settings          │
│  Admin Portal  │                                                          │
│                │  Guardian Settings                    [Back] [Save]     │
│  Dashboard     │                                                          │
│  Commerce   ▾  │  ┌───────────────────────────────────────────────────┐   │
│  Customers  ▾  │  │ Points Earning                                    │   │
│  Loyalty    ▾  │  │                                                   │   │
│  Products   ▾  │  │ Form controls / configuration                     │   │
│  Orders     ▾  │  └───────────────────────────────────────────────────┘   │
│  Payments   ▾  │                                                          │
│  Marketing  ▾  │  ┌───────────────────────────────────────────────────┐   │
│  Reports    ▾  │  │ Review Points                                     │   │
│  Settings   ▾  │  │                                                   │   │
│                │  │ Form controls / configuration                     │   │
│  SYSTEM        │  └───────────────────────────────────────────────────┘   │
│  Integrations  │                                                          │
│  Notifications │                                                          │
│  Audit Logs    │                                                          │
│                │                                                          │
│  Guardian      │                                                          │
│  Rewards       │                                                          │
│                │                                                          │
│  Admin User ▾  │                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Sidebar Navigation

The sidebar is the primary navigation structure for the admin portal.

#### Sidebar Dimensions

| Element | Specification |
|---|---|
| Desktop expanded width | `272px` |
| Desktop collapsed width | `72px` |
| Minimum content height | `100vh` |
| Position | Fixed/sticky left navigation |
| Background | Deep PawTag teal using `gray-900` / `primary-900`-inspired treatment |
| Right border | Subtle `rgba(255,255,255,0.08)` |
| Logo area height | Approximately `72px` |
| Navigation item height | `40–44px` |
| Parent item radius | `rounded-lg` |
| Active item radius | `rounded-lg` |
| Horizontal item padding | `12px` |
| Navigation gap | `4px` |
| Main section gap | `16–24px` |

The sidebar should visually resemble the approved PawTag admin direction: dark, premium, compact, highly legible and clearly branded.

#### Sidebar Background

Use a deep teal treatment rather than plain black.

Preferred visual hierarchy:
- Base: `primary-900` / `gray-900`-inspired deep teal.
- Slightly lighter hover surface.
- Active surface: `primary-700` or a controlled teal gradient.
- Active indicator: `primary-400` or a subtle left/inside accent.
- Sidebar text: white / `gray-100`.
- Secondary text: `gray-300`.
- Muted text: `gray-400`.

Do not use a saturated bright teal background for the entire sidebar.

#### PawTag Sidebar Branding

At the top of the sidebar:

- PawPrint logo icon inside a rounded teal/green brand treatment.
- "PawTag" wordmark.
- "Admin Portal" as small secondary text.
- Collapse/expand control aligned to the top-right.
- Logo follows the shared Logo specification in this document.

On the dark sidebar:
- PawPrint icon: white.
- Logo text: white for "Paw", `primary-300`/`primary-400` for "Tag" where contrast remains strong.
- "Admin Portal": `gray-400`.

---

### Sidebar Navigation Hierarchy

The navigation MUST support:

- Top-level parent items.
- Child items.
- Sub-child items.
- Additional nesting only when genuinely required.

Example:

```text
Commerce
  ├─ Overview
  ├─ Products
  │   ├─ All Products
  │   ├─ Categories
  │   ├─ Collections
  │   └─ Brands
  ├─ Orders & Fulfilment
  │   ├─ Orders
  │   ├─ Shipments
  │   └─ Returns
  └─ Suppliers
      ├─ Supplier List
      ├─ Product Sources
      └─ Integrations
```

#### Hierarchy Rules

- Parent items use a clear chevron:
  - `ChevronRight` when collapsed.
  - `ChevronDown` when expanded.
- Child items are visually indented.
- Sub-child items receive a second indentation level.
- Never rely on indentation alone; maintain clear typography and connector/spacing cues.
- A parent remains visually distinguishable from its children.
- Active child/sub-child navigation automatically expands all required ancestor levels.
- The current page is always visibly identifiable.
- Do not make every navigation item look like a primary button.

#### Indentation

Recommended:
- Parent: `pl-3`
- Child: `pl-10`
- Sub-child: `pl-16`

Use a subtle vertical hierarchy line for deeply nested navigation where it improves scanning.

#### Parent Navigation Behavior

A parent item with children should support:
- Clicking the label/icon to navigate when the parent itself has a destination.
- Clicking the chevron to expand/collapse.
- If the parent is purely a grouping item, clicking the parent row expands/collapses it.
- Keyboard users must be able to expand/collapse parents.
- Expansion state must be accessible via ARIA attributes.

Avoid forcing users to click tiny chevrons only.

---

### Sidebar Navigation Groups

Navigation should be organized into logical enterprise groups.

The exact items may evolve with the application, but the visual grouping pattern should remain consistent.

Recommended structure:

| Group | Example Items |
|---|---|
| **Overview** | Dashboard, Commerce Reports |
| **Commerce** | Products, Categories, Collections, Brands, Orders & Fulfilment, Suppliers |
| **Customers** | Customers, Pets, Guardian & Loyalty |
| **Payments & Finance** | Transactions, Refunds, Reconciliation, Accounting |
| **Marketing** | Referrals, Promotions, Campaigns |
| **Reports & Analytics** | Commerce Reports, Customer Analytics, Loyalty Analytics |
| **System** | Integrations, Notifications, Audit Logs, System Logs |
| **Settings** | General, Users & Permissions, Feature Flags, Site Settings |

Do not create a new group merely to contain one item unless there is a strong information-architecture reason.

The implementation must remain permission-aware: navigation items the current administrator cannot access should not be displayed.

---

### Sidebar Active State

The active navigation item is one of the most important visual signals.

#### Active Parent

When the current page belongs to a parent group:
- Parent background: subtle `primary-700` / teal surface.
- Text: white.
- Icon: white or a restrained semantic icon color.
- Chevron: `gray-200`.
- Parent remains expanded.

#### Active Child / Sub-child

- Background: `primary-600` with controlled opacity/surface treatment.
- Text: white.
- Icon: `primary-200` or white.
- Font weight: `font-semibold`.
- Radius: `rounded-lg`.

The active state should be unmistakable without looking like a large bright button.

#### Hover

- Background: white at approximately 5–8% opacity or equivalent dark-sidebar hover surface.
- Text: white.
- Icon: white / semantic icon color.
- Transition: `150–200ms ease-out`.

---

### Sidebar Icons

Use the shared Lucide icon system wherever possible.

Preferred icon characteristics:
- Stroke-based.
- 18–20px for navigation.
- 20–22px for important group headers.
- Consistent stroke width.
- Clear silhouettes at small sizes.

The existing `IconPicker` / `ICON_MAP` from `@pawtag/ui` remains the source for configurable icons.

#### Icon Color Strategy

Colored icons are allowed and encouraged **in moderation**.

Use a consistent category color, not arbitrary colors per item.

Suggested semantic/category mapping:

| Category | Icon Color |
|---|---|
| Commerce | `text-primary-300` / `text-teal-300` |
| Customers | `text-blue-300` |
| Loyalty & Guardian | `text-yellow-300` / Gold |
| Products | `text-purple-300` |
| Orders & Fulfilment | `text-orange-300` |
| Payments & Finance | `text-green-300` |
| Marketing | `text-pink-300` |
| Reports & Analytics | `text-cyan-300` |
| Security / Audit | `text-red-300` |
| System / Integrations | `text-gray-300` |
| Settings | `text-gray-300` |

These are **navigation icon accents**, not replacements for the existing semantic status colors.

Rules:
- Keep text primarily white/gray.
- Use color on icons to improve recognition.
- Active items may switch to white icons for stronger contrast.
- Do not use more than one strong accent color inside a single navigation item.
- Never use color as the only indication of state.

---

### Special Sidebar Feature Card

The approved design includes a small contextual feature card near the lower portion of the navigation, for example:

**Guardian Rewards**  
Manage points, tiers & rewards

Design:
- Dark/teal translucent surface.
- `primary-500` / `primary-400` border accent.
- Paw/Guardian icon in a circular or rounded container.
- White title.
- Small muted description.
- Chevron on the right.
- `rounded-xl`.
- Subtle hover elevation.

This is a **contextual shortcut**, not a replacement for normal navigation.

It should only appear if the feature exists and the administrator has permission to access it.

---

### Sidebar Footer / User Area

The authenticated administrator is shown at the bottom of the sidebar.

Recommended layout:

```text
┌──────────────────────────────┐
│  [Avatar]  Admin User     ▾  │
│            Administrator      │
└──────────────────────────────┘
```

Rules:
- Avatar: `36–40px`, `rounded-full`.
- Optional online/status indicator.
- Name: white, semibold.
- Role: `gray-400`, `caption`.
- Chevron: `gray-400`.
- Clicking opens the administrator account menu.
- Account menu may contain Profile, Preferences, Security and Logout as applicable.
- Never expose permissions or security-sensitive information directly in the navigation unless needed.

---

### Sidebar Collapse / Expand

Desktop sidebar supports expanded and collapsed modes.

#### Expanded

- Width: `272px`.
- Logo and labels visible.
- Hierarchical navigation fully readable.
- Feature card visible where appropriate.
- User details visible.

#### Collapsed

- Width: `72px`.
- Icons remain visible.
- Text labels hidden.
- Tooltips show navigation labels on hover/focus.
- Parent expansion may use a flyout/popup navigation panel when children exist.
- The active item remains clearly visible.
- The PawTag logo collapses to the PawPrint mark.

Do not simply hide child navigation when collapsed; users must still be able to reach every permitted route.

#### Persistence

Persist preference using:

`localStorage` key: `pawtag-admin-sidebar-collapsed`

The preference is user/device UI state and must not affect authorization.

---

### Sidebar Responsive Behavior

#### Desktop

Use the full sidebar pattern.

#### Tablet

- Sidebar may start collapsed.
- Allow explicit expansion.
- Maintain full navigation hierarchy.

#### Mobile

Do not force the desktop sidebar into a narrow unusable column.

Use:
- Off-canvas drawer.
- Full navigation hierarchy inside drawer.
- Overlay backdrop.
- Close control.
- Current route remains visible.
- Drawer closes after navigation where appropriate.

The top utility bar remains available.

---

## Admin Top Utility Bar

The main workspace has a clean top utility bar separate from the sidebar.

### Layout

Recommended:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  [Search anything...      ⌘ K]                 🔔   [Avatar] User ▾ │
└─────────────────────────────────────────────────────────────────────┘
```

### Search

Global admin search should:
- Be visually prominent but not oversized.
- Use a subtle `gray-50` / `gray-100` surface.
- Have a search icon.
- Support keyboard shortcut indication where implemented.
- Use `rounded-lg` or `rounded-xl`.
- Have clear focus state using `primary-500`.
- Remain compact enough to leave room for administrator controls.

Example:

`Search anything...`

Do not implement fake search functionality purely for visual purposes. If search is not yet implemented, the UI must not imply functionality that does not exist.

### Notifications

- Bell icon.
- Small unread badge when applicable.
- Use `red-500`/`red-600` only for actual unread notification count.
- Tooltip/accessibility label required.
- Clicking opens the notification surface.

### Administrator Controls

Top-right:
- Avatar.
- Name.
- Role/title.
- Chevron.
- Account menu.

The top-right administrator identity is always clearly separated from application navigation.

---

## Admin Breadcrumbs

Breadcrumbs are displayed above the page title.

Example:

```text
Home  >  Settings  >  Loyalty & Guardian  >  Guardian Settings
```

### Breadcrumb Rules

- Start with a Home icon where appropriate.
- Use `ChevronRight` as separator.
- Previous levels: `text-gray-500`.
- Current page: `text-gray-700` / `font-medium`.
- Links use `primary-600` on hover.
- Keep breadcrumbs compact.
- Do not repeat the exact page title unnecessarily if the breadcrumb would become redundant on small screens.
- Long breadcrumb chains may collapse intermediate levels responsively.

Breadcrumbs should reflect the actual route/information architecture, not manually hard-coded decorative text.

---

## Admin Page Header

The standard page header follows breadcrumbs.

```text
[Optional page icon]  Guardian Settings
                      Configure Guardian loyalty program settings

                                  [Back to Dashboard] [Save Settings]
```

### Rules

- Page title uses `h1`.
- Supporting description uses `body`/`body-sm`.
- Page actions align right on desktop.
- On smaller screens actions may wrap below the title.
- Primary action uses the shared Primary Button.
- Secondary action uses the shared Secondary Button.
- Do not create unique button styling for individual admin pages.

### Page Icon

An optional contextual icon may appear beside the title.

Recommended:
- 40–48px rounded container.
- `primary-50` / `primary-100` background.
- `primary-600` icon.
- Use a relevant Lucide icon.
- Keep icon treatment consistent across pages.

---

## Admin Content Workspace

### Page Background

Use:
- `gray-50` as the overall workspace background.
- White content surfaces.
- Subtle `gray-100` / `gray-200` borders.

Avoid pure white across the entire screen because it weakens hierarchy.

### Content Width

Use a responsive max-width appropriate to the screen.

Recommended:
- Full-width for data-heavy tables and dashboards.
- `max-w-7xl` or equivalent for standard configuration pages.
- Avoid excessively narrow enterprise settings pages.

### Cards

Admin cards use a refined version of the shared card system:

```text
bg-white
rounded-2xl
border border-gray-100
shadow-sm
```

Hover shadows should only be used for genuinely interactive cards.

Static configuration cards should not jump/elevate merely because the cursor passes over them.

### Card Header

Recommended:

```text
[Icon]  Points Earning
        Formula: (Order Total ÷ Spent Amount) × Rate = Points Earned
```

Rules:
- Heading: `h3`.
- Description/helper: `body-sm`, `gray-500`.
- Optional icon container: `primary-50` / `primary-100`.
- Divider only when it improves grouping.
- Avoid excessive card headers.

---

## Admin Forms

Use the shared Form Input patterns defined earlier in this document, with the following admin refinements:

- Input height should feel consistent across the admin portal.
- Labels remain clearly above fields.
- Helper text is concise.
- Related controls should be grouped in a grid.
- Use 2-column layouts on desktop where appropriate.
- Collapse to 1 column on smaller screens.
- Keep labels and helper text aligned.
- Do not put unrelated settings into the same visual group.

### Form Density

Admin forms may use slightly tighter spacing than customer forms:

- Field-to-field: approximately `16–24px`.
- Section-to-section: `24–32px`.
- Card padding: `24px`.
- Label-to-input: `6–8px`.

Do not reduce spacing so far that fields become difficult to scan.

---

## Admin Tables

For data-heavy screens:

- Sticky table headers where useful.
- Clear column alignment.
- Compact but readable rows.
- Zebra striping is optional and should not be the default.
- Prefer subtle borders over heavy grid lines.
- Use status badges from the shared design tokens.
- Row hover should be subtle.
- Bulk actions should appear only when rows are selected.
- Pagination and page-size controls should be predictable and consistent.

Never use color alone to communicate row status.

---

## Admin Navigation States

Every navigation item must support:

| State | Behavior |
|---|---|
| Default | White/gray text on dark sidebar |
| Hover | Subtle lighter surface + white text |
| Focus | Visible primary focus ring |
| Active | Teal active surface + strong contrast |
| Expanded parent | Chevron down + children visible |
| Disabled | Reduced opacity + no pointer interaction |
| Permission hidden | Not rendered at all |

Disabled and permission-hidden are different:
- **Disabled** means the item exists but cannot currently be used.
- **Permission hidden** means the user should not see the item at all.

---

## Admin Motion

Use the existing Motion & Interaction Specification.

Additional sidebar-specific rules:
- Expand/collapse: `200ms ease-out`.
- Active route transition: immediate or `150ms` subtle transition.
- Mobile drawer: `250–300ms ease-in-out`.
- Flyout submenu: `150–200ms ease-out`.
- Never animate every navigation label independently.
- Respect `prefers-reduced-motion`.

---

## Admin Accessibility

The enterprise admin portal must be keyboard and screen-reader usable.

Required:
- Visible focus states.
- Correct semantic navigation landmarks.
- `aria-expanded` for expandable parents.
- `aria-current="page"` for the active route.
- Tooltips for collapsed icon-only navigation.
- Keyboard navigation for menus and nested navigation.
- Sufficient color contrast.
- Do not depend on icon color alone.
- Touch targets should remain usable on tablet/mobile.
- Escape closes open menus/drawers where appropriate.

---

## Admin Dark / Light Theme

The **approved default admin appearance is the dark sidebar + light workspace shown in the final PawTag admin direction**.

This is distinct from making the entire admin application dark.

### Default

- Sidebar: dark PawTag teal.
- Workspace: light.
- Cards: white.
- Top bar: white.
- Inputs: white.
- Text: gray/near-black.

### Full Dark Mode

If full admin dark mode is implemented later, it must be treated as a deliberate extension of this design system and must define tokens for:
- Workspace background.
- Card background.
- Borders.
- Inputs.
- Text hierarchy.
- Sidebar.
- Tables.
- Modals.
- Dropdowns.

Do not partially implement dark mode with isolated `dark:` classes.

---

## Admin Design Anti-Patterns

Do NOT introduce:

- Generic template-dashboard appearance.
- Bright white sidebar.
- Black sidebar with no PawTag identity.
- Excessive neon colors.
- Rainbow navigation.
- Huge navigation icons.
- Oversized sidebar width.
- Nested navigation that visually looks identical at every level.
- Tiny unreadable labels.
- Breadcrumbs that are decorative but not route-aware.
- Fake search or notification functionality.
- Excessive gradients.
- Excessive glassmorphism.
- Excessive rounded cards.
- Heavy drop shadows on every component.
- Large animated navigation transitions.
- Different sidebar styles between admin sections.
- Hard-coded business colors outside the design tokens.

The admin portal should feel **premium, calm, fast, structured and trustworthy**.

---

## Scan Analytics Dashboard

The Scan Analytics dashboard follows the standard admin dashboard pattern.

### Design Tokens

| Element | Token/Class |
|---------|-------------|
| Page background | `bg-gray-50` |
| Card | `bg-white rounded-2xl shadow-sm border border-gray-100 p-6` |
| Card header | `h3` (text-lg font-semibold text-gray-900) |
| Stat value | `text-3xl font-bold text-gray-900` |
| Stat label | `text-sm text-gray-500` |
| Bar chart bar | `bg-primary-500` |
| Bar chart background | `bg-gray-100` |
| Clickable card hover | `hover:border-primary-200 hover:shadow-md transition-all duration-300` |
| Primary button | `bg-primary-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-primary-700` |
| Date range picker | `border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500` |
| Tab active | `border-b-2 border-primary-600 text-primary-700` |
| Tab inactive | `border-b-2 border-transparent text-gray-500 hover:text-gray-700` |

### Layout

The dashboard consists of:
- Header with title and date range picker
- Summary cards (total scans, period scans, unique tags/pets)
- Horizontal bar charts (device type, browser, OS, action)
- Top scanned tags and pets (clickable)
- Recent scans feed

### Charts

No external chart library is used. Horizontal bar charts are built with `div` elements:
- Bar color: `bg-primary-500`
- Bar background: `bg-gray-100`
- Labels: `text-sm text-gray-600`
- Values: `text-sm font-medium text-gray-900`

---

## Admin Reference Layout

The approved visual direction is:

```text
DARK PAWTAG SIDEBAR
    ↓
Brand
    ↓
Parent navigation
    ↓
Child navigation
    ↓
Sub-child navigation
    ↓
System links
    ↓
Contextual Guardian shortcut
    ↓
Administrator profile

LIGHT ADMIN WORKSPACE
    ↓
Top utility bar
    ↓
Breadcrumbs
    ↓
Page title + description + actions
    ↓
White configuration/data cards
    ↓
Clear forms / tables / reports
```

This structure is the authoritative visual direction for future PawTag Admin Portal UI work.

## Findings — Web App Inconsistencies

The following inconsistencies exist between the four web apps. These are documented here for a future deliberate decision — they were NOT fixed in this phase to avoid an unplanned redesign of working apps.

1. **`teal-*` vs `primary-*` usage:** `apps/web` uses hardcoded `teal-600` in most places while also defining a `primary` scale. The other three apps use `primary-*` consistently. **Recommendation:** Migrate `apps/web` to use `primary-*` tokens exclusively in a future cleanup pass.

2. **Border-radius inconsistency:** Login cards use `rounded-2xl` in web but `rounded-lg` in customer/admin. Product cards use `rounded-2xl` but admin dashboard cards use `rounded-lg`. **Recommendation:** Standardize on `rounded-xl` for buttons, `rounded-2xl` for cards.

3. **Dark mode configured in admin only** (`darkMode: 'class'`) but no `dark:` classes are actually used. **Recommendation:** Either implement dark mode properly or remove the config to avoid confusion.

4. **Custom animations in web only:** `animate-fade-in`, `animate-slide-up`, `animate-pulse-once`, `animate-slide-in-right` exist only in `apps/web/src/index.css`. **Recommendation:** Move to a shared CSS file or, for mobile, implement natively with the motion spec above.

5. **Missing assets:** `SeoHead` references `/og-image.png` and `site.logo` setting, but no image files exist. **Recommendation:** Create brand assets before public launch.

---

## Email Design System

All PawTag emails must use consistent design tokens defined here. These tokens are the single source of truth for email styling.

### Email Layout

| Token | Value | Usage |
|-------|-------|-------|
| `email.contentWidth` | `600px` | Standard email container max-width |
| `email.invoiceWidth` | `800px` | Invoice email container max-width |
| `email.outerPadding` | `32px 16px` | Outer email centering padding |
| `email.bodyPadding` | `40px` | Main content cell padding |
| `email.mobilePadding` | `24px` | Mobile override (< 600px) |

### Email Color Themes

| Theme | Header Gradient | Body Accent | Use Case |
|-------|----------------|-------------|----------|
| `default` | `#0d9488` → `#0f766e` | `#f0fdfa` | Standard transactional emails |
| `warning` | `#f59e0b` → `#d97706` | `#fffbeb` | Expiry warnings, grace period, tier downgrade |
| `danger` | `#dc2626` → `#ef4444` | `#fef2f2` | Emergency escalation, payment failures |
| `success` | `#10b981` → `#059669` | `#f0fdf4` | Payment success, refund settled |

### Email Typography

| Token | Value | Usage |
|-------|-------|-------|
| `email.fontFamily` | `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` | Body font |
| `email.monoFont` | `'Courier New', Courier, monospace` | OTP codes, tag IDs, order numbers |
| `email.headingSize` | `22px` | Email heading (logo area) |
| `email.bodySize` | `16px` | Primary body text |
| `email.bodySizeAlt` | `15px` | Alternative body text (Guardian templates) |
| `email.captionSize` | `14px` | Secondary text, descriptions |
| `email.labelSize` | `13px` | Labels, meta information |
| `email.smallSize` | `12px` | Uppercase labels, timestamps, footer |
| `email.tinySize` | `11px` | Uppercase meta headers |
| `email.bodyLineHeight` | `1.6` | Standard body line-height |
| `email.bodyColor` | `#374151` | Primary body text color |
| `email.mutedColor` | `#6b7280` | Secondary/muted text |
| `email.subtleColor` | `#9ca3af` | Tertiary/subtle text |

### Email Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `email.spacing.xs` | `4px` | Tightest gap |
| `email.spacing.sm` | `8px` | Compact gap |
| `email.spacing.md` | `16px` | Standard gap |
| `email.spacing.lg` | `24px` | Major gap, CTA margin |
| `email.spacing.xl` | `32px` | Large gap, header/footer padding |
| `email.spacing.xxl` | `40px` | Content cell padding |

### Email Borders

| Token | Value | Usage |
|-------|-------|-------|
| `email.border.standard` | `1px solid #e5e7eb` | Standard borders |
| `email.border.radius` | `8px` | Cards, info boxes, buttons |
| `email.border.radiusLg` | `12px` | OTP containers, header/footer corners |
| `email.border.radiusPill` | `20px` | Status badges |
| `email.border.dashed` | `2px dashed #0d9488` | OTP code display |

### Email Components

| Component | Key Styles |
|-----------|-----------|
| **CTA Button** | `bg: #0d9488, color: white, padding: 14px 40px (on <td>, not <a>), border-radius: 10px, font-size: 16px, font-weight: 600, letter-spacing: 0.3px` |
| **Info Box** | `bg: #f0fdfa, border: 1px solid #ccfbf1, border-radius: 8px, padding: 16px 20px` |
| **Divider** | `border-top: 1px solid #e5e7eb, margin: 24px 0` |
| **OTP Display** | `bg: #f0fdfa, border: 2px dashed #0d9488, border-radius: 12px, padding: 32px, code: 42px/800/letter-spacing: 10px` |
| **Data Table** | `header: bg #f9fafb, border-bottom: 2px solid #e5e7eb, body: border-bottom: 1px solid #f3f4f6` |
| **Status Badge** | `border-radius: 20px, padding: 4px 14px, font-size: 12px, font-weight: 700, uppercase, letter-spacing: 0.5px` |
| **Uppercase Label** | `color: #6b7280, font-size: 12px, text-transform: uppercase, letter-spacing: 0.5px` |

### Email Card Variants

| Variant | Background | Border | Use Case |
|---------|-----------|--------|----------|
| Info | `#f0fdfa` | `1px solid #ccfbf1` | Informational callouts |
| Warning | `#fffbeb` | `1px solid #fcd34d` | Expiry warnings, grace period |
| Danger | `#fee2e2` | `1px solid #fca5a5` | Errors, failures |
| Success | `#dcfce7` | `1px solid #86efac` | Completion, settlement |
| Processing | `#dbeafe` | `1px solid #93c5fd` | Pending, in-progress |

### Email Gradients

| Gradient | Value | Usage |
|----------|-------|-------|
| Header default | `linear-gradient(135deg, #0d9488, #0f766e)` | Standard email header |
| Header warning | `linear-gradient(135deg, #f59e0b, #d97706)` | Warning email header |
| Header danger | `linear-gradient(135deg, #dc2626, #ef4444)` | Emergency email header |
| Header success | `linear-gradient(135deg, #10b981, #059669)` | Success email header |

### Email Responsive Breakpoint

| Token | Value | Usage |
|-------|-------|-------|
| `email.breakpoint` | `600px` | Mobile breakpoint for responsive email |

**Media query:**
```css
@media only screen and (max-width: 600px) {
  .email-container { width: 100% !important; padding: 16px !important; }
  .content-cell { padding: 24px !important; }
}
```

### New Email Templates (Gold/Subscription)

The following email templates were added for Gold membership and subscription management:

| Template | Theme | Purpose |
|----------|-------|---------|
| `subscription-plan-changed.ts` | `default` (teal) | Plan change confirmation (annual ↔ monthly) |
| `gold-cancellation.ts` | `warning` (amber) | Gold-specific cancellation with benefits list |
| `subscription-resumed.ts` | `success` (green) | Auto-renew resume confirmation |

**Design patterns:**
- All templates use `renderBase()` with appropriate theme
- Plan change: Shows old → new plan with pricing table
- Gold cancellation: Lists lost benefits, includes resubscribe CTA
- Resume: Shows resumed date and next billing date

---

## Background Jobs Dashboard

The Background Jobs page follows the standard admin dashboard pattern with a focus on operational monitoring.

### Design Tokens

| Element | Token/Class |
|---------|-------------|
| Page background | `bg-gray-50` |
| Stat card | `bg-white rounded-2xl shadow-sm border border-gray-100 p-4` |
| Stat label | `text-xs text-gray-400 font-medium uppercase tracking-wide` |
| Stat value | `text-2xl font-bold text-gray-900` |
| Table container | `bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden` |
| Table header | `bg-gray-50 border-b border-gray-100` |
| Table header text | `px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide` |
| Table row hover | `hover:bg-gray-50` |
| Table row divider | `divide-y divide-gray-100` |
| Filter button (active) | `bg-primary-600 text-white rounded-lg` |
| Filter button (inactive) | `bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg` |
| Icon button | `p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-150` |
| Error alert | `bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700` |

### Status Badges

| Status | Badge Classes |
|--------|--------------|
| idle (enabled) | `bg-green-100 text-green-700` |
| running | `bg-blue-100 text-blue-700` |
| error | `bg-red-100 text-red-700` |
| disabled | `bg-gray-100 text-gray-600` |

### Category Badges

| Category | Badge Classes |
|----------|--------------|
| financial | `bg-red-50 text-red-700` |
| notification | `bg-blue-50 text-blue-700` |
| maintenance | `bg-gray-100 text-gray-600` |
| reconciliation | `bg-purple-50 text-purple-700` |
| compliance | `bg-amber-50 text-amber-700` |

### Edit Modal

Follows the standard ConfirmDialog pattern:
- Backdrop: `fixed inset-0 z-50 flex items-center justify-center bg-black/40`
- Card: `relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 mx-4 max-h-[90vh] flex flex-col`
- Close button: Lucide `<X size={18} />` with `text-gray-400 hover:text-gray-600 transition-colors`
- Form inputs: `w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500`
- Footer: `flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100`
- Cancel button: `px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50`
- Save button: `px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50`

### Notification Settings

Global notification settings appear at the bottom of the Background Jobs page:
- Master toggle for all job notifications
- Default notify-on-success (off) and notify-on-failure (on)
- Email recipient field (falls back to ADMIN_ALERT_EMAIL env var)
- Per-job overrides configurable in the edit modal

---

## Membership Downgrade Consent Pattern

When a customer requests a downgrade (e.g. Platinum → Gold), the UI must show exact consequences and require explicit consent before proceeding.

### Estimate Panel (Amber variant)

Used on `/account/membership/subscribe` when an existing member selects a lower tier.

| Element | Classes / Behavior |
|---------|-------------------|
| **Container** | `mb-6 rounded-2xl border-2 p-6 bg-amber-50 border-amber-300` |
| **Header icon** | Lucide `Info` `size={20} className="text-amber-600 shrink-0 mt-0.5"` |
| **Title** | `font-semibold text-gray-900 mb-1` — "Downgrade to {tier}" |
| **Cost breakdown** | `bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-2` |
| **Points at risk box** | `bg-red-50 border border-red-200 rounded-xl p-4` |
| **Points risk icon** | Lucide `AlertTriangle` `size={16} className="text-red-600"` |
| **Points risk label** | `text-sm font-semibold text-red-800` — "Points at Risk" |
| **Points risk body** | `text-sm text-red-700` — "You will lose {N} Guardian points..." |
| **Entitlements list** | `bg-white rounded-xl border border-gray-200 p-4` |
| **Entitlement row** | `flex items-center justify-between text-sm` — name left, value change right |
| **Entitlement value** | `text-red-600 font-medium` — "oldValue → newValue" |
| **Effective date box** | `bg-amber-50 border border-amber-200 rounded-xl p-4` |
| **Effective date icon** | Lucide `Clock` `size={16} className="text-amber-600"` |
| **Terms checkbox** | Required — `bg-white rounded-xl border border-gray-200 p-4` |
| **Checkbox label** | `text-sm text-gray-700` — "I understand and accept these changes..." |
| **Reason select** | Optional — standard form select |
| **Confirm button** | `bg-amber-600 text-white hover:bg-amber-700` — "Schedule Downgrade" |
| **Confirm disabled** | `bg-gray-300 text-gray-500 cursor-not-allowed` — until checkbox checked |
| **Cancel button** | `text-gray-600 bg-white border border-gray-300 hover:bg-gray-50` |

### Downgrade Success Screen

| Element | Classes / Behavior |
|---------|-------------------|
| **Container** | `max-w-md mx-auto px-4 py-20 text-center` |
| **Checkmark** | `w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6` |
| **Title** | `text-2xl font-bold text-gray-900 mb-2` — "Downgrade Scheduled" |
| **Message** | `text-gray-500` — "Your downgrade to {tier} has been scheduled for {date}." |
| **Summary box** | `mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left` |
| **Summary title** | `text-sm font-semibold text-amber-900 mb-2` — "What happens next:" |
| **Summary items** | `text-sm text-amber-700 space-y-1` — checkmarks + what stays/changes |

### Membership Keep Panel (cancelling members)

When membership is cancelling (or benefits ended), customer sees **one** action — not upgrade cards.

| Element | Classes / Behavior |
|---------|-------------------|
| **Container** | `rounded-2xl border border-amber-200 bg-amber-50/60 p-5` |
| **Icon** | Lucide `ShieldCheck` `size={22} className="text-amber-600"` |
| **Title** | `text-sm font-semibold text-amber-900` — “Keep your {tier} membership” |
| **Body (in period)** | Benefits until date + auto-renew on + **No charge today** |
| **Body (period ended)** | Full price + new period starts today |
| **Primary CTA** | `bg-primary-600 text-white` — “Yes, keep my membership” / “Keep membership — {price}” |
| **Loading** | Spinner + “Keeping your membership…” |
| **Success** | Green panel `border-green-200 bg-green-50` — kept + benefits until date |
| **Payment path** | When period ended: Stripe Elements inline (same as subscribe) |

Component: `apps/web/src/components/KeepMembershipPanel.tsx`  
Endpoints: `POST /api/membership/keep`  
While cancelling, Subscribe page **hides** tier grid / estimate.

### CSR Admin — Evidence Modal

Used in admin `MembershipSubscriberDetail` for Change Tier and Cancel actions.

| Element | Classes / Behavior |
|---------|-------------------|
| **Backdrop** | `fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4` |
| **Card** | `bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto` |
| **Evidence section** | `space-y-3 border-t border-gray-100 pt-4` |
| **Field label** | `block text-xs font-medium text-gray-500 mb-1` — required fields marked with `*` |
| **Input** | `w-full px-3 py-2 border border-gray-300 rounded-lg text-sm` |
| **Textarea** | Same as input + `resize-none` |
| **Required indicator** | Red asterisk `*` after label text |
| **Submit button** | `bg-blue-600 text-white hover:bg-blue-700` (Change Tier) / `bg-red-600` (Cancel) |
| **Loading state** | Lucide `Loader2` `className="h-4 w-4 animate-spin inline mr-1"` |
