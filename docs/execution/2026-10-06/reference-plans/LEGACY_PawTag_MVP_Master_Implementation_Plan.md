# PawTag MVP Master Implementation Plan

**Purpose:** This is the execution plan for taking the current PawTag repository from "feature-rich pre-MVP" to "safe enough for the first real customers".

**Audience:** AI coding assistants (OpenCode / coding models), plus the founder using those tools.

**Primary rule:** The source code is the source of truth. Do not assume a feature works because a README, comment, route name, test name, or UI screen says it exists.

**Product goal:** Launch a reliable PawTag experience where a customer can buy/activate a tag, attach it to a pet, mark the pet lost, a stranger can scan the tag and safely notify the owner, the owner can recover the pet, and PawTag can accept and reconcile real payments without exposing customers or the business to unreasonable risk.

---

# 1. How to Use This Plan With an AI Coding Assistant

Do **not** paste a prompt such as "make PawTag production ready" and allow the agent to change the entire repository at once.

Use this document as the master plan, but execute **one numbered work packet at a time**.

The recommended operating model is:

1. Give the coding assistant this entire file as context.
2. Tell it which exact work packet to execute, for example: `Execute Work Packet 1.2 only.`
3. Require it to inspect the relevant source before modifying anything.
4. Require it to add or improve tests for the behavior it changes.
5. Require it to run the targeted tests, typecheck, and build where relevant.
6. Review the assistant's summary and git diff.
7. Commit that work packet separately.
8. Only then move to the next work packet.

This avoids a common AI-development failure mode: an agent changes five interconnected systems, one change masks another, tests become difficult to interpret, and the code looks cleaner while becoming less reliable.

## Suggested copy-paste command for every work packet

```text
You are working on the PawTag repository as a senior production engineer.

Read PawTag_MVP_Master_Implementation_Plan.md first.
Execute ONLY Work Packet <NUMBER>.

Rules:
- Source code is the source of truth.
- Inspect all files named in the work packet before editing.
- Also trace direct callers/callees, models, types, middleware and tests relevant to the change.
- Do not refactor unrelated code.
- Do not introduce a new framework or dependency unless the work packet explicitly allows it or the current stack cannot safely solve the problem.
- Prefer the smallest reliable production solution over architectural perfection.
- Preserve existing user-facing behavior unless the work packet intentionally changes it.
- Add or update tests that would have caught the original defect.
- Do not make tests pass by weakening assertions.
- Do not use `as any` to hide a type-design problem.
- Do not leave fake/demo fallbacks active in production paths.
- Do not rely on frontend validation for security or financial correctness.
- Do not mark the work complete until the acceptance criteria pass.

Before coding, report:
1. What the current code actually does.
2. The root cause of the issue.
3. The minimal implementation approach.
4. Files you expect to change.
5. Tests you will add/update.

Then implement it.

After coding, report:
1. Files changed.
2. Behavior changed.
3. Tests added/updated.
4. Commands run and whether they passed.
5. Any remaining risk or follow-up.
6. Whether every acceptance criterion is satisfied.

Stop after this work packet. Do not begin the next one.
```

---

# 2. Non-Negotiable Engineering Rules

These rules apply to every phase.

## 2.1 Safety before elegance

If there is a choice between a more elegant architecture and a smaller change that is easier to prove safe for MVP, choose the smaller safe change.

## 2.2 Never trust the browser for authority

The API must independently enforce:

- authentication;
- ownership;
- RBAC/permissions;
- prices;
- discounts;
- inventory;
- subscription eligibility;
- refund eligibility;
- order status transitions;
- public/private pet information;
- destructive admin actions.

Frontend checks improve UX only. They are not security controls.

## 2.3 Financial operations must be idempotent

Any operation that can charge, refund, create an order, decrement stock, create a subscription, or issue a tag must be safe if the request or webhook is delivered twice.

## 2.4 External calls and database transactions are different things

Stripe, email, SMS, R2, push, shipping providers and other external systems cannot participate in a MongoDB transaction.

Design important workflows as:

1. persist an authoritative local state;
2. perform external side effects;
3. persist the result;
4. retry safely if needed;
5. surface irrecoverable discrepancies to operations.

Do not create a giant database transaction around slow external network calls.

## 2.5 Production mode must fail closed

If a production environment is missing a required payment secret, webhook secret, security secret or production setting, startup should fail clearly rather than silently running a demo fallback.

## 2.6 Fix root causes, not symptoms

Examples:

- Do not fix an async token-storage mismatch with another `as any`.
- Do not fix duplicate job execution by increasing intervals.
- Do not fix Stripe signature errors by disabling signature verification.
- Do not fix CAPTCHA integration by disabling CAPTCHA in production.
- Do not fix an ownership error by accepting a resource ID without the owner constraint.

## 2.7 Every production bug needs a regression test

If a defect could have affected a real customer, add a test that would have failed before the fix.

## 2.8 Avoid wide rewrites

Do not convert frameworks, databases, navigation libraries, state libraries, styling systems, or API architecture as part of production hardening unless a concrete blocker proves the current technology cannot support the requirement.

## 2.9 Keep commits small

Suggested commit pattern:

```text
fix(finder): make production notify CAPTCHA flow valid
fix(payments): preserve raw Stripe webhook body
fix(checkout): enforce pending-order ownership
feat(cart): add premium cart page layout
fix(mobile): make token storage async-safe
```

One work packet should normally be one commit or a very small sequence of related commits.

---

# 3. Definition of "Ready for First Real Customer"

PawTag is ready for a controlled first-customer launch only when all of the following are true.

## Core recovery journey

A real customer can:

- register;
- verify the required account channels;
- log in and log out reliably;
- create a pet;
- activate/redeem a tag;
- view and manage the pet;
- mark the pet lost;
- receive a finder notification;
- acknowledge/recover the pet.

A stranger can:

- scan a valid tag without creating an account;
- understand immediately that the tag belongs to a pet;
- see only information that PawTag intentionally makes public;
- contact/notify the owner;
- optionally share location with clear consent;
- succeed even when location permission is denied;
- recover from a temporary network problem;
- receive a clear confirmation;
- not accidentally create multiple escalations by tapping repeatedly.

## Commerce journey

A customer can:

- browse a product;
- add it to the cart;
- understand product/variant/customisation details;
- change quantity;
- remove an item;
- see a trustworthy price breakdown;
- apply valid promotions if enabled;
- proceed to checkout;
- pay once;
- receive exactly one order;
- see the order later;
- receive the correct tag/subscription entitlement;
- cancel/refund only where allowed.

PawTag operations can:

- identify paid-but-not-completed orders;
- identify failed webhooks;
- identify failed refunds;
- safely retry supported failures;
- tell whether stock is reserved/confirmed/released;
- trace an important action through logs/audit records.

## Production operations

The team can:

- deploy a known build;
- roll back;
- restore a database backup;
- rotate secrets;
- understand an alert;
- identify a failed background job;
- disable a risky feature without corrupting state;
- support the first customer without manually editing MongoDB as the normal workflow.

---

# 4. Release Strategy

Do not attempt a public launch immediately after coding finishes.

Use these release stages:

### Stage A - Local development

Normal developer environment. Test/demo integrations allowed.

### Stage B - Production-like staging

Production environment semantics with non-production accounts/keys.

Important: `NODE_ENV=production` behavior must be exercised here. This is specifically required because PawTag currently contains behavior that changes by environment.

### Stage C - Internal dogfood

Founder/team uses real devices and realistic scenarios.

### Stage D - Controlled first customers

A small invited group. Monitor every recovery, checkout, order and failure.

### Stage E - Broader MVP launch

Only after the controlled launch demonstrates stability.

---

# 5. Recommended First-Launch Scope

## Include in the first launch

- Customer web account.
- Pet creation and management.
- Tag activation/redeem.
- Lost mode.
- Finder web experience.
- Owner notification/recovery.
- Product browsing.
- Cart.
- Checkout and Stripe payments.
- Basic order history/detail.
- Required shipping behavior.
- Basic cancellation/refund capability where business rules require it.
- Minimal admin workflows needed to support customers.
- Audit/logging/monitoring necessary to operate safely.

## Include only if commercially necessary

- Guardian/Gold membership.
- Subscription lifecycle.
- Basic rewards.
- Promo codes.

If these affect price or entitlement at launch, they must receive the same testing standard as checkout.

## Prefer to defer or hide initially

- Large referral program surface.
- Advanced loyalty mechanics not needed for first purchase.
- Advanced CMS workflows.
- Accounting automation such as broad Xero/MYOB workflows.
- Advanced analytics dashboards.
- Affiliate/marketplace concepts.
- App-store mobile launch unless native QR/NFC/push is required for the initial business proof.

Do not delete deferred features merely for cleanliness. Hide or disable them safely if they enlarge the launch surface.

---

# 6. Phase 0 - Establish a Clean Baseline

**Goal:** Know whether a later failure was introduced by us or already existed.

Do not fix functional defects in this phase unless required to make the baseline commands runnable.

## Work Packet 0.1 - Baseline repository health

### Inspect

- root `package.json`
- `pnpm-workspace.yaml`
- all workspace `package.json` files
- `.github/workflows/ci.yml`
- `vitest.config.ts`

### Run

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:regression
pnpm test:smoke
pnpm build
```

If a command fails, record:

- command;
- failing package/test;
- exact error;
- whether failure is deterministic;
- whether failure is environmental or code-related.

### Create a simple progress log

Create:

`docs/MVP_IMPLEMENTATION_STATUS.md`

Use this format:

```md
# MVP Implementation Status

