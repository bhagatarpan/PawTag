Absolutely. Based on your existing `DESIGN.md`, your PawTag architecture, and your goal of being the **SME/Vision Owner rather than the developer**, I would create a separate implementation specification specifically for AI coding agents.

I would **not** replace `DESIGN.md`. This should sit alongside it and tell VS Code + OpenCode + coding LLMs **exactly how to transform the existing system into a runtime, no-code Theme/Brand/Appearance platform**.

Below is the complete file. You can save it as:

`docs/AI-THEME-ENGINE-IMPLEMENTATION.md`

It is intentionally written as an **AI execution contract**, not as a conceptual design document.

# PawTag Theme Engine & No-Code Appearance System

## AI Vibe-Coding Implementation Specification

**Document:** `docs/AI-THEME-ENGINE-IMPLEMENTATION.md`
**Project:** PawTag
**Status:** Implementation Specification
**Audience:** AI coding agents, senior developers, architects, UI/UX engineers
**Primary execution environment:** VS Code + OpenCode + capable coding LLM
**Owner:** PawTag SME / Product Vision Owner
**Authority:** This document + existing `DESIGN.md` + existing architecture are the implementation contract.

---

# 1. AI EXECUTION DIRECTIVE

You are acting as the **Senior Principal Engineer, Software Architect, UI/UX Architect, Design Systems Engineer, Product Engineer, QA Engineer, and Technical Lead** for PawTag.

The human product owner is an SME and vision owner, not a developer.

Therefore:

* Do not assume the product owner understands implementation details.
* Do not ask the product owner to make unnecessary technical decisions.
* Do not expose low-level implementation choices unless they materially affect product behavior.
* Make technically sound decisions independently.
* Prefer maintainable, boring, explicit architecture over clever abstractions.
* Preserve existing functionality.
* Do not rewrite unrelated systems.
* Do not introduce unnecessary dependencies.
* Do not replace existing technologies without a compelling architectural reason.
* Do not invent requirements.
* Do not silently change business behavior.
* Do not silently remove existing features.
* Do not make destructive repository-wide changes without first inspecting dependencies.
* Treat existing production functionality as valuable and fragile.
* Make changes incrementally.
* Validate every phase before proceeding.
* Keep the system usable after every phase.

The ultimate goal is:

> A non-technical PawTag administrator must be able to completely change the visual identity and UI appearance of the PawTag web experience from the Admin Panel without editing code, rebuilding the frontend, or deploying a new version.

The system must provide a controlled, professional, ThemeForest/WordPress-like visual customization experience while maintaining PawTag's UX, accessibility, security, semantic meaning, and functional integrity.

---

# 2. PRODUCT VISION

PawTag currently has a documented design system in:

`DESIGN.md`

That design system is currently mostly static.

The objective of this project is to transform the static design system into a:

> **Runtime, database-backed, versioned, previewable, publishable, no-code Theme Engine.**

The system must allow administrators to modify:

* Brand colors
* Color palettes
* Typography
* Font selection from approved fonts
* Border radius
* Buttons
* Cards
* Inputs
* Badges
* Alerts
* Shadows
* Spacing density
* Layout width
* Header style
* Footer style
* Navigation style
* Dark mode
* Motion intensity
* Brand assets
* Visual presets

without changing application source code.

The system must support:

```text
Preset
   ↓
Theme configuration
   ↓
Live preview
   ↓
Draft
   ↓
Validation
   ↓
Publish
   ↓
Runtime theme
   ↓
Web / Finder / Customer Portal
```

---

# 3. IMPORTANT: THIS IS NOT A CSS EDITOR

Do NOT implement this as an arbitrary CSS editor.

Do NOT expose:

```text
Custom CSS
Custom JavaScript
Arbitrary Tailwind classes
Arbitrary HTML
```

to normal administrators.

The system must expose a **controlled design vocabulary**.

The administrator chooses from safe design options.

For example:

```text
Button style:
- Solid
- Outline
- Soft
- Ghost

Card style:
- Flat
- Bordered
- Elevated

Radius:
- Sharp
- Compact
- Rounded
- Very Rounded
- Pill
```

The administrator gets broad visual freedom without being able to destroy the design system.

---

# 4. EXISTING PAWTAG TECHNOLOGY STACK

Do not replace the existing stack unless absolutely necessary.

## Monorepo

* pnpm workspaces

## Backend

* Node.js
* Express
* TypeScript
* MongoDB
* Mongoose

## Authentication

* JWT
* rotating refresh tokens
* bcrypt
* email OTP MFA
* CAPTCHA
* brute-force protection

## Frontends

* React 18
* TypeScript
* Vite
* React Router
* Tailwind CSS

## Shared UI

```text
packages/ui
```

This is the primary foundation of the theme system.

## CMS

* Tiptap
* Puck

## Mobile

* React Native
* Expo

## Validation

* Zod

## Logging

* Pino

## Audit

Existing enterprise audit logging system.

## Testing

* Vitest
* Testing Library
* Supertest
* MongoDB Memory Server

---

# 5. EXISTING APPLICATION STRUCTURE

The repository currently contains:

```text
apps/
├── web/
├── admin/
├── finder/
└── mobile/

packages/
├── api/
├── db/
├── shared/
└── ui/
```

Important:

`apps/customer` no longer exists as a separate application.

The customer portal is part of:

```text
apps/web
```

Do not recreate `apps/customer`.

---

# 6. EXISTING DESIGN SYSTEM IS AUTHORITATIVE

Read the existing:

```text
DESIGN.md
```

before implementing anything.

Do not replace it.

Do not rewrite it unless explicitly required.

The existing design system contains:

* Brand character
* Teal palette
* Gray palette
* Semantic colors
* Typography
* Spacing
* Radius
* Shadows
* Buttons
* Cards
* Inputs
* Badges
* Alerts
* Motion
* States
* Logo
* Imagery
* Tone of voice
* Existing inconsistencies

The new system must preserve the existing PawTag design as the:

> **PawTag Classic / Default Theme**

---

# 7. CORE ARCHITECTURAL PRINCIPLE

Separate:

```text
DESIGN PRINCIPLES
```

from:

```text
DESIGN TOKENS
```

and:

```text
CONTENT
```

and:

```text
BUSINESS LOGIC
```

These are different systems.

---

# 8. DESIGN PRINCIPLES

These should remain authoritative and should not be freely overridden by an administrator.

PawTag must remain:

* Warm
* Reassuring
* Modern
* Professional
* Approachable
* Clear
* Trustworthy
* Accessible
* Calm
* Action-oriented

Especially for lost-pet experiences.

A theme must never compromise:

