# PawTag Mobile Customer & Finder Experience

## Autonomous OpenCode Implementation Plan

**Repository snapshot reviewed:** `PawTag-main.zip` supplied 26 October 2026  
**Target:** premium, enterprise-quality customer and Finder experiences on mobile, using the existing responsive web applications as the shared UI source.  
**Scope:** front-end presentation, responsive behavior, accessibility, route reachability and UI validation.  
**Explicit exclusions:** configuration changes, business-rule changes, API/backend changes, data/persistence changes, payment/auth/entitlement changes, and duplicate React Native screens.

---

## 1. Executive objective

Make the PawTag customer journey feel coherent, trustworthy and purpose-built on phones while retaining one implementation of every customer screen in `apps/web`. Make the Finder public web journey equally usable on phones. Admin, CSR and website-admin remain desktop-first.

The implementation must cover existing routes, not just the screens changed by the previous visual pass. A route is not complete merely because it renders: its mobile navigation, data hierarchy, loading/empty/error/success states, keyboard behavior, safe-area behavior and reachable actions must be reviewed.

The three highest-priority redesigns are:

1. **Pet Health Records:** replace the centered modal with a dedicated responsive page and non-modal add/edit flow.
2. **Orders:** redesign both the order list card and the order details hierarchy.
3. **Invoices:** redesign both invoice list cards and invoice details.

Do not accept the previous matrix’s claim that Orders and Invoices are already board-compliant as a reason to skip them. The owner explicitly dislikes the current presentation; current source and this instruction take precedence.

---

## 2. Architecture and product constraints

### 2.1 One shared customer UI

- `apps/web` and its React Router routes remain the source of truth for customer UI.
- Desktop browser, mobile browser and the installed-app web surface must use these same React pages and shared components.
- A new customer page is implemented once as a shared web route and is therefore available to any shell loading that web app. Do not create a second React Native implementation.
- Existing `apps/mobile` Expo code is reference/migration material. Do not expand it with duplicate customer screens or retire it as part of this UI plan.
- New page code in a locally bundled Capacitor build can still require a native build/release. Content delivered from the server may update without a release; new bundled React route/component code does not automatically update an installed binary. Do not promise otherwise or introduce a remote-code update mechanism.

### 2.2 Finder and administration

- `apps/finder` remains a public, browser-based recovery flow. It must not require the owner to sign in or the finder to install PawTag.
- Do not fold Finder screens into the authenticated customer account shell.
- Keep `apps/admin` desktop-first; admin, CSR and website-admin are outside this implementation.

### 2.3 No business or configuration changes

The implementation may change JSX, CSS/Tailwind presentation, accessibility attributes, UI-only route composition and front-end tests. It must not change:

- API endpoint definitions/contracts, server routes, persistence, schema, background jobs or data migrations;
- account activation requirements, email/mobile verification, sign-in policy, MFA factors or session semantics;
- payment provider behavior, Stripe integration, checkout totals, tax, shipping, refunds, returns eligibility, membership pricing or subscription rules;
- health-record entitlements, permissions, saved data fields or current CRUD semantics;
- notification delivery, notification meaning, Finder privacy/consent behavior or owner-contact rules;
- environment values, dependencies for native capabilities, signing, build/deploy configuration or app-store setup.

Use the current data and existing API behavior. If a UI idea needs a new endpoint, data field, capability, entitlement or business decision, do not fake it; record the dependency and continue with independent UI work.

### 2.4 Source authority

Use this order when sources disagree:

1. Current code and API contracts.
2. Repository instructions (`AGENTS.md`, `README.md`), current `docs/DESIGN.md`, and active execution pack.
3. This plan and the owner’s explicit feedback.
4. Generated images, for layout/hierarchy/tone only.

The images in this package are generated concepts. Some generated samples may show invented names, dates, statuses, currencies, navigation labels or features. Those are not product requirements. Replace all sample content with actual repository data and existing labels. Never copy invented currency/tax values, statuses, tabs, order contents, medical facts or actions from an image.