## Baseline
- [ ] install
- [ ] typecheck
- [ ] unit
- [ ] integration
- [ ] regression
- [ ] smoke
- [ ] build

## Work Packets
- [ ] 1.1 Finder production CAPTCHA
- [ ] 1.2 Stripe raw-body webhook
...

## Known pre-existing failures
...
```

Do not put long explanations into this status file. The master plan remains the detailed source.

### Acceptance criteria

- Baseline results are recorded.
- No unrelated code is changed.
- The repository can be returned to the exact baseline state.

---

# 7. Phase 1 - Stop-Ship Production Safety

No real customer should use PawTag until these work packets are complete.

---

## Work Packet 1.1 - Fix Finder production CAPTCHA contract

### Problem today

The notify-owner API requires CAPTCHA in production through:

- `packages/api/src/routes/finder.ts`
- `packages/api/src/middleware/captcha.ts`

The Finder frontend notify form does not currently send the fields expected by the middleware:

- `apps/finder/src/components/NotifyOwnerForm.tsx`
- `apps/finder/src/lib/finderApi.ts`

This can create the dangerous situation where local development works and the real production action fails.

### Product requirement

A stressed stranger should not face an unnecessarily difficult challenge.

Use an abuse-prevention design with the least friction possible. If the current arithmetic/JWT CAPTCHA is retained for MVP, make it accessible and easy. Do not add a complicated third-party CAPTCHA platform unless there is a clear reason.

### Implementation steps

1. Inspect how CAPTCHA tokens are generated and whether an endpoint already exists.
2. Define a typed request/response contract for obtaining a challenge if needed.
3. Make the Finder frontend obtain the challenge when required.
4. Send `captchaToken` and `captchaAnswer` exactly as the middleware validates them.
5. Ensure expired/incorrect challenge errors return a user-friendly retry state.
6. Ensure a network retry does not accidentally create multiple notifications/escalations.
7. Preserve development convenience without bypassing production verification.
8. Add production-mode integration coverage.

### UX requirements

- Do not make CAPTCHA the first visual element on the Finder page.
- Keep "Notify owner" as the primary goal.
- Challenge copy must be understandable by a nontechnical stranger.
- If a challenge expires, regenerate without clearing the finder's entered contact details.
- Form errors should be announced accessibly.

### Tests

At minimum:

- production notify without CAPTCHA -> rejected;
- valid challenge -> notification succeeds;
- invalid challenge -> rejected;
- expired challenge -> rejected and recoverable;
- duplicate rapid submit -> does not create uncontrolled duplicate escalation work;
- development/test behavior remains intentional.

### Acceptance criteria

- A Finder notify request succeeds with `NODE_ENV=production` behavior.
- CAPTCHA remains enforced server-side.
- No frontend-only bypass exists.
- An automated test would catch the original mismatch.

---

## Work Packet 1.2 - Fix Stripe webhook raw-body handling

### Problem today

`packages/api/src/index.ts` installs `express.json()` before the Stripe webhook route that expects a raw body.

Relevant files:

- `packages/api/src/index.ts`
- `packages/api/src/routes/stripe-webhooks.ts`

Stripe signature verification must receive the exact raw request payload.

### Implementation approach

Mount the Stripe webhook raw-body route before the global JSON middleware, or use an equally correct Express approach that preserves the exact raw payload only for the Stripe endpoint.

Do not disable signature verification.

### Required behavior

- Stripe webhook receives `Buffer`/raw body.
- Normal JSON routes still receive parsed JSON.
- Invalid signature is rejected.
- Valid signature is accepted.
- Duplicate Stripe event ID remains idempotent.

### Tests

Create an integration test that constructs a valid Stripe webhook signature with a test webhook secret and sends the payload as raw bytes.

Test:

- valid signature;
- invalid signature;
- malformed payload;
- duplicate event ID;
- normal non-webhook JSON route still works.

### Acceptance criteria

- Signature verification is tested, not merely mocked away.
- The route does not depend on middleware order accidentally.
- Existing webhook idempotency remains intact.

---

## Work Packet 1.3 - Remove checkout ownership bypass

### Problem today

`packages/api/src/commerce/services/checkout.service.ts` first searches a `PendingOrder` using both `stripePaymentIntentId` and `userId`, then falls back to a lookup by payment-intent ID alone.

That weakens the account ownership boundary.

### Implementation steps

1. Remove the cross-user fallback.
2. Trace every caller of `confirmCheckout`.
3. Ensure the authenticated user ID is stable across access-token refresh.
4. If recovery after browser/session interruption is needed, design it using a secure user-bound recovery mechanism rather than bypassing ownership.
5. Ensure an already-converted order can still be returned idempotently only to its rightful owner.
6. Audit nearby payment/order lookup endpoints for the same pattern.

### Tests

- User A cannot confirm User B's PaymentIntent.
- User A cannot retrieve User B's pending order using the PaymentIntent ID.
- User A can refresh authentication and still confirm their own payment.
- Confirming the same own PaymentIntent twice returns the same authoritative order rather than creating another.

### Acceptance criteria

- Every pending-order/order lookup used in customer checkout is owner constrained.
- No comment claims token refresh changes the database user identity.
- Regression tests cover horizontal authorization.

---

## Work Packet 1.4 - Add production payment configuration guardrails

### Problem today

`packages/api/src/commerce/config.ts` defaults `commerce.payment.testMode` to `true`.

`packages/api/src/commerce/providers/stripe/index.ts` can simulate successful payment in test mode.

`packages/api/src/config/validateEnv.ts` currently validates only a small production environment set.

### Desired rule

A production process must never silently treat a fake/demo payment as a successful real payment.

### Implementation steps

1. Define clearly what environment variables/settings are required when commerce/payment is enabled.
2. At production startup, fail with a clear error when required Stripe configuration is absent.
3. In production, fail if payment test mode is enabled unless there is an explicit, intentionally named emergency override that is impossible to activate accidentally. Prefer no override for MVP.
4. Require a Stripe webhook signing secret when Stripe webhooks are enabled.
5. Validate allowed frontend origins and other security-critical environment values.
6. Keep local/test environments convenient.

### Do not

- silently switch providers;
- silently simulate success;
- log secret values;
- rely on a seed script to make production safe.

### Tests

Unit-test configuration validation for:

- production + missing Stripe key;
- production + test mode true;
- production + missing webhook secret;
- development/test accepted with test mode.

### Acceptance criteria

A dangerous production configuration stops startup before serving customer traffic.

---

## Work Packet 1.5 - Define checkout/order consistency and recovery state machine

### Problem today

`confirmCheckout()` coordinates multiple important actions:

- payment verification;
- Order creation;
- PaymentTransaction creation;
- inventory confirmation;
- tag generation;
- subscription creation;
- invoice creation;
- cart conversion;
- pending-order conversion.

Several occur sequentially without one coherent recovery state model. Some entitlement failures are logged as non-blocking.

### Important architecture principle

Do not simply wrap every operation in one giant Mongo transaction, especially not external Stripe/email calls.

### Required design

First document a small state machine in code comments/types/tests. Suggested conceptual states:

```text
payment_pending
payment_confirmed
order_committing
order_created
entitlement_pending
complete
repair_required
failed
```

Names can differ if they fit current models better.

### Implementation steps

1. Map every step of current checkout and classify it:
   - database-only and transaction-safe;
   - external side effect;
   - retryable;
   - non-retryable/manual intervention.
2. Decide which Mongo writes must commit atomically. Strong candidates:
   - authoritative Order record;
   - local payment transaction reference;
   - PendingOrder conversion marker;
   - inventory state transition where feasible.
3. Introduce a persistent post-payment completion/recovery status instead of merely logging non-blocking entitlement failures.
4. Ensure tag/subscription/invoice creation can be retried idempotently.
5. Ensure a crash at any checkpoint can be reconciled later.
6. Reuse or extend existing reconciliation jobs rather than inventing a second parallel system.
7. Add correlation identifiers to logs for payment intent/order/customer.

### Failure-injection tests

Test failure after each major checkpoint:

- after Stripe payment confirmed but before Order create;
- after Order create before inventory confirmation;
- after inventory confirmation before tag/subscription;
- after entitlement before invoice;
- before cart conversion;
- retry after process interruption.

Expected result must be either:

- exactly one correct complete order; or
- a persistent `repair_required`/equivalent state that the reconciliation job can safely repair.

Never allow "customer paid, data vanished and nobody knows."

### Acceptance criteria

- Duplicate requests cannot duplicate the order.
- Paid-but-incomplete states are queryable.
- Reconciliation can retry safely.
- Entitlement failures are not only logs.
- Tests inject at least several representative partial failures.

---

## Work Packet 1.6 - Fix inventory reservation compensation

### Inspect

- `packages/api/src/commerce/services/inventory.service.ts`
- `packages/api/src/commerce/services/checkout.service.ts`
- `packages/db/src/models/Product.ts`
- `packages/db/src/models/StockMovement.ts`
- cart/order tests.

### Goal

A checkout attempting to reserve multiple items must not leave earlier products reserved indefinitely when a later reservation fails.

### Implementation approach

Either:

- make multi-product reservation transactional in MongoDB where safe; or
- implement an explicit compensation path that releases all reservations created by the failed checkout.

Reservation/release must be idempotent and tied to a stable checkout/pending-order identifier where possible.

### Concurrency tests

Test two simultaneous checkouts for the final unit of stock.

Expected: only one succeeds/reserves the unit.

### Acceptance criteria

- no partial abandoned reservation when checkout setup fails;
- no oversell in tested concurrent path;
- release can be safely retried.

---

# 8. Phase 2 - Finder and Pet Recovery Reliability

The Finder application is the most important customer-outcome surface. Optimize for a stranger who is stressed, in poor signal, on an unfamiliar phone, and does not know PawTag.

---

## Work Packet 2.1 - Create an explicit public Finder DTO

### Problem today

The Finder route exposes internal pet substructures including health/microchip information more broadly than is necessary.

Relevant files:

- `packages/api/src/routes/finder.ts`
- `packages/db/src/models/Pet.ts`
- `apps/finder/src/types.ts`
- Finder UI components.

### Goal

Create a deliberately designed public shape such as `FinderPetView`/`PublicFinderPet`.

### Public data principle

Only return information required to help recover the animal.

Possible public fields, subject to PawTag's intended privacy settings:

- pet display name;
- primary photo(s);
- animal type/breed/color/recognition details;
- lost/found status;
- carefully chosen emergency medical alert summary where owner intentionally shares it;
- approved owner contact method;
- emergency action text;
- tag state.

Do not return rich internal records by default such as:

- veterinary clinic metadata;
- veterinarian names;
- vaccination lot numbers;
- private notes;
- internal model IDs not required by the client;
- full microchip metadata unless there is an explicit product reason and privacy approval.

### Implementation steps

1. Define typed response DTO.
2. Map internal `Pet` to the DTO explicitly.
3. Update Finder client types.
4. Add tests asserting sensitive fields are absent.
5. Verify JSON responses manually in an integration test.

### Acceptance criteria

Anonymous Finder responses expose only explicitly approved fields.

---

## Work Packet 2.2 - Separate "finder report" from "recovery confirmed"

### Problem to validate

The current Finder notify path can transition the pet to `found` when an anonymous finder submits.

### Product requirement

A stranger reporting "I found/saw this pet" is evidence, not necessarily final recovery.

### Recommended state semantics

Keep owner-controlled pet lifecycle clear:

```text
normal -> lost -> finder_reported/sighting -> owner_recovered
```

If changing the Pet status enum would create too much risk for MVP, the same distinction can be represented in an escalation/recovery record while keeping `lost` until owner acknowledgement.

### Implementation steps

1. Trace all code depending on `pet.status === 'found'`.
2. Choose the smallest compatible state design.
3. Do not automatically end lost-mode notification logic until recovery is confirmed by the owner or trusted admin process.
4. Update customer UI wording accordingly.
5. Add audit event for owner recovery confirmation.

### Acceptance criteria

Anonymous input cannot prematurely declare the entire recovery complete.

---

## Work Packet 2.3 - Make finder notification submission idempotent

### Goal

Repeated taps, browser retries, refreshes, or a flaky network should not send uncontrolled repeated notifications or create multiple escalation chains.

### Suggested approach

Use a short-lived idempotency key or stable FinderScan/session identifier with a server-side uniqueness rule appropriate to the workflow.

Do not deduplicate solely by IP because shared networks exist.

### UX

- Disable the submit button while a request is active.
- Preserve entered data on retry.
- Show a clear success state.
- If the original request succeeded but the response was lost, the retry should return the existing successful result rather than duplicate work.

### Acceptance criteria

Double-click and network retry tests demonstrate one logical notification action.

---

## Work Packet 2.4 - Finder degraded-network behavior

### Inspect

- `apps/finder/src/App.tsx`
- `FinderLoadingState.tsx`
- `FinderErrorState.tsx`
- `LocationConsentBanner.tsx`
- `NotifyOwnerForm.tsx`
- `finderApi.ts`

### Requirements

- Tag lookup should be the highest-priority network request.
- Nonessential site/settings requests should not prevent pet display.
- Timeout/error messages should distinguish invalid tag from network failure.
- Provide one obvious retry action.
- Location permission denial must still allow notification without GPS.
- Do not repeatedly request geolocation after denial.
- If pet data was already successfully loaded and a later action fails, do not discard the pet data.

### Optional, only if simple

Cache the most recently loaded finder response in session memory for refresh resilience, but do not create a persistent sensitive-data cache without considering privacy.

### Acceptance criteria

Finder remains useful with location denied and gracefully recoverable with an interrupted connection.

---

## Work Packet 2.5 - Finder privacy retention

### Inspect models/data

- `FinderScan`
- `LocationEvent`
- `EscalationRecord`
- associated audit/log data.

### Goal

Define technical retention behavior instead of keeping location/contact data forever by accident.

### Implementation

Create configuration/documented retention values and a safe cleanup mechanism where appropriate. Do not blindly TTL-delete records that are legally/operationally required for an active incident or financial/audit requirement.

At minimum record:

- what data is stored;
- purpose;
- retention target;
- deletion/anonymisation mechanism;
- whether records are needed for security/audit investigations.

This should later be reviewed with a privacy/legal professional.

---

# 9. Phase 3 - Commerce, Payments, Refunds and Subscriptions

---

## Work Packet 3.1 - Formalize payment and order idempotency

### Goal

Use stable uniqueness constraints and service behavior to guarantee:

- one Stripe PaymentIntent -> at most one PawTag order;
- one Stripe Event ID -> at most one logical event application;
- one refund request/idempotency key -> no duplicate refund;
- repeated confirmation -> existing result.

### Inspect

- `PendingOrder`
- `Order`
- `PaymentTransaction`
- `WebhookEvent`
- checkout service;
- refund service;
- Stripe webhook handlers.

### Requirements

Use database uniqueness where possible. Application `find then create` without a unique constraint is not enough under concurrency.

---

## Work Packet 3.2 - Harden webhook processing state machine

Each webhook should have clear state:

```text
received -> processing -> processed
                  \\-> failed -> retry_scheduled -> processing