* readability
* contrast
* touch target size
* critical CTA visibility
* semantic status meanings
* lost-pet recovery flow
* accessibility
* mobile usability

---

# 9. DESIGN TOKEN ARCHITECTURE

Implement three layers.

## Layer 1 — Primitive tokens

Examples:

```text
teal-50
teal-100
...
teal-900

gray-50
gray-100
...
gray-900
```

These represent raw values.

---

## Layer 2 — Semantic tokens

Examples:

```text
color.primary
color.primaryHover
color.primaryActive

color.background
color.surface
color.surfaceMuted

color.foreground
color.foregroundMuted

color.border
color.borderStrong

color.success
color.warning
color.danger
color.info
```

Components should prefer semantic tokens.

---

## Layer 3 — Component tokens

Examples:

```text
button.primary.background
button.primary.foreground
button.primary.hover
button.primary.active

button.radius
button.paddingX
button.paddingY

card.background
card.border
card.radius
card.shadow

input.background
input.border
input.focus
input.radius
```

This gives the theme engine control without coupling components directly to brand colors.

---

# 10. THEME CONFIGURATION MODEL

Create a strongly typed `ThemeConfig`.

Recommended location:

```text
packages/ui/theme/types.ts
```

Initial conceptual model:

```ts
interface ThemeConfig {
  meta: {
    id: string;
    name: string;
    version: number;
  };

  brand: {
    logoMode: "default" | "custom";
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };

  colors: {
    primary: ColorScale;
    secondary: ColorScale;

    background: string;
    surface: string;
    surfaceMuted: string;

    foreground: string;
    foregroundMuted: string;
    foregroundSubtle: string;

    border: string;
    borderStrong: string;

    success: ColorScale;
    warning: ColorScale;
    danger: ColorScale;
    info: ColorScale;
  };

  typography: {
    headingFont: string;
    bodyFont: string;
    monoFont: string;

    display: TypeStyle;
    h1: TypeStyle;
    h2: TypeStyle;
    h3: TypeStyle;

    bodyLg: TypeStyle;
    body: TypeStyle;
    bodySm: TypeStyle;
    caption: TypeStyle;
    mono: TypeStyle;
  };

  shape: {
    radiusSm: string;
    radiusMd: string;
    radiusLg: string;
    radiusXl: string;
    radius2xl: string;
    radius3xl: string;
    radiusFull: string;

    buttonRadius: string;
    cardRadius: string;
    inputRadius: string;
  };

  elevation: {
    none: string;
    subtle: string;
    medium: string;
    elevated: string;
    high: string;
  };

  spacing: {
    density: "compact" | "comfortable" | "spacious";
  };

  components: {
    button: ButtonTheme;
    card: CardTheme;
    input: InputTheme;
    badge: BadgeTheme;
    alert: AlertTheme;
    navigation: NavigationTheme;
  };

  layout: {
    container: "compact" | "standard" | "wide";
    header: "standard" | "centered" | "minimal";
    sidebar: "standard" | "compact" | "floating";
  };

  motion: {
    enabled: boolean;
    speed: "reduced" | "normal" | "expressive";
  };

  darkMode: {
    enabled: boolean;
    default: "light" | "dark" | "system";
  };
}
```

The exact TypeScript types may be refined during implementation.

Do not over-engineer the first version.

---

# 11. ZOD VALIDATION

The backend and frontend must share a validation contract.

Use Zod.

Create a schema equivalent to:

```text
ThemeConfigSchema
```

The backend must reject invalid themes.

The frontend must provide friendly validation feedback.

Never trust theme data received from the client.

---

# 12. DEFAULT THEME

Create:

```text
packages/ui/theme/presets/pawtag-classic.ts
```

This preset must reproduce the existing PawTag design documented in `DESIGN.md`.

The default theme must preserve:

* teal primary
* existing typography
* existing radius
* existing shadows
* existing spacing
* existing component behavior
* existing semantic colors
* existing motion behavior

The first objective is:

> Introduce the theme engine without visually changing PawTag.

This is a critical acceptance criterion.

---

# 13. CSS VARIABLE STRATEGY

Use CSS custom properties for runtime theme values.

Example:

```css
:root {
  --pt-color-primary: #0d9488;
  --pt-color-primary-hover: #0f766e;
  --pt-color-primary-active: #115e59;

  --pt-color-background: #ffffff;
  --pt-color-surface: #f8fafc;

  --pt-color-foreground: #111827;
  --pt-color-foreground-muted: #6b7280;

  --pt-color-border: #e5e7eb;

  --pt-radius-button: 12px;
  --pt-radius-card: 16px;
  --pt-radius-input: 8px;
}
```

Do not hardcode theme values throughout components.

---

# 14. THEME PROVIDER

Create a shared theme provider.

Conceptually:

```tsx
<ThemeProvider theme={theme}>
  <App />
</ThemeProvider>
```

The provider must convert the theme configuration into CSS custom properties.

Create something equivalent to:

```text
themeToCssVariables(theme)
```

This must be deterministic and testable.

---

# 15. WEB APPLICATIONS

The runtime theme must work across:

```text
apps/web
apps/finder
apps/admin
```

However, do not automatically assume that the same theme should control every part of every application.

---

# 16. PUBLIC THEME VS ADMIN THEME

Support separate conceptual themes:

```text
Public Theme
Admin Theme
```

The public theme controls:

```text
web
finder
public CMS pages
customer portal where appropriate
```

The admin interface should retain a professional administrative appearance.

The public branding system must not accidentally make the administrative back office unusable.

Initially, implementation may share infrastructure while maintaining separate configuration scopes.

---

# 17. FINDER EXPERIENCE SAFETY

The Finder application is a critical recovery workflow.

A Finder theme must never compromise:

* contrast
* readability
* primary CTA
* lost status visibility
* owner contact action
* notification action
* touch target size
* emergency/recovery information

The Finder theme may change:

* colors
* brand appearance
* typography within safe limits
* radius
* card style
* approved layout variants

Do not allow arbitrary visual customization that can make the recovery experience confusing.

---

# 18. COMPONENT MIGRATION

Audit `packages/ui`.

Identify components containing hardcoded:

```text
teal-*
gray-*
blue-*
green-*
red-*
amber-*
purple-*
```

Determine whether each usage is:

1. semantic
2. brand
3. structural
4. decorative

Replace brand-related hardcoding with semantic theme tokens.

Do not blindly replace semantic colors.

For example:

```text
danger
success
warning
info
```

must remain semantically meaningful.

---

# 19. IMPORTANT COLOR RULE

An administrator may change the visual shade of:

```text
primary
secondary
accent
success
warning
danger
info
```

but may not change the semantic meaning.

Never allow:

```text
danger = success
```

or:

```text
lost = decorative pink
```

if that compromises meaning.

---

# 20. ACCESSIBILITY

Every theme must be validated for accessibility.

At minimum:

* WCAG AA contrast where applicable
* readable text
* visible focus states
* keyboard navigation
* sufficient touch targets
* visible disabled states
* error states distinguishable without color alone

When an administrator selects a primary color, calculate or validate appropriate foreground contrast.

If a selected color produces poor contrast:

1. warn the administrator
2. suggest an accessible foreground
3. prevent publishing if critical accessibility rules fail

Do not silently publish an unsafe theme.

---

# 21. AUTOMATIC COLOR DERIVATION

The administrator should not have to manually define:

```text
primary-50
primary-100
primary-200
...
primary-900
```

The admin experience should ideally be:

```text
Primary Color
[ color picker ]
```

The system derives the required shades.

For example:

```text
primary
primaryHover
primaryActive
primarySubtle
primaryBorder
primaryForeground
```

Use a deterministic color-generation strategy.

Do not add a large color manipulation library unless necessary.

---

# 22. SEMANTIC COLOR SAFETY

The system should support:

```text
success
warning
danger
info
```

with controlled palettes.

For accessibility and clarity, do not rely exclusively on color.

Statuses should also have:

* icons
* labels
* appropriate text
* consistent patterns

---

# 23. TYPOGRAPHY

The default remains the existing PawTag system font stack.

Allow administrators to choose from an approved font registry.

Do not allow arbitrary external font URLs.

Recommended conceptual options:

```text
System
Inter
DM Sans
Nunito Sans
Plus Jakarta Sans
Source Sans 3
```

The exact available fonts may be adjusted based on licensing and implementation.

Typography must remain within safe limits.

Do not allow:

```text
body font = 8px
```

or other destructive settings.

---

# 24. TYPE SCALE

The existing type scale should become the default.

Default:

```text
display: 36px / 800 / 1.2
h1:      30px / 700 / 1.3
h2:      24px / 700 / 1.35
h3:      20px / 600 / 1.4
body-lg: 18px / 400 / 1.6
body:    16px / 400 / 1.5
body-sm: 14px / 400 / 1.5
caption: 12px / 500 / 1.4
mono:    14px / 400 / 1.5
```

Allow controlled scaling rather than arbitrary values.

---

# 25. RADIUS SYSTEM

Preserve the existing radius vocabulary:

```text
none
sm
md
lg
xl
2xl
3xl
full
```

Provide administrator-friendly presets:

```text
Sharp
Compact
Rounded
Very Rounded
Pill
```

Map these to safe radius values.

---

# 26. SHADOW SYSTEM

Preserve:

```text
None
Subtle
Medium
Elevated
High
```

Allow administrators to choose an overall elevation style.

Do not expose raw CSS shadow syntax in the initial version.

---

# 27. BUTTON THEMING

Support at minimum:

```text
Primary
Secondary
Ghost
Destructive
```

Add optional visual styles:

```text
Solid
Outline
Soft
Ghost
```

The button component must maintain:

* loading state
* disabled state
* keyboard focus
* accessibility
* touch target
* semantic behavior

Theme customization must never break those states.

---

# 28. CARD THEMING

Support:

```text
Flat
Bordered
Elevated
```

Optional:

```text
Glass
```

only if the implementation remains accessible and performant.

---

# 29. INPUT THEMING

Inputs must preserve:

* focus ring
* error state
* disabled state
* placeholder contrast
* label association
* helper text
* validation feedback

Theme settings may control:

* radius
* border color
* focus color
* background
* density

Do not allow unsafe removal of focus indicators.

---

# 30. BADGES

Support:

```text
Primary
Success
Warning
Error
Info
```

Use semantic colors.

Do not allow the theme editor to break badge readability.

---

# 31. ALERTS

Support:

```text
Error
Success
Warning
Info
```

Preserve the semantic hierarchy.

---

# 32. LAYOUT THEMING

Allow controlled options for:

```text
Container width:
- Compact
- Standard
- Wide

Spacing density:
- Compact
- Comfortable
- Spacious

Header:
- Standard
- Centered
- Minimal
```

Do not expose arbitrary pixel-level page layout controls initially.

---

# 33. DARK MODE

The existing design documentation states that dark mode is configured in admin but not actually implemented.

Treat this as a separate capability.

Do not claim dark mode is complete merely because CSS classes exist.

Dark mode must be implemented systematically across:

* backgrounds
* surfaces
* text
* borders
* buttons
* inputs
* cards
* alerts
* navigation
* Finder if applicable

If implementing dark mode is too large for the initial theme-engine milestone, leave it behind a clearly documented phase.

---

# 34. MOTION

Preserve the existing motion specification.

Default:

```text
micro: 150ms
small: 200ms
screen: 300ms
page: 500ms
```

Allow only controlled options:

```text
Reduced
Normal
Expressive
```

Always respect:

```text
prefers-reduced-motion
```

Do not introduce excessive animations.

PawTag is a lost-pet recovery product.

Motion must feel reassuring, not playful or distracting.

---

# 35. BRANDING SYSTEM

Separate branding from general appearance.

Branding includes:

```text
Logo
Favicon
Primary brand color
Secondary brand color
Accent color
Approved fonts
Brand imagery
```

Appearance includes:

```text
Radius
Shadows
Buttons
Cards
Inputs
Navigation
Spacing
Layout
Motion
```

Content includes:

```text
Pages
Hero
Features
FAQ
Testimonials
CTA
Navigation labels
Footer content
```

These must remain separate systems.

---

# 36. LOGO

The existing PawTag logo is code-based.

Do not break the existing default logo.

Support:

```text
Default PawTag Logo
Custom Uploaded Logo
```

Future support may include:

```text
Light-background logo
Dark-background logo
Favicon
Mobile icon
```

Images must be stored using the existing object-storage infrastructure.

Do not introduce a second image storage system.

---

# 37. DATABASE MODEL

Create a theme model using MongoDB/Mongoose.

Recommended conceptual entities:

```text
Theme
ThemeVersion
ThemePreset
```

---

# 38. THEME MODEL

Conceptual structure:

```ts
{
  _id,
  name,
  description,

  scope: "public" | "admin",

  config,

  status: "draft" | "published" | "archived",

  version,

  createdBy,
  updatedBy,

  createdAt,
  updatedAt
}
```

Use existing project conventions for:

* IDs
* timestamps
* audit metadata
* validation
* indexing

Do not blindly copy this schema if existing conventions differ.

