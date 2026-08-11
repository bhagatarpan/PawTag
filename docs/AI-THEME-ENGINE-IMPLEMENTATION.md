# AI-THEME-ENGINE-IMPLEMENTATION.md

# PawTag Theme Engine & Theme Studio

## AI Implementation Specification

**Project:** PawTag
**Document:** `AI-THEME-ENGINE-IMPLEMENTATION.md`
**Status:** Implementation Specification
**Audience:** AI coding agents, senior developers, architects, UI/UX agents
**Primary environments:** VS Code, OpenCode, Claude Code, Codex and equivalent coding agents
**Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
**Backend:** Node.js + Express + TypeScript
**Database:** MongoDB + Mongoose
**Shared UI:** `packages/ui`
**Shared types/validation:** `packages/shared`
**CMS:** Tiptap + Puck
**Authorization:** Existing PawTag RBAC
**Audit:** Existing enterprise audit logging
**Design intelligence:** UI/UX Pro Max skill
**Authoritative design reference:** `DESIGN.md`

---

# 1. PURPOSE

PawTag must provide a production-grade Theme Engine and Theme Studio that allows a non-technical administrator to significantly change the visual appearance and branding of the PawTag web platform without editing source code.

The experience should be conceptually similar to the customization experience found in mature WordPress/ThemeForest products:

* choose a visual preset
* change brand colors
* change typography
* change component appearance
* change layout density
* change corner radius
* change shadows
* change navigation appearance
* upload/change logo
* preview changes immediately
* save as draft
* compare changes
* publish with one deliberate action
* revert to a previous theme
* restore the default PawTag theme

The administrator must NOT need:

* CSS knowledge
* Tailwind knowledge
* React knowledge
* JavaScript knowledge
* developer assistance
* source-code access

The Theme Engine must be designed so that future visual changes can be made through configuration rather than source-code modifications.

---

# 2. CORE PRODUCT PRINCIPLE

The Theme Engine is a **configuration-driven design system**, not a CSS editor.

The system must NOT expose arbitrary CSS or JavaScript to ordinary administrators.

The architecture must instead be:

```text
Admin Theme Studio
        ↓
Theme Configuration
        ↓
Validation
        ↓
Theme Compiler / Token Resolver
        ↓
CSS Variables
        ↓
Shared UI Components
        ↓
Web / Admin / Finder experiences
```

The administrator controls a safe, predefined design space.

---

# 3. AUTHORITY HIERARCHY

The AI MUST follow this hierarchy.

## Level 1 — Product Owner / SME

The product owner determines:

* product vision
* business requirements
* desired user experience
* acceptable visual directions
* brand positioning
* which changes are appropriate for PawTag

The product owner is the final authority on product intent.

---

## Level 2 — `DESIGN.md`

`DESIGN.md` is the authoritative PawTag design system.

It defines:

* brand character
* accessibility philosophy
* color philosophy
* typography
* spacing
* component principles
* motion
* states
* logo treatment
* tone of voice
* emotional requirements
* lost-pet UX principles

The Theme Engine MUST NOT undermine these principles.

---

## Level 3 — UI/UX Pro Max

The UI/UX Pro Max skill is an auxiliary design-intelligence system.

Repository:

`https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`

Use it to assist with:

* visual design exploration
* design-system recommendations
* UX patterns
* typography combinations
* dashboard patterns
* component styling
* accessibility recommendations
* responsive layout recommendations
* theme preset exploration
* design consistency

UI/UX Pro Max is NOT the source of truth.

If its recommendations conflict with PawTag requirements, PawTag requirements win.

---

## Level 4 — AI Coding Agent

The AI coding agent is responsible for:

* architecture
* implementation
* testing
* migration
* refactoring
* documentation
* regression prevention
* accessibility
* visual QA

The AI must never interpret a design recommendation as permission to rewrite unrelated application functionality.

---

# 4. NON-NEGOTIABLE SAFETY PRINCIPLE

The Theme Engine is a visual system.

It must not modify:

* authentication logic
* authorization logic
* payment logic
* subscription state machines
* tag activation logic
* finder scan logic
* pet recovery workflows
* audit-log integrity
* database business rules
* notification logic
* Stripe webhook handling
* security controls
* API authorization
* RBAC permissions

unless a specific theme-related requirement genuinely requires a change.

Theme work must remain isolated from business logic.

---

# 5. CURRENT PAWTAG ARCHITECTURE

The existing repository is a pnpm monorepo:

```text
pawtag/
├── apps/
│   ├── web/
│   ├── admin/
│   ├── finder/
│   └── mobile/
│
├── packages/
│   ├── api/
│   ├── db/
│   ├── shared/
│   └── ui/
│
├── docs/
├── tests/
├── DESIGN.md
├── ARCHITECTURE.md
└── PawTag-Enterprise-Roadmap.md
```

Important architectural rule:

`packages/ui` is the shared visual foundation for the web applications.

New reusable visual components SHOULD be implemented in `packages/ui`, not separately inside every application.

---

# 6. APPLICATION SCOPE

The initial Theme Engine scope is:

### Included

* `apps/web`
* `apps/admin`
* `apps/finder`
* `packages/ui`

### Partially included

* CMS/Puck-rendered pages

### Mobile

The React Native application should NOT blindly consume web CSS variables.

Mobile should eventually consume shared semantic theme configuration through a platform-appropriate adapter.

Initial implementation may focus on web applications unless the existing architecture already supports shared mobile theme tokens.

Do not destabilize mobile merely to complete web theming.

---

# 7. REQUIRED USER EXPERIENCE

The administrator should eventually see:

```text
Admin
│
├── Appearance
│   └── Theme Studio
│
├── Content
├── Commerce
├── Pets
├── Tags
├── Customers
└── Settings
```

Theme Studio should provide:

```text
Theme Studio

┌──────────────────────────────────────────────┐
│ Theme                                        │
│                                              │
│ [ PawTag Classic ▼ ]                         │
│                                              │
│ Status: Draft                                │
│                                              │
│ [Save Draft]              [Publish]          │
└──────────────────────────────────────────────┘
```

Sections:

