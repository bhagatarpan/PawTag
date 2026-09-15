# Enterprise WYSIWYG Hero Slider — Progress Tracker

**Branch:** `feature/enterprise-hero-slider`
**Started:** 2026-09-15
**Status:** In Progress

---

## Phase 0: Foundation
**Status:** 🔄 In Progress
**Estimated:** 2-3 days

- [ ] Install SwiperJS dependency
- [ ] Create `heroSliderConfig.tsx` with PawTag-approved components
- [ ] Extract shared component definitions
- [ ] Create `HeroSliderSettings` CMS settings
- [ ] Add new API endpoints for hero slider management

---

## Phase 1: Admin Slide Management
**Status:** ⏳ Pending
**Estimated:** 3-4 days

- [ ] Create `HeroSliderManager.tsx` with drag-and-drop reorder
- [ ] Implement slide CRUD (create, edit, delete, duplicate)
- [ ] Add draft/publish workflow
- [ ] Generate slide thumbnails
- [ ] Add admin permissions for hero slider

---

## Phase 2: WYSIWYG Editor
**Status:** ⏳ Pending
**Estimated:** 5-7 days

- [ ] Integrate Puck with `heroSliderConfig`
- [ ] Create live preview panel
- [ ] Build component panel (PawTag-approved components)
- [ ] Add responsive preview (desktop/tablet/mobile)
- [ ] Build slide settings panel

---

## Phase 3: SwiperJS Frontend
**Status:** ⏳ Pending
**Estimated:** 3-4 days

- [ ] Rewrite HeroSlider with SwiperJS
- [ ] Apply central settings
- [ ] Implement responsive behavior
- [ ] Add touch/keyboard navigation
- [ ] Ensure accessibility

---

## Phase 4: Central Slider Settings
**Status:** ⏳ Pending
**Estimated:** 1-2 days

- [ ] Create admin settings page
- [ ] Implement settings persistence
- [ ] Connect frontend to settings

---

## Phase 5: Migration & Testing
**Status:** ⏳ Pending
**Estimated:** 2-3 days

- [ ] Verify existing slides work
- [ ] Cross-browser testing
- [ ] Mobile testing
- [ ] Accessibility audit
- [ ] Performance optimization

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visual Editor | Puck (existing) | Already integrated, MIT license, 30+ components |
| Carousel Engine | SwiperJS | MIT license, 2.8M weekly downloads, full-featured |
| Drag-and-Drop | @dnd-kit (existing) | Already installed, used in Products.tsx |
| Data Model | Extend CmsHomepageSection | Additive fields, no migration needed |
| Component Definitions | Shared (admin + web) | Single source of truth, no "what I see ≠ what customers see" |

---

## Files Created/Modified

### New Files
1. `apps/admin/src/components/hero/HeroSliderManager.tsx`
2. `apps/admin/src/components/hero/HeroSlideEditor.tsx`
3. `apps/admin/src/components/hero/HeroSlidePreview.tsx`
4. `apps/admin/src/components/hero/HeroSliderSettings.tsx`
5. `apps/web/src/components/hero/heroSliderConfig.tsx`
6. `apps/web/src/components/hero/HeroSliderNew.tsx`

### Modified Files
1. `packages/db/src/models/CmsHomepageSection.ts`
2. `packages/api/src/routes/cms-homepage-admin.ts`
3. `packages/api/src/seeds/seed.ts`
4. `apps/web/package.json`
5. `packages/shared/src/api/endpoints.ts`

---

## Licensing

All components used are MIT licensed:
- SwiperJS: MIT (free forever)
- Puck Editor: MIT (free forever)
- @dnd-kit: MIT (free forever)

**Total ongoing cost: $0**