Inspect the repository first.

---

# 39. THEME VERSION MODEL

Every published theme should be recoverable.

Conceptual:

```ts
{
  themeId,
  version,
  config,
  changeSummary,

  publishedBy,
  publishedAt,

  createdAt
}
```

A theme version should be immutable.

Do not mutate historical versions.

---

# 40. THEME PRESETS

System presets may be stored in code initially.

Example:

```text
PawTag Classic
PawTag Modern
PawTag Natural
PawTag Playful
PawTag Premium
PawTag Dark
```

Later they may be stored in MongoDB.

Do not over-engineer preset management in the first phase.

---

# 41. API DESIGN

Implement APIs consistent with existing PawTag API conventions.

Conceptual endpoints:

```text
GET    /api/themes/active

GET    /api/admin/themes

GET    /api/admin/themes/:id

POST   /api/admin/themes

PUT    /api/admin/themes/:id

POST   /api/admin/themes/:id/validate

POST   /api/admin/themes/:id/publish

GET    /api/admin/themes/:id/versions

POST   /api/admin/themes/:id/restore/:version
```

Use existing authentication and RBAC.

Do not create a separate authentication mechanism.

---

# 42. RBAC

Only authorized administrators may:

* view theme configuration
* edit theme configuration
* create themes
* publish themes
* restore themes

Recommended permissions:

```text
theme.read
theme.create
theme.update
theme.publish
theme.restore
```

Use the existing RBAC system.

Do not create a second permission system.

---

# 43. AUDIT LOGGING

Every significant theme operation must be audited.

At minimum:

```text
theme.created
theme.updated
theme.validated
theme.published
theme.restored
theme.archived
preset.applied
brand.asset.updated
```

Audit logs must include existing project-standard metadata:

* actor
* timestamp
* entity
* entity ID
* action
* relevant changes
* request context where appropriate

Never log secrets.

Never log raw uploaded credentials.

---

# 44. DRAFT / PREVIEW / PUBLISH MODEL

The theme workflow must be:

```text
Draft
  ↓
Validate
  ↓
Preview
  ↓
Publish
```

Never directly overwrite the published theme when the administrator is editing.

The administrator must be able to experiment safely.

---

# 45. LIVE PREVIEW

The appearance editor must provide a live preview.

Preferred approach:

```text
Admin Editor
      │
      ├── controls
      │
      └── preview
```

Use an iframe or isolated preview environment where practical.

The preview should represent the actual public application as closely as possible.

Do not create a fake preview that uses different components from production.

---

# 46. PREVIEW REQUIREMENT

Preview should support at least:

```text
Desktop
Tablet
Mobile
```

The administrator should be able to inspect:

```text
Header
Hero
Buttons
Cards
Forms
Alerts
Navigation
Footer
```

---

# 47. PREVIEW SECURITY

Never treat preview configuration as trusted production configuration.

Preview data may originate from unsaved client state.

Do not:

* execute arbitrary JavaScript
* inject arbitrary HTML
* execute arbitrary CSS
* bypass authentication
* expose privileged data

The preview must use the same safe component system.

---

# 48. ADMIN APPEARANCE UX

Create:

```text
/admin/appearance
```

The UI should feel like a professional theme builder.

Recommended structure:

```text
Appearance

├── Presets
├── Brand
├── Colors
├── Typography
├── Shape
├── Elevation
├── Components
├── Layout
├── Motion
└── Dark Mode
```

Right side:

```text
Live Preview
```

Top-level actions:

```text
Save Draft
Preview
Publish
Reset
```

---

# 49. PRESET EXPERIENCE

Presets should be visually represented.

Example:

```text
PawTag Classic
PawTag Modern
PawTag Natural
PawTag Playful
PawTag Premium
```

Each preset should have:

* preview thumbnail
* name
* short description
* Apply button

Applying a preset must modify the draft, not immediately publish it.

---

# 50. COLOR EDITOR UX

Do not expose raw implementation complexity.

Administrator experience:

```text
Brand Colors

Primary
[ color picker ]

Secondary
[ color picker ]

Accent
[ color picker ]
```

Advanced controls may be collapsible.

Show:

```text
Preview
Contrast status
Suggested accessible text color
```

---

# 51. TYPOGRAPHY EDITOR UX

Show:

```text
Heading Font
Body Font

Scale
Compact / Standard / Large

Weight
```

Provide preview text.

Do not require the administrator to understand CSS.

---

# 52. SHAPE EDITOR UX

Provide a simple visual choice:

```text
Sharp
Compact
Rounded
Very Rounded
```

Show visual examples.

Do not require the administrator to enter:

```text
border-radius: 13px
```

---

# 53. COMPONENT EDITOR UX

Show component previews.

For example:

```text
Buttons

[ Solid ]
[ Outline ]
[ Soft ]
[ Ghost ]
```

Cards:

```text
[ Flat Card ]
[ Bordered Card ]
[ Elevated Card ]
```

The user should understand the visual outcome without technical knowledge.

---

# 54. THEME PREVIEW COMPONENT

Create reusable preview components.

Example:

```text
ThemePreviewButton
ThemePreviewCard
ThemePreviewInput
ThemePreviewAlert
ThemePreviewBadge
```

However, wherever possible, preview actual production components rather than duplicating styles.

---

# 55. RESET BEHAVIOR

Provide:

```text
Reset section
Reset entire draft
Reset to PawTag Classic
```

Reset must affect draft only until published.

---

# 56. PUBLISH CONFIRMATION

Before publishing:

Show:

```text
Publish theme?

This will change the appearance of the public PawTag experience.

Your previous theme will remain available for rollback.

[Cancel]
[Publish]
```

This is especially important for a non-technical administrator.

---

# 57. VERSION HISTORY

Add:

```text
Appearance → Version History
```

Show:

```text
Version 7
Published Aug 11
By Admin

Version 6
Published Aug 09
By Admin

Version 5
Published Aug 03
By Admin
```

Actions:

```text
Preview
Restore
```

Never delete history as part of normal operation.

---

# 58. ROLLBACK

Rollback must create a new version.

Do not mutate history.

For example:

```text
v7 current
v6 old

Restore v6

creates:

v8 = v6 configuration
```

This preserves the audit trail.

---

# 59. PUBLISHING SAFETY

Before publish:

1. Validate schema.
2. Validate required values.
3. Validate accessibility constraints.
4. Validate supported component variants.
5. Validate uploaded assets.
6. Validate fonts.
7. Validate dark mode if enabled.
8. Ensure no arbitrary CSS/JS exists.
9. Create version.
10. Publish.
11. Update cache.
12. Write audit log.