```

Use atomic claim/update so two worker/API instances cannot process the same pending event simultaneously.

Store:

- Stripe event ID;
- event type;
- received timestamp;
- attempt count;
- last error category/message (redacted);
- next retry timestamp;
- processed timestamp.

Never store secrets or full sensitive payment data unnecessarily.

---

## Work Packet 3.3 - Refund correctness

### Trace

- customer/admin cancellation routes;
- `refund.service.ts`;
- `refund-retry.service.ts`;
- refund reconciliation job;
- Order/PaymentTransaction state transitions.

### Required rules

- refund authorization server-side;
- refund amount derived from authoritative order/payment data;
- prevent cumulative refund above captured amount;
- repeat request idempotent;
- Stripe failure does not falsely mark refund complete;
- Stripe success followed by local write failure is reconcilable;
- admin action audited.

### Tests

- duplicate refund submission;
- partial refund if supported;
- unauthorized customer/admin role;
- webhook + manual retry race;
- Stripe success/local DB failure recovery.

---

## Work Packet 3.4 - Cancellation correctness

Define allowed order statuses for cancellation.

Use one central service for cancellation business rules. Avoid slightly different rules in customer and admin routes.

Explicitly handle:

- not paid;
- paid but unfulfilled;
- shipped;
- partially refunded;
- subscription-linked purchase;
- inventory release/restock;
- tag/subscription entitlement effects.

---

## Work Packet 3.5 - Subscription entitlement integrity

If Gold/Guardian/subscriptions remain launch scope:

- a paid subscription must map to exactly one correct active entitlement;
- canceled/refunded payment must not leave an unintended entitlement;
- renewal events must be idempotent;
- expired/canceled subscriptions must not retain benefits indefinitely;
- external Stripe subscription state and PawTag state must reconcile.

If these features are not essential for first launch, feature-flag them out rather than rushing incomplete logic.

---

## Work Packet 3.6 - Fix New Zealand timezone assumptions

Audit jobs and commerce code for hard-coded `UTC+12` logic.

New Zealand uses daylight saving for part of the year.

Prefer:

- UTC persistence;
- IANA timezone `Pacific/Auckland` for user/business scheduling;
- a timezone-aware library already available, or a minimal standards-based approach.

Do not implement DST rules manually.

Add tests for dates on both sides of daylight-saving changes.

---

# 10. Phase 4 - Authentication, Session and Application Security

---

## Work Packet 4.1 - Strengthen web refresh-token storage

### Current risk

Web/admin refresh tokens are browser-readable through local storage in the shared API client architecture.

A successful XSS can therefore extract long-lived credentials.

### Recommended target

For browser apps:

- short-lived access token in memory where practical;
- refresh token in an `HttpOnly`, `Secure`, appropriately `SameSite` cookie;
- server refresh endpoint reads cookie;
- explicit logout revokes refresh token and clears cookie.

### Important

This is a meaningful auth change. Execute it carefully and independently.

### Steps

1. Document current login/refresh/logout flows.
2. Add server cookie configuration that is environment-aware.
3. Update CORS/credentials behavior correctly.
4. Migrate web API client.
5. Ensure admin client also works.
6. Keep mobile using SecureStore and token-body flow if necessary; do not force mobile to use browser cookies.
7. Preserve refresh-token rotation/revocation.
8. Add CSRF analysis for cookie-authenticated endpoints. If access auth remains bearer-token based and refresh cookie is scoped appropriately, design protection specifically for the refresh/logout routes.

### Acceptance criteria

Browser JavaScript cannot read the refresh token.

---

## Work Packet 4.2 - Session invalidation matrix

Test and fix behavior after:

- logout;
- password change;
- password reset;
- account disabled;
- role removed;
- MFA setting change;
- refresh-token reuse detection if implemented.

Write integration tests that prove stale sessions no longer retain inappropriate access.

---

## Work Packet 4.3 - Reverse proxy/IP/rate-limit correctness

### Inspect

- Express proxy configuration;
- `rate-limiter.ts`;
- standard `express-rate-limit` usage;
- deployment/Nginx setup;
- IP logging and geo-location.

### Goal

Ensure the application identifies the client IP correctly behind the actual production proxy without trusting attacker-supplied forwarding headers.

Set `trust proxy` according to the real deployment architecture, not `true` blindly.

### MVP scaling rule

If launch runs a single API process, a process-local limiter may be acceptable temporarily for some endpoints if documented.

If multiple replicas are deployed, rate-limit counters must move to a shared store or the deployment must be constrained to one relevant process.

Security-sensitive limits include:

- login;
- password reset;
- MFA/OTP;
- Finder notify;
- public lookup/enumeration-sensitive routes;
- support/contact abuse;
- upload endpoints.

---

## Work Packet 4.4 - Input validation consistency

Prioritize Zod/schema validation for:

1. public mutations;
2. commerce mutations;
3. Finder submissions;
4. account/security mutations;
5. admin financial/destructive mutations;
6. uploads.

Do not try to schema every internal endpoint in one huge refactor.

Reject unexpected types and invalid IDs before business logic.

---

## Work Packet 4.5 - Authorization audit of object-level access

Search for patterns such as:

```text
findById(req.params.id)
findOne({ _id: id })
```

inside customer routes/services.

For user-owned objects, verify ownership in the database query or immediately through an authorization service.

Audit at least:

- pets;
- health records;
- tags;
- orders;
- invoices;
- returns;
- subscriptions;
- notifications;
- addresses/profile objects if separate;
- uploaded media.

Add cross-user regression tests.

---

## Work Packet 4.6 - Upload/storage security

Inspect Multer/R2/local storage behavior.

Require:

- allow-listed content types;
- server-generated filenames/keys;
- size limits;
- no path traversal;
- no execution of uploaded content;
- authorization for private uploads;
- safe public/private bucket behavior;
- image handling failure behavior.

Do not trust filename extensions alone.

---

# 11. Phase 5 - Premium Cart and Commerce UX Redesign

This is a **product-quality phase**, not only visual styling.

## Product direction

The current narrow, single-column cart drawer should no longer be the primary place where customers understand and manage a meaningful PawTag order.

Recommended structure:

- Keep `CartDrawer` as a fast mini-cart/confirmation surface.
- Add a dedicated `/cart` page as the primary cart experience.
- Desktop/tablet landscape uses a premium **70/30** composition.
- The right-hand order summary is sticky.
- Mobile uses one-column responsive composition; do not force a squeezed 70/30 split onto phones.

The cart should communicate confidence, value and clarity rather than decorative luxury.

---

## Work Packet 5.1 - Establish cart information architecture

### Desktop layout

Use a centered max-width container approximately in the 1200-1400px range consistent with existing PawTag layout.

Suggested layout concept:

```text
+---------------------------------------------------------------------+
| Cart heading                                      Secure checkout   |
| 3 items                                                               |
+----------------------------------------------+----------------------+
|                                              |                      |
|  70% MAIN CART                              | 30% ORDER SUMMARY    |
|                                              | sticky               |
|  Product card                               |                      |
|  image | title + variant | line price       | Subtotal             |
|        | customisation    | qty controls     | Discount             |
|        | stock/status     | remove/save      | Shipping             |
|                                              | GST                  |
|  ------------------------------------------  | ------------------   |
|  Product card                               | Estimated total      |
|                                              |                      |
|  Benefits / delivery / reassurance          | Promo                |
|                                              | Membership benefit   |
|                                              |                      |
|                                              | [Checkout]           |
|                                              | Secure payment note  |
+----------------------------------------------+----------------------+
```

### Responsive breakpoints

- Desktop: approximately 70/30.
- Medium tablet: about 64/36 or natural grid based on minimum summary width.
- Mobile: one column.
- On mobile, summary appears after items but checkout CTA can use a carefully implemented sticky bottom action area if it does not obscure content or browser controls.

### Visual hierarchy

Use:

- clear page title;
- generous whitespace;
- contained cards/sections rather than one flat vertical stream;
- subtle border/elevation hierarchy;
- strong total amount;
- one primary checkout action;
- subdued secondary actions;
- meaningful status banners only when needed.

Avoid:

- excessive gradients;
- glassmorphism everywhere;
- animations that move continuously;
- multiple competing colored boxes;
- oversized marketing banners inside checkout-critical space;
- fake scarcity or pressure copy.

### Acceptance criteria

A designer/engineer can identify the primary action, total, product details and problems within seconds.

---

## Work Packet 5.2 - Create dedicated Cart page and route

### Likely files

- new `apps/web/src/pages/Cart.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/context/CartContext.tsx`
- `packages/ui/src/components/CartDrawer.tsx`
- new reusable cart components either in web or `packages/ui` where actually shared by web apps.

### Component recommendation

Do not build another 700-line cart page.

Suggested components:

```text
CartPage
  CartHeader
  CartIssueBanner
  CartItemList
    CartItemCard
      CartProductMedia
      CartProductDetails
      CartCustomizationSummary
      CartQuantityControl
  CartBenefitsPanel
  OrderSummary
    PromoCodeControl
    PriceBreakdown
    CheckoutTrustRow
