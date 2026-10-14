# Homepage Hero Slider — Implementation & Design Reference

**Status:** In progress (progress tracked in the checklist at the bottom)
**Branch:** `feature/homepage-hero-slider`
**Scope:** Homepage hero carousel only. Sibling homepage sections (ticker, testimonials, guardian promo) are untouched — see "Known issues outside scope".

---

## 1. Goal

Replace the gradient/illustration hero (5 slides, visual hidden on mobile, fake statistics) with a **premium, photography-led editorial carousel**: three approved stories, real HTML text, CMS-managed, image-ready, accessible, and fully visible on mobile.

---

## 2. Architecture & Data Flow (verified)

```text
Admin → /cms/homepage (CmsHomepageSections.tsx + SectionContentEditor/HeroSlideEditor)
   POST/PUT /api/admin/cms/homepage            (authenticate + cms.homepage.* permissions,
                                                hero content validated server-side, audit-logged)
        ↓  CmsHomepageSection (content: Mixed blob — no schema migration needed)
Public  GET /api/public/cms/homepage/sections?sectionType=hero_slide
        (active + not deleted, ordered; public DTO strips internals)
        ↓
useHomepageSections('hero_slide')  →  HeroSlider (normalizes legacy + new fields)
        ↓
Fallback: DEFAULT_HERO_SLIDES (3 approved stories) when CMS returns nothing
```

Files: `apps/web/src/components/hero/*` · `apps/web/src/components/HeroSlider.tsx` (re-export shim) ·
`packages/api/src/routes/cms-homepage-admin.ts` · `packages/api/src/routes/cms-public-v2.ts` ·
`packages/api/src/seeds/seed-cms.ts` · `scripts/migrate-hero-slides-v2.ts` ·
`apps/admin/src/components/SectionContentEditor.tsx` (HeroSlideEditor) ·
`apps/web/src/hooks/useCms.ts` (unchanged — `useHomepageSections`).

---

## 3. Design Decisions & Decision Tree

| Decision | Choice | Why |
|---|---|---|
| Layout desktop | Editorial split ~42% content / 58% media, white/primary-50 base (DESIGN.md tokens) | Image is the hero element; heavy gradients replaced by calm premium base |
| Layout mobile | **Stacked, image first** — the old `hidden md:` pattern is removed | Mobile gets the full brand impression; legibility without text-over-subject risk |
| No image yet | Refined teal gradient + oversized low-opacity PawPrint watermark | Polished before photography exists; no broken images, no stock photos |
| Slide count | 3 approved stories (Guardian/Gold preserved but deactivated, not deleted) | Core product focus per owner decision; memberships promoted via dedicated sections |
| Text | Always real HTML, never in the image | Accessibility, SEO, CMS editability |
| Carousel engine | Custom hook (no framework) | Existing pattern was fine; requirements are modest; avoids new dependency |
| Autoplay | 7s default, pauses on hover/focus/hidden/user-pause/reduced-motion, visible pause/play | WCAG 2.2 AA |
| Transition | Crossfade 600ms (instant under reduced-motion) | Restrained, no layout shift |
| Legacy CMS data | New fields added to `content` (Mixed) — old records render via fallbacks (`tag`→eyebrow, `imageUrl`→desktop) | Zero migration, zero data loss |
| Rollout | Migration script adds 3 new slides + **deactivates** (never deletes) old ones | Fully reversible via admin toggle |
| CTAs | Verified real routes only: `/shop`, `/about`, `/pet-recovery`; unsafe/invalid links fall back safely | No dead links, no open redirects |

### Decision tree — slide rendering

```text
CMS slides present?
 ├─ No  → render DEFAULT_HERO_SLIDES (3 approved stories)
 └─ Yes → normalize each: eyebrow(legacy:tag) → headline → sub → CTAs(legacy:ctaText/ctaUrl)
          images: desktopImageUrl (legacy: imageUrl) + mobileImageUrl + focal point
Slide has image URL?
 ├─ Yes → <img> (eager+fetchPriority for active first slide; lazy otherwise)
 │         onError → fallback gradient + watermark
 └─ No  → fallback gradient + watermark
CTA URL valid? (relative /path or http(s)://)
 ├─ Primary invalid   → CTA points at /shop (safe fallback, logged)
 └─ Secondary invalid → secondary CTA omitted
```

---