If any critical step fails:

> Do not partially publish.

---

# 60. CACHE

Do not query MongoDB for theme configuration on every component render.

Use a cached published configuration.

Use existing project infrastructure if a cache already exists.

If no cache exists, begin with a safe application-level cache and design the abstraction so it can later be replaced.

Cache invalidation must occur on publish/rollback.

---

# 61. WEB RUNTIME

Public web applications should load the active theme.

Conceptually:

```text
Application boot
    ↓
Fetch active theme
    ↓
Validate
    ↓
ThemeProvider
    ↓
CSS variables
    ↓
Application
```

If the theme API fails:

> Fall back safely to the built-in PawTag Classic theme.

Never render an unusable site because the theme API is unavailable.

---

# 62. OFFLINE / FAILURE FALLBACK

The application must have a local default theme.

Do not make the entire UI dependent on successful theme API retrieval.

Fallback order:

```text
Published server theme
        ↓
Cached theme
        ↓
Built-in PawTag Classic
```

---

# 63. Puck CMS INTEGRATION

Puck controls:

```text
content
sections
page structure
CMS composition
```

The theme engine controls:

```text
visual language
colors
typography
spacing
components
appearance
```

Do not mix these responsibilities.

---

# 64. PUCK COMPONENT RULE

Puck components must consume the shared:

```text
packages/ui
```

components wherever possible.

Do not create a second design system inside Puck.

For example:

```tsx
<Hero>
  <Heading />
  <Button />
</Hero>
```

should ultimately use the same themed Button/Heading system as the rest of the application.

---

# 65. PAGE BUILDER SAFETY

Do not allow Puck to bypass theme constraints.

A page editor may choose:

```text
content
layout
section variants
```

but should not inject arbitrary CSS/JS into production.

---

# 66. TENANT / WHITE-LABEL PREPARATION

Do not implement full multi-tenant branding unless required.

However, architect the theme system so that future scopes are possible.

Potential future model:

```text
Platform Theme
      ↓
Organization Theme
      ↓
Site Theme
      ↓
Page overrides
```

Do not implement unnecessary tenant complexity now.

---

# 67. MOBILE ARCHITECTURE

React Native cannot directly use browser CSS variables.

Therefore:

```text
ThemeConfig
     ↓
Web Theme Adapter
     ↓
CSS variables

ThemeConfig
     ↓
Mobile Theme Adapter
     ↓
React Native style objects
```

Do not duplicate the actual theme configuration.

There must be one conceptual theme contract.

Mobile implementation can be phased later if necessary.

---

# 68. MOBILE SAFETY

The mobile app must not become dependent on the web theme API during startup.

Use:

```text
bundled default theme
```

and optionally:

```text
remote published theme
```

with local fallback.

Never block mobile startup waiting for theme configuration.

---

# 69. DESIGN SYSTEM MIGRATION STRATEGY

Do not migrate the entire repository in one giant change.

Use incremental migration.

Recommended order:

```text
packages/ui
    ↓
web
    ↓
finder
    ↓
admin
    ↓
Puck components
    ↓
mobile
```

---

# 70. MIGRATION RULE

For every hardcoded visual value ask:

> Is this a theme value, semantic value, structural value, or business-state value?

Examples:

```text
Primary teal
→ theme

Danger red
→ semantic theme

Grid gap
→ structural/design token

Lost status
→ business semantic
```

Do not blindly replace everything with variables.

---

# 71. DO NOT BREAK BUSINESS LOGIC

Theme work must never modify:

* authentication
* payments
* Stripe webhook logic
* tag activation
* QR scanning
* NFC
* pet recovery workflows
* subscription state machine
* notifications
* audit logging
* RBAC behavior
* order lifecycle
* health record logic

unless explicitly required by the theme feature.

---

# 72. DO NOT REWRITE WORKING COMPONENTS WITHOUT REASON

If an existing component works:

```text
Preserve behavior.
Refactor styling.
```

Do not rewrite business logic merely because you are migrating styles.

---

# 73. TESTING REQUIREMENTS

Every implementation phase must include appropriate tests.

At minimum:

## Unit

Test:

```text
theme validation
theme merging
theme defaults
color generation
contrast validation
CSS variable generation
preset application
```

## Integration

Test:

```text
theme CRUD
theme publishing
theme rollback
RBAC
audit logging
```

## UI

Test:

```text
theme editor
preset selection
draft save
publish
reset
preview
```

## Regression

Ensure existing functionality remains operational.

---

# 74. THEME MERGING

Support sensible defaults.

For example:

```text
Default Theme
       +
User overrides
       =
Resolved Theme
```

Do not require every theme configuration to contain every possible value.

Use safe defaults.

---

# 75. IMMUTABILITY

Never mutate the original default theme.

Never mutate historical published versions.

Use immutable configuration snapshots.

---

# 76. THEME RESOLUTION

Conceptually:

```ts
const resolvedTheme = resolveTheme(
  pawTagClassic,
  draftOverrides
);
```

The result should be complete enough for rendering.

---

# 77. THEME VALIDATION LEVELS

Implement three levels:

### Level 1 — Schema

Is the configuration structurally valid?

### Level 2 — Design safety

Are values within safe ranges?

### Level 3 — Accessibility

Does the theme meet required contrast and usability rules?

Only a valid theme may be published.

---

# 78. ADMIN ERROR MESSAGES

Never expose technical errors such as:

```text
ZodError: path components.button.radius...
```

Instead:

```text
"The button style could not be saved. Please choose another button shape."
```

Technical details should go to logs.

---

# 79. UX WRITING

Use plain language.

Good:

```text
Save draft
Preview changes
Publish theme
Restore previous version
```

Bad:

```text
Persist configuration
Compile tokens
Hydrate theme
Mutate schema
```

The admin is not a developer.

---

# 80. ADMIN CONFIRMATIONS

When publishing:

```text
Your new appearance is ready.

Publishing will update the public PawTag experience.

Your current appearance will be saved as a previous version.

[Cancel] [Publish]
```

When restoring:

```text
Restore this appearance?

A new version will be created, so you can undo this later.

[Cancel] [Restore]
```

---

# 81. "ONE CLICK REVAMP" FEATURE

Provide a prominent preset experience.

Example:

```text
Revamp your website

Choose a design direction:

Modern
Natural
Playful
Premium
Classic
```

Clicking a preset should:

1. load preset configuration
2. apply it to current draft
3. show live preview
4. allow further customization
5. never publish automatically

---

# 82. PRESET REQUIREMENTS

Every preset must be complete enough to create a coherent experience.

Do not create presets that only change the primary color.

