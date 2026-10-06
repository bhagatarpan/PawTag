# PawTag MVP — Verified Comprehensive Review & Execution-Ready Implementation Plan

> **Repository reviewed:** uploaded `PawTag-main.zip` received 2026-10-06  
> **Purpose:** second full-system review after execution of the previous MVP implementation plan  
> **Authority:** actual source code, runtime wiring, tests, configuration and persistence models are the source of truth. Documentation and status files are treated as claims that must agree with the implementation.  
> **Audience:** PawTag founder, technical lead, OpenCode and autonomous coding agents.  
> **This document supersedes earlier implementation-plan completion claims wherever the current source code disagrees.**

---

# 1. How This Review Was Performed

This is a repository-wide source review, not a review of only the files changed by the previous implementation plan. The current repository was inspected across:

- `apps/web`
- `apps/finder`
- `apps/admin`
- `apps/mobile`
- `packages/api`
- `packages/db`
- `packages/shared`
- `packages/ui`
- `packages/design-tokens`
- root test suites
- CI configuration
- Docker configuration
- background workers/jobs
- payment and webhook code
- email, invoice and notification paths
- authentication/session code
- commerce and fulfilment services
- current `docs/MVP_IMPLEMENTATION_STATUS.md`
- original and second implementation plans under `docs/`
- real-device validation documentation
- repository-local skills and AI-agent guidance

The repository currently contains approximately:

- 821 TypeScript/TSX source files
- 71 database model files
- 66 API route files
- 147 root test files
- 95 documentation files
- 22 repository-local skills

## Runtime-validation limitation

The uploaded archive does not contain installed root dependencies and `pnpm` is not available as a direct executable in this review environment. Therefore this audit does **not** independently certify the checked-in claim that the full test suite/build currently passes. The status file records a green baseline from 2026-09-20; that is useful evidence but not equivalent to rerunning it against this exact archive today.

The implementation plan below requires the coding agent to restore and prove a fresh green baseline before making further production-readiness claims.

---

# 2. Technical-Lead Verdict

PawTag has materially improved since the first audit. Important corrections are present in the code, including:

- explicit payment modes (`fake`, `stripe_test`, `stripe_live`)
- production Stripe guardrails
- Stripe raw-body middleware mounted before JSON parsing
- checkout ownership checks
- server-authoritative item pricing
- a public Finder DTO
- Finder CAPTCHA integration
- finder state/idempotency improvements
- worker entry point and job-claiming infrastructure
- dedicated `/cart` page
- significantly improved cart item presentation
- QR and NFC mobile fixes
- better invoice access-token handling
- richer observability and audit infrastructure

However, **PawTag is still not ready for the first uncontrolled real customer.**

The remaining issues are not primarily “missing screens.” They are cross-layer production-integrity problems: reservation lifecycle, payment recovery, shipping configuration, subscription entitlement timing, email webhook security, push-provider mismatch, browser session hardening, checkout UX/business logic, and missing end-to-end proof.

The most important conclusion is:

> **Do not continue treating the percentage of work packets marked complete as the launch metric. Launch readiness must now be based on verified user journeys and financial/data invariants.**

---

# 3. Current Status File Is Not a Reliable Completion Authority

`docs/MVP_IMPLEMENTATION_STATUS.md` contains useful implementation history, but several completion claims conflict with the current source.

| Status claim | Current source evidence | Verdict |
|---|---|---|
| Browser refresh tokens no longer returned/stored | `auth.ts` still returns `refreshToken`; web/admin still write refresh tokens to localStorage | **Not complete** |
| Checkout uses consistent premium 70/30 shell | Delivery step contains `max-w-2xl` single-column UI; only later steps use 12-column layouts | **Not complete** |
| Checkout safely decomposed | `apps/web/src/pages/Checkout.tsx` is still ~1,369 lines | **Not complete** |
| Shipping selection removed client cost authority | Backend ignores client cost, but frontend still posts stale `cost`; fallback rates are not selectable by current service | **Partial** |
| PawRewards reservation implemented | PendingOrder stores a boolean but no balance is atomically reserved | **Not complete** |
| Real-device mobile validation complete | `docs/MOBILE-REAL-DEVICE-VALIDATION.md` remains an unchecked checklist | **Not validated** |
| Input validation consistency complete | High-value routes such as checkout still consume `req.body` without schema validation | **Not complete** |
| Email reliability complete | Resend webhook path/security are defective; no durable critical-email delivery workflow | **Not complete** |
| Production hardening complete | Web E2E not present; staging/production rehearsal remains unproven | **Not complete** |

**Required action:** reset `MVP_IMPLEMENTATION_STATUS.md` to an evidence-based status model during Phase 0 of this plan.

---

# 4. Stop-Ship Findings

These are the defects I would insist on fixing or explicitly removing from MVP scope before accepting real customer money or relying on PawTag for lost-pet recovery.

## P0-1 — PawRewards is not actually reserved

**Files**

- `packages/api/src/commerce/services/checkout.service.ts`
- `packages/api/src/services/loyalty/pawrewards.service.ts`
- `packages/db/src/models/PendingOrder.ts`

At PaymentIntent creation the server reads the current PawRewards balance and subtracts the requested amount from the calculated charge, but it does not atomically reserve or debit the balance. `pawRewardsReserved: true` is only a flag on `PendingOrder`.

`commitRewardsReservation()` later rereads the user balance. If the balance is insufficient it logs an error and returns without failing the already-paid order.

Two concurrent checkouts can therefore both receive the same rewards discount. One or both can complete without a corresponding reward debit.

**Must fix:** implement a real atomic reservation/hold ledger or atomically move balance from available to reserved. Payment amount must only be reduced after a durable reservation succeeds.

---

## P0-2 — Abandoned PendingOrders can leak reserved stock

**Files**

- `packages/db/src/models/PendingOrder.ts`
- `packages/api/src/commerce/services/checkout.service.ts`
- `packages/api/src/commerce/services/inventory.service.ts`
- checkout/cleanup jobs

Inventory is reserved when a PendingOrder is created. `PendingOrder.expiresAt` has a Mongo TTL index with `expireAfterSeconds: 0`.

Mongo TTL deletion bypasses application cleanup. No authoritative expiry workflow releases inventory and rewards before deletion.

Result: abandoned checkouts can leave `Product.reserved` permanently inflated.

**Must fix:** business expiry and database deletion must be separate. Expired pending checkouts must be claimed by a worker, cancel/resolve the provider intent, release stock/rewards, record disposition, then be retained for a short audit window before eventual TTL deletion.

---

## P0-3 — Failed stock confirmation is silently treated as success

**File:** `packages/api/src/commerce/services/inventory.service.ts`

`confirmSale()` performs an atomic `findOneAndUpdate()` with stock/reserved preconditions. If no product matches, it simply returns without throwing.

Checkout therefore considers inventory confirmation successful even when no sale was recorded.

**Must fix:** a failed precondition must throw a typed inventory-finalization error and place the order into a recoverable/manual-review state. Never silently accept a failed inventory commit.

---

## P0-4 — Payment/order finalization still has non-repairable partial states

**File:** `packages/api/src/commerce/services/checkout.service.ts`

The code has improved `completionStatus`/`completionErrors`, but `PaymentTransaction.create()` executes before the tracked completion-step block. If it fails after Order creation, retry can return the existing order without necessarily repairing the missing payment transaction.

Other completion failures are recorded as `repair_required`, but there is no complete automated repair worker proven for every recorded step.

**Must fix:** define a durable finalization state machine and idempotent repair handlers for payment transaction, inventory, promo, rewards, entitlement, fulfilment, invoice and cart cleanup.

---

## P0-5 — Stripe failed webhooks can become permanently stranded

**Files**

- `packages/api/src/routes/stripe-webhooks.ts`
- `packages/api/src/jobs/webhookRetry.ts`
- `packages/db/src/models/WebhookEvent.ts`

Webhook events are persisted and claimed, which is good. But the route error handler attempts to derive event ID from `req.body`; in real Stripe mode `req.body` is a Buffer. A failure after recording the normalized event can therefore leave it in `processing` forever.

The retry worker primarily processes pending/failed rows. A process crash after transition to processing can produce the same stranded state.

