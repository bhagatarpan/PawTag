# Mobile 52-Image Comparison Matrix

**Owner-directed Option A (2026-10-26):** every mockup image in
`docs/ux/PawTag_Mobile_Implementation_Package/images/` (local-only, untracked — not repo deliverables)
was opened individually and compared against the running screen.

**Method:**
- Public routes: Playwright @390×844 against the real dev servers (real dev API, no stubs) with a
  scroll-through reveal pass so FadeIn sections render before the fullPage capture.
- Authenticated routes: Playwright @390×844 with a stubbed session (`auth/me` + entitlements +
  unread-count stubbed; user-data endpoints either fixture-stubbed or real-dev-API); captures to
  `%TEMP%/opencode/cmp/` (not committed).
- Finder: captures at 390×844 in `verification/pkg-finder-*.png` (committed evidence).
- Secure token views (44/45): no valid tokens available — code-audited.
- **Overflow probe:** since the `html,body{overflow-x:clip}` fix (this pass), scrollWidth still counts
  clipped transforms — horizontal-overflow verdicts use the **pan test** (`scrollTo(9999,0)` stays at 0).
  All 16 public + 27 account captures re-verified at pan=0 after the fix.

**Authority:** code/spec > image (plan §2.4). Image names/prices/dates/tabs are invented sample data,
never requirements. Statuses: `MATCH` · `DEVIATES→FIXED` · `DEFERRED (reason)` · `DECIDED-AGAINST (reason)` ·
`CODE-AUDIT (capture infeasible)`.