```

Only extract components that have a coherent responsibility.

### Mini-cart behavior

`CartDrawer` becomes a quick preview:

- recently added/current items;
- item count;
- subtotal/estimated subtotal;
- "View cart";
- "Checkout" if appropriate;
- accessible close behavior.

Do not duplicate the entire full-cart feature set inside the drawer.

---

## Work Packet 5.3 - Premium product-line design

Each cart line should clearly display:

- meaningful product image;
- product name;
- variant where relevant;
- SKU only if useful to customers (usually not prominent);
- engraving/customisation text;
- customization unit price if charged;
- quantity;
- unit price;
- line total;
- stock/availability problem;
- price-change state;
- remove action.

### Customisation example

Instead of hiding customization inside the arithmetic:

```text
PawTag Classic
Midnight / Small
Engraving: "Buddy"
Tag                       $39.00
Engraving                  $5.00
Qty 2                    $88.00
```

Exact presentation can be more compact, but the customer must understand what they are paying for.

### Quantity control

Use an accessible stepper:

- labelled decrement button;
- current quantity;
- labelled increment button;
- disabled state at min/max;
- immediate pending/loading feedback;
- rollback/error message if stock update fails.

Do not let rapid tapping produce stale updates or out-of-order state.

---

## Work Packet 5.4 - Sticky 30% order summary

### Desktop behavior

The summary card should use `position: sticky` with an offset that respects the site header.

It should not exceed the viewport in a way that hides controls. If content becomes tall, ensure natural scrolling behavior.

### Summary content hierarchy

Recommended order:

1. `Order summary`
2. merchandise subtotal;
3. customization subtotal if useful to explain;
4. discount/promo;
5. shipping or `Calculated at checkout`;
6. GST/tax statement;
7. savings/Gold benefit only if real and calculated;
8. divider;
9. estimated total;
10. primary `Checkout` button;
11. payment/security reassurance;
12. secondary `Continue shopping` link.

### Rules

- Never invent savings.
- Never display a discount unless the API has validated it.
- Clearly distinguish estimated amounts from final amounts.
- Currency formatting should use one central formatter.
- NZ GST wording must match actual pricing/tax behavior.

---

## Work Packet 5.5 - Promo and Guardian/Gold treatment

Current cart/checkout experiences should not become a wall of marketing modules.

### Promo

Use progressive disclosure:

```text
Have a promo code?  [Add]
```

Expand inline when requested.

Show:

- applying state;
- applied success;
- specific failure message;
- remove/change action.

### Gold/Guardian

If Gold materially changes checkout benefits, show one compact benefit module.

Good:

```text
Guardian Gold
You would earn 2x PawRewards on this order.
[Learn about Gold]
```

Bad:

- multiple Gold banners;
- full membership sales landing page inside cart;
- unclear preselected paid membership;
- hiding the final charge impact.

Any add-on membership must be opt-in and its cost visible.

---

## Work Packet 5.6 - Cart states

Explicitly design and test:

### Empty cart

Not just "Cart empty".

Use:

- friendly PawTag-specific message;
- one clear `Shop tags`/`Continue shopping` action;
- optional small reassurance/value message.

### Loading

Use stable skeleton layout rather than full-page spinner where practical.

### Error

Keep existing cart visible if an update fails.

Show inline problem + retry.

### Price changed

Show a clear non-alarming message:

```text
The price of PawTag Classic changed from $X to $Y since it was added.
```

Require server-authoritative current price.

### Inventory changed

Clearly identify affected line and available quantity.

### Guest

Explain that cart can be preserved/merged when signing in without making login feel mandatory too early unless checkout business rules require verification.

---

## Work Packet 5.7 - Cart accessibility

Fix both full page and drawer.

### Drawer requirements

- `role="dialog"` or semantic dialog implementation;
- `aria-modal="true"` where appropriate;
- accessible name;
- Escape closes;
- focus moves into drawer when opened;
- focus is trapped while modal drawer is open;
- focus returns to opener when closed;
- icon buttons have accessible labels;
- background cannot be keyboard-interacted with.

### General

- visible focus states;
- screen-reader labels for quantity controls;
- error/status messages in suitable live regions;
- no color-only status indication;
- touch targets large enough;
- reduced-motion preference respected.

---

## Work Packet 5.8 - Cart motion system

Motion should explain change.

Allow:

- drawer slide/fade;
- newly added item highlight;
- item removal collapse;
- quantity/price crossfade;
- success check for promo;
- small CTA feedback.

Avoid:

- looping animation;
- bouncing CTAs;
- large parallax effects;
- animation that delays checkout;
- motion without reduced-motion handling.

Use existing animation tokens where sensible:

`apps/web/src/lib/cart-animation-tokens.ts`

Consolidate rather than inventing a second motion vocabulary.

---

## Work Packet 5.9 - Cart correctness regression suite

Test at least:

- guest add/update/remove;
- authenticated add/update/remove;
- guest cart merge on login;
- customized products;
- quantity stock failure;
- price changed;
- promo apply/remove;
- cart reload;
- empty cart;
- server error preserves recoverable UI;
- totals displayed match API values for authenticated cart.

The UI must not reimplement authoritative discount/tax/shipping rules inconsistently.

---

# 12. Phase 6 - Checkout UX and Customer Web Hardening

---

## Work Packet 6.1 - Decompose the checkout page safely

`apps/web/src/pages/Checkout.tsx` currently coordinates many responsibilities.

Refactor incrementally without altering the checkout contract.

Suggested structure:

```text
CheckoutPage
  CheckoutProgress
  CheckoutCustomerIdentity
  CheckoutAddress
  CheckoutShipping
  CheckoutVerification
  CheckoutPayment
  CheckoutOrderReview
  CheckoutConfirmation