**Must fix:** retain the normalized verified event in scope for error updates and add processing leases/stale-processing recovery.

---

## P0-6 — Shipping fallback rates cannot reliably be selected

**Files**

- `packages/api/src/routes/shipping.ts`
- `packages/api/src/commerce/services/shipping.service.ts`
- `packages/api/src/commerce/providers/nz-shipping/index.ts`

`getRates()` falls back to provider IDs such as `free-standard` and `flat-rate` when no `ShippingMethod` documents exist. But `selectMethod()` requires `ShippingMethod.findById(methodId)`. Those fallback IDs are not Mongo ObjectIds/documents.

Therefore the UI can receive a shipping rate that the backend cannot select.

Additionally, `cartSubtotal` is calculated in the route but not passed into the service; provider fallback is invoked with `subtotal: 0`, so threshold-based free shipping logic is wrong.

**Must fix:** one authoritative quote/rate-token system must generate and validate selectable shipping options regardless of whether the source is DB configuration or a provider.

---

## P0-7 — Production fulfilment can fabricate a successful NZ Post shipment

**File:** `packages/api/src/commerce/providers/nz-shipping/index.ts`

When NZ Post credentials are absent, `createShipment()` creates a successful demo tracking number. There is no production fail-closed check.

The “real” request also contains implementation requiring provider verification, including a hard-coded sender address and a `parcells` request field.

**Must fix:** production must explicitly use either:

1. validated live NZ Post integration, or
2. explicit manual-fulfilment mode that never invents tracking.

Demo shipment success must be impossible in production.

---

## P0-8 — Gold/subscription entitlement can be activated before payment success

**Files**

- `packages/api/src/services/subscription.service.ts`
- `packages/api/src/services/membership.service.ts`
- Stripe subscription webhooks

The repository contains overlapping subscription/membership implementations. `subscription.service.ts` creates Stripe subscriptions with `payment_behavior: 'default_incomplete'` but contains paths that create local subscriptions as `active`, mark invoices based on presence of a PaymentIntent ID, and send “Gold Membership Activated” before a successful provider payment is authoritatively established.

**Must fix:** consolidate to one authoritative membership state machine. `active` entitlement must be the consequence of confirmed provider payment/webhook state, never the existence of an intent or subscription object.

---

## P0-9 — Browser refresh-token hardening is not actually complete

**Files**

- `packages/api/src/routes/auth.ts`
- `packages/shared/src/api/client-factory.ts`
- `apps/web/src/pages/Login.tsx`
- `apps/web/src/context/AuthContext.tsx`
- `apps/admin/src/pages/Login.tsx`
- `apps/admin/src/lib/auth.tsx`

The API still includes `refreshToken` in multiple responses. Browser apps still persist it in `localStorage`.

This directly contradicts the status document.

**Must fix:** separate browser and native contracts explicitly. Browser refresh credentials live only in HttpOnly cookies. Native refresh tokens remain in SecureStore. Remove stale localStorage migration data and review CSRF/SameSite/CORS for cookie-authenticated refresh/logout endpoints.

---

## P0-10 — Resend webhook is both mis-mounted and unauthenticated

**Files**

- `packages/api/src/index.ts`
- `packages/api/src/routes/resend-webhooks.ts`

The router is mounted at `/api/webhooks/resend` but defines `POST /resend`, producing an effective route of `/api/webhooks/resend/resend`, despite comments claiming `/api/webhooks/resend`.

The webhook also accepts status updates without signature verification.

An unauthenticated caller can spoof email delivery/bounce/open/click states.

**Must fix:** correct the route, implement provider-supported signed-webhook verification using exact raw-body requirements, deduplicate event IDs, and reject unsigned/invalid events.

---

## P0-11 — Mobile registers Expo push tokens but backend sends them through Firebase Admin

**Files**

- `apps/mobile/src/lib/pushNotifications.ts`
- `packages/api/src/services/push-notification.service.ts`
- `packages/db/src/models/PushToken.ts`

Mobile uses `Notifications.getExpoPushTokenAsync()`. Backend passes stored tokens to `firebase-admin.messaging().send()`.

Expo push tokens are not Firebase registration tokens. This is an integration mismatch.

The backend also treats missing Firebase config as “demo push” and reports all tokens as successfully sent.

**Must fix:** choose one coherent provider architecture:

- Expo Push Service using Expo tokens, or
- obtain native FCM/APNs tokens appropriate for Firebase delivery.

For current Expo architecture, the simplest MVP choice is an Expo Push Service adapter. Production missing-provider configuration must fail/alert, never report fake success.

---

## P0-12 — Checkout Step 1 is not the promised 70/30 premium experience

**File:** `apps/web/src/pages/Checkout.tsx`

The source comment says “70/30 layout”, but the delivery step contains a `max-w-2xl` single-column block. Later payment/review steps use different 12-column structures.

The result is exactly the inconsistency reported by the founder: the checkout changes visual architecture between steps.

**Must fix:** create one persistent checkout shell used by Delivery, Review and Payment.

---

## P0-13 — Saved-address UI displays the wrong address line

**File:** `apps/web/src/pages/Checkout.tsx`

Each saved address card renders `form.line1` instead of `addr.line1`. Multiple cards can display the currently selected address line.

**Must fix immediately** because it can cause customers to choose the wrong shipping destination.

---

## P0-14 — “Save this address” is a non-functional control

**File:** `apps/web/src/pages/Checkout.tsx`

The checkbox exists visually but has no state or save action.

**Must fix or remove.** Production checkout must not present controls that do nothing.

---

## P0-15 — No browser E2E proof exists for the critical business loop

There is no Playwright setup or web E2E suite in the current repo. CI does not exercise a browser checkout/recovery flow.

The defects above demonstrate why unit/integration tests alone are insufficient.

**Must fix:** Playwright critical-path gates before launch.

---

# 5. Important High-Severity Findings

## H-1 — Zero-total checkout is not explicitly supported

Client code uses `totals.total || fallbackCalculation`, so a legitimate server total of `0` falls back to client arithmetic.

The backend then attempts normal PaymentIntent creation for `totals.total`, including zero-value outcomes after promo/rewards.

Define an explicit no-payment-required path. Recommended MVP decision:

- calculate a server quote;
- if payable total is exactly zero, create a PendingOrder marked `no_payment_required`;
- finalize through the same idempotent order-finalization service without calling Stripe;
- create an auditable zero-value payment/credit record where useful;
- never route zero-pay orders through fake Stripe behaviour.

---

## H-2 — Promo usage is not concurrency-safe and per-user limits are not enforced authoritatively

`PromoCode` contains limits, but checkout increments `usageCount` after the order. There is no atomic claim preventing concurrent orders from exceeding the global limit, and `perUserLimit` is not robustly enforced at finalization.

Implement a promo redemption/claim model or atomic reservation/update with user-level redemption tracking.

---

## H-3 — PaymentIntent creation precedes durable checkout reservation completion

Stripe PaymentIntent is created before PendingOrder creation and stock reservation. If later persistence/reservation fails, an orphan external intent can remain.

Add compensation (cancel intent) and/or reorder the process so durable checkout state exists before external provider allocation where possible.

---

## H-4 — Critical post-checkout emails are fire-and-forget

Checkout schedules emails/notifications asynchronously and logs errors. That is acceptable for latency only if failed delivery becomes durable retryable work. Currently critical transactional delivery is not fully backed by an outbox/retry state machine.

Implement a lightweight Mongo-backed outbox rather than adding a large queue platform for MVP.

---

## H-5 — Push missing configuration reports success

`sendPushToUser()` returns `sent: tokens.length` when Firebase is unavailable.

Production must return failure/unavailable state and create an operational alert. Do not claim delivery.

---

## H-6 — Checkout shipping-rate requests are vulnerable to stale/racing responses

Rates are fetched from mutable address state. There is no robust request cancellation/versioning contract. Fast typing/address changes can allow an older response to replace a newer one.

Use debounced complete-address quoting with `AbortController` or request generation IDs, and bind the selected rate to an immutable quote version.

---

## H-7 — Client still submits stale shipping fields

Frontend shipping synchronization still sends `methodName` and `cost` even though cost is supposedly server-authoritative.

Remove stale fields. Client should submit only an opaque server-issued rate/quote ID.

