# PawTag — Second Comprehensive MVP Audit & Execution-Ready Implementation Plan

**Audit date:** 20 September 2026  
**Repository reviewed:** `PawTag-main.zip` supplied for this review  
**Primary context reviewed:** current source code, `docs/MVP_IMPLEMENTATION_STATUS.md`, `docs/PawTag_MVP_Master_Implementation_Plan.md`, current `/docs`, current `AGENTS.md`, current repository-local skills, CI/Docker configuration, tests, applications and shared packages.

> **Purpose of this document:** This is the single implementation plan an AI coding agent should execute, phase by phase, to bring PawTag from its current state to a defensible first-real-customer launch. It supersedes completion labels in `MVP_IMPLEMENTATION_STATUS.md` wherever the current code or unexecuted validation evidence contradicts those labels.

---

## 0. Operating Instructions for the Implementing AI

### 0.1 Source-of-truth order

Use this precedence when anything disagrees:

1. Actual runtime behaviour and security/data-integrity requirements.
2. Current source code and database schemas.
3. Current automated tests, once verified to test intended behaviour rather than stale behaviour.
4. This implementation plan.
5. `AGENTS.md` and applicable repository-local skills.
6. `docs/MVP_IMPLEMENTATION_STATUS.md`.
7. README and other documentation.

Documentation claiming a work packet is complete does **not** prove the implementation is correct or production-ready.

### 0.2 Execution discipline

For every work packet in this document:

1. Inspect the named code and all direct callers/callees before editing.
2. Establish the current behaviour with a focused test or reproducible trace.
3. Make the smallest coherent change that resolves the complete issue.
4. Add or update behaviour-focused regression tests.
5. Run the specified validation commands.
6. Review the diff for security, ownership, payment, privacy, concurrency and error-path regressions.
7. Update relevant documentation only after the code/test behaviour is proven.
8. Record the result in `docs/MVP_IMPLEMENTATION_STATUS.md` with evidence.
9. Stop at the phase gate if required evidence is not green.

Do **not** weaken authentication, authorization, ownership checks, payment validation, idempotency, privacy controls, data integrity or production safeguards merely to make tests pass.

### 0.3 Definition of “complete”

A task is complete only when:

- the implementation exists;
- the intended runtime path reaches it;
- the frontend/backend contracts agree;
- authorization and validation are server-enforced;
- expected success and failure states work;
- production configuration is safe;
- regression tests cover the defect or contract;
- required end-to-end or real-device validation has actually been executed where applicable.

A checklist document with unchecked boxes is **not** completed validation.

---

# 1. Audit Method and Current Verdict

## 1.1 What was reviewed

The review traced the major paths across:

- `apps/web`
- `apps/admin`
- `apps/finder`
- `apps/mobile`
- `packages/api`
- `packages/db`
- `packages/shared`
- `packages/ui`
- root tests and mobile Maestro flows
- `.github/workflows`
- `docker/`
- environment validation/examples
- implementation status and production-rehearsal documentation

The review specifically followed customer commerce paths from UI -> API -> service -> model/provider -> post-payment side effects, plus Finder, authentication, email/invoice, subscriptions/refunds, jobs, CI/deployment and mobile validation.

## 1.2 Runtime-validation limitation of this second audit

The supplied ZIP did not contain installed `node_modules`. The current review environment did not have `pnpm` available, and `corepack` could not download it because outbound package-registry access was unavailable. Therefore this second review could not independently rerun the full typecheck/build/test suite.

This does **not** mean the prior reported results are discarded. The current `MVP_IMPLEMENTATION_STATUS.md` records:

- typecheck PASS;
- unit PASS;
- regression PASS;
- smoke PASS;
- build PASS;
- integration only **45/50 files passing, 649/668 tests passing, 5 files failing**.

Those integration failures remain launch blockers until repaired and rerun in a clean environment.

## 1.3 Current overall verdict

PawTag has improved materially since the first audit. Several original blockers were genuinely addressed, including Finder CAPTCHA wiring, Finder public DTO use, Stripe raw-body ordering, stricter checkout ownership handling, a dedicated worker process, and a dedicated cart page.

However, the codebase is **not yet ready for a first real customer**. The main reason is no longer broad feature absence; it is that important “complete” labels in the implementation status are not supported by the current end-to-end behaviour.

The most important current blockers are:

1. **Shipping price authority is client-controllable.** A customer can submit shipping `cost` and the backend stores/uses it in authoritative cart totals.
2. **PawRewards redemption is financially disconnected from checkout.** Rewards are deducted before purchase but are not applied to the server-side payment amount.
3. **Payment environment semantics are unsafe/confused.** Stripe test keys trigger fake demo intents rather than actual Stripe Test API traffic, while production can still be exposed to DB-configured demo behaviour.
4. **Email can silently succeed without sending.** The implementation uses Resend, but production environment validation checks SMTP variables and does not require `RESEND_API_KEY`.
5. **Gold subscription payment failure can fall back to demo and create an active/paid entitlement.** This is a direct financial/entitlement integrity defect.
6. **Browser refresh-token hardening is not actually complete.** Cookies are set after responses in critical auth paths and browser clients still store refresh tokens in localStorage.
7. **Checkout recovery has a broken URL/status contract.** Frontend recovery uses `/api/checkout/pending` through an API client already based at `/api`, and the backend pending endpoint does not return converted records that the frontend expects.
8. **A legacy order creation route remains exposed.** `POST /api/customer/orders/place` creates a duplicate financial path outside the intended checkout flow and accepts client-provided order data.
9. **The checkout UX is not the intended premium 70/30 experience.** Cart review and delivery/details are centered single-column; payment is 50/50; business logic is still concentrated in a 1,266-line page.
10. **Deployment/validation completion is overstated.** No Playwright web E2E exists, mobile “real-device validation” is an unchecked checklist, backup restore evidence is not a completed rehearsal, CI still includes failing integration tests, and current Docker configuration has unresolved environment/workspace-build risks.

---

# 2. Corrections to `MVP_IMPLEMENTATION_STATUS.md`

Before further implementation, treat the following status entries as **Needs Revalidation / Not Complete**.

| Existing status claim | Current evidence | Correct status |
|---|---|---|
| 4.1 Browser refresh-token hardening complete | `auth.ts` sends JSON before attempting to set refresh cookie; web/admin still persist refresh token locally | **Not complete** |
| 4.4 Input validation consistency complete | many mutation routes still directly consume `req.body`; returns and other routes use manual/incomplete validation | **Not complete** |
| 5.x Premium Cart complete | dedicated page exists but visual hierarchy remains basic; client/server financial authority issues remain | **Partially complete** |
| 6.1 Checkout decomposition complete | `apps/web/src/pages/Checkout.tsx` remains ~1,266 lines | **Not complete** |
| 6.2 Checkout recovery complete | pending recovery URL/status contract is inconsistent | **Not complete** |
| 7 Web E2E | not started | **Not complete / launch blocker** |
| 8.4 Real-device validation complete | `docs/MOBILE-REAL-DEVICE-VALIDATION.md` contains unchecked validation items | **Not executed** |
| 11.1 Docker/workspace builds complete | web Docker image does not clearly build `@pawtag/shared` dist before app build; production env injection is incomplete | **Needs revalidation / likely broken** |
| 11.4 Backup restore rehearsal complete | document states restore proof requirement; no completed rehearsal evidence in supplied repo | **Not proven** |
| 16.1 dangerous `any` cleanup complete | substantial `any`/`as any` remains, including payment flow global coupling | **Partially complete** |
| 16.3 demo/mock production fallback removal complete | email and subscription services still contain unsafe demo/fallback semantics | **Not complete** |
| Total 66/65 work packets (102%) | arithmetic and completion-state contradiction | **Status document needs reset** |
| Next packet 11.1 while Phase 11 marked complete | status is internally stale | **Correct status sequencing** |

### Work Packet 0A — Reset implementation status to evidence-based states

**Files**
- `docs/MVP_IMPLEMENTATION_STATUS.md`
- optionally `docs/SECOND_AUDIT_FINDINGS.md` if a short historical record is desired

**Tasks**
- Replace “complete” with `Implemented`, `Validated`, `Needs Revalidation`, `Blocked`, or `Not Started` where useful.
- Remove percentage >100% and recompute actual packet counts.
- Record the five currently failing integration suites.
- Record that real-device, backup restore, staging rehearsal and security rehearsal require execution evidence, not document existence.
- Link this plan as the new execution authority.

**Acceptance criteria**
- Status file no longer claims completion where runtime evidence is absent.
- Every phase has a concrete evidence link/command/result before being marked validated.

---

# 3. Target Architecture Decisions

These decisions should be treated as explicit implementation policy unless current code proves an equivalent safer approach.

## 3.1 Commerce has one authoritative checkout path

Target:

`Cart -> Server Checkout Quote -> Payment Intent -> Provider/Webhook -> Idempotent Order Finalization -> Fulfilment/Invoice/Notifications`

Remove or disable alternate public order-creation paths that can bypass the authoritative quote/payment state.

## 3.2 Server owns every financial number

The client may submit choices, never authoritative values.

Client may submit:
- product/variant IDs;
- quantity;
- engraving/customization input;
- shipping method ID;
- promo code;
- reward points requested;
- address IDs/data;
- payment intent/session identifiers.

Server must calculate:
- item prices;
- customization charges;
- discount eligibility/value;
- reward value;
- shipping cost;
- tax/GST treatment;
- final payable total;
- refundable amount.

## 3.3 Explicit payment environments

Replace ambiguous “test mode” semantics with three explicit behaviours:

| Environment mode | Intended use | Provider behaviour | Allowed in production? |
|---|---|---|---|
| `fake` | local deterministic development/unit tests | no Stripe network call; deterministic fake provider | **No** |
| `stripe_test` | staging/integration/UAT | real Stripe Test API using `sk_test`/`rk_test`, test webhook secret, test publishable key | **No live production** |
| `stripe_live` | production | real Stripe Live API using live keys and live webhook secret | **Yes, required** |

Do not infer “fake” merely because the Stripe key starts with `sk_test_`.

## 3.4 Critical customer communications are persistent operations

Do not treat a logged fire-and-forget `.catch()` as delivery.

For order, invoice, payment, password/security and Finder recovery communications:
- persist intent/status;
- track `pending/sent/failed/retrying/dead` or equivalent;
- use provider message/event IDs;
- make sends idempotent;
- process retryable work in worker jobs where appropriate;
- expose failure to operations.

## 3.5 Web and mobile share contracts/tokens, not forced renderers

