# Gold Membership Marketing — Implementation Tracker

**Branch:** `feature/gold-membership-marketing`
**Started:** 2026-09-10
**Completed:** 2026-09-10
**Goal:** Maximize Gold membership adoption across all customer touchpoints

---

## Phase 1: High-Impact Visibility (Quick Wins) — COMPLETE

| # | Location | Status | File | Notes |
|---|----------|--------|------|-------|
| 1 | Hero Slider — add Gold slide | DONE | HeroSlider.tsx | 5th slide: "Gold members earn 2× Rewards. Just $1.99/mo." with stats |
| 2 | Navbar — Gold link for non-Gold users | DONE | Navbar.tsx | Amber "Go Gold" link with Crown icon for logged-in non-Gold |
| 3 | Checkout — Gold upsell at payment step | DONE | Checkout.tsx | 3-way CTA: Gold status / Gold upsell / Guardian promo |
| 4 | Cart Drawer — Gold upsell for non-Gold | DONE | CartDrawer.tsx | "Earn 2× with Gold →" link in points display |
| 5 | Account Sidebar — Gold Benefits link | DONE | AccountLayout.tsx | "Go Gold" with Crown icon in sidebar nav |
| 6 | Footer — Gold Membership link | DONE | Footer.tsx | Added to footer fallback links |
| 7 | Fix homepage tier thresholds bug | DONE | GuardianSection.tsx | Corrected 500→100, 2000→200, 5000→300 |

---

## Phase 2: Conversion Optimization — COMPLETE

| # | Location | Status | File | Notes |
|---|----------|--------|------|-------|
| 8 | Order Confirmation — Gold upsell | DONE | Checkout.tsx | "With Gold, you'd have earned 2X Points" post-purchase |
| 9 | Gold Landing — fix CTAs | DONE | GoldLanding.tsx | Logged-in → /account/upgrade, guests → /register |
| 10 | Product Cards — Gold link | DONE | ProductCard.tsx | "Gold members earn 2× →" now clickable to /gold |
| 11 | Guardian Landing — move Gold section up | DONE | GuardianLanding.tsx | Gold upsell moved from 60% to immediately after hero |

---

## Phase 3: Email & Retention — COMPLETE

| # | Location | Status | File | Notes |
|---|----------|--------|------|-------|
| 12 | Welcome Email — Gold section | DONE | welcome.ts | Gold callout box after CTA button |
| 13 | Order Confirmation Email — Gold upsell | DONE | order-confirmation.ts | "Earn 2× on your next order" section |
| 14 | Purchase Points Email — Gold upsell | DONE | guardian-purchase-points.ts | "You'd have earned 2X Points" for non-Gold |
| 15 | Tier Upgrade Email — Gold mention | DONE | guardian-tier-upgrade.ts | "Go Gold for 2× points" for non-Gold |

---

## Bug Fixes Found During Audit

| # | Issue | Status | File |
|---|-------|--------|------|
| B1 | Homepage tier thresholds hardcoded (500/2000/5000 vs actual 100/200/300) | DONE | GuardianSection.tsx |
| B2 | Gold Landing CTA links to /register instead of /account/upgrade | DONE | GoldLanding.tsx |

---

## Gold Messaging Framework

- **Primary value prop:** "Earn 2× Points on every purchase"
- **Price framing:** "Less than a coffee — $1.99/month"
- **ROI proof:** "Spend $50/month? Gold pays for itself with $36 in annual PawRewards"
- **Urgency trigger:** "Start at Nurture tier — skip the Care level entirely"

---

## Files Modified (18 total)

| File | Phase | Change |
|------|-------|--------|
| HeroSlider.tsx | 1 | Added 5th Gold slide with stats |
| Navbar.tsx | 1 | Added "Go Gold" link for non-Gold users |
| Checkout.tsx | 1,2 | Gold upsell at payment + post-purchase confirmation |
| CartDrawer.tsx | 1 | Gold upsell link for non-Gold Guardian members |
| AccountLayout.tsx | 1 | "Go Gold" sidebar nav item |
| Footer.tsx | 1 | Added "Gold Membership" link |
| GuardianSection.tsx | 1 | Fixed tier thresholds (500→100, 2000→200, 5000→300) |
| GoldLanding.tsx | 2 | Context-aware CTAs (logged-in vs guest) |
| ProductCard.tsx | 2 | Made Gold upsell text clickable |
| GuardianLanding.tsx | 2 | Moved Gold section from 60% to immediately after hero |
| welcome.ts | 3 | Added Gold callout section |
| order-confirmation.ts | 3 | Added Gold upsell section |
| guardian-purchase-points.ts | 3 | Added Gold upsell for non-Gold members |
| guardian-tier-upgrade.ts | 3 | Added Gold upsell for non-Gold members |
| gold-marketing-tracker.md | - | Implementation tracking document |

---

**Last Updated:** 2026-09-10
