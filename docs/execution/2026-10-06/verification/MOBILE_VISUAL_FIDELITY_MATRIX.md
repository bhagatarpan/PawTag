# Mobile Visual Fidelity Matrix — board panel vs implementation (element level)

**Method:** each concept-board image re-viewed panel by panel; every visible element diffed against the implementation with evidence (code line or 390px screenshot).
**Statuses:** `MATCHED` · `DEVIATES` (fix listed) · `MISSING` (reason) · `DECIDED-AGAINST` (founder/flag reason).
**Pass date:** 2026-10-25 · branch `feat/mobile-visual-redesign`.

---

## Image 1 — customer-pets-lost-mode-concept.png

### 1A. Customer home

| Board element | Status | Note / fix |
|---|---|---|
| Photo greeting hero, big white greeting + "Healthy pets. Happier tomorrows." | MATCHED | `Dashboard` PhotoHero w/ first pet photo, gradient fallback (screenshot-verified) |
| Logo + tagline inside hero; bell top-right in hero | DECIDED-AGAINST | Our app chrome is the teal header (bell/hamburger there) — equivalent access; putting brand inside content hero would duplicate header |
| "Your pets" card, title + "2 pets" count | MATCHED | |
| Thumb labels = green "● Tag active" (TAG status) | DEVIATES | We show pet-status `StatusBadge` — **fix A1:** tag-active dot when tag active (status badge as fallback for no-tag pets) |
| Full-width "Manage my pets" CTA (paw + chevron) | MATCHED | button + PawPrint (chevron omitted — cosmetic) |
| 3 trust tiles: How it works / A safer community / Trusted care | DEVIATES | We render old "How it works" steps instead — **fix A1:** board's 3 tiles as InfoCards (MapPin/Users/ShieldCheck + board copy) |
| No 5-up stats strip on board | DEVIATES | We still show SummaryCards 5-up (spec §6.3 says secondary info belongs in nav) — **fix A1:** remove strip; relocate `TagUsageIndicator` into Your pets card |
| Bottom tab bar w/ elevated Activate | MATCHED | screenshot-verified |

### 1B. My Pets