---

## 3. Repository evidence and starting findings

The supplied snapshot contains:

- `apps/web/src/App.tsx`: public, auth and customer routes;
- `apps/web/src/components/AccountLayout.tsx`, `components/account/navigation.ts`, and `components/account/BottomNav.tsx`: shared account chrome and mobile navigation;
- `apps/web/src/pages/account/`: customer account screens;
- `apps/finder/src/App.tsx` and Finder components: public tag recovery flow;
- `packages/ui`: shared presentation components, including `OrderDetailView`;
- `docs/DESIGN.md` plus mobile route, visual redesign and visual fidelity matrices in `docs/execution/2026-10-06/verification/`.

Source-review findings to verify again before edits:

1. `HealthRecords.tsx` renders a centered fixed overlay with horizontally scrolling nine-category tabs. It is opened from `PetDetail.tsx`; there is no standalone Health Records route in `apps/web/src/App.tsx`. The page-level matrix calls it “no route”, but the actual UI is modal-only, so the feature exists while the durable page destination is missing.
2. The Health Records overlay has no clear semantic dialog/focus behavior and compresses a complex record-management workspace into a modal. The owner explicitly rejects this design.
3. `Orders.tsx` puts multiple statuses, total, progress, payment/address metadata, item count and invoice metadata into each card. The result can become dense and wrap unpredictably on narrow phones.
4. `OrderDetailView.tsx` has all major information, but its long sequence of status, progress, items, totals, payment, tracking, invoice, address, return and refund sections needs stronger task-first hierarchy and phone-specific grouping.
5. `Invoices.tsx` packs document metadata, amount, badges and compact icon actions into a row; a button-like row contains nested actions. Review semantic interactions and content hierarchy, not only target-size classes.
6. `InvoiceDetail.tsx` has useful detail, credit-note handling and document actions, but needs a clearer document summary and totals hierarchy. Preserve its existing secure document/PDF flows and credit-note scope.
7. The mobile route and redesign matrices explicitly leave viewport checks, authenticated journeys, physical-device checks and Capacitor checks unverified/not started. Do not turn their source claims into runtime proof.
8. `apps/web/src/platform/capacitor.ts` and a Capacitor config exist, but the inspected web entry point has no call to `initCapacitorPlatform()` or `PlatformProvider`; the supplied archive has no iOS/Android native project directories. Do not claim native shell parity. Do not modify configuration under this plan; document any remaining native integration as a separate release blocker.

Re-check all points in the live working tree. The ZIP is a snapshot; it is not proof of the developer’s current branch state.

---

## 4. Full mobile screen and route inventory

Use this as the coverage baseline. The exact route/component names must be confirmed against the current branch before implementation. The image reference column identifies a standalone PNG in `images/`. Static CMS routes use one reusable template reference because the actual content is CMS-driven.

### 4.1 Public customer web journey

| Route / flow | Current page | Mobile screen reference |
|---|---|---|
| `/` | `Home.tsx` | `01_home.png` |
| `/shop` | `Shop.tsx` | `02_shop.png` |
| `/shop/:id` | `ProductDetail.tsx` | `03_product_detail.png` |
| `/cart` | `Cart.tsx` | `04_cart.png` |
| `/checkout` delivery/contact step | `Checkout.tsx` | `05_checkout_delivery.png` |
| `/checkout` payment/review step | `Checkout.tsx` | `06_checkout_payment.png` |
| `/login` | `Login.tsx` | `07_login.png` |
| `/register` | `Register.tsx` | `08_register.png` |
| `/verify-account` | `VerifyAccount.tsx` | `09_verify_account.png` |
| `/verify-email` | `VerifyEmail.tsx` | `10_verify_email.png` |
| `/forgot-password` | `ForgotPassword.tsx` | `11_forgot_password.png` |
| `/reset-password` | `ResetPassword.tsx` | `12_reset_password.png` |
| `/about`, `/privacy`, `/terms`, `/faq`, `/contact` | respective public pages | `13_cms_content_page.png` (template/layout only) |
| `/pet-recovery` | `PetRecovery.tsx` | `14_pet_recovery.png` |
| `/guardian` | `GuardianLanding.tsx` | `15_guardian_landing.png` |
| `/membership` | `Membership.tsx` | `16_membership_landing.png` |
| `/donate` | `Donate.tsx` | `17_donate.png` |
| `/refer` | `Refer.tsx` | `48_public_refer.png` |
| `/donations/receipt/:token` | `DonationReceiptView.tsx` | `45_donation_receipt_view.png` |
| `/invoice/:token` | `InvoiceView.tsx` | `44_secure_invoice_view.png` |
| catch-all | `NotFound.tsx` | Use shared error-state tokens; no invented app route |