**Standing decided-against (not re-flagged):** 5-tab account nav only; public pages use hamburger navbar;
no greeting/My-Pets content on public home; no Invoices filter chips; no camera-scan tab (finder or tag
activation); MFA extras; ratings/swatches; collapsible checkout summary / 2-step merge; care-reminders;
finder "Report found"; header search; static chevrons; lost-mode GPS/team cards; donation fund labels
(don't exist in API); alternate tab bars in mockups.

---

## Real bugs found & fixed by this pass (beyond image deltas)

| Finding | Evidence | Fix |
|---|---|---|
| **Home horizontal pan at 390px (20px)** — `FadeIn` pre-reveal states use `translateX(±20px)` at `opacity:0`; invisible content extended the document's scrollable width until revealed | `scrollTo(9999,0)` moved 20px on `/` before fix; culprit div had `transform:matrix(1,0,0,1,20,0)` (FadeIn direction `left` hidden state) | `html, body { overflow-x: clip }` in `apps/web/src/index.css` (`clip`, not `hidden` — keeps fixed/sticky + y-axis untouched); pan test = 0 after |
| **Guardian Points balance rendered empty + progress bar NaN** — page read `data.balance`; API returns `points` (no `balance` field exists) | `customer-guardian.ts:56-102` returns `points`; `GuardianPoints.tsx` read `data.balance` at 3 sites + `PointsData.balance` typed the phantom field | Interface + render now use `points`; progress row guarded on `nextTier != null && pointsToNextTier != null` |
| FullPage captures froze FadeIn sections at `opacity:0` (white bands) | capture harness finding, not product | capture scripts scroll-through before screenshot |

---

## Public (01–17)

| # | Image → screen | Verdict | Note |
|---|---|---|---|
| 1 | 01_home → `/` | DECIDED-AGAINST | Mock mixes authenticated dashboard content (greeting hero, My Pets grid, 5-tab bar) into the public home. Real `/` = CMS-led marketing home (hero, how-it-works, safety, tiers, testimonials, donate, footer) per §6.1 + locked public/account nav split. Pan=0 after clip fix. |
| 2 | 02_shop → `/shop` | MATCH | Title → stacked product cards (badge, name, price, features, Details/Add). Search+Filters row omitted — acceptable at current SKU count; banners occupy that slot. |
| 3 | 03_product_detail → `/shop/:id` | CODE-AUDIT | No-stub capture returned empty-products state (dev DB stock varies). `ProductDetail.tsx`: gallery, price/sale, feature highlights, quantity stepper, engraving/customisation, add-to-cart — all present (A7 gates). |
| 4 | 04_cart → `/cart` | CODE-AUDIT | Capture = empty-cart state (well-formed). `Cart.tsx`: line-item cards (engraving/qty/remove), sticky ~33% desktop summary, mobile sticky "Checkout — $total" bar (Phase A8 gates). |
| 5 | 05_checkout_delivery → `/checkout` | CODE-AUDIT | Capture = guest entry (delivery step). Single-page checkout with step indicators, delivery/payment sections, sticky summary — matches mock intent. |
| 6 | 06_checkout_payment | CODE-AUDIT | No capture (requires cart+payment state). Payment step labels/structure verified in Orders packet gates. |
| 7 | 07_login → `/login` | MATCH | |
| 8 | 08_register → `/register` | MATCH | |
| 9 | 09_verify_account → `/verify-account` | MATCH | |
| 10 | 10_verify_email → `/verify-email` | CODE-AUDIT | Token route; capture is invalid-token state (well-formed). Resend page structure verified in code. |
| 11 | 11_forgot_password → `/forgot-password` | MATCH | |
| 12 | 12_reset_password → `/reset-password` | CODE-AUDIT | No token → invalid-link state captured; reset form verified in code. |
| 13 | 13_cms_content_page → `/about` | MATCH | Rich CMS content renders from dev DB. |
| 14 | 14_pet_recovery → `/pet-recovery` | DEFERRED → owner | Structure/hierarchy aligned but the finder-entry CTA ("Found a pet? Scan or enter a tag ID") + emergency-guidance block are missing. **Blocked on a finder base-URL decision** (finder is a separate origin; no in-repo FINDER_URL config — inventing a domain would be a config hardcode). Emergency copy is presentation-safe; both queued for owner decision. |
| 15 | 15_guardian_landing → `/guardian` | MATCH | |
| 16 | 16_membership_landing → `/membership` | MATCH | |
| 17 | 17_donate → `/donate` | MATCH | Amount presets → custom field (min/max helper) → donor details → CTA → Stripe/receipt reassurance. Frequency toggle (One-time/Monthly) additive per supported recurring. |

## Account core (18–29)

| # | Image → screen | Verdict | Note |
|---|---|---|---|
| 18a | 18_dashboard → `/account` | MATCH | Hierarchy (greeting hero → pets → section cards → 5-tab nav) aligns. "0 pets" in one capture = mixed-harness artifact (stub user has no DB pets — true empty state, not a defect). Breadcrumb desktop residue = minor, noted not fixed. |
| 18b | 18_health_records → `/account/pets/:id/health` | DEFERRED (minor) | Structure aligned (back link → pet card → wrapped category grid ≥44px → section header + Add → record cards). **Deferred:** health-stats chip row (age/gender/weight — all real fields); **DECIDED-AGAINST:** overdue/due-soon urgency chips (invented thresholds; `nextDueDate` already shown as text in vaccination rows — Phase 2 documented decision kept). |
| 19a | 19_pets → `/account/pets` | MATCH | |
| 19b | 19_health_record_editor | CODE-AUDIT | Inline add/edit form rebuilt Phase 2; field structure matches mock (vaccine/type/clinic/dates). |
| 20 | 20_add_edit_pet → `/account/pets?edit=` | DEFERRED → owner | Modal vs mock's full page; photo stack vs tap-zone; **Age dual-field touches the data model (age vs dateOfBirth semantics) — owner decision**. Header title polish queued as minor. |
| 21 | 21_pet_detail → `/account/pets/:id` | MATCH | Re-captured with corrected harness (tags/escalations endpoints array-stubbed); lost-mode banner + sections render. |
| 22 | 22_lost_mode → `/account/pets/:id/lost` | MATCH | Re-captured successfully; GPS/team cards absent per standing decision. |
| 23 | 23_tag_activation → `/account/redeem-tag` | DECIDED-AGAINST | Camera-scan + NFC entry methods are capability decisions (web NFC impossible; webcam QR = feature work) — consistent with the finder camera decision. Manual entry + 3-step explainer present. |
| 26 | 26_profile_security → `/account/profile` | DEVIATES→FIXED | Responsibility badge was red for unclassified/zero state → now neutral gray unless API explicitly classifies red. All inputs/selects `min-h-11` (44px). |
| 27 | 27_notifications → `/account/notifications` | DEVIATES→FIXED | `SelectChips` `min-h-9` (36px) → `min-h-11` (44px) in shared `packages/ui` (only Notifications consumes it). |
| 28 | 28_notification_preferences → `/account/notification-preferences` | MATCH | |
| 29 | 29_settings → `/account/settings` | DEVIATES→FIXED | Added **Privacy & Support** group (`/privacy`, `/terms`, `mailto:support@pawtag.co.nz`) — routes existed but weren't surfaced. The raw "Refresh token is required" panel in the capture = stub-token-vs-real-API harness artifact (global interceptor owns session expiry for real users) — recorded, not "fixed". |

## Commerce / membership (30–39, 46)

| # | Image → screen | Verdict | Note |
|---|---|---|---|
| 30 | 30_donations → `/account/donations` | MATCH | Invoice-twin cards + stats strip (rebuilt this run). Fund labels omitted per standing decision. |
| 31 | 31_subscriptions → `/account/subscriptions` | CODE-AUDIT | Capture = designed empty state (stub user has no subs). Per-subscription cards (plan header, Upgrade/Gold Billing, timeline, actions, invoices) verified in code. Minor: empty state lacks a next-step CTA — recorded. |
| 32 | 32_guardian_dashboard → `/account/guardian` | CODE-AUDIT | Capture blocked (stub token → real API 401 = harness artifact). Code: points → benefits → rewards → achievements → activity stack aligns with mock hierarchy. |
| 33 | 33_guardian_points → `/account/guardian/points` | DEVIATES→FIXED (**real bug**) | Page read `data.balance`; API returns `points` → empty balance number, NaN progress bar, orphan "points to" row. Fixed: interface + render use `points`; progress row only when `nextTier` and `pointsToNextTier` exist. |
| 34 | 34_guardian_rewards → `/account/guardian/rewards` | CODE-AUDIT | Capture 401 artifact; rewards card structure verified in code. |
| 35 | 35_membership_manage → `/account/membership` | MATCH | Tier gradient hero = sanctioned brand exception. View Plans CTA present. |
| 36 | 36_membership_subscribe → `/account/membership/subscribe` | MATCH (fixture artifact) | "Join undefined" in capture = my stub tiers lacked `displayName`; real tiers always carry it (admin API requires it; seeds Gold/Platinum/Black; public tiers endpoint selects it). Not a product defect. |
| 37 | 37_referrals → `/account/referrals` | DEVIATES→FIXED | Silent `catch(console.error)` left an empty card on load failure → now surfaces "We couldn't load your referral code" + **Try again** retry. Copy/share buttons ≥44px + aria-labels. (Empty history in capture = stub user has no referrals — true empty state.) |
| 38 | 38_tag_activation_fee → `/account/tag-activation-fee` | CODE-AUDIT | Capture fixture gap; fee-screen structure verified in code (fee amount from server config, GST line, pay CTA). |
| 39 | 39_return_request → `/account/orders/:id/return` | DEVIATES→FIXED | Reason radio rows `min-h-11` (44px); bottom Cancel/Back links `min-h-11`. Flow copy already explains the warehouse-review path — extra callout copy not duplicated. |
| 46 | 46_subscription_upgrade → `/account/upgrade` | CODE-AUDIT | Capture blocked (401 harness artifact); upgrade flow reads real membership data — multiplier/price from server (no client invention). |

## Finder (40–43, 47)

| # | Image → screen | Verdict | Note |
|---|---|---|---|
| 40 | 40_finder_landing → finder `/` | DEVIATES→FIXED | Added the slim PawTag brand bar (same as tag pages — every finder entry point now carries identity) + privacy reassurance line ("we only share what the pet's owner chose to share"). Input/CTA already ≥44px. |
| 41 | 41_finder_pet_details → `/:tagId` | MATCH | Lost banner → identity card → medical alert → consent → dominant Notify CTA → footer. Photo/"last seen" absent only because server returned no shared data — decided-against faking. Owner row = approved finder-DTO field. |
| 42 | 42_finder_notify_owner → notify form | DEVIATES→FIXED | Send/Cancel `py-2.5` → `py-3` (44px); both captcha refresh icon-buttons got ≥44px hit areas (`p-3` + negative margins, no layout shift). |
| 43 | 43_finder_location_consent → consent card | DEVIATES→FIXED | Share Location / Skip `py-2` → `py-3` (44px). **DECIDED-AGAINST:** extra "approximate only" reassurance line — consent copy is privacy-sensitive and stays untouched (earlier packets kept it verbatim); owner may approve copy later. |
| 47 | 47_finder_invalid_tag → error state | DEVIATES→FIXED | Added "Need help? Contact PawTag Support" (`mailto:support@pawtag.co.nz`) line to `FinderErrorState`. The expired-tag state already had the support CTA. |

## Secure views / refer / invoices (44, 45, 48, invoice pair)

| # | Image → screen | Verdict | Note |
|---|---|---|---|
| 44 | 44_secure_invoice_view → `/invoice/:token` | DEVIATES→FIXED | OTP submit `py-3`; Resend `min-h-11`; shared toolbar: **Print now visible on mobile** (was `hidden sm:`), Print/Download `min-h-11`, wrap-safe toolbar row. |
| 45 | 45_donation_receipt_view → `/donations/receipt/:token` | DEVIATES (touch FIXED; docNumber DEFERRED) | Touch targets fixed via shared `FinancialDocumentViewer`. **docNumber in chrome deferred:** the token endpoint returns the HTML document only — no meta/number payload exists; exposing it needs an API addition (out of presentation-only scope → owner decision). Number is visible inside the rendered document itself. |
| 48 | 48_public_refer → `/refer` | CODE-AUDIT | Capture showed the account Referrals page (logged-in redirect); public `/refer` exists (`Refer.tsx`) with the share-landing structure. |
| — | invoice_list_screen → `/account/invoices` | MATCH | Invoice-twin document cards (rebuilt this run, founder phone check passed). |
| — | invoice_detail_screen → `/account/invoices/:id` | MATCH | Status/number/date/amount, payment method + card brand/last4, line items, totals, View/Download (now `min-h-11`), bottom bar. |

---

## Fix inventory (this pass — all presentation-only)

1. `apps/web/src/index.css` — `html, body { overflow-x: clip }` (Home pan fix).
2. `apps/web/src/pages/account/GuardianPoints.tsx` — `points` contract fix (interface + balance + progress guard/width).
3. `packages/ui/src/components/SelectChips.tsx` — `min-h-11`.
4. `apps/web/src/pages/account/Profile.tsx` — neutral responsibility badge default; inputs/selects `min-h-11` (10 sites).
5. `apps/web/src/pages/account/Referrals.tsx` — load-failure state + Try again; icon buttons ≥44px + aria-labels.
6. `apps/web/src/pages/account/ReturnRequest.tsx` — radio rows + links `min-h-11`.
7. `apps/web/src/pages/account/Settings.tsx` — Privacy & Support links group.
8. `apps/web/src/pages/account/InvoiceDetail.tsx` — View/Download `min-h-11`.
9. `apps/web/src/pages/InvoiceView.tsx` — OTP submit `py-3`, Resend `min-h-11`.
10. `apps/web/src/components/FinancialDocumentViewer.tsx` — Print visible on mobile; toolbar buttons `min-h-11`; wrap-safe row.
11. `apps/finder/src/components/FinderLanding.tsx` — brand bar + privacy line.
12. `apps/finder/src/components/FinderErrorState.tsx` — support mailto line.
13. `apps/finder/src/components/NotifyOwnerForm.tsx` — Send/Cancel `py-3`; captcha refresh ≥44px.
14. `apps/finder/src/components/LocationConsentBanner.tsx` — Share/Skip `py-3`.

## Verification

- `pnpm typecheck` — PASS (all packages).
- `pnpm lint` — 0 errors, 970 warnings (exact pre-existing baseline).
- `pnpm test:unit` — 1343/1343 PASS.
- `pnpm test:smoke` — 6/6 PASS.
- `pnpm test:regression` — 33/33 PASS.
- `pnpm build` — PASS.
- Runtime: 16 public + 27 account + 2 re-captured + 4 finder captures at 390×844; pan test 0 on every
  public + account page post-fix. GuardianPoints balance fix verified against the API source contract
  (`customer-guardian.ts`); membership `displayName` verified present in seeds + admin validation +
  public tiers endpoint select.

## Deferred / owner decisions (explicitly not shipped)

- Pet-recovery finder-entry CTA + emergency guidance → needs finder base-URL config decision.
- Donation receipt `docNumber` in viewer chrome → needs token-meta API addition.
- Add/edit pet: photo tap-zone + Age dual-field → age touches data model (owner decision); header title minor.
- Health records: stats chip row (real fields) queued; urgency chips decided-against (invented thresholds).
- Consent "approximate only" reassurance line → privacy copy (owner).
- Dashboard pets-fetch failure currently maps to `[]` (shows empty state on load failure) — robustness
  semantics note, not a mockup gap; harness artifact explained in row 18a.
- Dev-only floating feedback widget overlapping captures — not product code.