```

Keep one orchestration layer for transitions.

Do not split every `<div>` into a component.

### Acceptance criteria

- behavior unchanged except explicit fixes;
- state ownership is clearer;
- payment submission remains single-shot/idempotent;
- browser refresh/re-entry recovery remains safe.

---

## Work Packet 6.2 - Checkout state and failure recovery

Test:

- refresh before payment;
- refresh after Stripe succeeds but before frontend confirmation response;
- network drops during confirm;
- PaymentIntent requires additional action;
- payment declined;
- cart price changed before payment;
- item becomes unavailable;
- address invalid;
- OTP expires;
- customer double-clicks Pay.

Never instruct the user to pay again while the system is uncertain whether the first payment succeeded. Instead check authoritative PaymentIntent/order state first.

---

## Work Packet 6.3 - Customer account critical journey polish

Prioritize:

- Dashboard;
- My Pets;
- Pet detail/health;
- Redeem tag;
- Lost mode;
- Orders;
- Order detail;
- Profile/settings/security;
- Notifications.

For each screen ensure:

- useful loading state;
- useful empty state;
- recoverable error state;
- clear success confirmation;
- mobile responsive behavior;
- consistent terminology;
- destructive-action confirmation;
- no raw API/internal terminology exposed to customers.

Do not spend first-launch time polishing low-use pages ahead of recovery and commerce journeys.

---

# 13. Phase 7 - Web End-to-End Quality Gate

Web E2E testing is required for first launch because critical PawTag failures occur between individually "working" layers.

---

## Work Packet 7.1 - Add Playwright (or equivalent browser E2E) deliberately

Playwright is a reasonable fit for the current Vite/React stack.

This is one of the few places where adding a development dependency is justified if none exists.

### Initial suite

Do not create 100 shallow tests.

Create approximately 8-15 high-value journeys.

Must include:

1. registration/login/verification representative flow;
2. pet create/update;
3. tag activation/redeem;
4. mark pet lost;
5. Finder loads public pet;
6. Finder production-CAPTCHA notify;
7. owner sees/acknowledges recovery;
8. add customized product to cart;
9. cart update and promo where enabled;
10. checkout success using Stripe test environment/mock boundary suitable for E2E;
11. refresh/retry after payment confirmation;
12. order appears in account;
13. unauthorized cross-user object access stays rejected.

### Production-like mode

At least the Finder and security-sensitive suite must run with production environment semantics, not merely `NODE_ENV=test` shortcuts.

---

## Work Packet 7.2 - CI quality gates

Update `.github/workflows/ci.yml` carefully.

Recommended required gates before merge/deploy:

- typecheck;
- unit tests;
- integration tests;
- regression/security tests;
- production build;
- critical browser E2E.

Coverage percentage is secondary to critical-flow protection.

Do not increase coverage thresholds arbitrarily just to create a number. Raise them gradually as meaningful tests are added.

---

# 14. Phase 8 - Mobile Strategy and Hardening

## First decision gate

For the **first real PawTag customer**, default recommendation is:

**Launch customer web + Finder first unless a native capability is essential to the proposition.**

The responsive web experience can prove the business while mobile is hardened.

If the founder decides native mobile must launch simultaneously, all required mobile work packets become pre-launch blockers.

---

## Work Packet 8.1 - Fix shared async token storage contract

### Problem today

`packages/shared/src/api/client-factory.ts` tries to determine whether storage is async using function constructor inspection.

`apps/mobile/src/api/client.ts` wraps SecureStore async functions in normal arrow functions and casts with `as any`.

This can cause Promise objects to be handled as token strings.

### Recommended architecture

Make token storage unambiguously async at the shared client boundary.

A simple approach:

```ts
interface TokenStorage {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(...): Promise<void>;
  clearTokens(): Promise<void>;
}
```

Browser adapters can return `Promise.resolve(localValue)` if still needed.

Alternative: explicit `sync` vs `async` adapters using a discriminated type. Do not infer async behavior from function constructor names.

### Acceptance criteria

- no async-storage `as any` casts;
- mobile request sends actual token string;
- refresh path works;
- logout clears SecureStore;
- unit test uses a true async fake storage adapter.

---

## Work Packet 8.2 - Fix mobile QR scanner

Inspect:

`apps/mobile/src/screens/tags/QRScannerScreen.tsx`

Current callback wiring needs correction so scanning enabled means the barcode callback is enabled.

Also test:

- permission granted;
- permission denied;
- invalid QR;
- PawTag URL QR;
- raw tag ID if supported;
- duplicate scan debounce;
- navigation after success;
- camera component unmount cleanup.

Add a component/unit test where feasible and keep Maestro QR flow.

---

## Work Packet 8.3 - Correct NFC NDEF URI decoding

Inspect:

`apps/mobile/src/screens/tags/NFCScannerScreen.tsx`

Use correct NDEF URI decoding including prefix byte semantics.

Test common PawTag records such as:

- `https://...` compressed prefix;
- full URI;
- malformed record;
- non-URI NDEF record;
- scan cancellation;
- NFC unsupported/disabled.

Show meaningful user errors rather than swallowing exceptions.

---

## Work Packet 8.4 - Mobile real-device readiness

Physical iOS and Android validation must cover:

- QR camera permission;
- QR activation;
- NFC support and activation where supported;
- push permission;
- Expo push token registration;
- deep link opening;
- notification tap navigation;
- background/foreground transition;
- offline -> online;
- secure token persistence;
- logout;
- keyboard avoidance on forms;
- safe areas;
- Android back behavior;
- app resume with expired access token.

An emulator alone is not enough for NFC/push/camera confidence.

---

## Work Packet 8.5 - Add mobile E2E to release process

The repository already contains Maestro flows.

Do not claim mobile release-ready until those flows are executed in a controlled build pipeline or documented release checklist on representative devices.

If reliable CI device execution is impractical for MVP, require a signed manual release checklist with screenshots/logs for each production candidate.

---

# 15. Phase 9 - Admin Operational Safety

Do not redesign the admin portal primarily for mobile. Optimize for safe desktop operations.

---

## Work Packet 9.1 - Inventory high-risk admin actions

Search all admin routes/pages for actions that can:

- refund money;
- cancel an order;
- change payment configuration;
- activate/deactivate a subscription;
- change role/permission;
- change user/account state;
- alter a tag;
- publish CMS content;
- alter site availability;
- export sensitive data;
- delete/soft-delete important data.

Create a table in `docs/ADMIN_HIGH_RISK_ACTIONS.md`:

```text
Action | Endpoint | Permission | Confirmation | Audit event | Reversible? | Notes
```

Do not treat documentation as the safety mechanism; use it to find gaps.

---

## Work Packet 9.2 - Standardize destructive confirmation

Use a consistent `ConfirmDialog` pattern.

For financial/destructive actions show:

- what will happen;
- affected customer/order/pet;
- amount where financial;
- whether reversible;
- final explicit action label such as `Refund $49.00`, not generic `Confirm`.

For exceptionally dangerous configuration actions, require stronger confirmation if justified.

---

## Work Packet 9.3 - Audit trail completeness

Every high-risk admin action should capture:

- actor user ID;
- actor role/permission context where available;
- action;
- target entity;
- before/after or relevant diff;
- timestamp;
- correlation/request ID;
- external transaction/reference ID where applicable;
- outcome.

Redact secrets/payment-sensitive values.

---

## Work Packet 9.4 - Break giant admin route only where it reduces risk

`packages/api/src/routes/admin.ts` is very large.

Do not refactor it all for aesthetics.

When fixing a high-risk workflow, move that workflow into the existing domain-specific route/service file if one already exists.

Examples already present:

- `admin-refunds.ts`
- `admin-payments.ts`
- `admin-subscriptions.ts`
- `admin-shipments.ts`

Goal: reduce duplicate business logic and make permission auditing easier.

---

# 16. Phase 10 - Background Jobs and Worker Architecture

---

## Work Packet 10.1 - Separate worker ownership from API process

Currently the API startup initiates multiple background schedules.

For MVP, avoid a large queue-platform migration.

Recommended architecture:

```text
Web / Finder / Admin / Mobile
            |
            v
       API process(es)
            |
            v
          MongoDB
            ^
            |
   ONE dedicated worker
            |
 Stripe / Email / SMS / Shipping
```

### Implementation options

Preferred simple option:

- extract job startup into a worker entry point;
- API process does not start recurring jobs in production;
- deployment runs exactly one worker replica initially.

Add a runtime guard so production configuration clearly selects `api` or `worker` role.