### 4.2 Authenticated customer account

| Route / flow | Current page | Mobile screen reference |
|---|---|---|
| `/account` | `account/Dashboard.tsx` | `18_dashboard.png` |
| `/account/pets` | `account/MyPets.tsx` | `19_pets_list.png` |
| add/edit pet | current pet flow in `MyPets.tsx` / shared UI | `20_add_edit_pet.png` |
| `/account/pets/:id` | `account/PetDetail.tsx` | `21_pet_detail.png` |
| proposed `/account/pets/:id/health` | currently modal-only `account/HealthRecords.tsx` | `18_health_records.png` |
| add/edit health record | current form in `HealthRecords.tsx` | `19_health_record_editor.png` |
| `/account/pets/:id/lost` and existing lost interaction | `account/LostMode.tsx` / PetDetail actions | `22_lost_mode.png` |
| `/account/redeem-tag` | `account/RedeemTag.tsx` | `23_tag_activation.png` |
| `/account/profile` | `account/Profile.tsx` | `26_profile_security.png` |
| `/account/notifications` | `account/Notifications.tsx` | `27_notifications.png` |
| `/account/notification-preferences` | `account/NotificationPreferences.tsx` | `28_notification_preferences.png` |
| `/account/settings` | `account/Settings.tsx` | `29_settings.png` |
| `/account/orders` | `account/Orders.tsx` | `24_orders_list.png` |
| `/account/orders/:id` | `account/OrderDetail.tsx` + `packages/ui/.../OrderDetailView.tsx` | `25_order_details.png` |
| `/account/orders/:id/return` | `account/ReturnRequest.tsx` | `39_return_request.png` |
| `/account/invoices` | `account/Invoices.tsx` | `invoice_list_screen.png` |
| `/account/invoices/:id` | `account/InvoiceDetail.tsx` | `invoice_detail_screen.png` |
| `/account/donations` | `account/MyDonations.tsx` | `30_donations_list.png` |
| `/account/subscriptions` | `account/Subscriptions.tsx` | `31_subscriptions.png` |
| `/account/guardian` | `account/GuardianDashboard.tsx` | `32_guardian_dashboard.png` |
| `/account/guardian/points` | `account/GuardianPoints.tsx` | `33_guardian_points.png` |
| `/account/guardian/rewards` | `account/GuardianRewards.tsx` | `34_guardian_rewards.png` |
| `/account/membership` | `account/MembershipManage.tsx` | `35_membership_manage.png` |
| `/account/membership/subscribe` | `account/MembershipSubscribe.tsx` | `36_membership_subscribe.png` |
| `/account/upgrade` | `account/SubscriptionUpgrade.tsx` | `46_subscription_upgrade.png` |
| `/account/referrals` | `account/Referrals.tsx` | `37_referrals.png` |
| `/account/tag-activation-fee` | `account/TagActivationFee.tsx` | `38_tag_activation_fee.png` |

### 4.3 Finder public mobile browser journey