```text
Brand
Colors
Typography
Buttons
Cards
Forms
Navigation
Layout
Radius
Shadows
Motion
Accessibility
Logo & Assets
Presets
Advanced
```

The exact visual layout should be designed using the PawTag design system and UI/UX Pro Max recommendations.

---

# 8. THEME MODEL

A theme is a structured configuration object.

Conceptually:

```text
Theme
│
├── metadata
├── brand
├── colors
├── typography
├── spacing
├── radius
├── shadows
├── buttons
├── cards
├── forms
├── navigation
├── layout
├── motion
├── accessibility
├── assets
└── versioning
```

Do NOT store compiled CSS as the primary source of truth.

The source of truth is the structured theme configuration.

---

# 9. THEME DOCUMENT

Create a Mongoose model appropriate to the existing database architecture.

Suggested conceptual structure:

```text
Theme
├── _id
├── name
├── slug
├── description
├── status
├── isSystemTheme
├── isDefault
├── version
├── config
├── createdBy
├── updatedBy
├── publishedBy
├── publishedAt
├── createdAt
└── updatedAt
```

Possible statuses:

```text
draft
published
archived
```

Do not invent unnecessary states.

Use existing project conventions where available.

---

# 10. THEME CONFIGURATION

The configuration should be strongly typed.

Example conceptual structure:

```text
config:
  brand:
    primary
    secondary
    accent
    logo
    favicon

  colors:
    background
    surface
    surfaceMuted
    text
    textMuted
    border

    success
    warning
    error
    info

  typography:
    fontFamily
    headingFontFamily
    bodyFontFamily
    baseSize
    headingWeight
    bodyWeight

  radius:
    button
    card
    input
    modal
    badge

  shadows:
    card
    dropdown
    modal
    elevated

  buttons:
    style
    size
    weight
    radius

  cards:
    style
    border
    shadow
    radius

  navigation:
    style
    sidebarWidth
    activeIndicator
    headerStyle

  layout:
    density
    contentWidth
    pageSpacing

  motion:
    enabled
    durationScale
    reducedMotionRespect

  accessibility:
    minimumContrast
    focusRing
    highContrastMode

  assets:
    logo
    logoDark
    favicon
    loginBackground
```

The final schema must follow actual project conventions.

---

# 11. DESIGN TOKENS

The Theme Engine must be based on semantic design tokens.

Do not make components depend directly on arbitrary theme configuration properties.

Bad:

```text
button.background = theme.primaryColor
```

Preferred:

```text
button.background = var(--pt-color-action-primary)
```

The Theme Engine maps theme configuration into semantic tokens.

---

# 12. TOKEN ARCHITECTURE

Use three conceptual layers.

## Layer 1 — Raw theme values

Example:

```text
brand.primary = #0D9488
```

## Layer 2 — Semantic tokens

Example:

```text
--pt-color-action-primary
--pt-color-action-primary-hover
--pt-color-action-primary-active
--pt-color-action-primary-text
```

## Layer 3 — Components

Components consume semantic tokens.

Example:

```text
Button
  ↓
--pt-color-action-primary
```

not:

```text
Button
  ↓
#0D9488
```

---

# 13. COLOR SYSTEM

Do not simply replace `teal-600`.

A theme's primary color must be transformed into a usable color family.

Given:

```text
primary = #0D9488
```

the system should derive or explicitly store:

```text
primary-50
primary-100
primary-200
primary-300
primary-400
primary-500
primary-600
primary-700
primary-800
primary-900
```

The implementation may use a proven color-generation algorithm or predefined palette mappings.

Do not invent mathematically poor color transformations.

The resulting palette must be tested for:

* readability
* contrast
* visual consistency
* hover states
* active states
* disabled states
* focus states

---

# 14. ACCESSIBILITY IS AUTOMATIC

A non-technical administrator must not be able to accidentally create an unusable theme.

The Theme Engine must validate:

* text/background contrast
* button text/background contrast
* link contrast
* focus indicators
* semantic status colors
* disabled states
* dark/light combinations

If the selected color combination fails accessibility requirements:

```text
Do not silently publish.
```

Instead display:

```text
Accessibility issue

This color combination may make text difficult to read.

Recommended alternatives:
[Use accessible teal]
[Darken primary]
[Lighten background]

Learn why
```

Where possible, provide automatic correction suggestions.

---

# 15. SEMANTIC COLORS MUST REMAIN SEMANTIC

Administrators may customize the overall visual identity.

However:

```text
error
success
warning
info
```

must remain distinguishable.

Do not allow a theme to make:

```text
success = red
error = green
```

unless there is a very deliberate advanced configuration and accessibility validation.

The safest default is to preserve semantic meaning.

---

# 16. TYPOGRAPHY

Typography customization should be controlled.

Do not allow arbitrary external font URLs by default.

Preferred options:

```text
System
Inter
Roboto
Open Sans
Nunito Sans
DM Sans
Other approved fonts
```

The exact available list should be based on:

* licensing
* performance
* accessibility
* browser support
* project infrastructure

The AI must not introduce an external font service without explicit approval.

---

# 17. FONT ROLES

Support at minimum:

```text
Heading font
Body font
Monospace font
```

Do not allow arbitrary typography per component unless there is a demonstrated product need.

---

# 18. BORDER RADIUS

Provide controlled presets.

Example:

```text
Sharp
Balanced
Soft
Rounded
```

Internally:

```text
radius.none
radius.sm
radius.md
radius.lg
radius.xl
radius.2xl
radius.full
```

The UI should use human-friendly names.

The administrator should not need to understand `12px`.

---

# 19. SHADOW PRESETS

Provide:

```text
Flat
Subtle
Soft
Elevated
Strong
```

Internally map to:

```text
shadow-sm
shadow-md
shadow-lg
shadow-xl
```

or CSS variables.

---

# 20. BUTTON STYLES

Allow controlled choices:

```text
Solid
Soft
Outline
Minimal
Pill
```

Do not allow arbitrary CSS.

The selected button style must propagate through shared components.

---

# 21. CARD STYLES

Possible options:

```text
Flat
Bordered
Soft Shadow
Elevated
Minimal
```