Continue current strategy:
- shared API types/contracts;
- shared validation/business rules where platform-neutral;
- shared design tokens;
- web-specific components in web/UI package;
- React Native components for native UI/camera/NFC/push/navigation.

Do not introduce a framework migration purely for theoretical UI sharing before MVP.

---

# 4. PHASE 1 — Restore a Green, Trustworthy Baseline

## Objective

Make test/build evidence reliable before changing more business logic.

## Files/modules

- `tests/integration/subscriptions-api.test.ts`
- `tests/integration/guardian-api.test.ts`
- `tests/integration/loyalty-api.test.ts`
- `tests/integration/upload-r2.test.ts`
- `tests/integration/finder-full.test.ts`
- `.github/workflows/ci.yml`
- root/package workspace configuration

## Tasks

### 1.1 Repair all five failing integration suites

Fix test setup rather than weakening production code.

- Replace CommonJS `require()` mocking patterns that point at invalid paths with the repository-standard Vitest module mocking/import approach.
- Make upload mocks intercept the actual storage module imported by upload routes.
- Update Finder full-flow test to the intended semantics: finder report must **not** automatically mark pet recovered; owner confirmation does.
- Ensure subscription/Guardian/loyalty tests use the actual mounted route/service modules.

### 1.2 Standardize toolchain versions

Current sources show version drift:
- previous baseline: Node 24 / pnpm 11;
- CI: Node 20 / pnpm 9;
- Docker: Node 22.

Select one supported production baseline. Recommended for MVP: an active LTS Node version and a pinned pnpm version using `packageManager` in root `package.json`.

Update:
- CI;
- Dockerfiles;
- developer docs;
- package engines;
- Corepack instructions.

### 1.3 Make CI fail on every required quality gate

Required pre-merge gates:
- install lockfile frozen;
- typecheck;
- unit;
- integration;
- regression;
- smoke;
- build;
- later Playwright critical E2E;
- production Docker build smoke.

Do not publish “green” coverage if integration/build failed.

## Acceptance criteria

- 100% of the current integration test files pass.
- No tests are skipped merely to reach green.
- CI and local clean-room commands use the same Node/pnpm major versions.
- `pnpm typecheck`, all test groups and `pnpm build` are green on a clean checkout.

## Validation