| Route / state | Current source | Mobile screen reference |
|---|---|---|
| Finder landing `/` | `apps/finder/src/App.tsx`, `FinderLanding.tsx` | `40_finder_landing.png` |
| Public tag/pet recovery `/:tagId` | `apps/finder/src/App.tsx`, pet detail components | `41_finder_pet_details.png` |
| Notify owner form | `NotifyOwnerForm.tsx` | `42_finder_notify_owner.png` |
| Location consent state | `LocationConsentBanner.tsx` and current handler | `43_finder_location_consent.png` |
| Invalid/unavailable tag | existing error state | `47_finder_invalid_tag.png` |

### 4.4 Shared UI states the agent must cover

The screen images are not a replacement for state coverage. For applicable routes, inspect and preserve loading/skeleton, empty, inline validation, API error/retry, saving, success, disabled, expired-session/login-return, offline, not-found, restricted/entitlement, long-content, and destructive-confirmation states. Specifically verify checkout authentication/step progression, order cancelled/refunded states, invoice paid/void/credit-note cases, health-record no-data/error/save/delete cases, Finder consent-denied and invalid-tag cases, and keyboard-open form states. Do not add states unsupported by actual code/data.

---

## 5. Design requirements

### 5.1 Visual language

- Treat `docs/DESIGN.md` and shared `@pawtag/ui` components/tokens as the design-system source.
- Use PawTag teal, warm white/neutral surfaces, charcoal text, semantic status colors, restrained borders/shadows and consistent typography/radii.
- Prefer clear hierarchy, typography and whitespace over nested panels, excessive badges, decorative gradients or dense rows.
- Do not rely on hover. Use accessible names, focus states and touch-friendly targets (at least the existing 44px standard where feasible).
- Keep browser/mobile app navigation consistent with the existing five account destinations: Home, Pets, Activate, Activity, Account. Do not copy the alternate tabs shown in generated art.
- Public shop/navigation and authenticated account bottom navigation are distinct. Do not add customer account navigation to Finder or public checkout without existing product behavior.

### 5.2 Orders redesign requirements

**Orders list**

- Prioritize order number/date, current order state and total; each should be easy to scan at a glance.
- Show a short item summary (and image when the existing API provides it) and a compact progress cue where meaningful.
- Reduce secondary payment/address/invoice detail from the card face; place it in order details.
- Provide a clear detail action without wrapping multiple unrelated statuses around the amount.
- Avoid an interactive parent containing interactive children. Use valid link/button semantics and a predictable keyboard sequence.
- Support orders with long identifiers, multiple items, no image, no tracking, cancelled/refunded/partial-refund statuses and the no-orders state.

**Order detail**

- Header: order number, placed date, primary order state, and payment state only when present.
- Next: progress/fulfilment and the actual next action or tracking state.
- Then: items, item quantities/customization, totals, invoice, payment and shipping details.
- Put return/cancel actions in a prominent but contextual action area only when existing code says they are available.
- Keep refund lifecycle/status and return status distinct; do not merge or relabel them into a new business state.
- At phone widths, use one column and short labels. At larger widths, use a deliberate main/supporting column layout. No horizontal overflow at 320px.
- Keep support for invoice viewing, tracking, cancellation reasons, return requests, return tracking submission and all current error/success states.

### 5.3 Invoice redesign requirements

**Invoice list**

- Build a document card with clear document type (invoice vs credit note), number, human status label, issue date, amount and related order/membership context when returned.
- Use clear full-label View details and separate Download PDF controls; avoid icon-only actions without accessible names.
- Use semantic structure that does not nest buttons/links inside another button-like row.
- Ensure long invoice numbers, credit-note negative amounts, labels and actions wrap without clipping at narrow widths.
- Preserve server-side pagination, real HTML document view and server-generated PDF download behavior.

**Invoice details**