---

## H-8 — Checkout verification friction requires an explicit product decision

Current progression requires both email and mobile verification. This may be intentional for PawTag account security, but it creates high checkout friction.

Recommended decision:

- require verified email for account/order communication;
- do not block payment solely on phone verification unless phone verification is a documented fraud/recovery requirement;
- if phone is required for tag recovery, allow purchase and require verification before activation or critical notification features instead.

If the business deliberately requires both before purchase, retain it but redesign the step to make the reason and recovery path exceptionally clear.

---

## H-9 — Completion repair state exists without complete repair execution

`Order.completionStatus='repair_required'` is valuable, but it is only useful if every error category has a deterministic retry/repair handler and operational visibility.

Add `orderCompletionRepair` worker and admin visibility.

---

## H-10 — Dead/obsolete order-creation service remains in source

`packages/api/src/services/order-creation.service.ts` appears unreferenced and implements older order/tag/subscription behaviour.

This is especially dangerous in an AI-assisted repository because future agents may discover and reuse it.

Verify there are no dynamic imports, then delete it or clearly quarantine it as deprecated test/history code.

---

# 6. What Is Genuinely Better Than the First Audit

The second review should not obscure real progress. The following improvements are present in source:

- Stripe raw request body is mounted before global JSON parsing.
- Checkout confirmation binds PendingOrder to the authenticated user.
- Payment mode is explicit and production refuses fake/test Stripe mode.
- Finder CAPTCHA is integrated end-to-end.
- Finder field projection is deliberate rather than serializing the full Pet model.
- Mobile SecureStore adapter is asynchronous without the prior Promise-as-token defect.
- Mobile QR scanner callback is corrected.
- Mobile NFC URI payload decoding is substantially improved.
- Cart page uses a real 12-column desktop grid with an 8/4 split.
- Cart item cards now have stronger hierarchy, stock messaging and customization treatment.
- Invoice access tokens are persisted in more flows.
- API and worker responsibilities have started to separate.
- CI now exists and includes smoke/unit/integration/regression/typecheck/build/coverage jobs.
- Production environment validation is materially stronger.

These are reasons to continue incrementally rather than rewrite the application.

---

# 7. Cart UX/UI — Verified Deep Review

## 7.1 Current architecture

The dedicated `/cart` direction is correct:

- `CartDrawer` should remain a quick mini-cart.
- `/cart` should be the full decision-making commerce surface.

`apps/web/src/pages/Cart.tsx` now uses `lg:grid-cols-12` with an 8/4 split and a sticky summary. Structurally that is approximately 67/33 and is acceptable as the intended “70/30” principle.

The remaining gap is not primarily the column ratio; it is **composition, information hierarchy, consistency and interaction quality**.

## 7.2 Required premium desktop layout

Use a shared commerce container (target max width approximately 1280–1360px, controlled by design tokens rather than ad hoc page values).

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Cart                                                                     │
│ 3 items                                                     Continue →  │
├──────────────────────────────────────────────┬───────────────────────────┤
│ PRIMARY — 8/12                               │ SUMMARY — 4/12            │
│                                              │ sticky                    │
│ Product card                                 │ Order summary             │
│ ┌────────┬────────────────────────────────┐  │ Subtotal                  │
│ │ image  │ Product / variant              │  │ Product discounts         │
│ │        │ Engraving / customization      │  │ Promo                     │
│ │        │ Stock / price state            │  │ Rewards                   │
│ │        │ Qty           line total       │  │ Shipping estimate         │
│ └────────┴────────────────────────────────┘  │ GST                        │
│                                              │ ─────────────────────     │
│ Product card                                 │ Estimated total            │
│                                              │                           │
│ Delivery / returns reassurance               │ [ Secure checkout ]        │
│ Guardian/Gold value treatment                │ trust/payment cues         │
└──────────────────────────────────────────────┴───────────────────────────┘
```

## 7.3 Cart requirements

### Product cards

Every line item must show, in this order:

1. product image
2. product title
3. variant/SKU only if customer-useful
4. personalization/engraving as a clearly labeled sub-section
5. unit price
6. customization surcharge if separate
7. quantity control
8. line total
9. inventory/price-change warning only when relevant
10. remove action

Avoid generic table-like CRUD presentation.

### Order summary

Must distinguish:

- merchandise subtotal
- customization subtotal if material
- promo discount
- Guardian/Gold discount or benefit
- PawRewards/Guardian Points redemption
- shipping status: **“Calculated at checkout” until a real rate has been selected**; never show “Free” merely because current cart field defaults to 0
- GST treatment
- final/estimated total

Terminology must be unified. Choose one customer-facing term for PawRewards / Guardian Points and use it consistently throughout cart, checkout, account, emails and admin.

### Async quantity behaviour

`CartItemCard` currently stops its local “updating” state immediately because `onUpdateQuantity` is typed/called as synchronous.

Refactor the contract to return a Promise or derive pending state from CartContext. Disable conflicting changes while a mutation is in flight and recover visually on failure.

### Drawer parity

`packages/ui/src/components/CartDrawer.tsx` should remain intentionally simpler but must calculate/display the same authoritative line price semantics as `/cart`, including customization.

### Responsive behaviour

- >= 1024px: 8/4 layout, sticky summary.
- tablet: either 7/5 or stacked based on measured content width; never squeeze product cards below readable width.
- mobile: one column; bottom sticky checkout bar shows total + CTA; full summary remains available in flow.
- no horizontal scrolling for ordinary cart content.

### Accessibility

- quantity control has explicit accessible names and disabled/pending state
- removal announces result
- cart errors use `role=alert` or appropriate live region
- price/inventory changes are announced without moving focus unexpectedly
- sticky CTA never obscures content
- focus returns predictably when drawer closes

---

# 8. Checkout UX/UI — Verified Deep Review

## 8.1 Current problem

`apps/web/src/pages/Checkout.tsx` is still approximately 1,369 lines and combines:

- account/contact verification
- saved/custom addresses
- address autocomplete
- shipping-rate fetching
- shipping selection
- promo/rewards state
- Stripe intent creation
- payment
- review
- confirmation/recovery

The UI does not maintain one spatial architecture across steps.

The delivery step is explicitly commented as “70/30” but uses a centered `max-w-2xl` block. Payment and review use separate 12-column grids. This creates visible layout jumping and undermines the premium commerce experience.

## 8.2 Required checkout journey

Recommended MVP checkout:

```text
/cart
   ↓
1. Delivery & Contact
   ↓
2. Review
   ↓
3. Payment
   ↓
Confirmation
```

Do not reintroduce cart editing as a checkout step. Quantity/removal/personalization lives in `/cart`.

## 8.3 Persistent checkout shell

Delivery, Review and Payment must all render inside the same shell:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ PawTag     Secure checkout              Delivery • Review • Payment       │
├──────────────────────────────────────────────┬───────────────────────────┤
│ PRIMARY — 8/12                               │ SUMMARY — 4/12            │
│                                              │ sticky                    │
│ Current step content                         │ compact item list         │
│                                              │ promo / rewards state     │
│ Delivery: contact/address/shipping           │ shipping                  │
│ Review: address/shipping/key options         │ GST                       │
│ Payment: Stripe/payment method               │ total                     │
│                                              │ trust/support cue         │
└──────────────────────────────────────────────┴───────────────────────────┘
```

The right summary should not disappear or radically change structure between steps.

## 8.4 Fix concrete Checkout defects

### Saved address display

Replace use of `form.line1` inside each saved-address card with the card's `addr.line1` and corresponding `addr.line2`.

### Save-address checkbox

Either wire it to the saved-address API after validation or remove it until implemented. Do not ship inert controls.

### Semantic address selection

Use a `<fieldset>` + `<legend>` and label-backed radio cards, not a clickable `<div>` containing a radio. Entire card remains clickable through `<label>` semantics.

### Shipping quote flow

Do not fetch provider rates for every partial address mutation.

Recommended contract:

1. customer selects/completes a valid address;
2. client requests `POST /api/checkout/quote` or a dedicated shipping-quote endpoint;
3. server calculates item prices, discounts, rewards eligibility, tax, shipping options and quote expiry/version;
4. response includes opaque selectable rate IDs/tokens;
5. customer selects rate token only;
6. server recalculates/validates quote before PaymentIntent creation.