Run from a clean clone/worktree:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:regression
pnpm test:smoke
pnpm build
```

**Gate 1:** Do not proceed to customer-facing commerce changes unless this baseline is green or a newly discovered infrastructure blocker is documented with exact reproduction.

---

# 5. PHASE 2 — Payment Environment and Production Configuration Safety

## Objective

Make fake, Stripe Test and Stripe Live behaviour explicit and impossible to confuse.

## Primary files

- `packages/api/src/commerce/config.ts`
- `packages/api/src/commerce/providers/stripe/index.ts`
- `packages/api/src/config/validateEnv.ts`
- `packages/api/src/index.ts`
- `packages/api/src/worker.ts`
- `packages/db` Setting/config models
- `.env.example`
- `apps/web` Stripe initialization
- Dockerfiles / compose / deployment docs
- admin commerce/payment settings UI/routes

## Current defects

1. `commerce.payment.testMode` defaults to `true`.
2. Stripe provider treats test Stripe keys as fake/demo mode rather than calling Stripe Test API.
3. Production environment validation rejects test keys but does not prove the DB payment test-mode setting is false after DB connection.
4. Frontend fake payment compatibility is not explicit; Stripe Elements cannot safely be assumed to work with fabricated client secrets.
5. `VITE_STRIPE_PUBLISHABLE_KEY` is not reliably injected into production web builds.

## Tasks

### 2.1 Introduce explicit `PAYMENT_MODE`

Use an enum such as:

```text
fake | stripe_test | stripe_live
```

Rules:
- `NODE_ENV=production` requires `PAYMENT_MODE=stripe_live`.
- `stripe_live` requires live secret key, live publishable key at frontend build, live webhook secret.
- `stripe_test` requires test secret key, test publishable key, test webhook secret and makes **real Stripe API calls**.
- `fake` uses deterministic local provider and is blocked from production.

### 2.2 Remove or neutralize DB-admin ability to put production payments into fake mode

Options in preference order:
1. remove `commerce.payment.testMode` entirely;
2. retain only as deprecated/read-only migration state and ignore it once `PAYMENT_MODE` exists;
3. if retained temporarily, startup must hard-fail in production when it is true.

### 2.3 Create a proper fake provider path

If local fake checkout remains useful:
- fake payment UI must not mount Stripe Elements;
- use deterministic controls such as `success`, `decline`, `requires_action`, `timeout` selected only in local/test environment;
- never use `Math.random()` for payment outcomes;
- ensure fake identifiers are visually/logically distinct and impossible in production.

### 2.4 Add post-DB startup assertions

After settings load and before serving traffic:
- assert payment mode safety;
- assert required provider configuration;
- assert webhook secret presence;
- assert email provider readiness (Phase 8);
- assert production frontend URL/origins;
- assert storage provider if uploads are required;
- expose a sanitized configuration-readiness status in readiness endpoint, never secrets.

## Payment-mode verification matrix

| Scenario | Expected API behaviour | Expected frontend | Webhook behaviour | Launch result |
|---|---|---|---|---|
| local + `fake` | deterministic fake PI | local fake payment component | synthetic internal event only | Allowed local only |
| staging + `stripe_test` | real Stripe test PI | Stripe Elements with test publishable key | signed Stripe test webhook | Required staging |
| production + `stripe_live` | real live PI | Stripe Elements with live publishable key | signed live webhook | Required production |
| production + `fake` | startup failure | app unavailable/readiness false | n/a | Blocked |
| production + test secret key | startup failure | n/a | n/a | Blocked |
| production missing webhook secret | startup failure | n/a | n/a | Blocked |
| staging fake client secret passed to Elements | impossible by architecture | fake UI instead | n/a | Required |

## Tests

- unit tests for mode resolver;
- startup configuration tests for every matrix row;
- integration test using Stripe test mock/contract layer;
- webhook signed-payload integration test;
- Playwright test for fake local path and Stripe test staging path where environment permits.

## Rollback

Preserve existing config key for one release as read-only migration compatibility if needed, but do not permit it to override explicit environment mode.

**Gate 2:** Production process must refuse unsafe payment/email configuration before continuing.

---

# 6. PHASE 3 — Authoritative Checkout Quote and Shipping/Pricing Integrity

## Objective

Eliminate all client-controlled financial values and create one authoritative server quote used by Cart and Checkout.

## Primary files

- `packages/api/src/routes/cart.ts`
- `packages/api/src/routes/shipping.ts`
- `packages/api/src/routes/checkout.ts`
- `packages/api/src/commerce/services/cart.service.ts`
- `packages/api/src/commerce/services/shipping.service.ts`
- `packages/api/src/commerce/services/pricing.service.ts`
- promo/rewards services/models
- `packages/shared/src/api/*`
- `apps/web/src/context/CartContext.tsx`
- `apps/web/src/pages/Cart.tsx`
- `apps/web/src/pages/Checkout.tsx`

## Current critical defect: client-controlled shipping price

`POST /api/shipping/select` accepts `methodId`, `methodName`, and **`cost`** from the browser. `shipping.service.ts` stores the submitted cost in the cart, and cart total calculation uses it. Similar behaviour exists in cart shipping selection. This violates server-authoritative pricing.

## Tasks

### 3.1 Change shipping selection contract

Client sends only:
- shipping method ID;
- required address context/reference.

Server:
1. loads authenticated cart;
2. recalculates cart subtotal from current products/variants/customizations;
3. loads eligible shipping methods;
4. calculates rate from server data/provider;
5. applies membership/free-shipping rules server-side;
6. stores method ID + authoritative cost snapshot + quote/version metadata.

Reject:
- unknown method;
- method not eligible for destination/cart;
- negative cost;
- stale quote when material prices changed.

### 3.2 Do not trust client `cartTotal` for shipping eligibility

`GET /api/shipping/rates` must derive cart total from the authenticated cart, not query input.

For guest cart shipping, use a signed/validated server quote generated from submitted item IDs/quantities rather than a raw client subtotal.

### 3.3 Introduce `CheckoutQuote`

A server-generated quote should include at minimum:

```ts
{
  quoteId,
  userId,
  cartVersion,
  expiresAt,
  items: [{ productId, variantId, quantity, unitPrice, customizationPrice, lineTotal, inventoryVersion }],
  promo: { code, discount } | null,
  rewards: { pointsReserved, value } | null,
  shipping: { methodId, name, amount },
  tax: { gstIncluded, amount },
  subtotal,
  discount,
  total,
  currency: 'NZD'
}
```

Persistence can reuse/extend `PendingOrder` if that keeps architecture simpler; do not add a new model solely for naming.

### 3.4 Make the quote the only source for PaymentIntent amount

PaymentIntent amount must equal the quote total at creation time.

Before creating/confirming payment:
- verify quote ownership;
- verify not expired;
- verify cart/version/inventory material state;
- if changed, return structured `QUOTE_CHANGED` response with refreshed quote for user confirmation.

### 3.5 Normalize GST semantics

For NZ consumer presentation, decide one rule and apply everywhere. Recommended:
- prices shown inclusive of GST where applicable;
- order summary says `Includes GST $X.XX`;
- invoice stores tax basis explicitly;
- do not add tax twice between product price and checkout.

## Tests

Add manipulation tests that submit:
- shipping cost `0`;
- shipping cost `-100`;
- altered method name;
- client cartTotal below/above Gold/free-shipping threshold;
- stale product price;
- stale variant price;
- changed inventory.

Expected result: client numeric values are ignored or rejected; payment total remains server-derived.

## Acceptance criteria

- No public route accepts authoritative shipping cost/total/discount/tax values.
- Cart, checkout and PaymentIntent display/use the same quote values.
- Price/inventory changes have a recoverable UI state rather than silent mutation.

---

# 7. PHASE 4 — Promo and PawRewards Financial Correctness

## Objective

Make discounts and loyalty redemption transactional with purchase completion rather than destructive before purchase.

## Current defects

### Promo usage

`cart.service.applyPromoCode()` increments usage count when a promo is merely applied to a cart. Removing/abandoning a cart can consume usage limits without a purchase.

### PawRewards

Checkout calls Guardian rewards redemption before payment. The service decrements the customer balance immediately, while server checkout/payment amount does not incorporate that redemption. This can charge full price **and** remove reward balance.

## Tasks

### 4.1 Promo usage state

At cart/quote time:
- validate promo eligibility;
- calculate discount;
- do **not** increment permanent usage count.

At successful order finalization:
- atomically record promo redemption against order/user;
- increment global usage within concurrency-safe operation;
- enforce per-user/global limits using unique indexes or transactional predicates.

If reservation is required for scarce one-time codes, introduce short-lived explicit reservations with expiry rather than usageCount mutation.

### 4.2 Rewards reservation rather than redemption

At quote time:
- validate requested points <= available balance;
- calculate monetary value server-side;
- create reservation or record requested points on pending checkout;
- do not permanently debit yet.

At successful order finalization:
- debit points exactly once;
- write ledger entry with order ID;
- include reward value in quote/payment total;
- mark reservation committed.

On expiration/cancel/failure:
- release reservation automatically.

### 4.3 Idempotency

Unique correlation should prevent double redemption on:
- double click;
- webhook + browser confirmation race;
- retry after timeout;
- worker recovery.

Use order ID / pending checkout ID as ledger idempotency key.

## Acceptance criteria

- User cannot lose points without a completed order except an explicit temporary reservation that automatically releases.
- Stripe amount equals displayed total after rewards.
- Promo usage reflects successful redemptions, not cart interactions.
- Applying/removing a promo repeatedly does not exhaust it.

---

# 8. PHASE 5 — Collapse to One Order-Creation/Payment-Finalization Path

## Objective

Remove duplicate financial paths and centralize order finalization.

## Primary files

- `packages/api/src/routes/checkout.ts`
- `packages/api/src/routes/customer.ts`
- `packages/api/src/commerce/services/checkout.service.ts`
- `packages/api/src/services/order-creation.service.ts`
- related shared endpoints/frontend calls

## Current defect

`POST /api/customer/orders/place` remains exposed and calls `createPawTagOrder()` using client-supplied order details/totals/payment identifiers. This duplicates the newer checkout path and is a high-risk bypass surface.

## Tasks

### 5.1 Inventory all callers of `/customer/orders/place`

- frontend web;
- admin;
- mobile;
- tests;
- scripts/docs.

If no required caller remains, remove route and shared endpoint.

If temporary compatibility is required, make the endpoint call the authoritative checkout finalization by pending/quote/payment ID only. It must never accept authoritative item totals.

### 5.2 Merge duplicate order creation business rules

Choose one service boundary, preferably commerce checkout/order-finalization service.

The canonical finalizer must own:
- order creation;
- payment transaction linkage;
- inventory commit/release;
- promo commit;
- rewards commit;
- entitlement/tag/subscription creation where appropriate;
- invoice creation;
- cart conversion/clear;
- domain events for email/notifications;
- final pending-checkout state.

Other modules call it rather than reimplement it.

### 5.3 Define durable recovery states

Use explicit states such as:

```text
pending
payment_processing
paid
finalizing
converted
repair_required
cancelled
expired
```

Persist step status/error details needed by worker recovery without exposing sensitive internals to customers.

### 5.4 Fix frontend/backend recovery contract

Current frontend recovery has two concrete issues:
- calling `/api/checkout/pending` through an Axios client already based at `/api` risks `/api/api/...`;
- frontend searches for `converted`, while backend pending listing does not expose converted entries.

Provide one shared endpoint and DTO, e.g.:

- `GET /api/checkout/status/:paymentIntentId`

Response:

```ts
{ status, orderId?, orderNumber?, recoverable, customerMessage }
```

Use shared `API.checkout.status(...)` helper.

### 5.5 Browser-close recovery

If Stripe confirms payment but customer closes browser:
- webhook must be sufficient to progress/finalize or enqueue repair;
- reopening checkout/order history must show correct order;
- duplicate browser confirm must return existing result idempotently.

## Tests

Failure injection between every major finalization step:
- after payment recognized;
- after order created;
- after inventory committed;
- after promo/rewards commit;
- after entitlement created;
- after invoice created;
- before notification dispatch.

Expected: retry reaches one consistent order, not duplicate charge/order/entitlement.

---

# 9. PHASE 6 — Subscription/Gold Entitlement Integrity

## Objective

Prevent paid membership from being granted when Stripe payment/subscription creation fails or is incomplete.

## Primary files

- `packages/api/src/services/subscription.service.ts`
- customer/admin subscription routes
- subscription/invoice/payment models
- Stripe provider/webhooks
- subscription jobs/reconciliation

## Current critical defects

1. `createGoldSubscription()` can catch Stripe failure and fall back to demo/local success.
2. Local subscription/invoice can be marked active/paid without confirmed payment.
3. Stripe `default_incomplete` subscription is not equivalent to an active paid local entitlement.
4. demo charge logic includes random success/failure behaviour.
5. local cancellation can be recorded while Stripe cancellation fails, risking continued billing.

## Tasks

### 6.1 Remove production fallback-to-demo

Provider errors in `stripe_test` or `stripe_live` must remain errors/retryable states. Never grant entitlement because Stripe was unavailable.

### 6.2 Map Stripe states explicitly

Define local mappings for:
- incomplete;
- incomplete_expired;
- trialing (if used);
- active;
- past_due;
- unpaid;
- canceled.

Only grant Gold benefits when policy-approved provider state proves entitlement.

### 6.3 Invoice/payment status

Never set invoice paid unless corresponding provider payment succeeded or an authorized zero-dollar transaction exists.

### 6.4 Cancellation saga

When user/admin cancels:
- request Stripe cancellation;
- record provider result;
- update local state only according to policy (`cancel_at_period_end` vs immediate);
- if external failure occurs, mark `cancellation_pending/repair_required` and alert operations;
- reconciliation repairs drift.

### 6.5 Deterministic fake behaviour

Remove `Math.random()` from any billing simulation. Tests should select explicit scenario fixtures.

## Acceptance criteria

- Stripe outage cannot create free active Gold.
- Stripe cancellation failure cannot be silently represented as fully cancelled locally.
- entitlement reconciliation can identify provider/local divergence.

---

# 10. PHASE 7 — Refunds, Returns, Cancellation and Fulfilment State Integrity

## Objective

Make post-purchase financial and operational state transitions safe, validated and auditable.

## Primary files

- `packages/api/src/routes/customer-returns.ts`
- admin returns/refunds/fulfilments/shipments routes
- refund/cancellation services
- refund reconciliation job
- Order/Return/Refund/Fulfilment models

## Current return defects

- return item quantity does not clearly reject zero/negative integers;
- refund calculation can therefore be poisoned by invalid quantity;
- matching by productId is ambiguous if an order contains the same product in multiple variants/customizations;
- already-returned quantity and return-window policy require explicit enforcement;
- statuses eligible for “return” overlap with states that may instead require cancellation.

## Tasks

### 7.1 Strong return schemas

Require:
- exact order line-item ID;
- integer quantity >=1;
- quantity <= remaining returnable quantity;
- reason enum/text limits;
- optional evidence/upload contract where policy requires.

### 7.2 Return eligibility service

Centralize:
- delivered/fulfilment status policy;
- return window;
- product exclusions;
- customization/engraving rules;
- shipping/non-refundable components;
- previously returned/refunded quantities.

### 7.3 Refund amount server calculation

Derive refundable amount from original settled order line snapshots and allocated discounts/rewards, not current product price or client amount.

### 7.4 Idempotent refund provider operations

- provider idempotency key tied to refund record;
- never issue duplicate refund on retry;
- persist provider refund ID/status;
- reconciliation identifies partial/failed/refunded mismatches.

### 7.5 Order state machine

Document/enforce allowed transitions, for example:

```text
pending_payment -> paid -> packing -> shipped -> delivered
                 \-> cancelled/refund_pending/refunded
```

Disallow arbitrary skips unless privileged operation has explicit reason/audit.

### 7.6 Fulfilment/shipment integration

Verify:
- shipment creation occurs once;
- tracking polling is idempotent;
- delivered state cannot regress without explicit correction;
- customer shipping emails trigger from persisted transition event, not repeated polling result.

---

# 11. PHASE 8 — Email, Invoice and Notification Reliability

## Objective

Ensure every critical communication is actually sent, routed correctly, auditable, retriable and environment-safe.

## Primary files

- `packages/api/src/services/email.service.ts`
- `packages/api/src/routes/resend-webhooks.ts`
- `packages/api/src/routes/invoice-access.ts`
- email template/CMS routes and models
- checkout/order/subscription/Finder/auth services
- notification/push routes/services
- worker/retry infrastructure
- `.env.example`, `validateEnv.ts`

## Current critical email configuration defect

The implementation uses **Resend**. If `RESEND_API_KEY` is missing, `sendMail()` enters demo mode, logs, and returns success. Production validation instead checks SMTP variables. Thus production can appear to send emails while sending nothing.

## Tasks

### 8.1 One supported transactional email provider contract

For MVP, make Resend the explicit provider unless a second provider is genuinely implemented.

Environment:

```text
EMAIL_PROVIDER=resend
RESEND_API_KEY=...
EMAIL_FROM="PawTag <no-reply@...>"
EMAIL_REPLY_TO=...
```

Production must fail startup/readiness if required provider configuration is absent.

If SMTP is retained in documentation, implement it fully behind the provider interface; otherwise remove SMTP claims.

### 8.2 Never report unsent production email as success

In production:
- missing provider -> startup failure;
- provider transient failure -> persisted failed/retry state;
- provider permanent failure -> dead-letter/operations visibility.

Local fake email may log or use a mailbox sink but must clearly report `simulated` rather than `sent`.

### 8.3 Create persistent communication dispatch records

Reuse existing EmailAudit if structurally adequate; otherwise extend it rather than adding unnecessary model proliferation.

Track:
- type/template;
- recipient;
- related entity/order/pet/user;
- idempotency key;
- provider message ID;
- status;
- attempt count;
- last error category;
- timestamps.

### 8.4 Resend webhook handling

Verify signature/authentication mechanism supported by provider.
Map delivery events to dispatch record:
- delivered;
- bounced;
- complained;
- failed.

Do not let webhook replay duplicate business events.

## Complete email trigger verification matrix

The implementing AI must create integration tests for every row and update this table with actual test names.

| Trigger | Email function/template | Recipient source | Idempotency key | Failure/retry expectation |
|---|---|---|---|---|
| Account verification | `sendVerificationEmail` | account email | verification token/event | retryable; token remains valid |
| Welcome | `sendWelcomeEmail` | verified account email | user + welcome | once per qualifying account |
| Password reset | `sendPasswordResetEmail` | normalized account email | reset token | retryable; no account enumeration |
| Password changed | `sendPasswordChangedEmail` | account email | password-change event | security alert; retryable |
| Login notification | `sendLoginNotification` | account email | login event | non-blocking but persisted |
| Login/MFA OTP | `sendLoginOtpEmail` | account email | OTP challenge | time-sensitive; failure surfaced |
| Finder pet found/report | `sendPetFoundEmail` | owner email | finder report ID/channel | persist status; escalation aware |
| Order confirmation | `sendOrderConfirmation` | order snapshot/customer email | order ID + confirmation | exactly once logically |
| Shipping notification | `sendShippingNotification` | order customer email | shipment state transition | once per transition |
| Invoice OTP | `sendInvoiceOtpEmail` | invoice owner email | invoice access challenge | time-sensitive |
| Invoice email | `sendInvoiceEmail` | authorized invoice recipient | invoice ID + recipient + send reason | audited; secure link valid |
| Guardian welcome | `sendGuardianWelcomeEmail` | member email | subscription ID | after entitlement active |
| Tier upgrade | `sendTierUpgradeEmail` | member email | tier transition | once per transition |
| Birthday | `sendGuardianBirthdayEmail` | member email | user/pet + year | worker idempotent |
| Monthly summary | `sendMonthlySummaryEmail` | member email | user + month | worker idempotent |
| Rewards reminder | `sendPawRewardsReminderEmail` | member email | reminder period | worker idempotent |
| Guardian anniversary | `sendGuardianAnniversaryEmail` | member email | subscription + year | worker idempotent |
| Renewal reminder | `sendGuardianRenewalReminderEmail` | member email | subscription + renewal date/window | worker idempotent |
| Account status admin/security changes | `sendAccountStatusEmail` | affected account | audit event | persisted and auditable |

### 8.5 Finder delivery wording

Current Finder notify endpoint can report “Owner has been notified successfully” even when email/push delivery promises are caught/ignored.

Change semantics:
- API success means **finder report recorded and notification workflow accepted**;
- response text should not claim provider delivery unless delivery is known;
- persist channel attempts;
- owner in-app notification should be durable;
- escalation should account for failed external channels.

---

# 12. PHASE 9 — Invoice Security and Delivery

## Objective

Make every emailed invoice link valid, scoped and non-exfiltrating.

## Primary files

- `packages/api/src/routes/invoice-access.ts`
- checkout/order-creation/subscription services
- `Invoice`, `InvoiceAccessToken` and audit models
- invoice email templates

## Current defects

1. Admin email-invoice flow creates a token string/URL but does not clearly persist a matching `InvoiceAccessToken`, so emailed link can be invalid.
2. Admin endpoint can accept arbitrary email override under a permission semantically unrelated to invoice delivery (`subscription.read`), creating exfiltration risk.
3. Legacy order-creation service builds a customer invoice URL using an already-verified/admin-style access token, inconsistent with OTP customer access.
4. Subscription invoice delivery is inconsistent with order invoice delivery.

## Tasks

### 9.1 One invoice access service

Centralize:
- token generation/hash;
- persisted access-token record;
- expiration;
- owner/recipient binding;
- OTP requirement policy;
- one-time/multi-use policy;
- audit.

### 9.2 Separate customer and admin flows

Customer:
- authenticated account invoice view may use account authorization directly;
- emailed public link uses secure token + policy-approved verification;
- cannot access another user's invoice.

Admin:
- authenticated permission controls invoice view;
- emailing to canonical customer address is normal audited action;
- sending to a different address requires elevated permission + explicit confirmation/reason + audit.

Do not use `subscription.read` as generic invoice-send permission.

### 9.3 Invoice correctness

Invoice must snapshot:
- legal seller details;
- order/customer billing details;
- line descriptions/customizations;
- discounts/rewards allocation;
- shipping;
- GST/tax basis;
- currency;
- payment/refund status;
- invoice number/date.

### 9.4 Invoice delivery tests

Test:
- generated link resolves;
- expired link fails;
- token is hashed/persisted;
- OTP delivery/verification;
- wrong user/recipient cannot access;
- resend is audited/idempotent;
- refunded order invoice/credit-note policy is consistent.

## Invoice verification matrix

| Source | Invoice created when | Recipient | Access mechanism | Required proof |
|---|---|---|---|---|
| Standard order | successful finalization | purchasing customer | authenticated account + secure email link | one invoice/order, correct totals |
| Gold/subscription | provider-confirmed billing event | subscription owner | account + secure link | no paid invoice before payment |
| Admin resend | explicit authorized admin action | canonical customer by default | newly persisted secure token | audit actor/reason/recipient |
| Refund/adjustment | policy event | customer | secure access | original/refund relationship clear |

---

# 13. PHASE 10 — Authentication, Session Security and Authorization

## Objective

Finish browser refresh-token hardening, consistent validation and object-level authorization.

## Primary files

- `packages/api/src/routes/auth.ts`
- auth middleware/services/token models
- `apps/web/src/context/AuthContext.tsx`
- `apps/web/src/lib/api.ts`
- admin auth equivalents
- `packages/shared/src/api/client-factory.ts`
- mobile secure storage client

## Current refresh-cookie defect

Critical auth paths currently attempt to set the HttpOnly refresh cookie **after** `res.json(...)`. Headers are already sent at that point, so cookie hardening may silently fail. The response also still returns refresh tokens and browser clients store them in localStorage.

## Tasks

### 10.1 Set cookies before response

Login/refresh:
1. generate/rotate refresh token;
2. set cookie header;
3. send response.

Logout/revocation similarly clears cookie before response.

### 10.2 Browser vs native client contract

Browser:
- refresh token only in HttpOnly Secure cookie;
- do not include refresh token in browser response body;
- API uses `withCredentials` where deployment topology requires;
- access token short-lived and preferably memory-managed; if localStorage remains temporarily for access token, document XSS residual risk.

Mobile/native:
- refresh token may be returned through an explicitly identified native client flow and stored in SecureStore;
- do not infer client platform from easily spoofed headers without server policy consideration.

### 10.3 CSRF/SameSite analysis

If refresh cookie is used:
- document same-site deployment topology;
- choose `SameSite` deliberately;
- protect state-changing cookie-auth endpoints as required;
- confirm CORS credentials + origin allowlist.

### 10.4 Systematic request validation

Create/extend Zod schemas for every public/financial/admin mutation. Prioritize:
- checkout/cart/shipping/promos/rewards;
- returns/refunds;
- Finder notify/location;
- auth/profile;
- uploads;
- subscription actions;
- admin destructive operations.

Validation belongs before service invocation.

### 10.5 BOLA/IDOR test suite

For each user-owned resource domain:
- pets;
- tags;
- orders;
- invoices;
- subscriptions;
- returns;
- saved addresses/profile;
- notifications;

Test User A cannot read/update/delete User B resource by replacing IDs.

### 10.6 Admin permission semantics

Review high-risk capabilities separately:
- refund;
- payment/provider settings;
- invoice resend to alternate recipient;
- role changes;
- user status;
- order cancellation;
- subscription changes;
- site availability;
- data export.

No “admin means bypass every business safety check” rule.

---

# 14. PHASE 11 — Finder Recovery Reliability, Privacy and Delivery

## Objective

Finish the improvements already made and validate the complete real-world lost-pet loop.

## Positive current changes to preserve

- production CAPTCHA is now connected;
- public `toFinderPetView` DTO exists;
- finder report no longer auto-marks pet recovered;
- duplicate notification logic exists;
- privacy retention work exists.

## Remaining tasks

### 11.1 Fix owner phone field mapping

Finder populate/select uses top-level `phone`, while User schema uses top-level `phoneNumber` (with another nested phone field elsewhere). Make DTO/population use the intended field and test privacy visibility rules.

### 11.2 Validate coordinates numerically

Replace truthiness checks like `if (latitude && longitude)` with numeric/range validation:
- latitude `[-90, 90]`;
- longitude `[-180, 180]`;
- accuracy reasonable non-negative value.

### 11.3 Make consent server-authoritative

Client may choose consent option; server should stamp:
- server timestamp;
- current consent text/version configured server-side;
- request IP/device context.

Do not accept client-provided consent version/time as authoritative audit evidence.

### 11.4 Move nonessential analytics off critical response latency

Pet information response should not wait for optional geo-IP/analytics writes if they can be durably enqueued. Security/audit events that must be guaranteed should use a reliable persistence pattern.

### 11.5 Notification delivery state

Persist finder-report delivery attempts across:
- in-app notification;
- email;
- push;
- SMS if SMS is an MVP requirement.

If SMS is not an MVP requirement, remove/clarify any copy implying it exists.

### 11.6 Retention proof

Run privacy-retention job against seeded old records and prove:
- expired Finder data is deleted/anonymized per policy;
- active incident data is preserved appropriately;
- audit requirements remain intact.

### 11.7 Poor-network E2E

Browser test with throttling/offline transitions:
- scan page loads;
- pet data remains understandable;
- denied location permission works;
- submission retries safely;
- refresh does not duplicate escalation;
- owner confirmation is separate from finder report.

---

# 15. PHASE 12 — Premium Cart Redesign

## Objective

Deliver the intended premium, high-confidence commerce cart rather than a functional but flat CRUD list.

## Current state

`apps/web/src/pages/Cart.tsx` now has a dedicated page and a sticky summary, which is a good structural improvement. However:

- desktop uses `1fr + 360px`, not a true adaptive 70/30 composition;
- all products sit inside one large flat white box with dividers;
- guest messaging incorrectly calls the experience “Guest checkout” while checkout itself requires authentication;
- hierarchy, merchandising, customization treatment and premium trust cues remain limited;
- summary values must be tied to the new authoritative server quote before the UI can be trusted.

## Target desktop layout

Use a 12-column grid:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Cart header / progress confidence                                   │
├──────────────────────────────────────────────┬──────────────────────┤
│ 8 cols (~68-70%)                             │ 4 cols (~30-32%)     │
│                                              │                      │
│ Product card                                 │ Sticky order summary │
│ Product card                                 │                      │
│ Product card                                 │ Subtotal             │
│                                              │ Discount             │
│ Promo / benefits / delivery support          │ Rewards              │
│                                              │ Shipping estimate    │
│                                              │ GST included         │
│                                              │ -------------------- │
│                                              │ Total                │
│                                              │ [Secure checkout]    │
│                                              │ payment/trust cues   │
└──────────────────────────────────────────────┴──────────────────────┘
```

Recommended implementation: `lg:grid-cols-12`, left `lg:col-span-8`, right `lg:col-span-4`, with max width sufficient for comfortable commerce content (e.g. 1200–1280px based on design tokens).

## Tasks

### 12.1 Redesign each product as a premium card, not one flat list

Each cart item card must visibly group:
- image with stable aspect ratio;
- product name;
- variant/color/size;
- engraving/customization value and surcharge;
- unit price;
- quantity control;
- line total;
- inventory/price-change state;
- remove action;
- optional delivery/subscription context.

Use individual cards or clearly separated item surfaces with enough breathing room. Do not make every row a dense table.

### 12.2 Product-card states

Support:
- available;
- low stock;
- unavailable/out of stock;
- price changed;
- customization invalid/outdated;
- quantity exceeds available;
- server refreshing.

A customer must understand exactly what prevents checkout and how to resolve it.

### 12.3 Order summary hierarchy

Summary order:
1. items/subtotal;
2. product/promo discount;
3. reward credit;
4. shipping / “calculated after address”;
5. GST statement;
6. prominent final/estimated total;
7. primary checkout CTA;
8. small trust/payment/returns cues.

Do not show a false exact total before shipping is known. Use “Estimated total” if applicable.

### 12.4 Promo and Gold/Guardian treatment

- Promo is progressive disclosure, not dominant content.
- Gold benefits should communicate real savings relevant to this cart.
- Do not create multiple competing upsell boxes.
- If user is guest, say: **“Your cart is saved on this device. Sign in or create an account to continue to checkout and save your cart.”** Do not claim guest checkout if unsupported.

### 12.5 Mini-cart distinction

`CartDrawer` remains a fast mini-cart:
- recently added item;
- short item list/count;
- subtotal/estimated total;
- View cart;
- Checkout.

Do not duplicate the full cart page architecture inside the drawer.

### 12.6 Responsive behaviour

Desktop >= design-system large breakpoint:
- 70/30 columns;
- summary sticky with offset below site header.

Tablet:
- use 60–65/35–40 only when content remains readable; otherwise stack.

Mobile:
- single column;
- order summary below items or collapsible summary near top;
- fixed/sticky bottom bar showing total + Checkout;
- ensure sticky bar does not obscure content/safe-area;
- quantity/remove touch targets >= recommended accessible size.

### 12.7 Motion

Use motion only for:
- item added/removed;
- quantity/total transition;
- validation banner appearance;
- drawer enter/exit.

Respect reduced-motion preference. Do not animate every card on load.

### 12.8 Accessibility

- semantic headings/list structure;
- accessible names on quantity/remove controls;
- disabled states communicated beyond color;
- focus moved to relevant error banner after checkout-blocking update;
- `aria-live` for price/quantity feedback where useful;
- no focus trap on ordinary page; proper dialog semantics only for drawer/modal;
- keyboard and screen-reader verification.

## Cart acceptance criteria

- desktop screenshot visually reads as a premium two-column commerce page;
- no single giant “Cart Items” slab is the only left-hand hierarchy;
- server quote controls money;
- guest wording matches actual account requirement;
- every failure state is recoverable;
- mobile remains intentionally single-column and usable at 320–430px widths;
- Playwright visual/interaction tests cover desktop/tablet/mobile.

---

# 16. PHASE 13 — Checkout UX Redesign: Persistent Premium 70/30 Shell

## Objective

Replace the current inconsistent Cart/Details/Payment layouts with one coherent checkout experience that preserves context and confidence.

## Current defects

`apps/web/src/pages/Checkout.tsx` remains ~1,266 lines.

Current visual structure:
- “Cart Review” step: centered `max-w-4xl`, single column;
- details step: centered/smaller single column;
- payment step: `lg:grid-cols-2` 50/50;
- therefore the intended premium 70/30 architecture is not consistently implemented.

Checkout also duplicates cart operations, increasing state/business-rule divergence.

## Product decision

**Remove Cart as a checkout step.** `/cart` already owns cart editing.

Recommended checkout flow:

```text
/cart
  ↓
Checkout: Delivery & Contact
  ↓
Checkout: Review & Payment
  ↓
Confirmation
```

If business requirements genuinely require three pre-confirmation steps, keep the same 70/30 shell for all of them.

## Target desktop shell

```text
┌──────────────────────────────────────────────────────────────────────┐
│ PawTag Checkout / compact progress                                   │
├───────────────────────────────────────────────┬──────────────────────┤
│ 8 cols (~70%)                                 │ 4 cols (~30%)        │
│                                               │                      │
│ CURRENT STEP                                  │ ORDER SUMMARY        │
│                                               │ (sticky)             │
│ Contact                                       │                      │
│ Delivery address                              │ item thumbnails      │
│ Shipping options                              │ subtotal             │
│ / Payment Element                             │ discounts/rewards    │
│                                               │ shipping             │
│ contextual errors                             │ GST                  │
│                                               │ TOTAL                │
│ [Continue / Pay securely]                     │ confidence cues      │
└───────────────────────────────────────────────┴──────────────────────┘
```

The right summary should remain stable across Delivery and Payment so the page does not visually reinvent itself at every step.

## Tasks

### 13.1 Create `CheckoutShell`

Responsibilities:
- layout only;
- progress/header;
- main content slot;
- sticky summary slot;
- mobile summary/sticky CTA pattern;
- focus target on step changes/errors.

### 13.2 Create one `CheckoutOrderSummary`

Use the authoritative server quote. Avoid separate ad-hoc summary math in each step.

Should display:
- compact item previews;
- customization;
- subtotal;
- discounts;
- reserved rewards;
- shipping;
- GST;
- total;
- `Edit cart` link back to `/cart`.

Do not allow quantity/promo/engraving editing inside checkout unless there is a proven UX reason. Returning to cart reduces duplicated state.

### 13.3 Decompose Checkout by business responsibility

Suggested structure:

```text
pages/Checkout.tsx                 orchestration only
components/checkout/CheckoutShell.tsx
components/checkout/CheckoutProgress.tsx
components/checkout/CheckoutOrderSummary.tsx
components/checkout/ContactSection.tsx
components/checkout/DeliveryAddressSection.tsx
components/checkout/ShippingMethodSection.tsx
components/checkout/VerificationRequirement.tsx
components/checkout/PaymentSection.tsx
components/checkout/PaymentRecoveryState.tsx
components/checkout/Confirmation.tsx
hooks/useCheckoutQuote.ts
hooks/useCheckoutRecovery.ts
```

Do not extract tiny wrappers merely to reduce line count. Move cohesive state/business responsibilities.

### 13.4 Remove `window.__paymentProgress`

`StripePaymentForm` currently communicates processing progress through a mutable global window property. Replace with typed callbacks/state:

```ts
onStageChange(stage)
onSucceeded(paymentIntentId)
onFailed(error)
```

### 13.5 Delivery step UX

Order:
1. contact/account identity summary;
2. required verification blocker only if policy truly demands it;
3. address;
4. shipping methods after address is valid;
5. continue.

Do not fetch rates on every uncontrolled keystroke. Trigger after validated address selection/change with debounce or explicit action.

If both email and mobile verification are required to pay, make that business rule explicit in product documentation and test it. Otherwise reduce unnecessary conversion friction according to business decision.

### 13.6 Payment step UX

Left 70%:
- concise order/payment context;
- Stripe PaymentElement;
- clear processing stage;
- failure/retry guidance;
- terms/policy acknowledgement if required;
- Pay button.

Right 30%:
- same sticky order summary.

Do **not** use 50/50 where payment form competes equally with summary.

### 13.7 Mobile checkout

- single column;
- compact/collapsible order summary above form;
- sticky bottom CTA only when it does not conflict with Stripe Element actions/keyboard;
- safe-area-aware;
- no horizontal overflow;
- input keyboard types correct;
- scroll/focus to first invalid field.

### 13.8 Required states

Implement and test:
- initial quote loading skeleton;
- empty cart redirect/recovery;
- account-required state;
- verification-required state;
- invalid address;
- shipping rates loading;
- no shipping rates;
- shipping provider error + retry;
- quote price/inventory changed;
- promo expired;
- reward balance changed;
- payment requires action/SCA;
- card declined;
- payment processing timeout;
- payment succeeded but order finalization pending;
- webhook completed order after browser timeout;
- recovered existing order;
- duplicate submit;
- offline/network interruption;
- success confirmation.

### 13.9 Currency consistency

Use shared formatter for `NZD`, not manually concatenated `$` in some surfaces and formatter elsewhere.

## Checkout acceptance criteria

- every pre-confirmation desktop checkout step uses the same ~70/30 shell;
- order summary is sticky and stable;
- no cart-editing duplicate step;
- `Checkout.tsx` is reduced to orchestration and is meaningfully maintainable;
- no window-global payment state;
- quote/payment/recovery contracts are typed and shared;
- mobile UX is purpose-designed single-column;
- all critical states have screenshots/E2E coverage.

---

# 17. PHASE 14 — API Contract Consistency and Route-Surface Hardening

## Objective

Ensure frontend/server route contracts are centralized, validated and free of duplicate/legacy paths.

## Tasks

### 14.1 Generate an API inventory test

Create a small test/script that inventories mounted Express route modules/prefixes and compares expected critical endpoints/shared definitions. This becomes documentation generated from source rather than a stale hand-written list.

### 14.2 Remove raw route strings in critical frontend paths

Prioritize:
- checkout/payment/recovery;
- cart/shipping/promo/rewards;
- invoices;
- notifications;
- auth refresh/logout;
- subscriptions.

Use `packages/shared` endpoint builders.

### 14.3 Standard response/error contract

For public/customer commerce routes, standardize:

```ts
{ success: true, data, meta? }
{ success: false, error: { code, message, fieldErrors?, retryable?, correlationId? } }
```

Do not break all routes at once if migration cost is excessive; start with critical workflows and provide adapters.

### 14.4 Validation middleware coverage

Add schemas to every mutation route in the verification matrix below.

## Complete API route-module verification matrix

Every listed module must be exercised by at least route-contract/auth tests appropriate to its risk. “N/A” must be justified rather than omitted.

| Route module | Mounted area / domain | Required verification |
|---|---|---|
| `auth.ts` | `/api/auth` | login/register/MFA/refresh/logout/reset, cookie/body contracts, rate limit |
| `customer.ts` | `/api/customer` | ownership, pet/tag/order/profile operations; remove legacy order placement |
| `customer-guardian.ts` | `/api/customer/guardian` | loyalty balance/earn/redeem authority |
| `customer-subscriptions.ts` | `/api/customer/subscriptions` | entitlement/payment/cancel ownership |
| `customer-returns.ts` | `/api/customer/returns` | schema, eligibility, line-item ownership |
| `cart.ts` | `/api/cart` | authoritative pricing, quantity, promo, shipping, guest/auth behaviour |
| `checkout.ts` | `/api/checkout` | quote/payment/confirm/recovery/idempotency |
| `checkout-otp.ts` | customer checkout OTP | challenge ownership/rate/expiry |
| `shipping.ts` | `/api/shipping` | server-derived rates/cost selection |
| `products.ts` | `/api/products` | public filtering/pagination/safe projection |
| `promo-public.ts` | `/api/public/promo` | disclosure/eligibility without private data |
| `commerce-public.ts` | `/api/public/commerce` | public config safe projection |
| `points-estimate.ts` | `/api/public/points` | estimate cannot mutate/override authority |
| `finder.ts` | `/api/finder` | CAPTCHA, privacy DTO, notify idempotency, lost/safe semantics |
| `invoice-access.ts` | `/api/...invoice...` | owner/admin/token/OTP isolation |
| `push-tokens.ts` | `/api` | token ownership, duplicate token, logout cleanup |
| `referrals.ts` | `/api` | referral abuse/ownership/reward idempotency |
| `upload.ts` | `/api/upload` | auth, MIME/content/size, storage key isolation |
| `address-autocomplete.ts` | `/api/address` | provider failure/rate limiting/no secret leakage |
| `support.ts` | public/admin support | spam/rate/auth/admin access |
| `communications.ts` | `/api/admin/communications` | permission, recipient selection, audit |
| `resend-webhooks.ts` | `/api/webhooks/resend` | signature/replay/status update |
| `stripe-webhooks.ts` | `/api/webhooks/stripe` | raw body/signature/replay/event state |
| `health.ts` | health/readiness | no secret leakage; readiness dependency accuracy |
| `system-status.ts` | public system status | minimal safe disclosure |
| `site-availability.ts` | admin availability | permission/audit/destructive confirmation |
| `audit.ts` | admin audit | permission/filter/pagination/sensitive redaction |
| `system-logs.ts` | admin logs | permission/redaction/pagination |
| `rbac.ts` | admin RBAC | privilege escalation tests, last-superadmin protections if applicable |
| `admin.ts` | admin core | high-risk action inventory, ownership irrelevant but permission/audit required |
| `admin-commerce.ts` | admin commerce | config/product/order mutations permission/audit |
| `admin-payments.ts` | admin payments | no arbitrary financial mutation without provider/state validation |
| `admin-refunds.ts` | admin refunds | idempotency, limits, reason/audit |
| `admin-returns.ts` | admin returns | transition rules/refund coupling |
| `admin-fulfilments.ts` | fulfilment | transition/idempotency |
| `admin-shipments.ts` | shipment | provider state/tracking idempotency |
| `admin-shipping.ts` | shipping methods | rate config validation |
| `admin-promocodes.ts` | promo admin | limits/date/rules validation |
| `admin-subscriptions.ts` | subscription admin | provider/local integrity |
| `admin-stripe-report.ts` | Stripe reporting | permission/read-only/provider errors |
| `admin-webhooks.ts` | webhook ops | retry authorization/idempotency |
| `admin-analytics.ts` | analytics | aggregation performance/data privacy |
| `admin-guardian.ts` | loyalty admin | financial-equivalent points mutation audit |
| `admin-brands.ts` | catalog | validation/slug uniqueness |
| `admin-categories.ts` | catalog | validation/slug uniqueness |
| `admin-collections.ts` | catalog | validation/slug uniqueness |
| `cms-admin.ts` and CMS admin modules | CMS | auth, content sanitization, draft/publish permissions |
| `cms-public.ts`, `cms-public-v2.ts`, `cms-settings-public.ts` | public CMS | safe projection/cache/fallback |

The remaining CMS-specific route files must be included in the generated route inventory and tested according to the same public/admin category.

---

# 18. PHASE 15 — Background Jobs, Worker Reliability and Idempotency

## Objective

Make the dedicated worker safe under restart, overlap and eventual multiple-instance operation.

## Current positive change

A dedicated `worker.ts` now owns scheduled/background work rather than blindly starting all jobs in every API process. Several externally significant jobs have claim semantics.

## Remaining tasks

### 15.1 Job-by-job ownership table

For every scheduled service/job, record:
- schedule;
- data query;
- atomic claim/lease strategy;
- idempotency key;
- retry policy;
- max attempts;
- backoff;
- dead/repair state;
- alert;
- overlap behaviour.

Cover at minimum:
- webhook retry;
- refund reconciliation;
- payment reconciliation;
- orphan payment detection;
- order auto-cancel;
- shipment polling;
- escalation;
- subscription reminders/renewals;
- low stock;
- PawRewards;
- pet milestones;
- privacy retention.

### 15.2 Ensure single-worker assumptions are explicit

If some low-risk jobs remain without distributed claims, production orchestration must enforce exactly one worker replica. Readiness/deployment docs must state this.

Before allowing horizontal worker scale, add claims to all jobs with externally observable side effects.

### 15.3 Graceful shutdown

Do not merely wait a fixed 2 seconds. Track in-flight job promises/claims and:
- stop accepting new work;
- wait to safe timeout;
- release/allow lease expiry;
- exit with meaningful code/log.

### 15.4 Worker credentials/config

Worker must receive the same relevant provider secrets/config as API where it performs:
- Stripe;
- email;
- push;
- shipping;
- storage.

---

# 19. PHASE 16 — Production Docker, Environment and Deployment Proof

## Objective

Make production images reproducible and prove they start using only documented configuration.

## Current concerns

### Web image workspace build

`packages/shared` exports built `dist` artifacts, while the supplied repo does not include them. `docker/Dockerfile.web` must explicitly build workspace dependencies in the container before building web/admin/finder. Do not rely on pre-existing `dist` from developer machines.

### Compose production env

Current compose production-like API/worker config does not visibly supply all variables required by `validateEnv.ts`, including origins/frontend and Stripe keys/secrets. It also does not clearly inject `VITE_STRIPE_PUBLISHABLE_KEY` into frontend build.

## Tasks

### 16.1 Deterministic workspace Docker build

Recommended pattern:
- copy root workspace manifests + relevant package manifests;
- install frozen lockfile;
- copy source;
- run `pnpm --filter @pawtag/shared build` and any required package builds;
- build target app;
- serve immutable frontend artifact.

Build web/admin/finder independently in CI from clean Docker context.

### 16.2 Frontend build-time environment

Inject:
- API base/public URL strategy;
- `VITE_STRIPE_PUBLISHABLE_KEY` corresponding to payment mode;
- Sentry/public monitoring values if used.

Never inject secret keys into frontend image.

### 16.3 API/worker environment schema

Document and validate exact required variables by environment. Include:
- DB;
- JWT/auth secrets;
- origins/frontend URLs;
- payment mode + Stripe secrets;
- email provider/Resend;
- storage/R2;
- push/Expo/provider config;
- shipping provider if used;
- monitoring DSN/exporter;
- encryption/secrets needed by models/services.

### 16.4 Docker smoke in CI

CI must:
- build every production image;
- start API+DB with safe fake/test config;
- wait for readiness;
- curl health/readiness;
- run a minimal browser/API smoke;
- tear down.

### 16.5 Migration/index startup policy

Mongoose automatic index creation in production should be deliberate. For expensive/large indexes, use controlled deployment scripts rather than surprising startup operations.

## Acceptance criteria

A fresh machine with Docker and documented env can build/start PawTag without hidden developer artifacts.

---

# 20. PHASE 17 — Web End-to-End Quality Gate (Playwright)

## Objective

Cover the cross-layer defects unit/integration tests cannot catch.

## Required setup

Add Playwright with:
- dedicated deterministic test database;
- fake payment mode for local deterministic suite;
- optional Stripe Test environment suite for staging;
- email sink/test provider inspection;
- desktop + mobile viewport projects;
- accessibility smoke via axe or equivalent where appropriate.

## Mandatory journeys

### Auth
1. register;
2. verify email;
3. verify phone if required;
4. login;
5. refresh session;
6. logout;
7. password reset.

### Pet/tag/recovery
1. create pet;
2. activate/redeem tag;
3. mark lost;
4. anonymous Finder scan;
5. location denied path;
6. location allowed path;
7. notify owner;
8. duplicate notify does not duplicate escalation;
9. owner sees report;
10. owner marks recovered.

### Cart
1. guest add item;
2. sign-in cart transition/merge policy;
3. quantity;
4. customization;
5. promo apply/remove;
6. price changed state;
7. inventory unavailable state;
8. responsive 70/30 desktop;
9. mobile sticky checkout.

### Checkout
1. authenticated cart -> delivery;
2. address validation;
3. shipping rates;
4. shipping method selection server-priced;
5. promo/rewards quote;
6. payment success;
7. payment decline;
8. payment requires action fixture;
9. browser/network interruption after payment;
10. recovered order;
11. duplicate submit creates one order.

### Post-order
1. order appears in history;
2. invoice accessible;
3. confirmation email recorded/sent in test sink;
4. shipment state/email;
5. allowed cancellation;
6. return/refund happy path;
7. duplicate refund prevented.

### Security
- User A cannot access User B order/pet/invoice/subscription/return.
- customer cannot call admin endpoints.

## Visual UX assertions

Capture baseline screenshots for:
- Cart desktop 1440px;
- Cart tablet;
- Cart 390px mobile;
- Checkout delivery desktop;
- Checkout payment desktop;
- Checkout mobile;
- Finder mobile.

Do not make pixel-perfect screenshots the only UX proof; assert functional layout properties too (sticky summary visible, no overflow, CTA reachable).

**Gate 17:** Critical Playwright suite must run in CI before staging rehearsal.

---

# 21. PHASE 18 — Mobile Production Validation

## Objective

Turn the existing mobile checklist into executed evidence if mobile is included in first-customer launch.

## Current status correction

`docs/MOBILE-REAL-DEVICE-VALIDATION.md` contains unchecked items. Therefore “8.4 Real-device validation complete” is not supported by evidence.

## Tasks

### 18.1 Execute, do not merely document

On physical iOS and Android devices, record build/version/device/date/results for:
- auth + refresh persistence;
- QR permission/scan/invalid/duplicate;
- NFC support/read/invalid/cancel/NDEF URI;
- push foreground/background/tap/deep link;
- lost mode;
- pets/health/media;
- order/subscription screens;
- safe areas/keyboard/back gestures;
- offline/recovery;
- app lifecycle.

### 18.2 Production build proof

Build signed staging/release candidate via actual Expo/EAS strategy and install that build, not only Expo Go/development client.

### 18.3 Release decision

If these tests cannot be executed before first customer, explicitly defer native mobile from launch and make responsive web the supported customer experience. Do not block the core PawTag launch for unfinished native app unless native capability is essential to the first-customer proposition.

---

# 22. PHASE 19 — Admin Operational Safety

## Objective

Ensure staff can operate PawTag without accidental financial/security damage.

## Tasks

### 19.1 High-risk action matrix

Verify permission + confirmation + reason + audit for:
- refunds;
- returns approval;
- order cancellation;
- subscription cancellation/override;
- payment configuration;
- promo changes;
- shipping-price config;
- invoice resend to alternate email;
- user status/role changes;
- site availability;
- webhook retries;
- destructive CMS publish/delete.

### 19.2 Confirmation UX

Financial/destructive dialogs show:
- entity/customer/order identifier;
- impact amount/state;
- irreversible/reversible nature;
- explicit confirmation text;
- reason when operationally useful.

### 19.3 Audit completeness

Audit record includes:
- actor;
- target;
- previous/next relevant state;
- reason;
- provider transaction IDs where relevant;
- correlation ID.

### 19.4 Desktop usability

Focus on:
- filters/search;
- pagination;
- status clarity;
- efficient tables/drawers;
- keyboard accessibility;
- not perfect phone responsiveness.

---

# 23. PHASE 20 — Accessibility, Responsive UX and Design-System Consistency

## Objective

Apply consistent accessible interaction rules across customer web, Finder, Cart/Checkout and critical admin flows.

## Tasks

### 20.1 Component primitives

Ensure shared primitives cover:
- Button variants/states;
- form field + error + help text;
- alert/banner;
- dialog/drawer with focus management;
- toast/live feedback;
- skeleton/loading;
- EmptyState;
- StatusBadge;
- money/date formatter.

### 20.2 Cart/checkout a11y

- keyboard quantity control;
- icon button labels;
- focus error summary;
- semantic fieldsets for shipping/payment choices;
- accessible progress indicator;
- dynamic totals announced without excessive screen-reader noise;
- reduced motion;
- contrast.

### 20.3 Finder a11y

- labels linked to inputs;
- clear location permission explanation;
- status/error live regions;
- no CAPTCHA inaccessible mode;
- large tap targets.

### 20.4 Automated + manual

Automated axe checks are required but insufficient. Manually verify keyboard-only and at least one screen-reader pass on Finder and checkout.

---

# 24. PHASE 21 — Performance and Reliability Hardening

## Objective

Meet practical MVP latency/reliability budgets on critical journeys.

## Tasks

### 21.1 Finder budget

Target on realistic NZ mobile connection:
- initial useful pet content fast enough to assist a finder;
- nonessential analytics not blocking render;
- images optimized/sized;
- degraded network retry.

Instrument server timings around:
- tag lookup;
- pet projection;
- scan persistence;
- geo lookup;
- notification enqueue.

### 21.2 Commerce budget

Measure:
- cart fetch/reprice;
- shipping rate fetch;
- checkout quote;
- PaymentIntent creation;
- order finalization.

Avoid duplicate refetch storms from React effects.

### 21.3 DB query/index review

Use explain/query profiling for high-volume paths rather than adding speculative indexes. Review:
- tagId finder lookup;
- carts by user/status;
- pending checkout by payment intent/user;
- order history pagination;
- notification/user queries;
- worker claim queries;
- webhook event claims;
- audit/admin logs.

### 21.4 Bundle/routes

Confirm lazy loading for heavy admin/editor/commerce routes where meaningful and keep Finder bundle minimal.

---

# 25. PHASE 22 — Observability, Reconciliation and Incident Readiness

## Objective

Make failures actionable for a small launch team.

## Tasks

### 22.1 Correlation IDs

A customer checkout should be traceable across:
- web request;
- quote;
- PaymentIntent;
- webhook;
- order;
- invoice;
- email;
- worker repair.

Use non-sensitive correlation IDs in logs/records.

### 22.2 Alerts

At minimum alert on:
- paid payment with no converted order;
- repeated finalization repair failure;
- refund/provider mismatch;
- webhook dead/retry exhausted;
- transactional email failure spike;
- worker not running/heartbeat stale;
- API readiness failure;
- payment provider mode/config mismatch;
- abnormal Finder notification failure.

### 22.3 Operations dashboard/runbook

For each alert document:
- meaning;
- customer impact;
- immediate inspection query/tool;
- safe repair procedure;
- escalation threshold.

Do not create a huge observability platform; use existing logging/Sentry/OTel plus minimal operational views.

---

# 26. PHASE 23 — Backup/Restore, Privacy and Data-Lifecycle Proof

## Objective

Prove data can be restored and privacy-retention rules execute as intended.

## Current status correction

A backup document is not a restore rehearsal. The supplied backup document itself says an un-restored backup is not proven.

## Tasks

### 23.1 Execute restore rehearsal

In isolated environment:
1. create representative users/pets/tags/orders/subscriptions/invoices;
2. take backup using production-equivalent process;
3. destroy/replace test DB;
4. restore;
5. verify referential/business integrity;
6. record RPO/RTO timestamps and evidence.

### 23.2 Privacy lifecycle

Verify retention/deletion for:
- Finder scans/contact/GPS/IP-derived data;
- LocationEvents;
- expired auth/verification/access tokens;
- logs;
- support records;
- soft-deleted users/pets;
- uploaded media.

### 23.3 Account deletion/export

If MVP promises these capabilities, test complete cross-model behaviour and third-party cleanup. If not ready, do not falsely advertise automated completeness; define operational support procedure.

---

# 27. PHASE 24 — Complete Integration Verification Matrices

This phase converts the major subsystem expectations into executable evidence.

## 27.1 Payment/webhook matrix

| Event/path | Test mode expectation | Production expectation | Required assertion |
|---|---|---|---|
| Create checkout quote | deterministic authoritative server quote | same | no client-controlled money |
| Create PaymentIntent | real Stripe Test PI in `stripe_test` | real Stripe Live PI | amount/currency/metadata match quote |
| Browser confirm | test PaymentElement | live PaymentElement | idempotent; no duplicate order |
| `payment_intent.succeeded` | signed test webhook | signed live webhook | event persisted/claimed once; finalize/repair |
| duplicate webhook | no duplicate effect | no duplicate effect | unique event/idempotency |
| webhook signature invalid | reject | reject | 4xx, no mutation |
| browser closes after payment | webhook finalizes/repairs | same | order appears eventually |
| card decline | no order/entitlement | same | clear customer state; reservation cleanup |
| SCA/requires action | supported | supported | resume correctly |
| payment succeeded/finalization fails | `repair_required` + worker retry | same + alert | no double charge/order |
| refund | Stripe Test refund | live refund | idempotent record/provider match |
| production fake mode | n/a | startup blocked | hard failure |

## 27.2 Email route/provider matrix

Verify all functions listed in Phase 8 plus:

| API/provider path | Auth/security | Expected result |
|---|---|---|
| Resend outbound call | server secret only | provider message ID persisted |
| Resend delivery webhook | verified/replay-safe | delivery status updated once |
| Admin email-template CRUD | permissioned | sanitized/validated template |
| Admin test-send | explicit test recipient | marked test, audited |
| Missing provider in production | n/a | startup/readiness failure, never fake success |

## 27.3 Invoice route matrix

| Action | Actor | Expected authorization/state |
|---|---|---|
| view own invoice authenticated | owner | allowed |
| view other user's invoice | customer | denied |
| generate customer access link | owner/system | token persisted/expiring |
| request OTP | valid token recipient | rate-limited |
| wrong OTP | recipient | denied/attempt policy |
| expired token | anyone | denied |
| admin view | authorized permission | allowed + audit where appropriate |
| admin resend canonical address | authorized admin | allowed + audit |
| admin resend alternate address | elevated permission + reason | explicit confirmation + audit |

## 27.4 Notification matrix

| Trigger | In-app | Email | Push | SMS (if enabled) | Idempotency/failure behaviour |
|---|---|---|---|---|---|
| Finder report | required durable | required/configured | configured | explicit scope decision | report accepted independent of transient provider; failures retried/escalated |
| Order confirmation | optional/in-app record | required | optional | no | once per order |
| Shipment | in-app | required/configured | optional | no | once per shipment transition |
| Refund | in-app | required | optional | no | once per refund state |
| Subscription active/cancel/renewal | in-app | required as applicable | optional | no | provider-state driven |
| Security event | optional | required for high-risk events | optional | policy | no sensitive detail leakage |

## 27.5 API route verification completion rule

For every route module listed in Phase 14, produce a machine-readable test inventory containing:
- method/path;
- auth middleware;
- permission middleware;
- validation schema;
- owner scoping rule;
- happy-path test;
- unauthorized/forbidden test where applicable;
- invalid-input test for mutations;
- idempotency test where externally significant.

Do not hand-maintain endpoint counts in README; generate the inventory from source/tests.

---

# 28. PHASE 25 — Security Abuse Rehearsal

## Objective

Execute focused pre-launch abuse testing against staging.

## Required cases

### Authorization
- object ID substitution across all customer-owned resources;
- privilege escalation through role/permission endpoints;
- customer calling admin APIs;
- invoice-token guessing/reuse;
- upload object-key access.

### Commerce manipulation
- altered unit price;
- altered shipping cost;
- negative/huge quantity;
- promo replay;
- reward replay;
- paymentIntent belonging to another user;
- duplicate confirm;
- duplicate/reforged webhook;
- refund repeated concurrently.

### Finder
- tag enumeration/rate limiting;
- repeated notify abuse;
- CAPTCHA bypass attempt;
- oversized/HTML/script input;
- location abuse;
- safe-pet privacy masking.

### Auth
- brute-force/rate limit;
- refresh-token reuse after rotation;
- logout/session revocation;
- reset-token reuse;
- MFA replay;
- CSRF/cookie-origin assumptions.

### Upload
- MIME spoofing;
- oversized file;
- unsupported content;
- path/key manipulation;
- unauthorized replacement/deletion.

## Deliverable

`docs/SECURITY_ABUSE_REHEARSAL_RESULTS.md` with actual executed results, environment, commit SHA and unresolved findings. No unchecked template may be marked complete.

---

# 29. PHASE 26 — Staging Dress Rehearsal

## Objective

Prove production-equivalent operation before first customer.

## Environment

Use:
- production Docker/image build path;
- production-like reverse proxy/TLS;
- isolated staging DB/storage;
- `PAYMENT_MODE=stripe_test` using actual Stripe Test API;
- Resend/test-domain or approved staging recipient routing;
- worker process;
- monitoring/alerts;
- realistic origins/cookies.

## Required dress-rehearsal journeys

1. Register -> verify -> login.
2. Add pet -> activate tag.
3. Mark lost -> Finder scan on real phone -> notify -> owner receives durable notification -> owner recovers pet.
4. Add customized PawTag to cart.
5. Apply promo.
6. Reserve rewards if eligible.
7. Delivery address -> actual server shipping rate.
8. Stripe Test checkout including one success, one decline, one SCA case.
9. Close browser after successful payment before confirmation and confirm webhook/recovery produces one order.
10. Verify order history, invoice link, confirmation email.
11. Fulfil/ship -> tracking/customer communication.
12. Cancel allowed order.
13. Create return -> approve -> refund Stripe Test -> reconcile.
14. Subscribe/cancel Gold using actual Stripe Test subscription path.
15. Restart API/worker mid-recovery and prove idempotent repair.
16. Verify monitoring alerts on deliberately injected failed email/webhook/finalization.

## Evidence

Record:
- commit SHA;
- environment config names (no secrets);
- timestamps;
- screenshots/log/correlation IDs;
- provider object IDs (test only);
- pass/fail.

**Gate 26:** Any critical failed journey blocks launch.

---

# 30. PHASE 27 — Real-Person UX Validation

## Objective

Validate that non-developers understand PawTag, especially Cart/Checkout and Finder.

## Participants

At least several people who did not build the app. Include:
- one primarily mobile user;
- one person unfamiliar with PawTag acting as finder;
- one purchase flow participant.

## Tasks

Ask them to perform without coaching:
- understand product/customization;
- add to cart;
- change quantity/remove;
- understand promo/Gold/rewards;
- predict final cost;
- checkout;
- interpret payment failure/retry;
- find invoice/order;
- scan a lost-pet tag and contact owner.

Observe rather than explain.

## Cart/checkout UX acceptance

Users should be able to answer:
- What am I buying?
- What personalization is applied?
- Why is the total this amount?
- What will shipping cost / when will I know?
- Is GST included?
- What discount/reward did I receive?
- What happens when I press Pay?
- Did payment/order succeed?

Fix high-severity confusion before launch.

---

# 31. PHASE 28 — Documentation and Status Reconciliation

## Objective

Make documentation describe proven reality after implementation.

## Tasks

Update:
- README current state;
- `MVP_IMPLEMENTATION_STATUS.md`;
- environment/deployment docs;
- payment-mode docs;
- support/operations runbooks;
- mobile release status;
- backup rehearsal results;
- security rehearsal results.

Remove stale claims/counts and any “production-ready” wording not supported by executed gates.

Do not put secrets, exploit payloads or private operational credentials in public docs.

---

# 32. PHASE 29 — Final End-to-End Verification Gate

This phase is mandatory and must be executed after all implementation phases. Do not mark complete from code review alone.

## 32.1 Clean build gate

From clean checkout:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:regression
pnpm test:smoke
pnpm build
pnpm <playwright-critical-suite>
```

Build all Docker images and run container smoke.

Expected: zero unexplained failures.

## 32.2 Commerce final verification

Verify:
- cart values server-authoritative;
- shipping cannot be manipulated;
- promo usage only on successful purchase;
- rewards reserve/commit/release correctly;
- fake/test/live payment modes separated;
- webhook raw signature and replay safe;
- one payment -> one order;
- recovery after browser/process failure;
- invoice totals match order/payment;
- confirmation email delivered/recorded;
- refund/cancel/return state accurate;
- Gold only active after valid provider state.

## 32.3 Cart/Checkout visual verification

Desktop:
- Cart ~70/30 with premium item cards and sticky summary.
- Checkout Delivery ~70/30.
- Checkout Payment ~70/30.
- consistent max width/grid/spacing/summary.

Tablet:
- no cramped forms/summary.

Mobile:
- intentional single-column;
- sticky CTA safe;
- no obscured Stripe fields;
- no horizontal overflow.

## 32.4 Finder verification

- valid lost pet;
- safe pet;
- invalid/deactivated tag;
- CAPTCHA production semantics;
- location denied;
- location shared;
- duplicate notify;
- notification provider failure;
- owner recovery confirmation;
- privacy projection/phone mapping;
- poor network.

## 32.5 Auth/security verification

- browser HttpOnly refresh works;
- no browser refresh token in localStorage/body;
- native SecureStore works if mobile in scope;
- logout/password reset/change invalidation;
- BOLA matrix;
- admin permission matrix;
- rate limits/proxy IP;
- upload validation.

## 32.6 Operational verification

- worker heartbeat;
- one controlled worker or fully claimed jobs;
- alert injection;
- backup restore proof;
- rollback procedure executed on staging;
- production env startup validation;
- secrets not exposed to client/logs.

---

# 33. First-Real-Customer Go/No-Go Checklist

**All items below are required unless explicitly marked out-of-scope and hidden from the customer.**

## Stop-ship engineering

- [ ] All unit/integration/regression/smoke tests green.
- [ ] Critical Playwright E2E green in CI.
- [ ] Production Docker images build from clean context.
- [ ] Production startup fails on unsafe payment/email config.
- [ ] Stripe Test dress rehearsal complete.
- [ ] Stripe Live configuration verified without making uncontrolled live charges.
- [ ] Shipping price cannot be client manipulated.
- [ ] Promo/reward financial correctness proven.
- [ ] Legacy alternate order-creation path removed/locked.
- [ ] Subscription cannot grant entitlement after failed/incomplete provider payment.
- [ ] Refund/cancel/return paths idempotent and reconciled.
- [ ] Email provider genuinely sends and failures are visible/retried.
- [ ] Invoice emailed links are valid and authorized.
- [ ] Browser refresh-token HttpOnly flow proven.
- [ ] Finder report/recovery loop proven on production-like environment.
- [ ] Worker jobs cannot duplicate external financial actions.

## UX

- [ ] Cart matches premium ~70/30 desktop target.
- [ ] Checkout every pre-confirmation step uses persistent ~70/30 desktop shell.
- [ ] Payment step is not 50/50.
- [ ] Checkout no longer duplicates full cart-editing step.
- [ ] Mobile Cart/Checkout is purpose-designed one-column.
- [ ] Loading/error/empty/success states verified.
- [ ] Keyboard/a11y checks completed.
- [ ] Real-person UX test completed and major confusion fixed.

## Operations

- [ ] Monitoring alerts tested.
- [ ] Backup restored successfully.
- [ ] Rollback rehearsed.
- [ ] Support process for first customer defined.
- [ ] Admin high-risk actions audited/confirmed.
- [ ] Privacy retention job executed and verified.

## Mobile, only if included in launch

- [ ] Signed physical-device build tested on iOS.
- [ ] Signed physical-device build tested on Android.
- [ ] QR, NFC and push validated on real devices.
- [ ] Offline/app lifecycle/deep links validated.

If not complete, explicitly defer native mobile and do not market it as launch-ready.

---

# 34. Recommended Dependency-Aware Execution Order

The implementing AI should follow this exact order unless a discovered blocker requires a documented adjustment:

1. **Phase 1 — Green baseline**
2. **Phase 2 — Payment environment safety**
3. **Phase 3 — Authoritative quote/shipping/pricing**
4. **Phase 4 — Promo/PawRewards correctness**
5. **Phase 5 — Single order finalization path/recovery**
6. **Phase 6 — Subscription integrity**
7. **Phase 7 — Refund/return/cancel/fulfilment**
8. **Phase 8 — Email/notification reliability**
9. **Phase 9 — Invoice security/delivery**
10. **Phase 10 — Auth/session/authorization**
11. **Phase 11 — Finder final hardening**
12. **Phase 12 — Premium Cart redesign**
13. **Phase 13 — Premium Checkout redesign**
14. **Phase 14 — API contract hardening**
15. **Phase 15 — Worker hardening**
16. **Phase 16 — Docker/deployment proof**
17. **Phase 17 — Playwright gate**
18. **Phase 18 — Mobile proof or explicit deferral**
19. **Phase 19 — Admin operational safety**
20. **Phase 20 — Accessibility/UX consistency**
21. **Phase 21 — Performance**
22. **Phase 22 — Observability/incident readiness**
23. **Phase 23 — Backup/privacy proof**
24. **Phase 24 — Integration matrices complete**
25. **Phase 25 — Security abuse rehearsal**
26. **Phase 26 — Staging dress rehearsal**
27. **Phase 27 — Real-person UX test**
28. **Phase 28 — Documentation reconciliation**
29. **Phase 29 — Final E2E gate**
30. **First real customer launch**

Cart/Checkout visual implementation intentionally occurs **after** financial authority is repaired so the premium UI is built on a stable server quote rather than duplicated client math.

---

# 35. Autonomous Decision Rules for the Implementing AI

To minimize unnecessary questions to the founder:

## Make these decisions autonomously

- choose incremental refactoring over broad rewrites;
- use existing libraries/patterns when adequate;
- centralize one business rule rather than maintaining duplicates;
- add schemas/types/tests needed by the work packet;
- remove dead legacy routes after proving no caller remains;
- use explicit state machines for financial operations;
- use existing worker/DB infrastructure before introducing a new queue;
- use existing design tokens before inventing styles;
- choose accessible, conventional UX over decorative complexity;
- fix adjacent defects only when they are required for the current acceptance criteria.

## Genuine blockers that justify stopping/asking

Only stop for information unavailable from code/config and impossible to decide safely, such as:
- real Stripe/Resend/R2/Expo credentials or account access;
- exact legal seller/tax/invoice wording that requires business/legal confirmation;
- a business-policy choice with real financial consequences not inferable from product intent (e.g. exact return window if not documented anywhere);
- production domain/DNS/TLS/account ownership;
- a deliberate decision whether native mobile is included in first customer launch.

When blocked by external access, complete all code/test preparation possible, document the exact manual step, expected result and evidence required, then continue to the next non-dependent work only if the phase gate allows it.

---

# 36. Final Technical-Lead Position

PawTag should **not** be rewritten. The repository has a viable architecture and significant real implementation. The second review shows that the next work must focus on closing the remaining gap between “a feature exists” and “the complete production workflow is correct under manipulation, provider failure, retry and real customer use.”

The highest-priority change is not visual: it is restoring **server authority over every financial value and every entitlement**. Once that foundation is correct, the Cart and Checkout should be rebuilt around the authoritative checkout quote into the premium experience originally intended:

- dedicated premium Cart page;
- adaptive desktop 70/30 composition;
- stable sticky financial summary;
- intentional mobile one-column experience;
- checkout that preserves the same 70/30 shell from delivery through payment;
- no duplicate cart-review step;
- strong state/error/recovery UX;
- one financial truth from server quote to payment to invoice.

The first real customer should only be admitted after the production-equivalent staging rehearsal, critical Playwright journeys, payment/email/invoice verification, restore rehearsal and security abuse rehearsal have been **executed**, not merely documented.