The AI must ensure cards remain consistent across:

* web
* admin
* finder

unless application-specific behavior requires an intentional difference.

---

# 22. NAVIGATION THEMING

Allow controlled navigation styles.

Examples:

```text
Sidebar:
- Light
- Dark
- Brand
- Soft

Active state:
- Filled
- Indicator
- Background
- Accent

Header:
- Minimal
- Standard
- Brand
```

Do not allow theme configuration to alter navigation routes.

Theme controls appearance only.

---

# 23. LAYOUT DENSITY

Provide:

```text
Compact
Comfortable
Spacious
```

This affects:

* table row height
* card padding
* form spacing
* navigation spacing
* page spacing

It must NOT break responsive layouts.

---

# 24. CONTENT WIDTH

Provide safe presets:

```text
Narrow
Standard
Wide
Full
```

Do not expose arbitrary pixel values to normal administrators.

---

# 25. MOTION

The Theme Engine may provide:

```text
Motion:
- Full
- Reduced
- Minimal
```

But accessibility must always take precedence.

Respect:

```text
prefers-reduced-motion
```

The theme cannot override a user's operating-system accessibility preference.

---

# 26. BRAND ASSETS

Theme Studio should support:

* primary logo
* dark-background logo
* favicon
* optional login image
* optional brand icon

Use the existing R2/object-storage architecture.

Do not store large binary assets directly in MongoDB.

Store:

```text
asset ID
URL/reference
metadata
alt text
```

Use the existing media library where possible rather than creating a second asset-management system.

---

# 27. LOGO SAFETY

The logo area should provide:

```text
Upload
Replace
Remove
Preview
Reset to default
```

Validate:

* file type
* file size
* dimensions
* SVG safety
* malicious content

Do not blindly accept arbitrary SVG.

Use the existing media-security conventions.

---

# 28. THEME PRESETS

The system must support presets.

At minimum:

```text
PawTag Classic
PawTag Modern
PawTag Professional
PawTag Soft
PawTag Premium
```

These are examples.

The actual presets must be validated against PawTag's product identity.

Each preset should simply be a valid theme configuration.

---

# 29. ONE-CLICK PRESET APPLICATION

When an administrator selects:

```text
PawTag Modern
```

the system should immediately populate the Theme Studio controls.

It should NOT immediately publish.

Correct flow:

```text
Select preset
     ↓
Theme changes in editor
     ↓
Preview
     ↓
Save Draft
     ↓
Publish
```

This prevents accidental production changes.

---

# 30. LIVE PREVIEW

Theme Studio must support live preview.

Preferred approach:

```text
Theme Editor
      │
      ├── current draft configuration
      │
      ▼
Theme Provider
      │
      ▼
CSS variables
      │
      ▼
Preview UI
```

The preview should not require saving to the database.

---

# 31. PREVIEW MODES

Provide:

```text
Desktop
Tablet
Mobile
```

At minimum the AI should implement responsive preview if the existing UI architecture allows it without introducing excessive complexity.

---

# 32. PREVIEW PAGES

Theme Studio should include representative preview components:

```text
Dashboard
Buttons
Forms
Cards
Tables
Badges
Alerts
Navigation
Modal
Empty State
Error State
Success State
```

This lets an administrator understand the impact of a theme before publishing.

---

# 33. DO NOT PREVIEW ONLY THEME CONTROLS

The preview must show actual PawTag-like UI.

Example:

```text
Theme Studio
│
├── Controls
│
└── Live Preview
    ├── Dashboard card
    ├── Pet card
    ├── Order table
    ├── Buttons
    ├── Form
    ├── Status badges
    └── Navigation
```

---

# 34. THEME DRAFTS

Theme editing must use drafts.

The administrator should be able to:

```text
Start editing
      ↓
Make changes
      ↓
Save Draft
      ↓
Leave
      ↓
Return later
      ↓
Continue editing
```

Drafts must not affect the public application.

---

# 35. PUBLISHING

Publishing is an explicit action.

Before publish:

```text
Publish Theme?

This will change the visual appearance of the selected PawTag experiences.

Current theme:
PawTag Classic

New theme:
My Modern PawTag

[Cancel]
[Publish]
```

If possible, display a summary:

```text
12 color changes
2 typography changes
1 navigation change
3 component-style changes
```

---

# 36. ROLLBACK

Every published theme must be versioned.

Administrators with the appropriate permission must be able to:

```text
Theme History

v8  Current
v7  Previous
v6
v5
Default
```

Actions:

```text
Preview
Restore
Compare
```

Restoring a theme should create a new version rather than destroying historical records.

---

# 37. VERSIONING MODEL

Do not mutate historical published theme versions.

Preferred model:

```text
Theme
   ↓
Version 1
Version 2
Version 3
Version 4
```

Publishing creates a new immutable version.

Rollback means:

```text
Version 4 active
       ↓
Restore Version 2
       ↓
Create Version 5
       ↓
Version 5 contains Version 2 configuration
```

This preserves auditability.

---

# 38. THEME SCOPE

The architecture should support future theme scopes.

Potential scopes:

```text
global
web
admin
finder
tenant
brand
```

Initial implementation may use:

```text
global
```

Do not over-engineer multi-tenancy unless required by the current product.

However, structure the schema so this possibility is not blocked.

---

# 39. ADMIN VS PUBLIC THEMING

The Theme Engine must explicitly distinguish between:

### Product/Admin UI theme

The internal admin back office.

### Public site theme

Marketing/shop/customer experience.

### Finder theme

The public QR/NFC recovery experience.

These may eventually have separate theme configurations.

Do not assume that a dashboard theme and missing-pet finder theme should always look identical.

---

# 40. FINDER SAFETY

The finder experience has special priority.

It is often used when:

* someone finds a missing pet
* the finder is on a phone
* the user may be unfamiliar with PawTag
* the owner may be under stress

Theme customization MUST NOT compromise:

* scan-result readability
* emergency/contact actions
* lost-pet status
* owner notification actions
* location consent
* accessibility
* mobile usability

The finder must remain extremely clear regardless of theme.

---

# 41. CSS ARCHITECTURE

The preferred architecture is:

```text
Theme Configuration
        ↓
Theme Resolver
        ↓
CSS Custom Properties
        ↓
packages/ui components
```

Example conceptual variables:

```text
--pt-color-primary
--pt-color-primary-hover
--pt-color-primary-active
--pt-color-primary-soft

--pt-color-background
--pt-color-surface
--pt-color-surface-muted

--pt-color-text
--pt-color-text-muted
--pt-color-border

--pt-color-success
--pt-color-warning
--pt-color-error
--pt-color-info

--pt-radius-button
--pt-radius-card
--pt-radius-input

--pt-shadow-card
--pt-shadow-dropdown
--pt-shadow-modal

--pt-font-body
--pt-font-heading

--pt-layout-content-width
--pt-layout-density
```

The exact token list should be finalized after inspecting the current implementation.

---

# 42. TAILWIND INTEGRATION

Do not attempt to dynamically regenerate Tailwind configuration in production for every theme.

Avoid:

```text
theme change
→ edit tailwind.config
→ rebuild application
```

That defeats the purpose of runtime theming.

Instead:

```text
Tailwind
+
CSS variables
```

Use Tailwind for structural utilities and CSS variables for runtime theme values.

---

# 43. MIGRATION FROM CURRENT DESIGN

The existing system contains hardcoded values such as:

```text
teal-600
teal-700
gray-900
rounded-xl
```

Do NOT perform a massive blind replacement.

Perform migration incrementally.

Recommended sequence:

```text
Phase 1
Create token architecture.

Phase 2
Modify shared UI components.

Phase 3
Migrate common primitives.

Phase 4
Migrate admin.

Phase 5
Migrate web.

Phase 6
Migrate finder.

Phase 7
Handle CMS/Puck.

Phase 8
Remove remaining unnecessary hardcoded theme values.
```

---

# 44. SHARED UI COMPONENT MIGRATION

Prioritize:

```text
Button
Input
Select
Textarea
Checkbox
Radio
Switch
Badge
Alert
Card
Modal
Dialog
Dropdown
Tooltip
Tabs
Table
Pagination
Navigation
Sidebar
Header
EmptyState
LoadingState
ErrorState
```

Each should consume semantic theme tokens.

---

# 45. COMPONENT CONTRACT

Every shared UI component must:

1. consume semantic tokens
2. support accessibility
3. preserve existing behavior
4. preserve existing public APIs where possible
5. avoid application-specific business logic
6. remain usable without Theme Studio
7. fall back safely to PawTag defaults

---

# 46. DEFAULT FALLBACK

If:

* theme API fails
* database unavailable
* theme is malformed
* configuration missing
* browser loads before theme request completes

the application must use:

```text
PawTag Default Theme
```

The application must never render unstyled or broken UI because the Theme API is unavailable.

---

# 47. THEME LOADING STRATEGY

Avoid noticeable theme flashing.

Preferred sequence:

```text
Application starts
      ↓
Default theme immediately available
      ↓
Fetch active theme
      ↓
Apply validated theme
```

If practical, preload the active theme configuration.

Do not block the entire application indefinitely waiting for theme configuration.

---

# 48. API DESIGN

Follow existing Express architecture.

Potential endpoints:

```text
GET    /api/admin/themes
POST   /api/admin/themes
GET    /api/admin/themes/:id
PATCH  /api/admin/themes/:id
DELETE /api/admin/themes/:id

POST   /api/admin/themes/:id/publish
POST   /api/admin/themes/:id/duplicate

GET    /api/admin/themes/:id/versions
GET    /api/admin/themes/:id/versions/:version

POST   /api/admin/themes/:id/restore/:version

GET    /api/theme/active
```

Do not create endpoints that duplicate existing CMS or media functionality.

Follow current route naming conventions.

---

# 49. API VALIDATION

All Theme API input must use Zod.

Validate:

* colors
* enums
* numeric limits
* font selections
* radius options
* shadow options
* asset references
* theme status
* version identifiers

Never trust client-side validation.

---

# 50. SECURITY

Theme configuration is admin-controlled data.

Protect it using existing RBAC.

Suggested permissions:

```text
theme.view
theme.create
theme.edit
theme.publish
theme.restore
theme.delete
```

Use the project's existing permission naming conventions if different.

Do not invent a second authorization mechanism.

---

# 51. PUBLISH PERMISSION

Editing and publishing should preferably be separate permissions.

Example:

```text
Designer/Admin:
theme.edit

Senior Admin:
theme.publish
theme.restore
```

This allows a safe workflow where one person creates a theme and another approves production changes.

---

# 52. AUDIT LOGGING

Every important theme operation must be audited.

At minimum:

```text
theme.created
theme.updated
theme.published
theme.restored
theme.deleted
theme.preset_applied
theme.assets_changed
```

Audit entries should identify:

* actor
* action
* theme
* version
* timestamp
* relevant metadata
* before/after summary where appropriate

Do not log secrets or sensitive data.

Use the existing enterprise audit system.

Do not create a second audit-log implementation.

---

# 53. CHANGE SUMMARY

When publishing a theme, generate a human-readable summary.

Example:

```text
Theme published

Changes:
• Primary color changed
• Button style changed from Solid to Soft
• Border radius changed from Soft to Rounded
• Heading font changed
• Navigation changed to Dark
```

This helps non-technical administrators understand what they did.

---

# 54. THEME COMPARISON

Provide a simple comparison view.

Example:

```text
Current
PawTag Classic

vs.

Draft
PawTag Modern
```

Show:

```text
Primary color
Typography
Button style
Card style
Navigation
Radius
Density
```

Do not expose raw JSON to normal users.

---

# 55. ADVANCED VIEW

A future advanced view may expose:

```text
Theme JSON
```

but this should:

* be hidden behind an advanced permission
* be read-only by default
* validate all changes
* never permit arbitrary code
* never permit JavaScript injection
* never permit arbitrary CSS injection

Normal administrators should never need it.

---

# 56. PRESET ARCHITECTURE

Presets should be stored as structured configuration.

Example:

```text
preset:
  id: pawtag-classic
  name: PawTag Classic
  description: Warm, trustworthy PawTag default
  config: {...}
```

