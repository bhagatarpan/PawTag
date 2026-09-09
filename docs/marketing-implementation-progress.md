# Guardian & Gold Marketing Implementation — Progress Tracker

## Branch: `feature/subscription-loyalty-implementation`

---

## Phase 1: Public Marketing Pages (CRITICAL)

### 1.1 Public `/guardian` Landing Page
- [ ] Create `apps/web/src/pages/GuardianLanding.tsx`
- [ ] Add route in `apps/web/src/App.tsx`
- [ ] Hero section with CTA
- [ ] Guardian vs Gold comparison table
- [ ] How it works section
- [ ] Tier progression visualization
- [ ] Points earning examples
- [ ] Social proof section
- [ ] Footer CTA

### 1.2 Public `/gold` Landing Page
- [ ] Create `apps/web/src/pages/GoldLanding.tsx`
- [ ] Add route in `apps/web/src/App.tsx`
- [ ] Hero section with Gold branding
- [ ] Gold benefits grid
- [ ] Pricing comparison
- [ ] ROI calculator
- [ ] Upgrade CTA

---

## Phase 2: Navigation & Header (HIGH IMPACT)

### 2.1 Navbar Guardian Link for Non-Logged-In Users
- [ ] Add "Guardian" link visible to all visitors
- [ ] Link to `/guardian` for non-logged-in users
- [ ] Keep existing `/account/guardian` for logged-in users
- [ ] Add points indicator pill for logged-in users

### 2.2 Announcement Bar
- [ ] Create `apps/web/src/components/AnnouncementBar.tsx`
- [ ] Add to `apps/web/src/App.tsx` layout
- [ ] Rotating promotional messages
- [ ] Dismissible with localStorage
- [ ] Links to `/guardian`

---

## Phase 3: Homepage Enhancement (HIGH IMPACT)

### 3.1 Guardian/Gold Hero Slide
- [ ] Add 4th hero slide in HeroSlider fallback
- [ ] Guardian/Gold themed content
- [ ] CTA to `/guardian`

### 3.2 Enhance GuardianSection
- [ ] Add Gold tier visibility
- [ ] Add "Gold members earn 2× Points" callout
- [ ] Add pricing comparison
- [ ] Add CTA for non-members
- [ ] Add Gold upgrade CTA for Guardian members

---

## Phase 4: Shop & Product Pages (MEDIUM IMPACT)

### 4.1 Shop Page Enhancements
- [ ] Add CTA button to non-logged-in banner
- [ ] Add Gold callout for non-Gold members
- [ ] Add scroll-based marketing message

### 4.2 Product Card Gold Upsell
- [ ] Add "Gold members earn 2× Points" for non-Gold members

### 4.3 Product Detail Gold Callout
- [ ] Add Gold callout for non-Gold members

---

## Phase 5: Cart & Checkout (MEDIUM IMPACT)

### 5.1 CartDrawer Link for Guests
- [ ] Make "Join Guardian" a clickable link to `/guardian`

### 5.2 Checkout Membership Comparison
- [ ] Add collapsible Guest vs Guardian vs Gold comparison

---

## Phase 6: Onboarding Integration (MEDIUM IMPACT)

### 6.1 Add Guardian Step to Onboarding
- [ ] Add Guardian introduction step to CMS seed
- [ ] Configure in `packages/api/src/seeds/seed-cms.ts`

---

## Completion Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Public Pages | Not Started | |
| Phase 2: Navigation | Not Started | |
| Phase 3: Homepage | Not Started | |
| Phase 4: Shop/Products | Not Started | |
| Phase 5: Cart/Checkout | Not Started | |
| Phase 6: Onboarding | Not Started | |

---

**Started:** 2026-09-09
**Last Updated:** 2026-09-09