## 4. Approved Content (3 slides)

| # | Eyebrow | Headline | Primary CTA → | Secondary CTA → |
|---|---|---|---|---|
| 1 | PET SAFETY, SIMPLIFIED | They can't tell someone where they live. Their tag can. | Shop PawTag → `/shop` | How PawTag Works → `/about` |
| 2 | SMART IDENTIFICATION | One scan can make all the difference. | See How It Works → `/about` | Explore PawTag → `/shop` |
| 3 | MORE THAN A NAME TAG | Their important details, always close. | Discover Pet Profiles → `/pet-recovery` | Get Started → `/shop` |

Copy rules: no statistics, no testimonials, no prices in hero copy. Membership/Guardian promotion stays in the dedicated homepage sections.

---

## 5. Screen Mockups (visual reference)

### Desktop ≥768px

```text
┌────────────────────────────────────────────────────────────────────────┐
│  PawTag  Shop Guardian Membership   Cart   Sign In                     │  ← existing navbar
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   PET SAFETY, SIMPLIFIED                       ┌───────────────────┐   │  ← eyebrow (primary-700,
│                                                │                   │   │    uppercase, tracked)
│   They can't tell someone                     │                   │   │
│   where they live.                            │   [ PHOTOGRAPHY   │   │  ← headline: gray-900,
│   Their tag can.                              │     4:3, rounded   │   │    display scale,
│                                                │     3xl, shadow   │   │    max 2 lines]
│   Give your pet a simple way                   │                   │   │
│   to be identified and help                    │   fallback: teal  │   │  ← sub: gray-600, body-lg
│   someone reach you if they wander.            │   gradient + paw  │   │
│                                                │   watermark       │   │
│   [ Shop PawTag → ]   [ How PawTag Works ]     │                   │   │  ← primary: bg-primary-600
│                                                └───────────────────┘   │    secondary: outline
│   ● ─ ○     (slide 1 of 3)                 [‹] [▶/❚❚] [›]              │  ← controls row: dots left,
│                                                                        │    arrows+pause right
└────────────────────────────────────────────────────────────────────────┘
```

### Mobile <768px (stacked — image never hidden)

```text
┌──────────────────────────┐
│ ≡  PawTag          🛒 👤 │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │                      │ │  ← image: aspect-[4/3],
│ │   [ PHOTOGRAPHY ]    │ │     rounded-2xl, focal point
│ │                      │ │
│ └──────────────────────┘ │
│                          │
│ PET SAFETY, SIMPLIFIED   │
│ They can't tell someone  │
│ where they live.         │
│ Their tag can.           │
│                          │
│ Give your pet a simple   │
│ way to be identified…    │
│                          │
│ [ Shop PawTag → ]        │  ← full-width, 48px touch target
│ [ How PawTag Works ]     │
│                          │
│  ● ─ ○        [‹][▶][›]  │
└──────────────────────────┘
```

### Fallback state (no photography yet)

```text
┌───────────────────────┐   Gradient: from-primary-600 to-primary-800
│                       │   Watermark: PawPrint, white/10, oversized,
│        🐾             │   centered. No text. No broken-image icon.
│      (giant paw)      │   Identical treatment desktop + mobile.
│                       │
└───────────────────────┘
```

---

## 6. CMS Field Reference (`content` keys)

| Field | Type | Notes |
|---|---|---|
| `eyebrow` | string | Legacy slides: falls back to `tag` |
| `headline` | string | **Required** by admin + server validation |
| `sub` | string | Supporting copy |
| `ctaText` / `ctaUrl` | string | Primary CTA; URL must be relative (`/shop`) or http(s) |
| `secondaryCtaText` / `secondaryCtaUrl` | string | Optional; omitted when invalid/empty |
| `desktopImageUrl` | string (media picker) | Legacy fallback: `imageUrl` |
| `mobileImageUrl` | string (media picker) | Optional purpose-cropped image |
| `imageAlt` | string | Alt text; empty = decorative |
| `imageFocalPoint` | enum | object-position preset (center/top/right/bottom/…) |
| `duration` | number 3–30 | Autoplay seconds; default 7 |
| *legacy:* `tag`, `bg`, `visualType`, `stats`, `flowSteps` | — | Tolerated, ignored by new renderer, still editable for restored slides |

---

## 7. Business & Safety Rules