### Acceptance criteria

Starting two API replicas does not automatically start duplicate scheduled work.

---

## Work Packet 10.2 - Atomic job claiming for externally significant jobs

Even with one worker, implement atomic claim/lease where duplicate processing could cause financial or customer harm, especially:

- webhook retry;
- refund reconciliation/retry;
- payment reconciliation repair;
- order auto-cancel if it triggers refunds/releases;
- escalation notifications;
- shipment polling actions.

A Mongo atomic update with `lockedAt`, `lockedBy`, `leaseExpiresAt`, attempts, and status may be sufficient.

Do not add Redis/BullMQ unless persistent scheduling/throughput needs justify it.

---

## Work Packet 10.3 - Job error policy

Every job must answer:

- Is it idempotent?
- What item is being processed?
- What happens after failure?
- How many retries?
- What is retry backoff?
- When does it become manual intervention?
- What alert is emitted?
- Can a crashed lease be reclaimed?

Log per-item failures; do not let one bad item abort the entire batch without handling the rest where safe.

---

# 17. Phase 11 - Deployment and Production Configuration

---

## Work Packet 11.1 - Fix and prove Docker/workspace builds

Inspect:

- `docker/Dockerfile.api`
- `docker/Dockerfile.web`
- `docker/docker-compose.yml`
- workspace dependencies.

The web Docker dependency stage must correctly install workspace packages required by the selected app, including `@pawtag/shared` and `@pawtag/ui`.

Do not assume a local monorepo build proves Docker is correct.

Build actual images for:

- API;
- web;
- finder;
- admin;
- worker if separated.

Run each image and execute a health/smoke check.

---

## Work Packet 11.2 - Production environment schema

Create one authoritative environment validation module.

Categorize values:

### Always required in production

Examples:

- DB connection;
- JWT/security secrets;
- public origins/base URLs.

### Required when feature enabled

Examples:

- Stripe key/webhook secret;
- Resend/email configuration;
- R2 storage;
- SMS provider;
- monitoring exporter.

### Optional

Clearly safe optional integrations.

Do not allow code to scatter `process.env.X || unsafeDefault` for production-critical values.

Provide `.env.example` without real secrets.

---

## Work Packet 11.3 - Health/readiness checks

Distinguish:

- liveness: process is running;
- readiness: process can serve requests with required dependencies.

Readiness should verify essential dependencies carefully without performing expensive external operations on every probe.

Do not expose internal secrets/configuration through health responses.

---

## Work Packet 11.4 - Backup and restore rehearsal

Before first customer:

1. Create a staging dataset.
2. Take a backup using the planned production mechanism.
3. Delete/alter representative data in staging.
4. Restore from backup.
5. Verify users/pets/orders/tags relationships.
6. Record the exact restore runbook.

A backup that has never been restored is not yet a proven backup strategy.

---

## Work Packet 11.5 - Rollback procedure

Document and test:

- previous application image/version;
- database migration compatibility;
- configuration rollback;
- how to stop worker processing during incident;
- how to disable checkout while leaving Finder recovery online if necessary.

PawTag should prioritize pet recovery availability over commerce during an incident where feasible.

---

# 18. Phase 12 - Observability and Incident Readiness

---

## Work Packet 12.1 - Define actionable alerts

Existing logging/Sentry/OTel hooks are useful only if someone acts on them.

Create alerts for a small set of critical conditions:

- Stripe webhook verification failures spike;
- paid PaymentIntent without completed order beyond threshold;
- checkout confirmation errors spike;
- refund repair required;
- Finder notify errors spike;
- email/SMS/push delivery failure spikes;
- worker job repeatedly failing;
- database unavailable;
- API error rate/latency severe;
- disk/storage/provider failures if relevant.

Avoid dozens of noisy alerts.

---

## Work Packet 12.2 - Correlation IDs across critical flows

Ensure important logs can be traced by:

- request/correlation ID;
- user ID where safe;
- order ID/order number;
- PaymentIntent ID;
- Stripe Event ID;
- pet/tag ID;
- escalation/FinderScan ID.

Never log full auth tokens, card data, secrets, OTP values, or unnecessary sensitive medical/location data.

---

## Work Packet 12.3 - Basic operations dashboard/runbook

For the first customers, an elaborate dashboard is unnecessary.

Create a simple runbook that explains how to answer:

- Did Stripe charge this person?
- Did PawTag create the order?
- Was stock confirmed?
- Was a tag/subscription created?
- Did an owner notification send?
- Did a Finder report arrive?
- Is a refund complete?
- Is a job stuck?

Provide the safe admin/log query path for each answer.

---

# 19. Phase 13 - Accessibility and UX Consistency

Do not postpone all accessibility until after visual polish. Critical flows must be usable before launch.

---

## Work Packet 13.1 - Critical web accessibility pass

Prioritize:

1. Finder;
2. Cart;
3. Checkout;
4. Login/register/verification;
5. Pet/lost mode;
6. customer account dialogs;
7. high-risk admin dialogs.

Check:

- labels;
- semantic buttons/links;
- keyboard navigation;
- focus management;
- modal/dialog semantics;
- error associations;
- `aria-live` for asynchronous feedback;
- color contrast;
- touch target sizes;
- reduced motion;
- heading hierarchy.

Add automated accessibility scanning if simple, but still manually keyboard-test critical flows.

---

## Work Packet 13.2 - UX vocabulary consistency

Create a short centralized vocabulary reference for terms that currently risk drifting:

- Lost mode;
- Found / Finder report / Recovered;
- Tag activation / Redeem tag;
- Guardian / Gold;
- PawRewards;
- Order states;
- Subscription states;
- Refund states.

The same state should not have different customer-facing names on web, Finder, mobile and email unless intentionally audience-specific.

---

## Work Packet 13.3 - Common feedback patterns

Standardize:

- toast style;
- inline error style;
- success confirmation;
- destructive confirmation;
- skeleton/loading pattern;
- empty-state pattern;
- status badges;
- currency/date formatting.

Reuse existing `packages/ui` components where they already fit. Improve them rather than creating near-duplicates.

---

# 20. Phase 14 - Design System and Web/Mobile Reuse

Do this after critical reliability work. Do not block safety fixes on design-system restructuring.

---

## Work Packet 14.1 - Extract platform-neutral design tokens

Current web and mobile design concepts should converge at the token level.

Create a package such as:

`packages/design-tokens`

Share plain TypeScript/JSON-compatible semantic values for:

- brand colors;
- semantic colors;
- spacing scale;
- border radii;
- typography names/sizes/weights where practical;
- elevation concepts;
- motion duration/easing;
- breakpoints as documentation/web tokens where relevant.

### Important

Do not put DOM classes or React Native `StyleSheet` objects in the token package.

Consumers:

- `packages/ui` / Tailwind preset translates tokens to web;
- `apps/mobile` translates tokens to React Native styles.

---

## Work Packet 14.2 - Share contracts, not renderers

Maximize reuse of:

- API client/types;
- validation;
- formatting;
- data models/DTOs where safe;
- business rules that are truly client-side;
- status labels;
- design tokens;
- component behavior specifications.

Keep platform-specific:

- DOM components;
- React Native components;
- navigation;
- camera;
- NFC;
- push;
- secure storage;
- permissions;
- native gestures/pickers;
- safe-area behavior.

Do not migrate to React Native Web, Tamagui, NativeWind, gluestack or another UI framework solely to chase 100% code sharing.

---

## Work Packet 14.3 - Shared API contract cleanup

Continue centralizing endpoints/types in `packages/shared`, but do not blindly make one giant API types file.

Remove literal endpoint strings from applications as features are touched.

The goal is compile-time drift detection between clients and intended endpoints.

Where practical, share request/response DTO types rather than Mongoose document types.

---

# 21. Phase 15 - Performance Hardening

Only optimize measured or obvious critical-path issues.

---

## Work Packet 15.1 - Finder latency budget

Target a fast initial useful render.

Measure:

- HTML/JS load;
- tag lookup latency;
- DB query time;
- image load;
- geo lookup time;
- incidental writes.

Do not make nonessential analytics/settings calls gate the pet identity display.

Optimize images for mobile networks.

---

## Work Packet 15.2 - API query review of critical endpoints

Use query logging/profiling on:

- Finder lookup;
- customer dashboard;
- pets list/detail;
- cart;
- checkout;
- orders list/detail;
- admin order/customer search.

Look for:

- N+1 queries;
- unnecessary population;
- unbounded result sets;
- missing pagination;
- sorts without indexes;
- returning full documents where projections suffice.

Add indexes only when supported by actual query patterns.

---

## Work Packet 15.3 - Frontend bundle and route loading

Measure Vite bundles.

Lazy-load genuinely heavy, noncritical routes/components such as rich CMS/editor functionality.

Do not prematurely split every route into dozens of chunks.

Finder should remain especially lean.

---

# 22. Phase 16 - Code Quality Cleanup That Directly Improves Safety

This phase is intentionally late. The first launch does not require a beautiful codebase.

---

## Work Packet 16.1 - Remove dangerous `any` in boundaries

Do not try to eliminate every `any` in one campaign.

Prioritize `any` at:

- authentication/token storage;
- checkout/payment;
- cart pricing/customization;
- public DTOs;
- admin financial actions;
- external webhook payload handling.

Replace with real interfaces, narrowing and schema validation.

---

## Work Packet 16.2 - Reduce giant route/service files incrementally

Refactor only when touching the relevant functionality.

Target pattern:

```text
route
  -> validates request
  -> authenticates/authorizes
  -> invokes one domain service operation
  -> maps result to response

service
  -> owns business rule/orchestration

model/repository query
  -> persistence concern

integration provider
  -> Stripe/email/SMS/storage/shipping concern
```

Do not create interfaces/factories merely to make the architecture look enterprise-grade.

---

## Work Packet 16.3 - Remove demo/mock fallbacks from production paths

Search for:

```text
demo
mock
fake
testMode
fallback
placeholder
TODO
FIXME
sample
stub
```

Classify every hit:

- test-only;
- development-only;
- safe fallback;
- production-dangerous.

Production-dangerous behavior must be removed or guarded explicitly.

---

# 23. Phase 17 - Production Rehearsal

No new major features should be added during this phase.

---

## Work Packet 17.1 - Staging dress rehearsal

Perform the exact sequence a real launch uses:

1. build immutable production artifacts/images;
2. deploy production-like API/web/Finder/admin/worker;
3. run database initialization/migrations/seed only as intentionally required;
4. verify health/readiness;
5. run critical E2E;
6. run a real Stripe test-mode checkout through the deployed environment;
7. send real test email/SMS/push to controlled devices;
8. run QR/Finder recovery from a separate phone/network;
9. execute a refund;
10. inspect logs/audit/reconciliation;
11. simulate worker restart;
12. simulate API restart during a pending checkout;
13. verify recovery;
14. restore staging backup.

Record every unexpected manual fix. If normal operation required direct database editing, treat that as a product/operations defect.

---

## Work Packet 17.2 - Security abuse rehearsal

Attempt at least:

- cross-user pet ID access;
- cross-user order ID access;
- cross-user invoice access;
- cross-user pending-order/payment confirmation;
- repeated login attempts;
- repeated Finder notify;
- malformed IDs;
- oversized request/upload;
- fake Stripe signature;
- replayed Stripe event;
- duplicate refund;
- expired reset/verification/MFA tokens;
- low-privilege admin calling privileged endpoint.

Verify errors do not leak sensitive internals.

---

## Work Packet 17.3 - UX real-person test

Have at least one person who did not build PawTag attempt, without guidance:

### Customer

- create account;
- create pet;
- activate tag;
- buy a tag;
- find order;
- mark pet lost.

### Finder

Give them a QR/NFC tag and say only:

> You found this on a lost pet. Help the owner.

Observe where they hesitate.

Do not explain the interface during the test.

Fix genuine blockers/confusion before launch.

---

# 24. Phase 18 - First Real Customer Launch

## Launch mode

Start with a small number of invited/known customers.

Do not make multiple unrelated major code changes during the first-customer period.

## For every first checkout, verify

- Stripe PaymentIntent succeeded;
- exactly one Order exists;
- correct amount/currency;
- inventory transitioned correctly;
- tag/subscription entitlement exists;
- invoice/order confirmation generated as expected;
- no reconciliation error.

## For every first Finder event, verify

- public payload appropriate;
- owner notification sent;
- finder consent/location behavior appropriate;
- escalation record sensible;
- no duplicate spam;
- owner can acknowledge recovery.

## Keep a launch issue log

Use severity:

- `P0`: security, money, data loss, core recovery unusable -> stop affected feature/launch;
- `P1`: major customer workflow broken -> same-day fix before expansion;
- `P2`: confusing/incorrect but recoverable -> prioritize;
- `P3`: polish -> backlog.

---

# 25. Detailed Product Experience Principles

These principles guide AI-generated UI changes so PawTag does not become visually inconsistent.

## 25.1 Premium does not mean decorative

Premium PawTag UX should feel:

- calm;
- trustworthy;
- deliberate;
- warm;
- clear;
- responsive;
- polished.

It should not feel:

- flashy;
- over-animated;
- packed with gradients;
- like a generic admin template;
- like every feature is inside an identical white card;
- like an AI generated ten competing badges for every status.

## 25.2 Hierarchy before color

Create hierarchy using:

1. layout;
2. spacing;
3. typography;
4. grouping;
5. border/elevation;
6. color.

Do not solve flatness by adding more colors.

## 25.3 One dominant action per decision point

Cart -> Checkout.

Finder -> Notify/contact owner.

Lost pet owner -> respond/recover/manage lost mode.

Admin refund -> explicit refund action.

Secondary actions should remain visibly secondary.

## 25.4 Explain financial values

Customers should never need to mentally calculate why the total changed.

Whenever price changes due to:

- engraving;
- quantity;
- discount;
- Gold membership;
- shipping;
- GST;
- promotion;

show the change near the relevant part of the interface and in the final summary.

## 25.5 Error recovery is part of UX

Do not show only:

`Something went wrong.`

Tell the user:

- what failed at a useful level;
- whether their previous action may have succeeded;
- what they should do next;
- whether retry is safe.

Payments deserve especially careful wording.

---

# 26. Cart Design Specification for the AI Assistant

This is the more prescriptive design brief for the cart workstream.

## Desktop page shell

- Use site-standard header/footer.
- Main content max width around existing PawTag wide content width.
- Top margin generous enough to feel premium, not wasteful.
- Header row contains:
  - `Your cart`;
  - item count;
  - small secure/returns reassurance only if true.
- Main grid uses `minmax(0, 7fr) minmax(320px, 3fr)` or equivalent that behaves well at PawTag breakpoints.
- Gap should visually separate order-editing from transaction summary.

## Left 70% panel

### Product cards

Prefer horizontal product rows/cards on desktop.

Suggested anatomy:

```text
[ 120-160px image ]   Product title                    $line total
                      Variant / color
                      Engraving details
                      Availability/status

                      [-] 2 [+]        Remove
```

Do not put each small label in its own card.

Use separators or subtly elevated item surfaces.

### Information after items

Possible sections:

- delivery expectation/reassurance;
- return/support reassurance;
- one Guardian/Gold benefit module if relevant.

Keep marketing below product management so it does not interrupt cart correction.

## Right 30% sticky summary

Suggested card:

```text
Order summary

Subtotal                         $XX.XX
Engraving                         $X.XX   (optional separate display)
Discount                         -$X.XX
Shipping                    Calculated next
GST                         Included / $X.XX depending actual model
---------------------------------------
Estimated total                  $XX.XX NZD

[ Continue to checkout ]

Secure checkout
Stripe / payment reassurance if truthful

Continue shopping
```

A promo accordion/control can sit before totals or after subtotal according to visual testing.

The CTA should be full-width in the summary and visually dominant.

## Sticky behavior

- Sticky only when enough vertical viewport exists.
- Offset below fixed navigation.
- No sticky overlap with footer.
- Summary should remain naturally accessible if its content becomes taller than viewport.

## Mobile

Order:

1. heading;
2. issue banner if any;
3. product cards;
4. benefits/reassurance;
5. promo;
6. price summary;
7. checkout.

Optional bottom sticky checkout bar:

```text
$XX.XX total             Checkout ->
```

Only if:

- it respects safe areas;
- it does not hide required legal/price information;
- it disappears/changes appropriately when checkout is disabled;
- full summary remains in page.

## Product imagery

- consistent aspect ratio;
- object-fit behavior;
- graceful fallback image;
- optimized loading;
- meaningful alt text.

## Micro-interaction timing

Prefer fast motion approximately in the 150-250ms family for UI state, slower only for the drawer itself if existing PawTag tokens support it.

Respect `prefers-reduced-motion`.

## Visual tone

Use PawTag's existing brand colors and radius language.

Do not copy Shopify, Apple, Chewy or another brand literally.

Borrow interaction principles, not visual identity.

---

# 27. AI Code Review Checklist After Every Work Packet

The coding model must inspect its own change against this checklist.

## Correctness

- Did I change the intended behavior only?
- What happens on retry?
- What happens on duplicate request?
- What happens when the process crashes halfway?
- What happens when the external provider times out?
- What happens when the DB write fails?

## Security

- Is authentication required where needed?
- Is object ownership enforced server-side?
- Is authorization/permission enforced server-side?
- Is input validated?
- Am I leaking internal or personal data?
- Did I weaken a security check to make tests pass?

## Commerce

If money involved:

- Is price authoritative on server?
- Is operation idempotent?
- Can the user be charged twice?
- Can an order be duplicated?
- Can a refund exceed payment?
- Is partial failure repairable?

## Type safety

- Did I add `any` or unsafe casts?
- Could a Promise/string/null mismatch be hidden?
- Are public DTOs explicit?

## UX

- loading state?
- empty state?
- error state?
- success state?
- mobile layout?
- keyboard/screen reader behavior?
- clear primary action?

## Tests

- Is there a regression test for the bug?
- Does test assert behavior rather than implementation trivia?
- Did I run the relevant suite?
- Did I run typecheck?
- Does production build still succeed?

---

# 28. Things the AI Assistant Must Not Do

Do not:

- rewrite PawTag into microservices;
- replace MongoDB because relational databases are fashionable;
- introduce Kubernetes for MVP;
- introduce Kafka for MVP;
- replace React/Vite;
- replace Expo/React Native just for code sharing;
- introduce a new state manager without a concrete need;
- rewrite all CSS/design system at once;
- create repository/repository-service-controller layers mechanically around every model;
- create dozens of generic abstractions that only have one implementation;
- disable Stripe signature verification;
- disable production CAPTCHA to make Finder tests work;
- accept a PaymentIntent ID as authorization;
- move financial calculations into the browser;
- store secrets in frontend environment variables;
- log auth tokens, OTPs, passwords or Stripe secrets;
- solve failed tests by deleting/loosening the test without proving the intended behavior changed;
- mark a feature complete because a screen renders;
- make mobile share DOM components merely because both platforms use React;
- add visual animation that reduces clarity or accessibility.