Presets should not be implemented as:

```text
if theme === "modern":
   add CSS class
```

That approach becomes unmaintainable.

---

# 57. UI/UX PRO MAX ROLE IN PRESETS

When creating or reviewing a preset:

1. Identify intended personality.
2. Consult UI/UX Pro Max.
3. Analyze appropriate patterns.
4. Generate candidate design direction.
5. Check against `DESIGN.md`.
6. Convert the approved direction into theme tokens.
7. Validate accessibility.
8. Build a preview.
9. Test across representative screens.
10. Store the final preset as configuration.

UI/UX Pro Max should influence the design process, not become a runtime dependency.

---

# 58. DESIGN INTELLIGENCE DOCUMENT

Create:

```text
docs/design/PAWTAG-DESIGN-INTELLIGENCE.md
```

It should record:

* PawTag visual personality
* user emotional context
* preferred visual patterns
* forbidden patterns
* accessibility priorities
* approved typography
* approved theme styles
* UI/UX Pro Max recommendations adopted
* recommendations rejected and why

This prevents future AI agents from repeatedly making the same design mistakes.

---

# 59. THEME ENGINE DESIGN RULES

The AI MUST follow these principles:

### Rule 1

Configuration over source-code modification.

### Rule 2

Semantic tokens over hardcoded colors.

### Rule 3

Shared components over duplicated styles.

### Rule 4

Safe presets over arbitrary CSS.

### Rule 5

Draft before publish.

### Rule 6

Every published theme is versioned.

### Rule 7

Every important change is audited.

### Rule 8

Accessibility is mandatory.

### Rule 9

Existing application functionality must remain unchanged.

### Rule 10

PawTag Default Theme must always be recoverable.

---

# 60. BRANCHING AND CHANGE ISOLATION

Theme Engine development MUST NOT happen directly on the production/main branch.

Before implementation:

```text
git status
git branch
git log -n 10
```

Confirm the repository is clean or understand existing changes.

Create an isolated feature branch.

Recommended naming:

```text
feature/theme-engine-foundation
feature/theme-engine-tokens
feature/theme-engine-admin
feature/theme-engine-presets
feature/theme-engine-publishing
feature/theme-engine-migration
feature/theme-engine-qa
```

Do not create one enormous uncontrolled branch if the work can be safely divided.

---

# 61. CRITICAL BRANCHING RULE

Never modify unrelated working code merely because it looks old.

If an existing implementation works:

```text
LEAVE IT ALONE
```

unless the Theme Engine specifically requires the change.

Document unrelated technical debt instead of fixing it opportunistically.

---

# 62. BASELINE BEFORE CHANGES

Before each phase:

```text
pnpm typecheck
pnpm test
pnpm build
```

Use the actual repository scripts if they differ.

Record baseline results.

If the baseline already has failures:

```text
DO NOT CLAIM THEY WERE CAUSED BY THE THEME WORK.
```

Document them.

---

# 63. SMALL COMMITS

Prefer commits such as:

```text
feat(theme): add theme schema
feat(theme): add semantic token resolver
feat(theme): add runtime theme provider
feat(theme): migrate Button component
feat(theme): add theme API
feat(theme): add Theme Studio
feat(theme): add theme publishing
feat(theme): add theme history
feat(theme): add presets
```

Avoid:

```text
feat: completely redesign PawTag
```

---

# 64. PHASED IMPLEMENTATION

The AI must implement the system in phases.

Do not attempt the entire Theme Engine in one uncontrolled pass.

---

# PHASE 0 — DISCOVERY

Before changing code:

Inspect:

```text
DESIGN.md
ARCHITECTURE.md
packages/ui
apps/admin
apps/web
apps/finder
packages/api
packages/db
packages/shared
CMS/Puck implementation
existing theme-related code
Tailwind configuration
global CSS
existing CSS variables
existing RBAC
existing audit logging
media library
```

Search for:

```text
teal-
primary-
gray-
rounded-
shadow-
font-
bg-
text-
border-
dark:
```

Identify where visual values are hardcoded.

Deliver:

```text
docs/design/THEME-ENGINE-DISCOVERY.md
```

Do not implement yet.

---

# PHASE 1 — ARCHITECTURE

Create:

```text
docs/design/THEME-ENGINE-ARCHITECTURE.md
```

Document:

* theme model
* configuration schema
* semantic tokens
* runtime strategy
* API
* permissions
* publishing
* versioning
* preview
* rollback
* fallback
* migration strategy

Get architecture internally consistent before implementation.

---

# PHASE 2 — THEME CONTRACT

Create shared TypeScript types.

Prefer:

```text
packages/shared
```

Define:

```text
Theme
ThemeConfig
ThemeColors
ThemeTypography
ThemeRadius
ThemeShadows
ThemeNavigation
ThemeLayout
ThemeMotion
ThemeAccessibility
ThemeAssets
ThemeVersion
```

Add Zod schemas.

Ensure frontend and backend share the same validation contract where practical.

---

# PHASE 3 — DEFAULT THEME

Convert the current PawTag design into a formal:

```text
PawTag Default Theme
```

The current visual appearance should remain as close as possible to the existing production UI.

This is critical.

The first Theme Engine milestone must NOT be a redesign.

It is a formalization of the existing design.

---

# PHASE 4 — SEMANTIC TOKEN SYSTEM

Implement the semantic CSS variable architecture.

Start with:

```text
colors
radius
shadows
typography
layout
motion
```

Create a centralized theme resolver.

Do not scatter token-generation logic across components.

---

# PHASE 5 — THEME PROVIDER

Create the runtime theme mechanism.

Conceptually:

```text
ThemeProvider
```

Responsibilities:

* receive theme configuration
* validate configuration
* resolve semantic tokens
* apply CSS variables
* provide current theme state
* provide fallback defaults
* prevent malformed values from reaching DOM styles

Do not place API/business logic inside every UI component.

---

# PHASE 6 — SHARED UI MIGRATION

Migrate shared components gradually.

Order:

```text
Button
Input
Badge
Alert
Card
Modal
Dropdown
Table
Tabs
Navigation
```

