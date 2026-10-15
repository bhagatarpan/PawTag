# Homepage Hero Slider — Implementation & Design Reference

**Status:** Cinematic redesign implemented (2026-10-15); final photography pending owner upload
**Branch:** `main`
**Scope:** Homepage hero carousel only. Sibling homepage sections (ticker, testimonials, guardian promo) are untouched — see "Known issues outside scope".

---

## 1. Goal

A **premium full-width cinematic hero**: the photograph covers the entire hero canvas edge-to-edge; headlines, descriptions, CTAs, and controls are real HTML layered over it behind a readability scrim. Three approved stories, CMS-managed, image-ready, accessible, and fully visible on mobile.

> Historical note: the first implementation (2026-10-14) used an editorial split layout (content left, boxed 4:3 image right). The business owner approved the full-bleed photographic direction; this document describes the current implementation.

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
| Layout | **Full-bleed cinematic canvas** — media + scrim absolute `inset-0`; content overlaid in the `max-w-7xl` grid | Owner-approved direction: premium pet-lifestyle advertising, not a SaaS split panel |
| Layout desktop | Content left-anchored (max `max-w-2xl`), vertically centered; subject expected right-of-frame | Photograph dominates; scrim guarantees text contrast on any photo brightness |
| Layout mobile | Same canvas, content anchored low (`justify-end`), bottom-weighted scrim; portrait mobile crop preferred | Photograph never hidden; text stays legible without cutting the subject |
| No image yet | Deep teal→charcoal gradient fills the whole canvas (no watermark, no box) | Polished before photography exists; composition identical with/without photos |
| Responsive images | Single `<picture>` — mobile crop `<source media="(max-width: 767px)">`, desktop `<img>` fallback | One download per slide (two `<img>` elements would fetch both); native browser selection |
| Focal points | Separate desktop (`imageFocalPoint`) and mobile (`imageMobileFocalPoint`) CMS fields; mobile falls back to desktop on legacy records | Portrait and landscape crops keep different subjects visible; additive Mixed-blob key, no migration |
| Slide count | 3 approved stories (Guardian/Gold preserved but deactivated, not deleted) | Core product focus per owner decision; memberships promoted via dedicated sections |
| Text | Always real HTML, never in the image | Accessibility, SEO, CMS editability |
| Carousel engine | Custom hook (no framework) | Existing pattern was fine; requirements are modest; avoids new dependency |
| Autoplay | 7s default, pauses on hover/focus/hidden/user-pause/reduced-motion, visible pause/play | WCAG 2.2 AA |
| Transition | Crossfade 600ms (instant under reduced-motion) | Restrained, no layout shift |
| Legacy CMS data | New fields added to `content` (Mixed) — old records render via fallbacks (`tag`→eyebrow, `imageUrl`→desktop, mobile focal→desktop focal) | Zero migration, zero data loss |
| Rollout | Migration script adds 3 new slides + **deactivates** (never deletes) old ones | Fully reversible via admin toggle |
| CTAs | Verified real routes only: `/shop`, `/about`, `/pet-recovery`; unsafe/invalid links fall back safely | No dead links, no open redirects |

### Decision tree — slide rendering