A quote should bind to cart version + address + user + expiry so stale rates cannot be reused after cart changes.

### PaymentIntent lifecycle

If a customer returns from Payment to an earlier step and changes any price-affecting input, the existing PaymentIntent must be invalidated/cancelled or updated from a new authoritative quote. Never charge against a stale snapshot.

### Zero-total orders

Implement explicit `no_payment_required` finalization instead of calling Stripe with zero.

### Verification friction

Product decision for MVP: verified email is required for checkout; phone verification is required before tag recovery features that need the phone channel, not automatically before purchasing physical goods. If PawTag deliberately chooses stricter checkout verification, document the business reason and add recovery UX.

### Loading/error states

Each async boundary needs a local recoverable state:

- saved addresses
- address autocomplete
- shipping quote
- promo/rewards application
- PaymentIntent creation
- Stripe confirmation
- order finalization
- invoice/receipt generation

Do not collapse every failure into a page-level generic toast.

### File decomposition

Refactor only after behaviour is protected by tests. Target components/hooks:

- `CheckoutShell`
- `CheckoutSummary`
- `DeliveryContactStep`
- `SavedAddressSelector`
- `ShippingQuoteSelector`
- `CheckoutReviewStep`
- `CheckoutPaymentStep`
- `CheckoutConfirmation`
- `useCheckoutQuote`
- `useCheckoutRecovery`

The page should orchestrate state and navigation, not contain all markup and transport logic.

---

# 9. Payment Mode Contract

PawTag now has the right conceptual model. Preserve it and make the behaviours explicit.

| Mode | Intended environment | Stripe network calls | Webhooks | Real money | Allowed in production |
|---|---|---:|---:|---:|---:|
| `fake` | deterministic local/unit dev | No | simulated internally only | No | **No** |
| `stripe_test` | local integration/staging | Yes, Stripe Test | signed Stripe test webhook | No | **No** |
| `stripe_live` | production | Yes, Stripe Live | signed live webhook | Yes | **Yes** |

## Required invariants

- `NODE_ENV=production` requires `PAYMENT_MODE=stripe_live`.
- live mode rejects `sk_test_*`.
- test mode requires a valid Stripe test key and a valid test webhook secret when webhook behaviour is being exercised.
- fake mode can never silently activate because a provider credential is missing.
- provider failure in live/test mode can never fall through to fake success.
- health/readiness exposes sanitized provider state, never secrets.
- unit tests can use fake mode; payment integration tests use `stripe_test` in isolated environments.

---

# 10. Email, Invoice, Notification and Webhook Verification Matrices

These matrices are implementation requirements, not documentation-only checklists. Every row must eventually have an automated test and, where external-provider behaviour matters, staging evidence.

## 10.1 Email trigger matrix

| Trigger | Recipient source | Template / function | Delivery requirement | Failure behaviour |
|---|---|---|---|---|
| Registration verification | authenticated/registered user's verified email target | `sendVerificationEmail` | blocking enough to report send failure; retryable | UI says not sent; allow resend |
| Welcome | user email | `sendWelcomeEmail` | async durable | outbox retry |
| Password reset | account email | `sendPasswordResetEmail` | security-critical | generic API response; durable send record |
| Password changed | user email | `sendPasswordChangedEmail` | security notification | durable retry + audit |
| Login/security notification | user email | `sendLoginNotification` | async durable | record failure |
| Finder pet-found alert | owner notification email(s) determined by recovery rules | `sendPetFoundEmail` / CMS equivalent | critical recovery alert | retry + alternative channel/escalation |
| Emergency escalation | emergency contact | escalation email function/template | critical recovery | retry/escalate; never claim delivered without evidence |
| Order confirmation | order owner's email snapshot | `sendOrderConfirmation` | transactional | outbox retry; visible in admin |
| Invoice delivery | authorized order/subscription recipient | `sendInvoiceEmail` | transactional | retry; regenerate access token safely |
| Shipping notification | order owner | `sendShippingNotification` | transactional | retry; does not roll back shipping |
| Refund/cancellation | order owner | relevant CMS/email path | transactional | durable retry |
| Gold/Guardian activation | membership owner | `sendSubscriptionWelcomeEmail` / Guardian functions | only after entitlement active | never send before payment confirmation |
| Renewal reminder/result | subscription owner | renewal functions | scheduled durable | retry + audit |
| Loyalty reminders/summaries | eligible user | Guardian/PawRewards functions | noncritical | bounded retries |

## 10.2 Email provider verification

| Area | Current status | Required verification |
|---|---|---|
| Resend send API | implemented | staging send to controlled mailbox |
| Missing key in production | startup enforcement exists | automated startup test |
| Development simulation | exists | clearly labeled, never used for prod evidence |
| Resend webhook path | **incorrect effective path** | fix to canonical path and integration test |
| Resend webhook signature | **missing** | signed valid/invalid tests |
| Delivery audit | implemented | idempotent event update test |
| Bounce/complaint handling | partial status mapping | user/admin policy + suppression behaviour |
| Retry/outbox | incomplete | persistent critical-email outbox |

## 10.3 Invoice matrix

| Flow | Invoice required | Access control | Delivery |
|---|---:|---|---|
| paid product order | yes | owner/admin or scoped one-time token | order email + portal |
| zero-pay order | yes/receipt according to accounting policy | same | portal/email |
| subscription start | yes where charged | owner/admin/token | subscription email/portal |
| subscription renewal | yes | owner/admin/token | renewal email/portal |
| partial/full refund | credit note / adjusted accounting artifact | owner/admin/token | refund email/portal |
| cancelled unpaid order | no paid invoice; preserve audit record | owner/admin | cancellation message |

Validate token expiry, one-time/limited access semantics, no `?admin=1` bypasses, ownership and audit logging.

## 10.4 Webhook matrix

| Provider/event | Expected handler | Idempotency | Retry/recovery | Security |
|---|---|---|---|---|
| Stripe `payment_intent.succeeded` | finalize/recover order | event ID + payment ID | stale-processing recovery | Stripe signature/raw body |
| Stripe `payment_intent.payment_failed` | mark pending failure/release when terminal | event ID | cleanup worker | signature |
| Stripe refund/charge events | reconcile refund | event ID/provider transaction ID | reconciliation worker | signature |
| Stripe invoice succeeded | subscription renewal/activation | event ID + invoice ID | repair worker | signature |
| Stripe invoice failed | mark past-due/failure policy | event ID | retry/dunning policy | signature |
| Stripe subscription updated/deleted | synchronize local entitlement | event ID/subscription ID | reconciliation | signature |
| Resend delivered/bounced/etc. | update EmailAudit | provider event ID | safe reprocessing | **signed webhook required** |

## 10.5 Notification matrix

| Channel | Producer | Persistence | Provider | Required outcome |
|---|---|---|---|---|
| in-app | notification service | `Notification` | internal | persisted/read state |
| email | notification/email service | EmailAudit + outbox | Resend | sent/failed/delivery status |
| SMS | relevant verification/recovery paths | audit/log | Twilio when selected | real provider or explicit disabled mode |
| mobile push | push service | PushToken + delivery result | choose Expo or Firebase coherently | real delivery, no demo-success in prod |
| finder escalation | escalation service | escalation model | email/SMS/push | retries + terminal escalation state |

---

# 11. API/Route Verification Matrix

The coding agent must maintain an inventory generated from mounted Express routers and shared endpoint definitions. At minimum, the following critical route groups require contract tests.

| Route group | Critical routes | Verification focus |
|---|---|---|
| Cart | GET cart; add/update/delete item; promo; shipping; totals | ownership, validation, authoritative pricing, concurrency |
| Checkout | payment-intent; confirm; pending; status | auth, schemas, idempotency, zero-pay, recovery |
| Shipping | rates; select | quote integrity, fallback rate selection, stale quote prevention |
| Stripe webhook | POST `/api/webhooks/stripe` | raw body, signature, duplicate event, failure retry |
| Resend webhook | canonical POST path | signature, idempotency, status mutation |
| Push tokens | register/delete/list | token type/provider, ownership, validation |
| Notifications | list/read/preferences/actions | ownership, pagination, delivery vs persistence semantics |
| Orders | list/detail/cancel/return | ownership, state transitions, financial bounds |
| Invoices | owner/admin/token retrieval | no IDOR, token expiry, audit |
| Subscriptions/membership | create/change/cancel/status | provider state, entitlement, idempotency |
| Finder | public tag view; notify; location | public DTO, CAPTCHA, rate limit, idempotency, privacy |
| Auth | register/login/MFA/refresh/logout/reset/verify | cookie/native contract, CSRF, rotation, lockout |
| Admin financial | refunds/order state/subscription/settings | RBAC, confirmation, audit, provider reconciliation |