1. Never publish statistics, testimonials, or prices in hero content.
2. CTA destinations must be real routes; unsafe schemes (`javascript:`, `data:`, `//host`) rejected server-side and client-side.
3. Old slides are deactivated, never deleted; restoration = admin toggle.
4. Admin mutations are audit-logged (`cms_homepage_section_*`) and permission-gated (`cms.homepage.*`).
5. Public endpoint returns a trimmed DTO (no `__v`/`deletedAt`/timestamps; hero content limited to known keys).
6. No final images generated in this workstream — creative briefs prepared separately (§9).

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Existing DBs still serve `/gold` dead link (old slide 5) | Migration script deactivates legacy slides; seed fixed for fresh DBs |
| React Router resolution in root component tests | Component tests mock `react-router-dom`; pure helpers tested directly |
| Playwright not installed | Attempt install; if blocked, E2E documented as pending with repro steps |
| LCP regression from hero image | First slide eager + fetchPriority; lazy others; aspect-ratio boxes prevent CLS |
| Legacy admin content strands | Legacy editors kept (labelled), fallbacks in renderer |

**Known issues outside this scope (reported, not fixed):** fake stats/testimonials in `EngagementTicker`/`Testimonials`/`ResponsibilityScore`; hardcoded prices in `GuardianSection`; `/gold` links in email templates (`welcome.ts`, `order-confirmation.ts`, `email.service.ts:617`); admin reorder is a non-atomic double-PUT.

---

## 9. Image Production (owner action — after implementation)

Three photographs per `docs/ux/HERO-IMAGE-CREATIVE-BRIEFS.md`. Upload via Admin → CMS → Media, then assign in Admin → CMS → Homepage Sections per slide (desktop + optional mobile crop).

---

## 10. Progress Checklist

- [x] Stage 1 — Discovery & feature document
- [x] Stage 2 — Data & content (3-slide defaults, seed fixed incl. `/gold`, migration script)
- [x] Stage 3 — Component redesign (`components/hero/` — Slider/SlideContent/SlideMedia/Controls + hook + types/links/slides modules)
- [x] Stage 4 — Carousel behaviour (7s autoplay, all pause conditions, keyboard, swipe, crossfade, reduced-motion)
- [x] Stage 5 — CMS improvements (editor with previews/image pickers/validation; server-side zod; audit logging; public DTO trim)
- [x] Stage 6 — Responsive & performance (visual review at 375/768/1280/1920; eager LCP first slide, lazy others; aspect-ratio CLS guard; mobile FAB-overlap defect found in screenshots and fixed)
- [x] Stage 7 — Testing (36 unit/component + 14 API integration + **8 browser E2E passed**; web/admin/api builds + typechecks clean; full unit suite 1044/1044)
- [x] Stage 8 — Documentation, creative briefs, skill extraction, README/AGENTS/DESIGN updates

## 11. Verification Evidence (2026-10-14, branch `feature/homepage-hero-slider`)

| Check | Result |
|---|---|
| `pnpm vitest run tests/unit/hero-*.test.*` (links, slides, slider) | **22/22 PASS** |
| `pnpm vitest run tests/integration/cms-homepage-hero.test.ts` | **14/14 PASS** |
| `pnpm vitest run tests/integration/cms-and-subs.test.ts` (regression) | **45/45 PASS** |
| `pnpm test:unit` (full suite) | **1044/1044 PASS** |
| `pnpm exec playwright test --config playwright.hero.config.ts` (real Chromium, isolated port, CMS stubbed) | **8/8 PASS** (+ visual capture run) |
| Typecheck api / web / admin · build web / admin | **PASS** |
| `scripts/migrate-hero-slides-v2.ts` dry-run vs dev DB | **PASS** — plans 3 adds + 6 legacy deactivations (incl. `/gold` slide), 0 mutations |
| Screenshot inspection 375/768/1280/1920 + slide 2 | Done — mobile FAB/controls overlap found & fixed, re-verified |

**E2E note:** the standard web preview proxies `/api` → `localhost:5000`, so `playwright.hero.config.ts` runs an isolated port and the spec stubs the CMS endpoint (`page.route`) for determinism. `pnpm test:e2e:hero` runs the suite.

**Migration not yet executed** against any database — dry-run only; run `scripts/migrate-hero-slides-v2.ts --apply --yes` after founder review.
