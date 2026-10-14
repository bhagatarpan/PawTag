# Skill: CMS Homepage Sections

Work with `CmsHomepageSection`-backed homepage content (hero slides, how-it-works, trust, testimonials, banners, FAQs). `AGENTS.md` remains authoritative; `docs/DESIGN.md` governs visuals.

## Architecture (verified)

```text
Admin: apps/admin/src/pages/cms/CmsHomepageSections.tsx
  + apps/admin/src/components/SectionContentEditor.tsx  (typed editor per sectionType via editorMap)
      → POST/PUT /api/admin/cms/homepage        (authenticate + cms.homepage.* RBAC)
        packages/api/src/routes/cms-homepage-admin.ts
          ↓  CmsHomepageSection (packages/db): sectionType enum + content: Mixed (untyped blob)
Public: GET /api/public/cms/homepage/sections[?sectionType=]  (packages/api/src/routes/cms-public-v2.ts)
          ↓  trimmed projection (no __v/timestamps/deletedAt; hero content limited to known keys)
Web:    useHomepageSections(type) in apps/web/src/hooks/useCms.ts → section components
```

## Rules

1. **`content` is a Mixed blob** — new content keys need no DB migration. Renderer must tolerate missing/legacy keys with safe fallbacks; never assume a key exists.
2. **Typed editor per type**: adding a `sectionType` requires four synchronized changes — the Mongoose enum, `SECTION_TYPES` in `CmsHomepageSections.tsx`, the `editorMap` in `SectionContentEditor.tsx`, and a typed sub-editor (else the raw-JSON `FallbackEditor` appears).
3. **Images**: use the shared `ImagePicker` (`apps/admin/src/components/ImagePicker.tsx`) — values are **plain URL strings** from the CMS media library (Admin → CMS → Media; 10 MB, WebP/AVIF/JPG allowed). Do not reference `CmsMedia.thumbnails` (never populated).
4. **Validate server-side, always**: CMS content is rendered to visitors. Hero content uses `heroSlideContentSchema` (`packages/api/src/middleware/schemas.ts`) — URL fields must be site paths (`/shop`) or http(s); `javascript:`, `data:`, and `//host` are rejected. Keep client-side checks as convenience mirrors only.
5. **Public projection**: strip Mongo internals; for new content keys, extend the projector allow-list in `cms-public-v2.ts` so unknown/junk keys never reach visitors.
6. **Audit + log every mutation** (create/update/delete/toggle) via `auditService.log(req.auditContext, …)` (category `CONFIG`) plus a `logger.info` line — CMS publication is an auditable action.
7. **Content policy (hero specifically)**: no statistics, testimonials, or prices in hero content. CTA destinations must be verified real routes.
8. **Rollout is additive-only**: new default content = seed for fresh DBs (idempotent, never overwrites) + a dry-run-first migration script for existing DBs (deactivate, never delete).

## Testing conventions

- Integration: supertest + `setupTestDb`/`clearDb` + `createSuperAdmin`/`createCustomerWithRBAC` (`tests/integration/`), see `cms-homepage-hero.test.ts`.
- Component: `tests/unit/*.test.tsx` with `// @vitest-environment happy-dom` (root config is node env); jest-dom matchers are NOT registered — use plain assertions; `getByRole` ignores `aria-hidden` subtrees, so query hidden-state DOM directly.
- Browser E2E: `playwright.hero.config.ts` runs the hero suite on an isolated port (the default web preview proxies `/api` to `localhost:5000`, so a running dev API leaks live data into tests — stub CMS responses with `page.route`).