Every mutation route in these groups must have schema validation or an explicitly documented typed/manual validator. Financial/public/admin-destructive routes have no exceptions.

---

# 12. Autonomous Agent Execution Rules

The implementation agent should receive this entire document plus `AGENTS.md`, but execute **one phase at a time** without asking the founder routine technical questions.

For each phase it must:

1. inspect current implementation and relevant tests before editing;
2. record baseline tests for the affected area;
3. implement the smallest coherent solution satisfying the phase contract;
4. add regression/integration/E2E tests appropriate to the risk;
5. run typecheck and targeted tests;
6. run the broader required gate for the phase;
7. review its own diff for unrelated changes;
8. update `docs/MVP_IMPLEMENTATION_STATUS.md` with commands and evidence, not percentages;
9. commit logically if the human workflow requests commits;
10. proceed to the next phase automatically only after the current phase gate is green.

It must stop only for genuine external blockers such as missing production credentials, inaccessible provider account configuration, DNS, Apple/Google developer-account action, Stripe dashboard webhook setup, or physical-device human validation.

It must never weaken authentication, ownership, validation, payment verification, privacy, idempotency or accounting controls merely to make a test pass.

---

# 13. Phased Implementation Plan

## Phase 0 — Reset Evidence and Restore a Trusted Baseline

### Objective

Make the repository status truthful before further work.

### Likely files

- `docs/MVP_IMPLEMENTATION_STATUS.md`
- root `package.json`
- `.github/workflows/ci.yml`
- relevant failing tests/source discovered by baseline

### Tasks

1. Install using the pinned Node/pnpm versions.
2. Run:
   - `pnpm typecheck`
   - `pnpm test:unit`
   - `pnpm test:integration`
   - `pnpm test:regression`
   - `pnpm test:smoke`
   - `pnpm build`
   - lint command(s) that actually exist
3. Record exact counts and failures from this exact commit.
4. Change status categories to:
   - `VERIFIED`
   - `IMPLEMENTED — NOT VALIDATED`
   - `IN PROGRESS`
   - `BLOCKED — EXTERNAL`
   - `NOT STARTED`
5. Remove “102% complete”/similar progress arithmetic.
6. Correct false claims identified in Section 3.
7. Add a source commit hash/date to every future validation entry.

### Acceptance criteria

- baseline commands genuinely pass or every failure is explicitly listed;
- no “complete” status is based only on a checklist/document existing;
- later phases have a known starting point.

### Rollback

Documentation-only changes can be reverted independently; source fixes discovered during baseline must be isolated commits.

---

## Phase 1 — Authoritative Checkout Quote and Schema Boundary

### Objective

Create one server-owned snapshot of every value that can affect the amount charged.

### Likely files

- `packages/api/src/routes/checkout.ts`
- `packages/api/src/commerce/services/checkout.service.ts`
- `packages/api/src/commerce/services/pricing.service.ts`
- `packages/api/src/routes/shipping.ts`
- `packages/shared/src/api/endpoints.ts`
- shared/Zod schemas
- `apps/web/src/pages/Checkout.tsx`

### Tasks

1. Add Zod schemas for checkout quote/payment-intent/confirm requests.
2. Introduce `CheckoutQuote` contract with:
   - quote ID/version
   - cart version/hash
   - item snapshots
   - subtotal/customization
   - discounts/promo
   - rewards reservation eligibility
   - tax
   - selectable shipping rates
   - selected shipping rate
   - payable total
   - currency
   - expiry
3. Never accept monetary values from client as authority.
4. Make shipping rate selection an opaque server rate ID/token.
5. Revalidate quote immediately before provider intent creation.
6. Invalidate/requote when cart, address, promo, rewards or shipping selection changes.
7. Implement explicit zero-total/no-payment-required checkout contract.
8. Return customer-readable quote-expired/stock-changed/price-changed responses.

### Tests

- manipulated price/tax/shipping/rewards values ignored/rejected;
- stale quote rejected;
- cart change invalidates quote;
- zero-total quote does not call Stripe;
- malformed body rejected with 400;
- ownership enforced.

### Acceptance criteria

There is exactly one authoritative total used by UI display, PaymentIntent and Order creation.

---

## Phase 2 — Pending Checkout Lifecycle, Expiry and Compensation

### Objective

Make abandoned/failing checkouts release every reserved resource exactly once.

### Likely files

- `packages/db/src/models/PendingOrder.ts`
- checkout service
- inventory service
- PawRewards service
- worker/jobs
- Stripe provider cancellation method

### Tasks

1. Remove immediate business-expiry TTL deletion behaviour.
2. Add PendingOrder lifecycle fields such as:
   - `businessExpiresAt`
   - `cleanupStatus`
   - `cleanupAttempts`
   - `cleanupClaimedAt`
   - `cleanupError`
   - provider cancellation state
3. Add a worker to atomically claim expired PendingOrders.
4. For terminal abandoned/failing pending checkout:
   - cancel/reconcile PaymentIntent where appropriate;
   - release exact inventory reservation;
   - release rewards hold;
   - release promo reservation if introduced;
   - preserve audit state.
5. Apply TTL only to terminal historical records after a safe retention period.
6. Add compensation when PaymentIntent creation succeeds but PendingOrder/stock reservation fails.

### Tests

- abandoned checkout releases stock;
- cleanup runs twice without double release;
- worker crash/lease expiry is recoverable;
- payment succeeded race does not release committed inventory;
- orphan Stripe intent is cancelled/reconciled.

### Acceptance criteria

No checkout resource can remain reserved merely because a browser was closed or a process crashed.

---

## Phase 3 — PawRewards and Promo Concurrency Integrity

### Objective

Ensure discounts cannot be double-spent or exceed configured limits.

### Likely files

- PawRewards models/services
- `PendingOrder`
- `PromoCode`
- new reservation/redemption models if required
- checkout service

### PawRewards decision

Implement durable holds. Prefer a ledger/reservation record keyed by checkout/quote rather than overloading the user balance field.

Required invariants:

`available = earned - redeemed - active_reserved - expired`

or an equivalent atomically maintained model.

### Promo decision

Add durable promo claims/redemptions so global and per-user limits can be atomically enforced under concurrency.

### Tasks

- reserve rewards atomically before reducing payable total;
- idempotent commit and release;
- prevent two pending checkouts spending the same balance;
- enforce promo `usageLimit` atomically;
- enforce `perUserLimit`;
- define expiry/release semantics for promo reservation;
- expose customer-friendly rejection reasons.

### Tests

Run concurrent Promise-based integration tests proving only valid requests succeed.

### Acceptance criteria

No discount or reward value can be created by racing requests.

---

## Phase 4 — Inventory Reservation and Order Finalization State Machine

### Objective

Make paid-order finalization deterministic and repairable.

### Likely files

- inventory service
- checkout service
- Order/StockMovement/PaymentTransaction models
- worker

### Tasks

1. Make `confirmSale()` throw if its atomic predicate does not match.
2. Consider explicit InventoryReservation documents keyed by PendingOrder for exact attribution. If avoiding a new model, at minimum prove reserve/release/confirm totals remain correct under concurrent orders.
3. Create a typed finalization state machine with idempotent handlers:
   - order persisted
   - payment transaction recorded
   - inventory committed
   - promo committed
   - rewards committed
   - points awarded
   - digital entitlement created
   - fulfilment created
   - invoice created
   - cart cleared
   - notifications queued
4. Build `orderCompletionRepair` worker for every recoverable step.
5. Add admin view/action for `repair_required` orders with safe retry.
6. Make PaymentTransaction idempotent/unique by provider transaction + type.