- Lead with a compact document summary: type, document number, status, amount and relevant date.
- Group related order/membership/subscription information, line items and totals so customers can find the financial result quickly.
- Make the total visually distinct and show only totals returned by current data. Preserve GST, shipping, discounts, card fee and currency fields as currently modeled.
- Credit notes must show the credited scope and total, not original-order items that contradict the credit amount.
- Keep View and Download actions above the mobile tab bar, safe-area aware, and reachable with the software keyboard where relevant.
- Preserve secure access controls, existing `openDocumentInNewTab` behavior and tokenized document routes.

### 5.4 Health Records redesign requirements

- Replace the overlay modal with a durable page destination linked from Pet Details. The proposed path is `/account/pets/:id/health`; verify route conventions and deep-link behavior first.
- Render inside `AccountLayout` so title, breadcrumb, responsive width, bottom navigation and safe-area clearance are owned once.
- The page should retain pet identity and make the current category clear. On desktop, use a stable section navigation plus content workspace. On phone, use a compact accessible category selector/navigation that does not require swiping through an ambiguous strip of nine tabs.
- Provide readable record cards/lists with category-appropriate fields and the existing values. Do not invent care reminders or clinical interpretation.
- Use a full-page or inline add/edit experience rather than a modal. Keep the user oriented to the pet and category, and make Save/Cancel reachable when the software keyboard is open.
- Preserve all existing sections: vaccinations, microchips, medications, allergies, vet details, surgeries, weight history, health conditions and desexing.
- Preserve existing fetch/save/delete endpoints, record shapes, success/error feedback and membership entitlement checks. No endpoint, rule, schema or entitlement change.
- Make category navigation keyboard accessible and expose selected state semantically. Use page headings, `aria-current`/tab semantics where appropriate, labeled fields, error association and focus movement after save/cancel.
- Confirm whether opening a category loads current data or relies on pet-detail payload; prevent stale/empty UI without introducing duplicate or conflicting fetch behavior.
- Destructive confirmation must remain clear. If current browser `confirm()` is retained, keep it accessible; replacing the interaction is presentation-only only if equivalent and no deletion semantics change.

---

## 6. Phased implementation sequence

OpenCode must complete all phases in one autonomous run unless a concrete blocker exists. Keep a small progress/evidence record in the existing execution documentation area or an appropriately named mobile UX follow-up file; do not scatter duplicate plans across the repository.

### Phase 0 — Repository reset and evidence baseline

1. Read root `AGENTS.md`, `README.md`, `docs/DESIGN.md`, `docs/execution/2026-10-06/00_READ_ME_FIRST.md`, Phases 08–10, and the mobile route/redesign/fidelity matrices.
2. Inspect current branch, working tree and the relevant source components. Preserve unrelated changes.
3. Rebuild route/component inventory from `apps/web/src/App.tsx`, account navigation config and `apps/finder/src/App.tsx`; confirm each row in §4.
4. Confirm current scripts, dependencies, tests and available browser tools. Run baseline checks where feasible before editing.
5. Record unsupported routes, route title fallbacks, inaccessible patterns and unverified checks as evidence, not assumptions.

**Gate:** baseline inventory and validation capabilities are documented; no source/config/business behavior changed in this phase.

### Phase 1 — Shared mobile shell and reachability audit

1. Review `AccountLayout`, `BottomNav`, drawer/sidebar, public `Navbar`, route protection, scroll restoration, deep links and page-level fixed/sticky bars.
2. Verify each customer route is reachable by navigation and by direct URL, with a meaningful mobile title/back path and no duplicate shell chrome.
3. Correct presentation/navigation-only defects that cause clipping, hidden content, inaccessible menu states or incorrect active tabs. Do not change which actions or routes a user is entitled to access.
4. Resolve account section title/breadcrumb fallbacks through existing navigation presentation configuration only if safe and within repository conventions.
5. Maintain exactly the existing five customer account tab destinations and keep public, Finder and authenticated account chrome distinct.

**Gate:** route inventory reconciles to the actual router and every customer route has a discoverable path or a documented intentional access path.

### Phase 2 — Pet Health Records full-page redesign