```text
CMS slides present?
 ├─ No  → render DEFAULT_HERO_SLIDES (3 approved stories)
 └─ Yes → normalize each: eyebrow(legacy:tag) → headline → sub → CTAs(legacy:ctaText/ctaUrl)
          images: desktopImageUrl (legacy: imageUrl) + mobileImageUrl + focal points
Slide has image URL?
 ├─ Yes → <picture>: mobile crop <source media="(max-width: 767px)"> when set,
 │         desktop <img> (eager + fetchPriority for the active first slide; lazy otherwise)
 │         onError → fallback gradient canvas
 └─ No  → fallback gradient canvas (full-bleed, no watermark)
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

### Desktop ≥768px — full-bleed cinematic

```text
┌────────────────────────────────────────────────────────────────────────┐
│  PawTag  Shop Guardian Membership   Cart   Sign In                     │  ← existing navbar
├────────────────────────────────────────────────────────────────────────┤
│▓▓▓▓ FULL-WIDTH PHOTOGRAPH (or teal→charcoal fallback gradient) ▓▓▓▓▓▓▓▓│
│▓▓▓▓ scrim: dark left → clear right ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│                                                                        │
│   PET SAFETY, SIMPLIFIED              (subject right-of-frame)         │  ← eyebrow primary-300
│                                                                        │
│   They can't tell someone                                                     headline: white,
│   where they live. Their tag                                                  display scale,
│   can.                                                                        max-w-2xl
│   Give your pet a simple way to                                              ← sub: white/85
│   be identified and help someone…                                            │
│                                                                        │
│   [ Shop PawTag → ]   [ How PawTag Works ]                              │  ← primary fill + white outline
│                                                                        │
│   ▰ ─ ─                                              ⏸  ◀  ▶           │  ← bars left, controls right
└────────────────────────────────────────────────────────────────────────┘
```

### Mobile <768px (same canvas — content anchored low)

```text
┌──────────────────────────┐
│ ≡  PawTag          🛒 👤 │
├──────────────────────────┤
│▓▓▓▓▓▓▓ PHOTOGRAPH ▓▓▓▓▓▓│  ← full-bleed; portrait crop preferred;
│▓▓▓▓▓ (subject top) ▓▓▓▓▓│     scrim: light top → dark bottom
│                          │
│ PET SAFETY, SIMPLIFIED   │
│ They can't tell someone  │
│ where they live. Their   │
│ tag can.                 │
│                          │
│ Give your pet a simple   │
│ way to be identified…    │
│                          │
│ [ Shop PawTag → ]        │  ← full-width, 48px touch target
│ [ How PawTag Works ]     │
│                          │
│  ▰ ─ ─   [⏸][‹][›]      │  ← controls clustered left (clear of FAB)
└──────────────────────────┘
```

### Fallback state (no photography yet)

```text
┌───────────────────────────────┐   Gradient: from-primary-900 via-gray-900
│                               │   to-primary-800, full-bleed canvas.
│   PET SAFETY, SIMPLIFIED      │   Same composition as the photographic
│                               │   state — scrim + white text + controls.
│   They can't tell someone     │   No watermark. No text baked into
│   where they live…            │   media. No broken-image icon.
│                               │   Identical on desktop + mobile.
│   [ Shop PawTag ] [ How… ]    │
│   ▰ ─ ─              ⏸ ◀ ▶   │
└───────────────────────────────┘
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
| `mobileImageUrl` | string (media picker) | Optional purpose-cropped image; desktop image served below 768px otherwise |
| `imageAlt` | string | Alt text; empty = decorative |
| `imageFocalPoint` | enum | Desktop object-position preset (center/top/right/bottom/…) |
| `imageMobileFocalPoint` | enum | Mobile object-position preset; falls back to `imageFocalPoint` on legacy records |
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
- [x] Stage 9 — **Cinematic full-bleed redesign** (2026-10-15): split layout removed; full-viewport media canvas + readability scrim; `<picture>` responsive images; separate desktop/mobile focal points (`imageMobileFocalPoint` additive CMS key, validated + projected); dark-surface controls/typography; deep teal→charcoal fallback (paw watermark removed); admin preview rebuilt to match the live composition; docs + briefs updated

## 11. Verification Evidence

### Initial build (2026-10-14, branch `feature/homepage-hero-slider`)

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

### Cinematic redesign (2026-10-15, branch `main`)

| Check | Result |
|---|---|
| `pnpm vitest run tests/unit/hero-*.test.*` | **28/28 PASS** (6 new: picture/source, full-bleed layers, fallback canvas, focal points, eager/lazy) |
| `pnpm vitest run tests/integration/cms-homepage-hero.test.ts` | **16/16 PASS** (2 new: mobile focal save/project + invalid-value rejection) |
| `pnpm exec playwright test --config playwright.hero.config.ts` | **11/11 PASS** (3 new: desktop full-bleed width, photograph-covers-canvas layering, updated mobile composition) |
| Typecheck api / web / admin · build web / admin | **PASS** |
| Built-CSS inspection | All scrim + focal classes compiled (`071f22` stops incl. `/95`, `md:object-*`) — caught & fixed a dropped `/92` opacity stop mid-work |
| Screenshot inspection 320/375/390/430/768/1280×720/1280/1440/1920 + slide 2 crossfade | Done — full-bleed canvas, scrim, alignment, controls verified at every viewport |

**E2E note:** the standard web preview proxies `/api` → `localhost:5000`, so `playwright.hero.config.ts` runs an isolated port and the spec stubs the CMS endpoint (`page.route`) for determinism.

**Known pre-existing issue (not fixed — outside hero scope):** the homepage page-level `scrollWidth` exceeds the viewport by ~20px at desktop widths because `FadeIn direction="left"` (used for `ResponsibilityScore` in `Home.tsx`) renders a `translateX(20px)` pre-reveal state. Hero-level overflow tests are scoped to the hero box accordingly.

**Photography not yet tested** — no real hero images exist in the environment; the image path is verified with component tests, integration tests, and a data-URI fixture in Chromium. Final visual validation after the owner uploads the three photographs remains an explicit follow-up.
