# PawTag Design System

**Last updated:** 2026-08-06
**Status:** Active — authoritative reference for all PawTag UI (web, customer, admin, finder, mobile)

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

### Gradients

| Gradient | Usage |
|---|---|
| `from-teal-600 to-teal-700` | Logo icon background (navbar, auth pages) |
| `from-teal-500 to-teal-600` | Footer logo icon |
| `from-teal-700 to-teal-600` | Hero banners, shop banners |
| `from-teal-50 to-teal-100` | Image placeholders, upload areas |
| `from-emerald-600 to-teal-700` | Active subscription cards |
| `from-amber-500 to-orange-600` | Grace period subscription cards |
| `from-gray-700 to-gray-900` | Expired subscription cards |

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

### Alerts

| Type | Classes |
|---|---|
| **Error** | `bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 p-4` |
| **Success** | `bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 p-4` |
| **Warning** | `bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 p-4` |
| **Info** | `bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 p-4` |

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

### Sidebar Navigation

The admin sidebar is the primary navigation control. It uses a collapsible section pattern with 8 logical groups.

#### Section Structure

| Section | Purpose | Items |
|---------|---------|-------|
| **Overview** | Dashboard and analytics | Dashboard, Statistics |
| **Business** | Core business operations | Orders, Products, Pets, Subscriptions, Tags, Users |
| **Communication** | User engagement | Notifications, Support Requests, Referrals, Tag Expiry Alerts |
| **Content** | CMS management | 13 CMS items (Announcements, Pages, Templates, etc.) |
| **Settings** | System configuration | Address Autocomplete, Feature Flags, General Settings, Pet References, Site Availability |
| **Security** | Access control and audit | Access Scopes, Audit Settings, Audit Trail, Permission Groups, Roles & Permissions |
| **Operations** | Technical operations | System Log Settings, System Logs, Write NFC Tag |

#### Behavior Rules

- **Collapsible sections:** Click section header to expand/collapse
- **Chevron indicators:** `ChevronRight` (collapsed) / `ChevronDown` (expanded)
- **Collapse persistence:** State saved in `localStorage` key: `pawtag-admin-sidebar-collapsed`
- **Active section auto-expand:** Section containing active route auto-expands on navigation
- **ASC ordering:** Items sorted alphabetically within each section
- **Badges:** Notification count (red), Support request count (red)

#### Theme Support

The sidebar supports dark and light modes:

| Element | Dark Mode (default) | Light Mode |
|---------|---------------------|------------|
| Background | `gray-900` | `white` |
| Link text | `gray-300` | `gray-600` |
| Link hover | `gray-800` bg, `white` text | `gray-50` bg, `gray-900` text |
| Active link | `primary-600` bg, `white` text | `primary-50` bg, `primary-700` text |
| Section header | `gray-500` text | `gray-400` text |
| Section hover | `gray-800` bg (dark), `gray-50` bg (light) | — |
| Chevron/icon | `gray-500` (dark), `gray-400` (light) | — |
| Border | `gray-700` | `gray-200` |
| Footer | `gray-500` text, `gray-700` border | `gray-40` text, `gray-200` border |

**Theme toggle:** Sun/Moon icon button in sidebar header (top-right)
**Persistence:** `localStorage` key: `pawtag-admin-sidebar-theme`
**Default:** Dark

#### Active State Styling

When a link is active:
- Background: `primary-600` (dark) / `primary-50` (light)
- Text: `white` (dark) / `primary-700` (light)
- Icon: `white` (dark) / `primary-600` (light)

#### Layout Structure

```
┌─────────────────────────────────────────┐
│ PawTag Admin Portal          [Sun/Moon] │  ← Header
├─────────────────────────────────────────┤
│ ▸ Overview                              │
│ ▾ Business                              │  ← Collapsible sections
│     Orders                              │
│     Products                            │
│     Pets                                │
│     Subscriptions                       │
│     Tags                                │
│     Users                               │
│ ▸ Communication                         │
│ ▸ Content                               │
│ ▸ Settings                              │
│ ▸ Security                              │
│ ▸ Operations                            │
├─────────────────────────────────────────┤
│ PawTag v0.1.0                           │  ← Footer
└─────────────────────────────────────────┘
```

---

## Findings — Web App Inconsistencies

The following inconsistencies exist between the four web apps. These are documented here for a future deliberate decision — they were NOT fixed in this phase to avoid an unplanned redesign of working apps.

1. **`teal-*` vs `primary-*` usage:** `apps/web` uses hardcoded `teal-600` in most places while also defining a `primary` scale. The other three apps use `primary-*` consistently. **Recommendation:** Migrate `apps/web` to use `primary-*` tokens exclusively in a future cleanup pass.

2. **Border-radius inconsistency:** Login cards use `rounded-2xl` in web but `rounded-lg` in customer/admin. Product cards use `rounded-2xl` but admin dashboard cards use `rounded-lg`. **Recommendation:** Standardize on `rounded-xl` for buttons, `rounded-2xl` for cards.

3. **Dark mode configured in admin only** (`darkMode: 'class'`) but no `dark:` classes are actually used. **Recommendation:** Either implement dark mode properly or remove the config to avoid confusion.

4. **Custom animations in web only:** `animate-fade-in`, `animate-slide-up`, `animate-pulse-once`, `animate-slide-in-right` exist only in `apps/web/src/index.css`. **Recommendation:** Move to a shared CSS file or, for mobile, implement natively with the motion spec above.

5. **Missing assets:** `SeoHead` references `/og-image.png` and `site.logo` setting, but no image files exist. **Recommendation:** Create brand assets before public launch.