---

# 29. Recommended Work Order Summary

Use this exact order unless a newly discovered critical defect requires reprioritization.

## Gate A - Cannot launch

1. `0.1` Baseline health.
2. `1.1` Finder CAPTCHA contract.
3. `1.2` Stripe raw webhook body.
4. `1.3` Checkout ownership.
5. `1.4` Production payment config guardrails.
6. `1.5` Checkout consistency/recovery state.
7. `1.6` Inventory reservation compensation.
8. `2.1` Public Finder DTO.
9. `2.2` Recovery-state semantics.
10. `2.3` Finder idempotency.
11. `3.1` Payment/order idempotency.
12. `3.2` Webhook state/claiming.
13. `3.3` Refund correctness.
14. `3.4` Cancellation correctness.
15. `4.2` Session invalidation.
16. `4.5` Object-level authorization audit.
17. `7.1` Critical web E2E.
18. `10.1` Dedicated worker ownership.
19. `11.1` Production Docker builds.
20. `11.2` Production environment validation.
21. `11.4` Backup restore rehearsal.
22. `17.1` Staging dress rehearsal.
23. `17.2` Security abuse rehearsal.

## Gate B - Required product quality before normal MVP launch

24. `2.4` Finder degraded network UX.
25. `2.5` Privacy retention.
26. `4.1` Browser refresh-token hardening.
27. `4.3` proxy/rate limiting correctness.
28. `4.4` input-validation priority pass.
29. `5.1-5.9` Premium cart redesign.
30. `6.1-6.3` Checkout/customer critical UX.
31. `9.1-9.3` Admin high-risk safety.
32. `12.1-12.3` alerts/correlation/runbook.
33. `13.1-13.3` accessibility/consistency.

## Gate C - Mobile, if launching native app with first customers

34. `8.1` async token storage.
35. `8.2` QR scanner.
36. `8.3` NFC decoding.
37. `8.4` real-device validation.
38. `8.5` mobile release gate.

If native mobile is not in initial launch, complete these immediately after the web/Finder launch stabilizes.

## Gate D - Improvement after immediate launch blockers

39. `14.x` shared design tokens/platform reuse.
40. `15.x` measured performance.
41. `16.x` targeted code-quality cleanup.

---

# 30. Founder-Friendly Acceptance Questions

You do not need to understand the code to challenge an AI assistant. After each work packet, ask it these questions.

## For any security fix

> Show me the test where a different user tries the action and is rejected.

## For any payment fix

> Show me what happens if the exact request happens twice.

> Show me what happens if Stripe succeeds and PawTag crashes before finishing.

## For any Finder fix

> Show me that this works with production settings, not only development settings.

> What happens if location permission is denied?

> What happens if the finder taps the button twice?

## For any background job

> What happens if two copies of this worker run at the same time?

> What happens if it crashes after doing the external action but before saving success?

## For any UI change

> Show me desktop, tablet and phone behavior.

> What is the loading state, error state, empty state and success state?

> Can I use it with keyboard only?

## For any refactor

> What user-visible or production risk did this refactor reduce?

If the answer is only "cleaner architecture," defer it unless it is blocking safe development.

---

# 31. Recommended Prompt for the Cart Phase

When you reach Phase 5, copy this to the coding assistant.

```text
You are now acting as PawTag's senior commerce product designer, UX architect and frontend engineer.

Read the entire PawTag_MVP_Master_Implementation_Plan.md, especially Phase 5 and Section 26.

The current cart feels flat, basic and overly dependent on a narrow single-column drawer. Do not merely restyle the current drawer.

Target architecture:
- Keep CartDrawer as a lightweight mini-cart.
- Create a dedicated premium /cart page.
- Desktop layout is approximately 70/30.
- Left 70%: cart items, customization, item issues, relevant reassurance/benefits.
- Right 30%: sticky Order Summary.
- Mobile becomes an excellent single-column experience; do not force two columns.
- Use PawTag's existing design language and packages/ui where appropriate.
- Do not copy another brand visually.
- Do not change authoritative pricing logic into frontend logic.
- Server totals remain source of truth for authenticated cart and checkout.
- Show customization/engraving clearly.
- Surface price/inventory changes clearly.
- Use one compact Guardian/Gold treatment if relevant, not multiple marketing boxes.
- Promo is progressive disclosure.
- The order summary must make subtotal, discount, shipping, GST/tax semantics and estimated total understandable.
- Accessibility is part of completion, especially the mini-cart dialog, focus management and quantity controls.
- Motion must communicate state and respect reduced-motion settings.

Before changing code:
1. Trace CartContext, cart API routes/service/model, CartDrawer, checkout totals, product/customization types, and current design tokens.
2. Report current cart data flow and which totals are authoritative.
3. Propose component boundaries.
4. Propose desktop/tablet/mobile layouts in text.
5. Identify what can reuse packages/ui and what should remain app-specific.

Then implement Phase 5 one work packet at a time, starting with 5.1/5.2. Stop after each work packet for review.
```

---

# 32. Recommended Prompt for Production-Safety Work

Use this at the start of Phase 1.

```text
Act as PawTag's senior backend/security engineer.

Read PawTag_MVP_Master_Implementation_Plan.md.
We are now executing Phase 1 - Stop-Ship Production Safety.

Do not optimize styling, mobile design, architecture aesthetics or unrelated code during this phase.

Our priority order is:
1. Finder production CAPTCHA contract.
2. Stripe webhook raw-body/signature correctness.
3. Checkout ownership authorization.
4. Production payment configuration fail-closed rules.
5. Checkout/payment/order recovery semantics.
6. Inventory reservation compensation/concurrency.

For every issue:
- prove the current behavior from source first;
- create a regression test that fails under the defective behavior;
- implement the smallest safe fix;
- run targeted tests and then relevant integration/typecheck/build commands;
- report exact remaining risk;
- stop before starting the next work packet.

Never disable a security control simply to restore functionality.
```

---

# 33. Recommended Prompt for Pre-Launch Review

Use after the implementation phases are complete.

```text
Act as PawTag's independent release reviewer. Do not assume previous coding work is correct because another AI implemented it.

Read PawTag_MVP_Master_Implementation_Plan.md and inspect the current source.

Perform a release-candidate verification focused only on first-customer safety.

Verify with code/tests/runtime evidence:
- Finder production notify flow.
- Finder public data minimization.
- recovery state semantics and duplicate submission behavior.
- Stripe raw webhook verification.
- checkout ownership.
- payment/order idempotency.
- partial-failure recovery.
- inventory concurrency.
- refund/cancellation correctness.
- production config fail-closed behavior.
- session invalidation/object authorization.
- critical web E2E.
- worker single ownership/atomic jobs.
- Docker production builds.
- health/readiness.
- backup restore runbook.
- cart/checkout responsive and accessible behavior.
- monitoring and reconciliation visibility.

Classify every remaining issue as:
P0 Stop launch
P1 Fix before expanding beyond controlled customers
P2 Can launch controlled cohort with workaround/monitoring
P3 Post-MVP polish

Do not give numerical readiness scores.
Do not rely on README claims.
```

---

# 34. What "Done" Looks Like for the First Customer

The first real customer should not be the person discovering whether PawTag's architecture works.

Before that customer arrives, PawTag should have already proven the following in staging and internal use:

- the production Finder flow really notifies an owner;
- a stranger sees the right pet information and no unnecessary private data;
- duplicate scans/submissions do not create chaos;
- Stripe webhooks verify correctly;
- a payment cannot be attached to another user's order;
- payment retry cannot duplicate an order;
- a crash halfway through checkout leaves a repairable state;
- the inventory system does not oversell the final unit in tested concurrency;
- refunds cannot duplicate or exceed the captured amount;
- high-risk admin operations are authorized, confirmed and audited;
- the web cart clearly explains what the user is buying;
- the cart has the premium 70/30 desktop layout and a strong mobile alternative;
- checkout survives real-world refresh/retry/failure conditions;
- browser E2E protects the recovery and purchase loops;
- jobs do not multiply just because a second API instance starts;
- production configuration cannot accidentally run fake payments;
- production images actually build and run;
- a backup has been restored successfully;
- alerts tell the team when the most dangerous failures occur.

At that point, PawTag does not need to be "enterprise perfect." It needs to be **safe, understandable, recoverable and operable**.

That is the right standard for the first real customer.

---

# 35. Technical Lead Recommendation

Do not rewrite PawTag.

Do not pause the product for months to chase architectural purity.

The repository already contains substantial useful implementation. The path to launch is to strengthen the boundaries where real-world production conditions matter:

1. **anonymous Finder -> public data + abuse protection + reliable notification;**
2. **customer -> authentication + object ownership;**
3. **cart -> authoritative price + clear UX;**
4. **Stripe -> verified event + idempotent financial state;**
5. **payment -> order -> inventory -> tag/subscription -> reconciliation;**
6. **API -> worker -> external providers with recoverable failure states;**
7. **production build -> monitoring -> restore -> controlled launch.**

For UI, make the cart a benchmark for the rest of PawTag: strong information hierarchy, calmer surfaces, useful detail, sticky transactional summary on desktop, responsive behavior on mobile, and motion only where it communicates state.

For architecture, share contracts, rules, validation and design tokens between web/mobile, but keep platform-specific renderers and native capabilities separate.

For AI-assisted development, force every agent to work in small verified packets and demonstrate behavior with tests. The model should be treated like a fast engineering team member, not like an authority whose code is correct because it compiles.

If this plan is executed in order, the result should be a substantially safer first-customer release without turning PawTag into an over-engineered platform before the business has proven itself.