| Board element | Status | Note / fix |
|---|---|---|
| Top bar: brand + teal "+ Add pet" pill right | MATCHED\* | Our Add Pet = primary token button in header row (account chrome differs from board's mock chrome — see 1A decision) — verify placement during capture |
| H1 + subtitle "Keep their details up to date for a faster, safer return." | DEVIATES | subtitle absent — **fix A2:** add |
| Cards: large square photo left, name + pill top-right, breed/age lines | MATCHED | PetCard horizontal rebuild (1b) |
| Pill = "Tag active" (tag) | DECIDED-AGAINST | We show pet-status pill (+ tag dot inside row) — pet status is required by spec §6.5 (lost prominence); keeping ours |
| Meta rows: tag #, Healthy, chevron — large readable rows | DEVIATES | Ours are `text-xs` tight — **fix A2:** `text-sm` + taller rows |
| "Next check-in Apr 2025" row | MISSING | no reminder/check-in data in the product (flagged 1b) |
| "Adding another pet?" tinted card + chevron | MATCHED | InfoCard added in 1b |

### 1C. Pet detail

| Board element | Status | Note / fix |
|---|---|---|
| Back chevron + white "Edit" pill overlaid on photo hero | DEVIATES | Ours sit in a row ABOVE the hero — **fix A3:** overlay both on hero (PhotoHero children) |
| Hero: photo + name/breed/age overlay | MATCHED | PhotoHero + subtitle |
| Tag status card: tag-image thumb, Active pill, tag #, last seen, chevron | MATCHED† | Icon well uses QrCode (no tag illustration asset exists — MISSING(asset), not faked); last-seen truthful (1b audit) |
| Health summary + "All good" pill + 3 icon chips | MATCHED‡ | chips exist — **fix A3:** distinct icons (PawPrint/Bone/FileText) instead of generic checks |
| Care reminders row ("Next: Apr 12, 2025") | MISSING | no reminder data (flagged 1b) — Health records row shows real data instead |
| Vet information row | MATCHED | when entitlement + data present |
| Red full-width "Mark as Lost" CTA | MATCHED | Button danger lg full |
| Bottom tab bar | MATCHED | |

### 1D. Lost Mode

| Board element | Status | Note / fix |
|---|---|---|
| Back chevron + "● Lost Mode Active" red pill top-right | MATCHED | |
| Calm red hero: pinging pin, h1, sub "We're helping…" | MATCHED | |
| "Location sharing is ON" toggle card | DECIDED-AGAINST | tags have no GPS — never faked (1b) |
| "Our team has been notified" card | DECIDED-AGAINST | no such capability on lost (1b) |
| "What happens next?" 3 numbered steps | MATCHED§ | wording intentionally truthful (board's "members are alerted" implies a broadcast network we don't have — kept ours) |
| "Share Buddy's lost pet profile" OUTLINED teal button | DEVIATES | ours is filled primary + different label — **fix A4:** secondary/outline + label "Share {name}'s lost pet profile" |
| Sightings list / escalation contact | MATCHED+ | ours adds real shared-locations list + escalation card (board implied) |
| Mark Found CTA | MATCHED+ | ours adds it (needed by workflow) |

---

## Image 2 — account-notifications-finder-concept.png

### 2A. Account → Security tab

| Board element | Status | Note / fix |
|---|---|---|
| Teal app bar (logo center + gear) | DECIDED-AGAINST | our teal header chrome (hamburger/label/bell/avatar) — same decision as 1A; gear → Settings lives in our nav |
| Identity row: avatar + name + email + chevron→profile | DEVIATES | no chevron — **fix A5:** chevron linking to profile tab |
| Tabs with icons (person/shield/bell) + underline | DEVIATES | ours text-only — **fix A5:** add lucide icons |
| "Account security" + sub copy | MATCHED | |
| Email/Mobile cards + green Verified pills + Verify links | MATCHED† | board chevrons on verified rows have no target in our product — omitted (no fake affordance) |
| Two-step verification / Authenticator / Recovery methods | DECIDED-AGAINST | MFA excluded by founder decision |

### 2B. Activity & notifications

| Board element | Status | Note / fix |
|---|---|---|
| H1 "Activity & notifications" + sub "Stay up to date with your orders, pets and account." | DEVIATES | ours "Notifications"/old copy — **fix A5:** adopt board title+copy |
| Chips All/Orders/Pets/Account | MATCHED | 1d |
| Rows: tinted square icon tile + unread dot LEFT + title/subtitle + time right | DEVIATES | ours: plain icon, dot right, time under message — **fix A5:** tile bg, dot left, time right-aligned on title line |
| Row chevron (tap target) | DECIDED-AGAINST | rows are static today; a chevron would promise navigation we don't wire (`actionUrl` handling = separate behavior change) |
| Tab set w/ "Orders" tab | DECIDED-AGAINST | locked Phase 08 five-tab model (documented earlier) |

### 2C. Order detail

| Board element | Status | Note / note |
|---|---|---|
| Big order number + placed date + Shipped pill | MATCHED | `OrderHeader` |
| Full stepper w/ step names + dates | MATCHED† | code-check dates during Phase B (capture blocked: needs auth) |
| Green "On the way" status card | MATCHED† | `OrderStatusBanner` (same) |
| "View tracking details" row | MATCHED† equiv | our shipped-without-tracking amber notice covers board's "will be updated soon" intent; tracking row shows when number exists |
| Items card: product image, variant, qty, price | MATCHED† | `OrderItemsList` w/ `item.image` |
| Action rows: invoice / receipt / return | MATCHED† | actions exist in `OrderDetailView` |
| Bottom nav w/ Orders active | DECIDED-AGAINST | locked tab model (chrome decision) |

### 2D. Finder pet page

| Board element | Status | Note / fix |
|---|---|---|
| Teal brand bar (logo) | DEVIATES | finder has no header — **fix A6:** slim teal brand bar on finder pet page + landing (no nav links — one-purpose flow) |
| Language chip "EN" | MISSING | no i18n system in product (feature, excluded) |
| Full photo hero | MATCHED | screenshot-verified |
| Circular avatar + name + traits + pill in card | DEVIATES | no circle avatar (hero photo only) — **fix A6:** circular thumb beside name (real photo) |
| Traits inline text vs chips | DECIDED-AGAINST | temperament ("Friendly") not in data; our chips use real fields |
| "Is this my pet?" + copy | MATCHED | verified |
| "Contact my owner" CTA | MATCHED† | our label "Notify Owner I Found Their Pet" (kept: truthful specificity); icon differs (phone vs chat) — cosmetic |
| Location share section: neutral card + outline button | DEVIATES | ours blue-tinted card + filled Share — **fix A6:** restyle container/button classes only (consent copy + handlers untouched) |
| "Report found" row | DECIDED-AGAINST | no endpoint (flagged) |

---

## Image 3 — product-and-cart-concept.png

### 3A. Product detail

| Board element | Status | Note / fix |
|---|---|---|
| Header search icon | DECIDED-AGAINST | header-level search = new nav feature, not visual work (flag if wanted) |
| "< Tags" back link | MATCHED† | ours "Back to Shop" — same destination (label swap cosmetic, kept) |
| Full-BLEED hero photo, edge to edge, no card inset | DEVIATES | ours inset rounded image — **fix A7:** full-bleed on mobile |
| Thumbnail strip below hero (selected ring) | MATCHED | shown when >1 image; hidden for single-image products (correct) |
| Title left + price right on one row | DEVIATES | ours stacked (title block, then big price) — **fix A7:** one row, price right |
| Star rating 4.9 (120 reviews) | MISSING | no review/rating system (flagged Packet 3 — never fake social proof) |
| "Tag colour" swatches | MISSING | variant selection = commerce-contract packet (flagged) |
| "Front text" field + counter | MATCHED† | ours: checkbox-gated engraving with per-quantity names + counter — real superset of board; kept (board's single field is a simplification) |
| "Back style" segmented control | MISSING | no such product option exists (flagged) |
| Sticky full-width "Add to cart — NZD $34.00" (price in button) | DEVIATES | ours: price left + "Add to Cart" right — **fix A7:** price inside full-width button |
| Public Home/Shop/Cart/Profile tab bar | DECIDED-AGAINST | standing exclusion (nav architecture) |

### 3B. Cart

| Board element | Status | Note / fix |
|---|---|---|
| H1 + "1 item" sub | MATCHED† | `CartHeader` |
| Item card: image left, title/price(right, teal)/meta lines, qty stepper + Edit + Remove row | DEVIATES? | needs real capture (guest cart) before verdict — **Phase B step:** capture with items, then align Edit/Remove pairing if diverged |
| Order summary card (subtotal, shipping estimate + destination, divider, Estimated total) | MATCHED† | `OrderSummary` (capture pending) |
| Free-shipping teal banner | MATCHED | built in Packet 3 (renders only when server threshold applies) |
| Sticky "Checkout — NZD $40.00" (price in button) | DEVIATES | ours totals-block + "Checkout" button — **fix A7:** full-width button with price inside |
| Public tab bar | DECIDED-AGAINST | standing exclusion |

---

## Image 4 — checkout-concept.png

### 4A. Delivery step

| Board element | Status | Note / fix |
|---|---|---|
| Header brand + cart badge | MATCHED | public Navbar (CartIcon badge) |
| 2-step indicator: 1 Delivery & contact / 2 Payment (numbered circles, active teal) | DEVIATES? | must confirm our step count/labels in code — if ours has a separate Review step, merging = checkout flow change → **DECIDED-AGAINST unless founder flips**; verification = Phase B code check |
| Collapsible "Order summary" compact card (thumb, variant, price, chevron) | DECIDED-AGAINST | standing exclusion — always-visible totals (safer for money, spec §6.7) |
| "Delivery & contact" heading + sub-copy | DEVIATES? | verify our copy — align to board wording if different (**fix A8**, copy-only) |
| Single-column labeled fields (email → name row → address → suburb → city/postcode row → country) | MATCHED† | ours also has saved-address cards + autocomplete = real superset; single-column mobile layout kept (Phase 04) — field styling verified by capture |
| Sticky full-width "Continue to payment →" | MATCHED† | Phase 04 sticky CTA; label verified by capture |

### 4B. Payment step

| Board element | Status | Note / fix |
|---|---|---|
| Indicator: ✓ on step 1, active step 2 | MATCHED† | same component as 4A |
| "Payment" heading + "Your payment information is securely processed." | DECIDED-AGAINST | ours "Review & Pay" + added trust card — our label is honest for a screen that shows review+payment together; depends on step structure (4A) |
| "Secure payment component" placeholder | MATCHED† | ours = real provider-hosted fields (placeholder exists only because boards can't show provider UI) |
| "Your information is safe" card | MATCHED | built in Packet 3 (truthful wording) |
| Sticky "Pay securely — NZ$34.00 →" price in button | DEVIATES? | **fix A8:** verify pay-button label includes amount; adopt "Pay securely — $X.XX" if not |
| Public tab bar | DECIDED-AGAINST | standing exclusion |

---

**Summary of Phase A fixes queued:** A1 dashboard (tag-active dots, trust tiles, remove stats strip, relocate tag usage) · A2 MyPets (subtitle, bigger meta rows) · A3 pet detail (hero-overlay back/edit, chip icons) · A4 lost-mode share button outline+label · A5 profile tab icons+chevron, notifications title/copy + row redesign (tiles, dot-left, time-right) · A6 finder brand bar, circle avatar, consent restyle · A7 product full-bleed hero + title/price row + price-in-button stickies (product & cart) · A8 checkout copy/step/pay-label verification.

### Phase A captures (guest, 390px, 2026-10-25)

| Capture | Findings |
|---|---|
| Cart with 1 item | Item card = image/price/qty/trash ✓ (Edit+meta correctly absent — product has no engraving); **fix A7b:** board wants teal line price + teal Estimated Total; sticky bar = totals-block+button → price-in-button (A7); free-shipping banner correctly absent (API threshold `null` here — unit-tested behavior); checkout reached OK |
| Checkout (guest) | Real **sign-in gate** renders ("Sign in to continue") — existing product rule, board mock ignores auth; **step indicator shows icon-only circles at 390px because labels are `hidden sm:inline` → A8 label fix; step count 4 vs board 2 = DECIDED-AGAINST (flow change)** |

---

## Phase B — fixes implemented (all queued A-items) + after-fix screenshot verification

| Fix | Files | Verified by |
|---|---|---|
| A1 Dashboard: 5-up stats strip removed; board trust trio (How it works / A safer community / Trusted care); "Tag active" dot under pet thumbs (status-badge fallback for no-tag pets); tag-usage pill relocated into Your pets header | `Dashboard.tsx` | ✅ screenshot `after-dashboard.png` |
| A2 MyPets: subtitle line; pet-card meta rows → `text-sm` + comfortable spacing | `MyPets.tsx`, `PetCard.tsx` | typecheck + code |
| A3 Pet detail: back/Edit overlaid on hero (circle chevron + white pill); health chips get distinct icons (PawPrint/Bone/FileText) | `PetDetail.tsx` | typecheck + code |
| A4 Lost Mode share → outlined secondary, label "Share {name}'s lost pet profile" | `LostMode.tsx` | code |
| A5 Profile: tab icons (User/ShieldCheck/Bell) + identity-row chevron; Notifications: title "Activity & notifications" + board copy, icon tinted tiles, relative time on title line (full timestamp kept `sr-only`) | `Profile.tsx`, `Notifications.tsx` | typecheck + code |
| A6 Finder: slim teal brand bar, circular avatar in identity card, consent card neutralized w/ outline Share button (**copy & handlers untouched**) | finder `App.tsx`, `PetDetailsCard.tsx`, `LocationConsentBanner.tsx` | ✅ screenshot `after-finder.png` |
| A7 Product: full-bleed mobile hero, title+price one row, sticky "Add to cart — $X.XX" price-in-button; Cart sticky "Checkout — $X.XX"; Estimated Total in teal | `ProductDetail.tsx`, `Cart.tsx`, `OrderSummary.tsx` | ✅ screenshot `after-product.png` |
| A8 Checkout step labels visible at all widths (were `hidden sm:inline`) | `CheckoutStepIndicator.tsx` | code (delivery step itself needs login) |

Supporting: `Pet.linkedTag?` optional typed in `apps/web/src/types` (server-joined field, honestly documented).

### Still DECIDED-AGAINST / MISSING (unchanged, founder-flippable)
Public tab bar · collapsible checkout summary · step-count merge · ratings/swatches/back-style · finder "Report found" · MFA UI · header search icon · care-reminders row · "Location sharing is ON"/"team notified" cards · row chevrons on static notifications.

### Remaining human verification
320/360/430 + tablet widths, authenticated screens with real data (dashboard/pets/order detail with content), notched safe-area, real checkout journey — matrix §3.1 footnote.

### Follow-up mock — Order detail header (founder image, 2026-10-26)

| Mock element | Status |
|---|---|
| Teal header / breadcrumb structure / stepper (5 real steps) | already shipped (prior packets) |
| Icon tile + "ORDER" eyebrow + number-only heading + stacked state pills | **IMPLEMENTED** (spec in `docs/DESIGN.md` → "Order detail header") |
| Breadcrumb "Order Details" / "Invoice Details" | **IMPLEMENTED** — `DETAIL_LABELS` config in `navigation.ts` (tested) |
| Stepper polish: gray completed, teal+ring active, light-gray upcoming, accessible group name | **IMPLEMENTED** (tests updated to the approved contract) |
| Deliberate deviation: tile is brand-neutral (not always-green) so refunded orders don't read "confirmed" — documented in DESIGN.md | |