After each group:

```text
typecheck
tests
build
visual review
```

Do not migrate every screen at once.

---

# PHASE 7 — THEME API

Implement backend theme management.

Include:

```text
CRUD
validation
permissions
active theme
drafts
publishing
versioning
rollback
```

Use:

```text
Express
TypeScript
Zod
Mongoose
existing auth
existing RBAC
existing audit logging
```

Do not introduce another backend framework.

---

# PHASE 8 — ACTIVE THEME

Implement:

```text
GET /api/theme/active
```

or the project's equivalent.

The public application should receive the currently published theme.

Ensure caching can be introduced later.

Do not query MongoDB independently from every React component.

---

# PHASE 9 — THEME STUDIO

Create:

```text
apps/admin
    Appearance
        Theme Studio
```

Build the UI using:

```text
packages/ui
```

Do not create a separate design system for Theme Studio.

---

# PHASE 10 — THEME STUDIO CONTROLS

Implement controls in this order:

### Brand

* logo
* favicon
* brand name if product requirements permit

### Colors

* primary
* secondary
* accent
* background
* surface

### Typography

* heading
* body
* scale

### Shape

* radius preset

### Shadows

* elevation preset

### Buttons

* style

### Cards

* style

### Navigation

* style

### Layout

* density
* width

### Motion

* motion preference

---

# PHASE 11 — LIVE PREVIEW

Implement the preview environment.

It should use the same shared components as the real application.

Do NOT create fake CSS-only preview components that behave differently from production components.

---

# PHASE 12 — PRESETS

Create initial presets.

Each must:

* be valid configuration
* pass schema validation
* pass accessibility validation
* render correctly
* not modify source code
* be reversible

---

# PHASE 13 — DRAFT / PUBLISH

Implement:

```text
Draft
Published
```

Publishing must:

* require permission
* create a version
* create an audit record
* validate configuration
* validate accessibility
* preserve previous version

---

# PHASE 14 — VERSION HISTORY

Implement:

```text
Theme History
```

Features:

```text
View
Preview
Compare
Restore
```

Restoration creates a new version.

---

# PHASE 15 — ADMIN / WEB / FINDER MIGRATION

Migrate remaining application-level hardcoded theme values.

Priority:

```text
packages/ui
      ↓
apps/admin
      ↓
apps/web
      ↓
apps/finder
```

Avoid a big-bang rewrite.

---

# PHASE 16 — CMS / PUCK

Inspect how Puck components currently receive styles.

Theme-aware Puck components should use semantic tokens.

Do NOT allow Puck content authors to bypass Theme Engine constraints.

Puck should control:

```text
content
layout
approved component options
```

Theme Engine controls:

```text
brand
colors
typography
component appearance
```

Maintain this separation.

---

# PHASE 17 — MOBILE

Only after web theming is stable:

Investigate a shared semantic theme model for React Native.

Use:

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
React Native styles
```

Do not force web CSS into React Native.

---

# PHASE 18 — ACCESSIBILITY QA

Test:

* keyboard navigation
* focus states
* color contrast
* screen reader labels
* reduced motion
* form states
* error states
* status indicators

Test multiple presets.

A theme is not complete merely because it looks good.

---

# PHASE 19 — RESPONSIVE QA

Test:

```text
mobile
tablet
desktop
large desktop
```

At minimum test:

* navigation
* dashboard
* forms
* tables
* cards
* finder
* shop
* customer portal

---

# PHASE 20 — REGRESSION QA

Verify:

```text
authentication
RBAC
orders
checkout
Stripe
subscriptions
pets
tags
finder scans
notifications
CMS
media
audit logs
mobile API
```

Theme changes must not alter functionality.

---

# 65. TESTING REQUIREMENTS

Add unit tests for:

```text
theme validation
theme normalization
color generation
token generation
fallback logic
preset validation
version creation
rollback
access control
```

Add API integration tests for:

```text
create theme
update theme
publish theme
restore theme
get active theme
unauthorized access
invalid theme
```

Add component tests for:

```text
Button
Card
Input
Badge
Alert
Navigation
```

---

# 66. VISUAL REGRESSION

If the project has screenshot tooling, use it.

Otherwise create a repeatable manual visual QA procedure.

Every major preset must be tested against representative screens.

Compare:

```text
Default
Modern
Professional
Soft
Premium
```

---

# 67. PERFORMANCE REQUIREMENTS

Theme switching must not cause:

* full page reload
* unnecessary API requests
* component remount storms
* excessive DOM updates
* layout thrashing

Prefer updating CSS variables at the appropriate root level.

Do not make every component subscribe independently to theme changes.

---

# 68. CACHING

The active published theme is relatively stable.

The architecture should permit:

```text
memory cache
HTTP cache
server cache
client cache
```

but do not prematurely introduce complex infrastructure.

Correctness comes first.

---

# 69. THEME INVALIDATION

After publish:

```text
new theme version
      ↓
invalidate active-theme cache
      ↓