A real preset should change a combination of:

```text
colors
typography
radius
shadows
button style
card style
spacing
layout
```

---

# 83. INITIAL PRESETS

Create at least:

## PawTag Classic

The existing PawTag design.

## PawTag Modern

Characteristics:

* clean
* SaaS-like
* restrained radius
* subtle shadows
* strong whitespace

## PawTag Natural

Characteristics:

* organic
* calming
* earthy palette
* soft visual language

## PawTag Playful

Characteristics:

* brighter palette
* larger radius
* friendlier visual language
* still professional

## PawTag Premium

Characteristics:

* elegant
* restrained
* premium contrast
* sophisticated typography

Do not compromise PawTag's trustworthiness.

---

# 84. DO NOT OVERDESIGN

PawTag is not a gaming application.

Avoid:

* excessive gradients
* excessive glassmorphism
* giant animations
* cartoon UI
* excessive shadows
* excessive rounded shapes
* visual clutter

Especially in:

```text
Finder
Lost mode
Tag activation
Emergency contact
Pet recovery
```

---

# 85. RESPONSIVE DESIGN

The theme system must work across:

```text
Mobile
Tablet
Desktop
Large desktop
```

Theme settings must not create horizontal overflow.

Test:

```text
320px
375px
390px
768px
1024px
1280px
1440px+
```

---

# 86. PERFORMANCE

The theme system must be lightweight.

Avoid:

* generating huge CSS files
* runtime recompilation
* unnecessary rerenders
* loading dozens of fonts
* unnecessary API calls

Prefer:

```text
Theme JSON
+
CSS variables
```

rather than dynamically generating large stylesheets.

---

# 87. SECURITY

Theme data is admin-controlled but still untrusted input.

Validate:

* strings
* URLs
* image references
* font identifiers
* enum values
* color values
* numeric values

Never execute:

```text
JavaScript from theme configuration
```

Never render arbitrary HTML from theme configuration.

---

# 88. MEDIA

Use the existing R2/object-storage system for uploaded:

* logos
* favicons
* brand images

Do not store large binary files directly in MongoDB unless the existing architecture already requires it.

---

# 89. SEO

Theme changes must not alter:

* page metadata
* structured data
* canonical URLs
* sitemap
* SEO content

unless explicitly intended.

---

# 90. ACCESSIBILITY REGRESSION

After theme migration, run accessibility checks on:

```text
Homepage
Shop
Product
Checkout
Customer dashboard
Pet profile
Finder
Login
Admin appearance
```

At minimum verify:

* keyboard navigation
* focus visibility
* color contrast
* labels
* headings
* buttons
* links
* form errors

---

# 91. DOCUMENTATION

Update documentation after implementation.

Create/update:

```text
docs/theme-engine.md
```

Document:

* architecture
* ThemeConfig
* theme lifecycle
* API
* database models
* preset system
* component integration
* preview
* publishing
* rollback
* troubleshooting

Do not let documentation describe functionality that does not exist.

---

# 92. PHASED IMPLEMENTATION PLAN

The implementation MUST be phased.

Do not attempt the entire system in one prompt or one coding session.

---

# PHASE 0 — REPOSITORY DISCOVERY

## Goal

Understand the existing system before changing it.

AI must inspect:

```text
DESIGN.md
ARCHITECTURE.md
apps/web
apps/admin
apps/finder
apps/mobile
packages/ui
packages/shared
packages/api
packages/db
```

Also inspect:

```text
Tailwind configuration
Vite configuration
existing theme providers
existing CSS
existing component patterns
existing CMS implementation
existing RBAC
existing audit logging
existing API conventions
existing database conventions
```

## Deliverable

Create:

```text
docs/theme-engine-discovery.md
```

containing:

* existing architecture
* current styling strategy
* hardcoded color locations
* existing UI components
* current theme-like infrastructure
* risks
* recommended migration order

## Acceptance

No code changes required except documentation.

---

# PHASE 1 — THEME CONTRACT

## Goal

Create the canonical theme data model.

Implement:

```text
packages/ui/theme/types.ts
packages/ui/theme/schema.ts
packages/ui/theme/defaults.ts
packages/ui/theme/presets/pawtag-classic.ts
```

Create:

```text
ThemeConfig
```

and Zod schema.

## Acceptance

* TypeScript compiles.
* Zod validation works.
* PawTag Classic represents the existing design.
* No application behavior changes.

---

# PHASE 2 — CSS VARIABLE ENGINE

## Goal

Convert ThemeConfig into runtime CSS variables.

Implement:

```text
themeToCssVariables()
ThemeProvider
```

Add tests.

## Acceptance

Given:

```text
PawTag Classic
```

the rendered site looks visually equivalent to the existing implementation.

---

# PHASE 3 — SHARED UI MIGRATION

## Goal

Make `packages/ui` theme-aware.

Migrate:

```text
Button
Card
Input
Badge
Alert
Modal
Tabs
Navigation
Table
etc.
```

Do not migrate the entire application yet.

## Acceptance

Shared components respond correctly when theme values change.

---

# PHASE 4 — PUBLIC WEB MIGRATION

Migrate:

```text
apps/web
```

from hardcoded brand colors to semantic theme tokens.

Priority:

```text
Header
Footer
Homepage
Shop
Product pages
Checkout
Customer portal
```

## Acceptance

Changing the runtime theme changes the public website without source-code changes.

---

# PHASE 5 — FINDER MIGRATION

Migrate:

```text
apps/finder
```

with strict UX/accessibility safeguards.

## Acceptance

Finder responds to theme changes without compromising:

* recovery CTA
* readability
* accessibility
* lost status
* owner notification

---

# PHASE 6 — THEME DATABASE

Implement:

```text
Theme
ThemeVersion
```

using existing MongoDB/Mongoose patterns.

Add indexes as appropriate.

## Acceptance

Themes can be:

```text
created
read
updated
versioned
published
restored
```

---

# PHASE 7 — THEME API

Implement secure API endpoints.

Integrate:

```text
JWT authentication
RBAC
Zod
audit logging
```

## Acceptance

Unauthorized users cannot modify themes.

Authorized users can create/update/publish according to permissions.

---

# PHASE 8 — ADMIN APPEARANCE EDITOR

Build:

```text
/admin/appearance
```

Sections:

```text
Presets
Brand
Colors
Typography
Shape
Elevation
Components
Layout
Motion
Dark Mode
```

## Acceptance

A non-technical person can understand the interface without developer assistance.

---

# PHASE 9 — LIVE PREVIEW

Add:

```text
Desktop
Tablet
Mobile
```

preview.

Preview must use real production components.

## Acceptance