1. Add a UI route for Health Records using established router and `AccountLayout` patterns. Link it from Pet Details; make browser back and a visible return link work.
2. Refactor `HealthRecords.tsx` from modal-only rendering into a page/workspace. Keep the existing component or extract presentation components without duplicating APIs.
3. Implement responsive category navigation and records presentation for all nine record categories.
4. Convert add/edit forms to a non-modal page/inline mode with clearly labeled, accessible inputs and keyboard-safe actions.
5. Preserve existing section endpoint mapping, API payloads, entitlements, save/delete behavior and toast/error semantics.
6. Verify empty/loading/error/saving/success state for each shared state pattern; test at least each category navigation and one create/edit/delete path using existing contracts.
7. Remove obsolete modal-only focus/overlay styling only after confirming no other screen uses it.

**Gate:** Health Records is a stable responsive route; no modal is used for viewing or editing records; all nine categories and existing actions remain available; no business/API/entitlement changes.

### Phase 3 — Orders and returns redesign

1. Refactor `account/Orders.tsx` into scannable mobile order cards using existing `Order`, status and payment data.
2. Preserve polling behavior and all status/refund labels. Do not conflate payment/order/refund/return states.
3. Refine `OrderDetailView` and its customer wrapper into a task-first hierarchy for phone widths and a deliberate wider layout.
4. Preserve tracking links, invoice entry, cancellation flow/reasons, return request eligibility, return tracking edits, refund summary and subscription related information.
5. Ensure proper link/button semantics, target sizes, keyboard order and text wrapping.

**Gate:** list and details work for pending, paid, packing, shipped with/without tracking, delivered, cancelled, refunded, partial refund, return states, invoice absent/present and empty/error states.

### Phase 4 — Invoice list and details redesign

1. Rework invoice list cards around document identity, type/status/date/amount and relationship context.
2. Preserve pagination, API response/status labels and secure real HTML/PDF actions.
3. Replace ambiguous nested interactive row patterns with valid semantic link/button composition.
4. Rebuild Invoice Details summary, items, totals, payment/context and actions as grouped sections.
5. Validate invoice and credit-note rendering separately, especially credited item scope and negative credit amount.
6. Preserve the mobile action bar’s position above bottom navigation and account for safe-area/keyboard/long labels.

**Gate:** invoice/credit-note UI uses current values, correct document paths and no altered access policy; View and PDF actions are tested.

### Phase 5 — Remaining customer route review and refinements

1. Review every public/customer route in §4, not only the three priority workstreams.
2. Reconcile actual page state and visible actions with current code; improve layout only where a concrete usability issue exists.
3. Review dashboard, pet list/detail, lost mode, tag activation, profile, notifications/preferences, settings, donations, subscriptions, Guardian/rewards, membership, referral and activation fee pages.
4. Validate public commerce, registration/dual verification, sign-in return path, cart and each checkout step without changing flow or totals.
5. Apply shared tokens/components and fix duplicated wrappers, conflicting sticky bars, bottom-nav overlap, keyboard obstruction, horizontal scrolling and insufficient focus indication.
6. Keep missing product features (for example, reminders or new MFA choices) out of UI unless they already exist in source and API data.

**Gate:** all customer routes have recorded review outcomes. Any intentionally unchanged screen has a reason based on current source/product behavior, not an unsupported “already compliant” claim.

### Phase 6 — Finder mobile browser journey

1. Review landing, tag/pet details, owner notification form, location consent, loading/error/invalid-tag and success states in `apps/finder`.
2. Make all existing fields, consent copy, permission requests and actions comfortable on phone widths.
3. Preserve public access, privacy behavior, contact endpoints and location consent semantics.
4. Ensure no link forces app install, customer login or customer account navigation.

**Gate:** public Finder flow can be completed at phone widths in browser; consent and privacy behavior remains the same.

### Phase 7 — Accessibility, responsive and regression validation