clients receive new configuration
```

Ensure stale themes do not remain active indefinitely.

---

# 70. FAILURE HANDLING

If publishing fails:

```text
Previous theme remains active.
```

If theme retrieval fails:

```text
PawTag Default Theme remains active.
```

If a malformed theme somehow reaches the frontend:

```text
Reject malformed values.
Use defaults.
Report error.
```

Never allow malformed theme configuration to break the application.

---

# 71. OBSERVABILITY

Theme operations should be observable through the existing logging infrastructure.

Useful events:

```text
theme_load_failed
theme_validation_failed
theme_publish_failed
theme_restore_failed
theme_asset_upload_failed
```

Use Pino and existing error tracking conventions.

Do not introduce a separate logging system.

---

# 72. AI CODING AGENT RULES

The AI coding agent must behave as a senior engineer.

Before editing:

```text
inspect
understand
plan
```

Do not immediately code.

Before creating a new component:

```text
search for existing component
```

Before creating a utility:

```text
search for existing utility
```

Before creating a model:

```text
inspect existing models
```

Before creating a permission:

```text
inspect existing RBAC
```

Before creating an audit event:

```text
inspect existing audit implementation
```

---

# 73. NO DUPLICATION

Do not create:

```text
ThemeButton
ThemeCard
ThemeInput
```

if existing shared components can be made theme-aware.

Prefer:

```text
Button
Card
Input
```

with theme support.

---

# 74. NO HARD-CODED COLORS

After migration, avoid introducing:

```text
#0D9488
#14B8A6
#0F766E
```

directly into components.

Use semantic tokens.

Exceptions:

* source theme definitions
* brand asset processing
* validated preset definitions
* charts where a dedicated token system exists

---

# 75. NO RANDOM TAILWIND OVERRIDES

Do not solve theme problems with:

```text
!important
```

or giant conditional class strings.

If the issue is systemic, fix the token/component architecture.

---

# 76. NO ARBITRARY CSS EDITOR

Do not implement:

```text
Custom CSS
```

as the primary Theme Studio mechanism.

The system must remain structured and safe.

---

# 77. NO SOURCE-CODE REWRITING FOR THEMES

Changing:

```text
Primary color
```

must NOT cause the AI or application to modify React source code.

Correct:

```text
Theme configuration changes.
```

Incorrect:

```text
AI edits 127 files to replace teal with purple.
```

---

# 78. THEME APPLICATION BOUNDARY

The runtime application should know:

```text
active theme configuration
```

It should NOT know:

```text
who created the theme
why the theme exists
what AI recommended
what UI/UX Pro Max suggested
```

Those belong to admin/design-development processes.

---

# 79. AI / UIUX PRO MAX BOUNDARY

UI/UX Pro Max belongs to the development/design workflow.

It is not part of:

```text
runtime API
runtime database
production browser bundle
```

unless a future explicit requirement changes this.

---

# 80. THEME STUDIO SHOULD BE NON-TECHNICAL

Do not expose terminology like:

```text
CSS variable
semantic token
Tailwind class
hex value
HSL
RGB
```

to normal administrators.

Use:

```text
Primary Brand Color
Button Style
Corner Style
Interface Density
Navigation Style
```

Advanced technical information can be hidden.

---

# 81. HUMAN-FRIENDLY DESCRIPTIONS

Every major control should explain itself.

Example:

```text
Interface Density

Controls how much information is displayed
on screen at once.

Compact
More information, less spacing

Comfortable
Balanced spacing

Spacious
More breathing room
```

The UI should teach the administrator what a setting does.

---

# 82. PREVIEW BEFORE PUBLISH

Every potentially high-impact setting should visibly update the preview.

The administrator should be able to experiment without fear.

This is one of the most important parts of the experience.

---

# 83. UNSAVED CHANGES

If the user has unsaved changes:

```text
Unsaved changes
```

must be clearly visible.

If navigating away:

```text
You have unsaved theme changes.

[Stay]
[Discard]
```

Do not silently lose work.

---

# 84. DRAFT AUTOSAVE

Autosave may be implemented later.

If implemented:

* save drafts only
* never auto-publish
* debounce requests
* show save state

Example:

```text
Saving...
Saved just now
```

---

# 85. RESET CONTROLS

Provide:

```text
Reset section
Reset theme
Restore PawTag Default
```

Require confirmation for destructive reset operations.

---

# 86. THEME DUPLICATION

Allow:

```text
Duplicate theme
```

Example:

```text
PawTag Modern
      ↓
Duplicate
      ↓
My Brand
```

This is useful for organizations that want variations.

---

# 87. THEME NAMING

Theme names must be human-friendly.

Examples:

```text
PawTag Classic
Spring Campaign
Corporate Brand
Partner Brand
Holiday Campaign
```

Avoid exposing internal IDs.

---

# 88. FUTURE CAMPAIGN SUPPORT

Do not implement campaign scheduling unless specifically required.

However, the schema may eventually support:

```text
publishAt
unpublishAt
```

Do not add scheduling complexity prematurely.

---

# 89. FUTURE MULTI-BRAND SUPPORT

Design the system so that themes can eventually belong to:

```text
organization
brand
tenant
```

But do not implement multi-tenant theme isolation unless the current product requires it.

---

# 90. DATA MODEL PRINCIPLE

Do not store every CSS property imaginable.

Store meaningful product-level decisions.

Good:

```text
density: comfortable
buttonStyle: soft
radiusPreset: rounded
```

Bad:

```text
buttonBorderRadius: 11px
buttonPaddingLeft: 23px
buttonPaddingRight: 27px
```

The first creates a maintainable design system.

The second creates a visual mess.

---

# 91. DESIGN TOKEN NORMALIZATION

The Theme Engine may internally convert:

```text
rounded
```

into:

```text
button = 12px
card = 16px
input = 10px
```

The administrator sees:

```text
Rounded
```

The application receives deterministic values.

---

# 92. DESIGN SYSTEM GOVERNANCE

Every new theme option must answer:

```text
Why does this need to be configurable?
```

If the answer is:

```text
Because technically we can make it configurable.
```

do not add it.

Configuration should exist where it provides meaningful product value.

---

# 93. WHAT SHOULD NOT BE THEMED

Avoid exposing these as normal settings:

* individual component margins
* individual component widths
* individual page layouts
* arbitrary z-index
* arbitrary CSS
* arbitrary animations
* arbitrary breakpoints
* arbitrary icon sets
* arbitrary HTML
* arbitrary JavaScript
* arbitrary Tailwind classes

These are developer-level implementation details.

---

# 94. THEME ENGINE VS PAGE BUILDER

Maintain a strict distinction.

### Theme Engine

Controls:

```text
How the application looks.
```

### Puck/Page Builder

Controls:

```text
What content/layout the page contains.
```

Example:

Theme:

```text
button = rounded
primary = teal
font = Inter
```

Puck:

```text
Hero
Heading
Image
CTA
Feature grid
```

Do not merge these systems into one uncontrolled editor.

---

# 95. THEME ENGINE VS CMS

CMS controls:

```text
content
```

Theme Engine controls:

```text
presentation system
```

The CMS should automatically inherit the active theme.

---

# 96. DESIGN TOKEN DOCUMENTATION

Update `DESIGN.md` once the Theme Engine architecture is established.

Document:

* semantic token system
* runtime theming
* default theme
* theme configuration
* accessibility rules
* approved presets

Do not delete the existing design philosophy.

The existing `DESIGN.md` remains the conceptual design authority.

The Theme Engine becomes its implementation mechanism.

---

# 97. MIGRATION SUCCESS CRITERIA

Migration is successful when:

```text
Changing primary brand color
```

updates:

* buttons
* links
* active navigation
* focus states
* badges where appropriate
* progress indicators
* relevant finder UI
* relevant customer UI
* relevant admin UI

without modifying source code.

---

# 98. TRUE SUCCESS TEST

A non-technical administrator should be able to:

```text
Open Theme Studio
        ↓