Changes appear immediately without publishing.

---

# PHASE 10 — PRESETS

Implement:

```text
Classic
Modern
Natural
Playful
Premium
```

Applying a preset changes the draft.

## Acceptance

One click completely changes the visual style.

---

# PHASE 11 — PUBLISH / VERSION / ROLLBACK

Implement:

```text
Draft
Publish
Version history
Restore
Audit
```

## Acceptance

Every published theme is recoverable.

---

# PHASE 12 — PUCK INTEGRATION

Ensure Puck components consume shared themed UI components.

## Acceptance

Changing the theme changes the appearance of CMS-created pages.

---

# PHASE 13 — DARK MODE

Implement only after the core theme system is stable.

## Acceptance

Dark mode is complete and consistent, not partially implemented.

---

# PHASE 14 — MOBILE THEME ADAPTER

Implement shared ThemeConfig consumption in React Native.

## Acceptance

Mobile can consume the same conceptual theme contract while retaining a bundled fallback.

---

# PHASE 15 — FINAL QA

Perform:

```text
unit tests
integration tests
UI tests
typecheck
lint
build
accessibility review
responsive review
security review
performance review
```

Then run existing regression suites.

---

# 93. DEFINITION OF DONE

The feature is not complete until all of the following are true.

## Functional

An admin can:

* select a preset
* modify colors
* modify typography
* modify radius
* modify shadows
* modify buttons
* modify cards
* modify inputs
* modify layout
* preview changes
* save draft
* publish
* restore previous versions

## Technical

* ThemeConfig exists.
* Zod schema exists.
* ThemeProvider exists.
* CSS variables exist.
* Shared components use semantic tokens.
* Theme API exists.
* Database models exist.
* RBAC exists.
* Audit logging exists.
* Version history exists.
* Rollback exists.

## UX

A non-technical administrator can use the system without knowing:

* CSS
* Tailwind
* React
* JavaScript
* HTML
* design tokens

## Safety

Theme changes cannot:

* execute JavaScript
* inject arbitrary CSS
* break accessibility
* destroy critical Finder UX
* bypass RBAC
* modify business logic

---

# 94. AI CODING RULES

When using OpenCode, VS Code agents, Claude Code, GPT-based coding agents, or other LLM coding tools, follow these rules.

## Rule 1

Always inspect the repository before coding.

## Rule 2

Never assume a file exists.

## Rule 3

Never assume an API exists.

## Rule 4

Search before creating duplicate utilities.

## Rule 5

Use existing project conventions.

## Rule 6

Prefer shared abstractions over app-specific duplication.

## Rule 7

Do not introduce dependencies without justification.

## Rule 8

Do not rewrite unrelated files.

## Rule 9

Do not change business logic while changing presentation.

## Rule 10

Run tests after meaningful changes.

## Rule 11

Run TypeScript checks after TypeScript architecture changes.

## Rule 12

Never claim success without verification.

---

# 95. AI AGENT WORKFLOW

For every implementation task, follow:

```text
1. Read relevant documentation
2. Inspect repository
3. Identify existing implementation
4. Identify affected files
5. Explain intended change internally
6. Implement smallest coherent change
7. Run targeted tests
8. Run typecheck
9. Inspect diff
10. Fix regressions
11. Update documentation
12. Report exactly what changed
```

---

# 96. NEVER DO THIS

Do not:

```text
Rewrite the entire frontend
Replace Tailwind
Replace React
Replace MongoDB
Replace Express
Replace Puck
Replace packages/ui
Create a second API
Create a second CMS
Create a second authentication system
Create arbitrary CSS injection
```

unless explicitly required by a future architecture decision.

---

# 97. AI DECISION PRIORITY

When requirements conflict, prioritize:

```text
1. Security
2. Data integrity
3. Existing business functionality
4. Accessibility
5. Recovery/lost-pet UX
6. Architecture consistency
7. Maintainability
8. Performance
9. Visual flexibility
10. Developer convenience
```

Visual customization must never override safety.

---

# 98. WHEN REQUIREMENTS ARE UNCLEAR

If a decision is minor:

> Choose the most maintainable implementation.

If a decision affects:

* business logic
* customer experience
* data integrity
* security
* pricing
* subscriptions
* recovery workflow

do not invent business behavior.

Document the ambiguity and choose the safest non-destructive behavior.

---

# 99. SME COMMUNICATION RULE

The product owner is not expected to understand:

```text
React
TypeScript
MongoDB
CSS variables
Tailwind
Mongoose
API contracts
component architecture
```

When reporting progress, explain outcomes in product language.

Good:

> "The website's colors are now controlled centrally. We can change the primary brand color from the admin panel without editing code."

Bad:

> "I implemented a CSS custom-property provider with a token resolver."

Technical details may be included afterward if useful.

---

# 100. AI SHOULD NOT ASK THE SME TO CHOOSE TECHNICAL DETAILS

Do not ask:

> "Should we use Context API or Zustand?"

Choose the appropriate implementation.

Do not ask:

> "Should the theme be stored in MongoDB or local storage?"

The architecture already indicates MongoDB for persistent configuration.

Do not ask:

> "Should I use CSS variables?"

Yes.

Do not ask:

> "Should I create a ThemeConfig?"

Yes.

The SME should primarily make:

* product decisions
* visual decisions
* business decisions
* branding decisions

The AI should make implementation decisions.

---

# 101. VISUAL QA RULE

When changing visual components, inspect the actual UI.

Do not rely solely on TypeScript compilation.

A component can compile perfectly and still look broken.

Where browser tooling is available:

1. start application
2. open relevant page
3. inspect desktop
4. inspect mobile
5. change theme
6. inspect again
7. verify no layout regression

---

# 102. REGRESSION RULE

Before declaring completion, verify:

```text
Login works
Admin login works
Homepage works
Shop works
Checkout works
Pet profile works
Tag activation works
Finder works
Customer portal works
CMS works
```

Theme changes must not affect business behavior.

---

# 103. GIT / DIFF DISCIPLINE

Keep changes reviewable.

Prefer:

```text
Phase 1 commit
Phase 2 commit
Phase 3 commit
...
```

Avoid giant commits containing unrelated changes.

Suggested commit style:

```text
feat(theme): add ThemeConfig contract

feat(theme): add runtime CSS variable engine

refactor(ui): migrate Button to semantic theme tokens

feat(admin): add appearance editor

feat(theme): add theme publishing and rollback
```

---

# 104. DOCUMENTATION UPDATE RULE

After each major phase update:

```text
docs/theme-engine.md
```

with actual implementation status.

Do not document planned features as completed.

Use:

```text
Implemented
Partial
Planned
```

where appropriate.

---

# 105. FINAL USER EXPERIENCE

The final experience should feel like this:

```text
Admin Panel
    ↓
Appearance
    ↓
Choose "Modern"
    ↓
Preview
    ↓
Website changes visually
    ↓
Adjust Primary Color
    ↓
Preview
    ↓
Adjust Buttons
    ↓
Preview
    ↓
Adjust Typography
    ↓
Preview
    ↓
Save Draft
    ↓
Publish
    ↓
Entire public experience updates
```

No code.

No developer.

No deployment.

No Tailwind knowledge.

No CSS knowledge.

---

# 106. FINAL PRODUCT PRINCIPLE

The system should make this statement true:

> **"If a non-technical PawTag administrator wants the website to look completely different tomorrow, they should be able to do it from the Admin Panel without asking a developer to change code."**

But it must simultaneously remain true that:

> **"A theme change cannot break PawTag's core UX, accessibility, security, pet-recovery workflow, or business logic."**

That balance is the central architectural requirement.

---

# 107. REFERENCE ARCHITECTURE

The intended final architecture is:

```text
                         PAWTAG
                           │
                           ▼
                    ┌───────────────┐
                    │  Admin Panel  │
                    │               │
                    │ Appearance    │
                    │ Presets       │
                    │ Brand         │
                    │ Colors        │
                    │ Typography    │
                    │ Components    │
                    │ Layout        │
                    │ Preview       │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Theme API     │
                    │               │
                    │ RBAC          │
                    │ Validation    │
                    │ Audit         │
                    │ Publishing    │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ MongoDB       │
                    │               │
                    │ Theme         │
                    │ Versions      │
                    │ Presets       │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ ThemeConfig   │
                    │               │
                    │ Design Tokens  │
                    └───────┬───────┘
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
          Web Adapter  Finder Adapter  Mobile Adapter
                │           │           │
                ▼           ▼           ▼
          CSS Variables   CSS Vars    RN Styles
                │           │           │
                └───────────┼───────────┘
                            ▼
                    ┌───────────────┐
                    │ packages/ui   │
                    │               │
                    │ Button        │
                    │ Card          │
                    │ Input         │
                    │ Modal         │
                    │ Badge         │
                    │ Table         │
                    │ Navigation    │
                    └───────┬───────┘
                            │
                ┌───────────┼────────────┐
                ▼           ▼            ▼
               WEB        FINDER       ADMIN
                │
                ▼
             Puck CMS
                │
                ▼
          Public Experience
```

---

# 108. FINAL IMPLEMENTATION CHECKLIST

Before marking the project complete:

```text
[ ] Repository inspected
[ ] Existing DESIGN.md preserved
[ ] ThemeConfig created
[ ] Zod schema created
[ ] PawTag Classic preset created
[ ] CSS variable engine created
[ ] ThemeProvider created
[ ] Shared UI migrated
[ ] Web migrated
[ ] Finder migrated
[ ] Admin appearance editor created
[ ] Theme database models created
[ ] Theme API created
[ ] RBAC integrated
[ ] Audit logging integrated
[ ] Draft system implemented
[ ] Preview implemented
[ ] Presets implemented
[ ] Publish implemented
[ ] Version history implemented
[ ] Rollback implemented
[ ] Accessibility validation implemented
[ ] Puck integration verified
[ ] Dark mode implemented or explicitly deferred
[ ] Mobile adapter implemented or explicitly deferred
[ ] Tests added
[ ] Existing tests pass
[ ] Typecheck passes
[ ] Lint passes
[ ] Production build passes
[ ] Responsive QA completed
[ ] Documentation updated
[ ] No arbitrary CSS/JS injection
[ ] No business logic regressions
[ ] Finder recovery UX preserved
[ ] Default PawTag appearance preserved
```

---

# 109. MASTER AI PROMPT

When beginning implementation with an AI coding agent, use this instruction:

> You are the Senior Principal Engineer responsible for implementing the PawTag Theme Engine according to `docs/AI-THEME-ENGINE-IMPLEMENTATION.md`.
>
> Before making changes, read:
>
> * `docs/AI-THEME-ENGINE-IMPLEMENTATION.md`
> * `DESIGN.md`
> * `ARCHITECTURE.md`
> * relevant package documentation
> * existing implementation files
>
> Inspect the repository before coding.
>
> Determine which phase is currently complete.
>
> Do not skip phases unless the repository already satisfies their acceptance criteria.
>
> Do not rewrite unrelated systems.
>
> Do not change business logic.
>
> Do not introduce arbitrary CSS or JavaScript injection.
>
> Do not replace existing technologies without strong justification.
>
> Use existing PawTag architecture and conventions.
>
> Implement the smallest coherent increment.
>
> After implementation:
>
> 1. run relevant tests
> 2. run TypeScript validation
> 3. inspect the diff
> 4. fix regressions
> 5. update documentation
> 6. report what was implemented
> 7. report what remains
>
> Do not claim a feature is complete without verification.
>
> The product owner is an SME, not a developer. Explain the final result in business/product language.
>
> The ultimate goal is a safe, professional, no-code, WordPress/ThemeForest-style visual customization system where an authorized PawTag administrator can completely change the public visual identity of the application without code changes or redeployment.

---

# 110. END STATE

When this specification has been successfully implemented, PawTag should have evolved from:

```text
Static Design System
        +
Hardcoded UI styling
```

into:

```text
                    PAWTAG DESIGN PLATFORM

                         Theme Engine
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
         Branding          Appearance        Content
            │                 │                 │
         Logo              Colors             Puck
         Fonts             Typography         Pages
         Identity          Components         Sections
                           Layout
                           Motion
                              │
                              ▼
                         Live Preview
                              │
                              ▼
                         Draft Version
                              │
                              ▼
                           Publish
                              │
                              ▼
                      Version + Audit
                              │
                              ▼
                   Entire Website Updates
```

The administrator controls the **visual identity**.

The developer controls the **design system boundaries**.

The product owner controls the **vision and business rules**.

The application retains control of **security, accessibility, semantics, and core pet-recovery functionality**.

That is the intended architecture for PawTag's next-generation no-code appearance system.

I would use this as the **master implementation contract**, while keeping your existing `DESIGN.md` as the visual/design reference.

One important recommendation: **do not give the AI this document and tell it “build everything.”** Give it this document and instruct it to start at **Phase 0 only**, inspect the repository, produce `theme-engine-discovery.md`, and stop. Then let the agent execute one phase at a time. That will dramatically reduce the chance of an LLM doing a giant destructive rewrite of your existing PawTag codebase.