### Acceptance criteria

A process can die after any step and a retry/worker converges to one correct final state without duplicate side effects.

---

## Phase 5 — Stripe Webhook Durability and Payment Reconciliation

### Objective

Make Stripe events safe under duplicates, handler failures and process crashes.

### Likely files

- `routes/stripe-webhooks.ts`
- `jobs/webhookRetry.ts`
- `WebhookEvent`
- reconciliation jobs

### Tasks

- keep verified normalized event ID in handler scope;
- update failure state by normalized event ID, never raw body parsing after verification;
- add processing lease/claimedAt;
- reclaim stale processing events;
- enforce unique `(source,eventId)`;
- cap retries and expose dead-letter/terminal state;
- add correlation IDs to payment/order logs;
- reconcile Stripe succeeded payments without orders;
- reconcile local paid orders with contradictory provider state;
- ensure refund events are idempotent.

### Tests

Valid signature, invalid signature, duplicate event, handler throw, process-stale event, out-of-order event, recovery to correct order.

### Acceptance criteria

No verified Stripe event can remain silently stranded.

---

## Phase 6 — Payment Mode and Environment Proof

### Objective

Prove `fake`, `stripe_test` and `stripe_live` behave differently and safely.

### Tasks

- remove duplicate `RESEND_API_KEY` optional classification;
- make Stripe webhook secret required in `stripe_test` when running provider integration/staging;
- add startup matrix tests;
- prove production refuses fake/test keys/modes;
- ensure no `catch` in test/live provider flows falls back to fake success;
- add sanitized `/health`/readiness provider status;
- document exact staging and live variables without values.

### External validation

Run a Stripe Test staging checkout using a real test card and signed webhook endpoint.

### Acceptance criteria

A configuration error stops the system instead of silently producing simulated success.

---

## Phase 7 — Subscription / Guardian Gold Entitlement Integrity

### Objective

Collapse overlapping membership/subscription pathways into one authoritative lifecycle.

### Likely files

- `subscription.service.ts`
- `membership.service.ts`
- subscription routes
- Stripe webhook handlers
- subscription/invoice models
- web/admin membership UIs

### State model

Suggested states:

`pending_payment → active → past_due/grace → cancelled/expired`

Never set `active` until provider payment state proves entitlement.

### Tasks

- inventory all callers of both services;
- nominate one authoritative service;
- migrate callers incrementally;
- prevent “active” after `default_incomplete` until confirmation;
- invoice is paid only on provider-confirmed successful payment;
- send welcome/activation only after state transition to active;
- implement idempotent webhook sync;
- reconcile stale local/provider subscription states;
- define cancellation-at-period-end vs immediate cancellation;
- ensure refund/cancellation affects entitlement correctly.

### Acceptance criteria

A failed card cannot result in active Gold entitlement or “paid” invoice.

---

## Phase 8 — Shipping, Fulfilment and Tracking

### Objective

Make shipping rates selectable, fulfilment real or explicitly manual, and production unable to fabricate tracking.

### Likely files

- shipping routes/service/provider
- older duplicate shipping service
- shipment service/label service
- Order model/admin fulfilment UI

### Tasks

1. Fix fallback provider rate selection through the quote/rate-token model.
2. Pass real server subtotal/items into rate calculation.
3. Remove stale client `cost` and unnecessary `methodName` authority.
4. Choose launch fulfilment mode:
   - **recommended for first customer if NZ Post API is not proven:** manual fulfilment with admin-entered tracking;
   - otherwise validate live NZ Post API contract in staging.
5. Production must never call `createDemoShipment()`.
6. Move sender address to validated configuration, not hardcoded code.
7. Verify NZ Post payload field names/API version against provider documentation during implementation.
8. Consolidate duplicate shipping services.
9. Add state-transition protection: paid → packing → shipped → delivered.
10. Shipment creation must be idempotent.

### Acceptance criteria

Every shipping option shown can be selected and charged correctly, and every “shipped” real order corresponds to a real/manual tracking action rather than demo generation.

---

## Phase 9 — Email Reliability, Resend Webhook and Transactional Outbox

### Objective

Make critical email delivery observable, retryable and provider-authenticated.

### Likely files

- `email.service.ts`
- `email-audit.service.ts`
- `resend-webhooks.ts`
- EmailAudit model
- worker

### Tasks

- fix Resend route to canonical endpoint;
- implement signed webhook verification;
- use raw body if required by provider signature specification;
- deduplicate provider webhook events;
- create lightweight Mongo transactional/outbound-message model for critical emails;
- queue rather than fire-and-forget critical emails;
- retry exponential/backoff with terminal failure state;
- expose email failure in admin/support view;
- define suppression behaviour after hard bounce/complaint;
- ensure production missing Resend fails startup/readiness;
- ensure test recipient override cannot activate in production.

### Acceptance criteria

Order/Finder/security email failures are durable work, not lost log lines.

---

## Phase 10 — Invoice and Financial Document Integrity

### Objective

Complete invoice/credit-note ownership, state and delivery rules.

### Tasks

- map invoice creation to successful financial state;
- implement zero-pay receipt semantics;
- ensure subscription invoice paid state follows confirmed provider state;
- ensure refunds produce correct credit-note/accounting representation;
- verify every access-token path expires and cannot elevate to admin;
- prevent duplicate invoices under retries;
- make invoice email delivery outbox-backed;
- include immutable order/customer/address/tax snapshots required for historical accuracy.

### Acceptance criteria

An invoice’s status never claims money was received solely because a PaymentIntent ID exists.

---

## Phase 11 — Push and Notification Provider Alignment

### Objective

Make mobile push actually deliver through the token type the app registers.

### Recommended MVP decision

Because the mobile app currently obtains Expo push tokens, implement an Expo Push Service provider unless there is a deliberate decision to migrate the client to native FCM/APNs tokens.

### Tasks

- add token provider/type to PushToken model (`expo`, `fcm`, etc.);
- validate token shape;
- implement Expo push adapter with receipt checking;
- remove Firebase-only assumption or migrate client accordingly;
- production missing provider returns failure/alert, never fake success;
- deactivate invalid tokens based on provider receipts;
- persist send attempt/outcome for critical recovery notifications;
- verify deep-link payloads.

### Acceptance criteria

A push sent in staging arrives on a real iOS and Android test device and delivery failures are visible.

---

## Phase 12 — Browser Session, Refresh Token and CSRF Hardening

### Objective

Finish the partially implemented browser/native auth split.

### Tasks

- browser login/MFA/refresh responses omit refresh token body;
- native client explicitly identifies a native token flow and receives refresh token for SecureStore;
- remove `pawtag_refresh_token` and `admin_refresh_token` localStorage writes;
- one-time migration removes stale browser refresh keys;
- browser API uses cookie refresh with credentials;
- validate `HttpOnly`, `Secure` in production, appropriate `SameSite`, path and expiry;
- review CSRF requirements for refresh/logout and any other cookie-authenticated mutation;
- strict allowlist CORS with credentials;
- session revocation after password reset/change and administrative disable;
- tests for token rotation/reuse detection.

### Acceptance criteria

A browser JavaScript context cannot read the refresh credential.

---

## Phase 13 — API Input Validation, Authorization and Security Boundary Audit

### Objective

Close remaining public/financial/admin mutation boundary gaps.

### Tasks

- Zod validation on checkout, shipping, push token and all financial/admin-destructive routes;
- systematically inventory `req.body`, `req.query`, `req.params` usage;
- constrain resource lookups by owner/permission at query boundary;
- test IDOR/BOLA on pets/tags/orders/invoices/subscriptions/addresses/payment methods;
- protect file uploads by MIME/size/type and storage authorization;
- rate-limit auth/Finder/support/payment-sensitive endpoints using multi-instance-safe backing;
- confirm proxy trust/IP handling in production;
- ensure errors never expose provider secrets/internal stack traces.

### Acceptance criteria

Security test suite proves representative horizontal/vertical authorization attacks fail.

---

## Phase 14 — Finder Recovery Final Hardening

### Objective

Prove the core PawTag business loop under real conditions.

### Tasks