Choose "Modern"
        ↓
Change primary color
        ↓
Choose rounded corners
        ↓
Change typography
        ↓
Preview
        ↓
Save
        ↓
Publish
```

and the application should visually update.

No developer.

No code change.

No deployment required.

No Tailwind rebuild.

No manual CSS.

---

# 99. DEFINITION OF DONE

The Theme Engine is NOT complete until all of the following are true.

## Architecture

* [ ] Theme configuration exists
* [ ] Semantic token system exists
* [ ] Default theme exists
* [ ] Runtime theme resolver exists
* [ ] Fallback exists

## Backend

* [ ] Theme model exists
* [ ] API exists
* [ ] Zod validation exists
* [ ] RBAC exists
* [ ] Audit logging exists
* [ ] Publishing exists
* [ ] Versioning exists
* [ ] Rollback exists

## Frontend

* [ ] Theme Provider exists
* [ ] CSS variables work
* [ ] Shared UI components consume tokens
* [ ] Admin Theme Studio exists
* [ ] Live preview exists
* [ ] Presets exist
* [ ] Unsaved-change handling exists

## Accessibility

* [ ] Contrast validation exists
* [ ] Focus states work
* [ ] Reduced motion works
* [ ] Keyboard navigation works

## Reliability

* [ ] Theme API failure falls back
* [ ] Invalid theme falls back
* [ ] Previous theme remains active if publish fails
* [ ] Rollback works

## Regression

* [ ] Existing authentication works
* [ ] Existing RBAC works
* [ ] Orders work
* [ ] Payments work
* [ ] Subscriptions work
* [ ] Pets work
* [ ] Tags work
* [ ] Finder works
* [ ] CMS works
* [ ] Audit logs work

---

# 100. FINAL AI EXECUTION INSTRUCTION

When asked to implement the PawTag Theme Engine, do NOT immediately start editing files.

First:

```text
1. Inspect repository.
2. Inspect DESIGN.md.
3. Inspect ARCHITECTURE.md.
4. Inspect packages/ui.
5. Inspect existing CSS/Tailwind configuration.
6. Inspect existing theme-related code.
7. Inspect RBAC.
8. Inspect audit logging.
9. Inspect media management.
10. Inspect CMS/Puck.
11. Inspect tests.
12. Inspect git status and current branch.
```

Then produce:

```text
A. Current-state assessment
B. Risks
C. Proposed architecture
D. Files likely to change
E. Files that should NOT change
F. Migration plan
G. Testing plan
H. Rollback strategy
```

Do not begin broad implementation until the plan is internally consistent.

---

# 101. IMPLEMENTATION SAFETY RULE

If implementation requires changing a working subsystem unrelated to theming:

STOP.

Explain:

```text
Why the dependency exists
What would change
What regression risk exists
What safer alternatives exist
```

Then proceed only if the change is necessary.

---

# 102. FINAL PRODUCT VISION

The end result should feel like:

```text
WordPress Theme Customizer
+
Modern SaaS Design System
+
Enterprise Configuration Management
+
Live Visual Preview
+
Version Control
+
Accessibility Guardrails
+
PawTag-specific UX
```

without becoming:

```text
A dangerous arbitrary CSS editor
```

---

# 103. THE GOLDEN RULE

The Theme Engine exists so that:

> **A non-technical PawTag administrator can change the visual identity of the product without changing the product itself.**

The system must separate:

```text
WHAT THE PRODUCT DOES
```

from:

```text
HOW THE PRODUCT LOOKS
```

The Theme Engine controls the second.

It must never accidentally break the first.

---

# 104. FINAL ARCHITECTURAL MODEL

The completed architecture should conceptually look like:

```text
                         PAWTAG
                           │
              ┌────────────┴────────────┐
              │                         │
        PRODUCT LOGIC              PRESENTATION
              │                         │
       Express/API                Theme Engine
              │                         │
       MongoDB/Models              Theme Config
              │                         │
       Business Rules             Semantic Tokens
              │                         │
        Auth / RBAC                CSS Variables
              │                         │
       Payments / Tags             packages/ui
              │                         │
       Pet Recovery               Web/Admin/Finder
                                        │
                                        │
                                ┌───────┴────────┐
                                │                │
                           Theme Studio       Puck CMS
                                │                │
                           Admin controls      Content
                                │                │
                                └───────┬────────┘
                                        │
                                      User
                                        │
                               Non-technical SME
```

And the development-time design intelligence layer sits outside production:

```text
                    DEVELOPMENT TIME

                  Product Owner / SME
                          │
                          ▼
                     DESIGN.md
                          │
                          ▼
                UI/UX Pro Max Skill
                          │
                          ▼
               AI Coding Agent
                          │
                          ▼
                Theme Engine Code
                          │
                          ▼
                   PawTag Runtime
```

The key architectural decision is:

**UI/UX Pro Max helps the AI decide what good design could look like.
`DESIGN.md` defines what good PawTag design means.
Theme Studio lets the SME control approved visual decisions.
The Theme Engine converts those decisions into runtime design tokens.
`packages/ui` renders those tokens consistently.**

That separation should remain intact throughout the implementation.

One important recommendation: **do not give the AI this document and tell it “build everything.”** Give it this document and instruct it to start at **Phase 0 only**, inspect the repository, produce `theme-engine-discovery.md`, and stop. Then let the agent execute one phase at a time. That will dramatically reduce the chance of an LLM doing a giant destructive rewrite of your existing PawTag codebase.