1. Test responsive layouts at 320, 360, 375, 390, 430 CSS px and 768px tablet where tooling permits. Check horizontal overflow, text wrapping, sticky action overlap, safe-area spacing and page-end content visibility.
2. Test keyboard navigation, visible focus, screen-reader names/roles, form labels/errors, accessible status beyond color, reduced motion and zoom/text scaling where supported.
3. Test account navigation and direct URLs with authenticated and unauthenticated state where fixtures exist; verify return after login and browser back.
4. Run focused unit/component tests for changed behavior, followed by web/Finder typecheck, lint/build and meaningful project regression suites available in the repo.
5. Run browser-level mobile tests on priority flows if Playwright/browser fixtures are available: Health Records, Orders, Invoice, Checkout, registration verification, Finder notify owner.
6. Record exact commands, counts/results and failures. Mark real-device and store tests NOT RUN unless performed on physical devices; do not infer Capacitor readiness from browser tests.

**Gate:** required desktop and responsive automated checks pass or have a clearly isolated failure report; all unexecuted manual/device rows remain explicitly unverified.

### Phase 8 — Final route and scope reconciliation

1. Reconcile implementation against every row in §4 and the existing mobile route/visual matrices.
2. Update evidence documents only where implementation changed the truth. Do not claim tests, screenshots, runtime or device validation that did not happen.
3. Confirm there are no accidental changes to business logic, API contracts, configuration, API data mapping, payment/auth/entitlement behavior or `apps/mobile` parallel UI.
4. Provide a concise final report: screens changed, screens audited and unchanged, files touched, test commands/results, known UI issues and external native-shell/device blockers.

---

## 7. Validation matrix

| Area | Minimum validation |
|---|---|
| Route coverage | Every route in §4 loads directly and is reachable from the existing navigation/flow; intentional bare/public routes remain bare/public. |
| Health Records | All nine categories; existing entitlement boundary; view/add/edit/delete; empty/error/saving/success; back navigation; 320–430px layout; no modal. |
| Orders | Long/short order number; every status family; tracking present/absent; return/cancel/refund distinctions; invoice action; no order state; narrow layout. |
| Invoices | Paid/unpaid/void and credit note; long document number; amounts/currency from API; pagination; HTML view; PDF download; secure routes; bottom-bar clearance. |
| Authentication | Login/register, email and mobile verification steps, resend/retry/error, password reset, return URL; do not alter activation policy. |
| Checkout | Existing step sequence, guest/auth gate, real payment component behavior, quote/totals unchanged, fixed action/keyboard/safe-area positions; test provider mode remains configuration. |
| Finder | Valid/invalid tag, loading/error, owner contact submission, consent granted/denied/continued without consent where supported, no login/app install. |
| Responsive | 320, 360, 375, 390, 430px phone widths and 768px tablet; no horizontal page scroll, clipped controls or content hidden behind navigation/action bars. |
| Accessibility | Semantic links/buttons/forms, 44px targets where practical, keyboard order/focus, named icon controls, status not conveyed by color alone, zoom/reduced motion. |
| Native app | Do not claim complete until shell bootstrap, route delivery, deep links, native capabilities and physical iOS/Android checks are separately proven. No configuration/native project edits in this task. |

---

## 8. Definition of done

This mobile UI implementation is complete when:

- the shared web route set remains the one source of customer screen behavior;
- all existing customer/Finder screen areas in §4 have been reviewed and have a recorded outcome;
- Health Records is a full responsive page, not a modal, and preserves the nine categories and current entitlement/API behavior;
- order list cards, order details, invoice list cards and invoice details have been redesigned to clear, customer-first mobile hierarchies;
- existing payment, auth, verification, health, return, refund, invoice, notification and Finder behavior is unchanged;
- no business/config/API/persistence changes or duplicate React Native customer screens are introduced;
- meaningful tests and available typecheck/lint/build gates pass, and unrun checks are labeled honestly;
- generated image concepts are treated only as layout guidance;
- final report identifies any separate native shell/configuration, physical device, store or external dependency that this UI-only plan cannot close.