- production-mode E2E: valid tag → pet view → CAPTCHA → notify → owner alert;
- invalid/deactivated/expired/returned tag states;
- duplicate finder submission idempotency;
- location allowed/denied/unavailable;
- poor network/retry/refresh behaviour;
- owner non-response escalation;
- public DTO snapshot tests;
- retention cleanup validation;
- delivery wording only claims events actually persisted/queued, not provider-delivered unless known;
- accessibility and mobile performance audit.

### Acceptance criteria

A stranger on a phone can complete the recovery workflow without an account and without exposing unnecessary private data.

---

## Phase 15 — Premium `/cart` Redesign and Behaviour Completion

### Objective

Deliver the product-quality cart described in Section 7 while preserving commerce correctness.

### Likely files

- `apps/web/src/pages/Cart.tsx`
- `apps/web/src/components/cart/*`
- `packages/ui/src/components/CartDrawer.tsx`
- design tokens

### Tasks

- shared premium commerce page shell;
- 8/4 desktop composition with stable sticky summary;
- separate premium cards, not one visually flat white container;
- clear personalization hierarchy;
- accurate line totals including customization;
- authoritative shipping messaging;
- unify PawRewards/Guardian terminology;
- promo success/error/expired states;
- inventory/price-changed callouts;
- async quantity mutation correctness;
- empty/loading/offline/server-error states;
- guest/auth handoff preserves cart;
- mobile sticky total CTA;
- reduced-motion support.

### Automated tests

- quantity/add/remove
- customization line price
- promo states
- inventory conflict
- guest-to-auth preservation
- summary totals
- keyboard operation

### Visual validation

Capture Playwright screenshots at mobile/tablet/desktop viewports and compare against an approved baseline.

---

## Phase 16 — Premium Persistent 70/30 Checkout

### Objective

Replace the inconsistent current step layouts with one coherent premium checkout experience.

### Tasks

1. Protect current behaviour with E2E tests before refactor.
2. Extract the components/hooks listed in Section 8.
3. Implement persistent 8/4 shell across Delivery, Review and Payment.
4. Fix saved-address rendering bug.
5. Wire or remove Save Address.
6. Implement semantic radio-card address and shipping selectors.
7. Integrate server CheckoutQuote contract.
8. Add debounced/cancellable quote refresh.
9. Keep summary visible and consistent through all steps.
10. On mobile, use one-column sections plus sticky final CTA; do not force two columns.
11. Design explicit states for quote expired, price changed, stock changed, payment failed, finalization pending, finalization repair/recovery.
12. Add safe recovery when payment succeeded but browser disconnects.
13. Ensure Back navigation never causes a stale intent to be charged.
14. Confirmation displays order ID/number, delivery expectations, receipt/invoice access, and next action.

### Acceptance criteria

The first checkout screen visibly follows the same premium shell as the later steps, with no major layout jump.

---

## Phase 17 — Admin Financial and Operational Safety

### Objective

Make staff operations safe without spending MVP time on unnecessary admin mobile polish.

### Tasks

- enumerate refund/cancel/subscription/role/payment-mode/shipment/CMS-publish destructive actions;
- require explicit permission and confirmation;
- reason/note required for financially significant changes;
- audit before/after state, actor and provider transaction IDs;
- hide/disable fake/test controls in production;
- show repair-required orders/webhooks/emails/jobs;
- prevent duplicate refund/shipment actions;
- keep admin desktop-first, keyboard accessible.

### Acceptance criteria

A CSR cannot accidentally perform or repeat a financial action outside granted permissions.

---

## Phase 18 — Background Workers, Leases and Recovery

### Objective

Make every externally significant background task safe with multiple instances and restarts.

### Jobs to verify

- Stripe webhook retry
- pending checkout expiry
- order completion repair
- payment/refund reconciliation
- subscription renewal/reconciliation
- escalation
- shipment polling
- auto-cancel
- notification/email outbox
- loyalty jobs

### Requirements

Every job must have:

- atomic claim/lease
- lease expiry recovery
- idempotency key
- bounded retry/backoff
- terminal state/dead-letter or admin action
- observability metric
- no overlapping duplicate external action

### Acceptance criteria

Running two worker instances in an integration test does not duplicate refund/email/shipment/order side effects.

---

## Phase 19 — Mobile Release Hardening

### Objective

Separate “implemented” from “real-device validated.”

### Tasks

- complete every item in `docs/MOBILE-REAL-DEVICE-VALIDATION.md` with device/OS/build/date evidence;
- verify auth refresh flow with SecureStore;
- QR activation/scan;
- NFC NDEF read on supported Android/iOS hardware as applicable;
- push registration/delivery foreground/background/terminated;
- deep links;
- permission denial/recovery;
- offline/reconnect;
- app lifecycle/background;
- safe area/keyboard;
- Android back behaviour;
- production EAS build/config;
- store update/version strategy.

### Launch decision

If these cannot be proven before first customer, **do not make native mobile required for MVP**. Launch responsive web/Finder first and mark native app beta/internal.

---

## Phase 20 — Accessibility and Responsive System Audit

### Objective

Meet a practical WCAG 2.2 AA-oriented MVP bar.

### Scope

- Finder first priority
- cart/checkout second
- customer account
- admin high-risk workflows
- mobile native semantics/touch targets

### Tests

- axe automated checks in Playwright
- keyboard-only critical flows
- focus trapping/restoration
- error association
- screen-reader labels/status regions
- 200% zoom/responsive reflow
- reduced motion
- contrast check
- 44px-ish mobile target validation where applicable

---

## Phase 21 — Performance and Poor-Network Validation

### Objective

Prove critical journeys remain usable under realistic mobile conditions.

### Tasks

- Finder bundle/network waterfall audit;
- defer noncritical analytics writes from Finder response path where safe;
- image sizing/lazy loading;
- API query/pagination review;
- database query index verification using actual query patterns;
- prevent duplicate checkout/rate requests;
- code-split heavy customer/admin routes where valuable;
- simulate slow 4G/offline/reconnect for Finder and checkout.

### Acceptance criteria

Set measured budgets after baseline rather than arbitrary numbers; document and enforce the chosen budgets in CI where practical.

---

## Phase 22 — Web E2E and CI Quality Gate

### Objective

Add the missing cross-layer safety net.

### Playwright journeys required

1. register → verify → login
2. pet creation/edit
3. tag activation
4. lost mode
5. Finder scan/notify → owner-visible recovery event
6. product → cart → customization → quantity
7. promo/rewards checkout quote
8. delivery/address/shipping
9. fake-mode deterministic checkout for PR CI
10. Stripe-test checkout in staging pipeline/manual gate
11. payment succeeded/browser disconnected → recovery
12. order detail + invoice
13. cancellation/refund representative flow
14. subscription/Gold success/failure representative flow
15. major authorization negative tests

### CI changes

Add:

- lint
- Playwright PR gate using fake provider
- Docker build checks
- security/dependency audit according to repository toolchain
- optional scheduled Stripe-test smoke against staging
- mobile build/typecheck; Maestro where infrastructure permits

Do not chase meaningless global coverage. Raise thresholds specifically on critical commerce/auth/Finder modules and require new code coverage/regression tests.

---

## Phase 23 — Deployment, Docker and Production Configuration

### Objective

Prove the exact artifacts that will run in production.

### Tasks

- pin Docker pnpm to repository `packageManager` version; avoid `pnpm@latest`;
- build API/web/admin/finder images in CI;
- verify Vite runtime/build-time API URL strategy and nginx proxy configuration;
- define separate API and worker process deployment;
- readiness must fail when mandatory providers for enabled launch features are unavailable/misconfigured;
- provide staging/prod environment matrix;
- secrets only in secret manager/platform, never repo;
- migrations/index creation procedure;
- rolling deployment strategy;
- database compatibility rules;
- explicit rollback procedure.

### Acceptance criteria

A clean environment can build and start the same images intended for production using documented configuration only.

---

## Phase 24 — Privacy, Retention, Backup and Restore Proof

### Objective

Convert policies/checklists into executed evidence.

### Tasks

- retention jobs for FinderScan/location/security logs/outbox/webhooks according to chosen policy;
- account/pet deletion and soft-delete semantics;
- export/delete workflows where implemented;
- restrict health/microchip/location data by audience;
- review logging/redaction for PII/secrets;
- take staging DB backup and actually restore to isolated environment;
- verify R2/file backup/recovery expectations;
- record RPO/RTO assumptions appropriate for MVP;
- have legal/privacy professional review policies separately from technical implementation.

---

## Phase 25 — Remove Dangerous Dead/Duplicate Paths and Reduce AI Drift

### Objective

Make the codebase safer for future AI-assisted development.

### Tasks

- confirm and remove unreferenced `order-creation.service.ts`;
- consolidate duplicate shipping services;
- inventory overlapping membership/subscription services and remove deprecated entry points after migration;
- remove stale endpoint strings/contracts;
- replace unsafe `as any` at critical boundaries first, not as a cosmetic repo-wide campaign;
- break giant route/page files only where boundaries are now stable;
- add comments only for non-obvious invariants, not to justify bypasses;
- update repository skills if new authoritative patterns changed.

### Acceptance criteria

There is one obvious implementation path for each financially significant workflow.

---

## Phase 26 — Documentation and Status Reconciliation

### Objective

Make README/AGENTS/docs tell the truth after implementation.

### Tasks

- update `README.md` current architecture/run/config/test information;
- update `AGENTS.md` only where new invariants/tools changed;
- update skills referencing payment/auth/shipping/notifications;
- mark historical plans as superseded rather than deleting useful history;
- generate current route/provider/environment matrices from source where possible;
- update `MVP_IMPLEMENTATION_STATUS.md` with actual evidence from this commit;
- no unsupported “production-ready” claim.

---

## Phase 27 — Staging Dress Rehearsal With Real Test Providers

### Objective

Run the system the way production will behave without using real customer money.

### Required staging configuration

- production-equivalent Mongo topology
- `PAYMENT_MODE=stripe_test`
- Stripe Test keys + signed public webhook
- real Resend controlled domain/test recipients
- chosen SMS provider test/sandbox as applicable
- chosen push provider with physical devices
- staging storage
- shipping sandbox or explicit manual mode
- Sentry/observability
- API + worker as separate processes

### Execute end-to-end

- account create/verify/MFA where enabled
- purchase a personalized PawTag
- promo/rewards
- shipping selection
- Stripe success/failure/3DS if supported
- webhook delay/duplicate
- browser disconnect after charge
- invoice email/download
- fulfilment/tracking
- cancellation/refund
- Gold subscription success/failure
- lost mode + Finder + escalation
- push/email/SMS delivery
- worker restart during queued work

### Acceptance criteria

Every external side effect has evidence: provider ID, DB state and expected customer/admin state.

---

## Phase 28 — Real-Person UX Validation

### Objective

Catch issues code review cannot.

Use at least several people who did not build PawTag.

### Scenarios

- “Buy and personalize a tag.”
- “You found this lost pet. Help return it.”
- “Your payment failed; recover.”
- “Change quantity/promo/shipping.”
- “Find your receipt/invoice.”
- “Cancel/request return.”
- mobile Finder under intentionally slow network.

Observe; do not coach. Record confusion points and fix genuine blockers/friction before launch.

Cart/checkout must specifically be judged for premium visual hierarchy, trust, clarity and consistency—not merely completion.

---

## Phase 29 — Final End-to-End Launch Gate

### Objective

One final release candidate must pass every critical invariant on the same commit/image.

## Required automated gate

- typecheck
- lint
- unit
- integration
- regression
- smoke
- build
- Playwright critical E2E
- Docker builds
- critical security/authorization tests

## Required operational gate

- production env validation dry-run
- DB indexes verified
- backup restore evidence current
- monitoring alerts tested
- Stripe live webhook endpoint configured (no real charge required until controlled launch)
- Resend signed webhook configured
- production domains/TLS/CORS/cookies checked
- API/worker deployment ownership checked
- shipping mode explicitly approved
- mobile gate either passed or native app excluded from launch scope

## Critical business invariants

- customer cannot alter authoritative price/shipping/tax/discount;
- rewards/promo cannot be double-spent;
- inventory reservation always commits or releases;
- a successful charge converges to exactly one order;
- a failed charge never creates paid entitlement;
- a retry cannot duplicate order/refund/shipment/invoice;
- Finder works in production mode;
- anonymous Finder cannot access non-public owner/pet data;
- critical notification failures are visible/retryable;
- browser refresh credential is not readable by JavaScript;
- admin financial actions are authorized/audited;
- production cannot silently use demo payment/shipping/push/email behaviour.

Only after this gate should PawTag be considered ready for the first controlled customer.

---

# 14. First-Customer Controlled Launch

Do not immediately open to unrestricted public traffic after Phase 29.

Recommended first release:

1. one production release candidate;
2. one or a few known real customers;
3. staff watching payment/order/email/webhook/worker dashboards;
4. verify each first order manually against Stripe and database state;
5. verify fulfilment and Finder/tag activation path;
6. keep fast rollback available;
7. expand gradually after several clean real transactions.

This is not because the architecture cannot scale; it is because first-customer launch is the best opportunity to validate the final integration assumptions safely.

---

# 15. External Blockers the Agent Must Not Guess

The implementation agent should work autonomously through code phases, but it must explicitly flag these when actual human/provider access is required:

- production Stripe secret and webhook configuration
- Stripe staging webhook public endpoint
- Resend domain/webhook secret/provider configuration
- Twilio credentials/numbers if SMS is included
- Expo/Firebase provider account decision/credentials
- NZ Post account/API credentials if live automatic fulfilment is chosen
- Cloudflare R2/production storage credentials
- DNS/TLS/domain configuration
- Apple/Google developer accounts and physical device validation
- production database/backup platform access
- legal/privacy policy approval

Absence of those values must never be “solved” by adding fake production defaults.

---

# 16. Final Technical-Lead Answer

If I were personally responsible for approving PawTag for its first customer, I would **not** ask for a rewrite and I would **not** spend MVP time on theoretical large-scale architecture.

I would insist that the team/agent prove the following before launch:

1. **Money is correct:** one authoritative quote, real rewards/promo reservation, safe zero-pay handling, Stripe event recovery and exactly-one order.
2. **Inventory is correct:** every pending reservation either commits or releases, including abandoned checkouts.
3. **Entitlements are correct:** Gold/tag/subscription access never activates before the required payment state.
4. **Fulfilment is real:** production never invents a shipping success/tracking number.
5. **Communication is real:** email and push providers are coherent, signed/retryable and never report demo success as real delivery.
6. **Sessions are genuinely hardened:** browser refresh tokens leave localStorage.
7. **Finder is proven end-to-end in production-like configuration.**
8. **Cart and Checkout feel like one premium PawTag commerce experience:** `/cart` is an 8/4 product + summary experience and every checkout step uses the same persistent 8/4 shell on desktop with purpose-built mobile composition.
9. **Critical journeys are tested through a browser and real providers in staging**, not inferred from unit-test counts.
10. **Status/documentation reflect executed evidence**, not the existence of implementation files or checklists.

Once those conditions pass on one release candidate, the codebase is suitable for a controlled first-customer launch without an architectural rewrite.

---

# 17. Recommended OpenCode Kickoff Prompt

Use this after adding this file to the repository, for example as:

`docs/PawTag_MVP_Verified_Comprehensive_Review_and_Implementation_Plan.md`

```text
Read AGENTS.md, README.md, docs/MVP_IMPLEMENTATION_STATUS.md, and
`docs/PawTag_MVP_Verified_Comprehensive_Review_and_Implementation_Plan.md`.

The verified comprehensive plan supersedes earlier completion claims wherever
current source code or validation evidence disagrees.

Execute Phase 0 first, then continue phase-by-phase only when each phase gate is
green. Use the relevant repository-local skills. Do not ask me routine technical
implementation questions: make reasonable decisions according to the plan and
repository architecture. Stop only for genuine external access/credential/product
blockers explicitly identified by the plan.

For every phase:
- inspect before editing;
- preserve security/data-integrity invariants;
- add required tests;
- run the phase validation commands;
- review the diff;
- update MVP_IMPLEMENTATION_STATUS.md with evidence;
- then proceed to the next phase.

Never weaken authentication, authorization, payment verification, pricing,
privacy, validation, idempotency or accounting rules merely to make tests pass.
```

