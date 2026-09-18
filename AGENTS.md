# PawTag AI Development Operating Guide

> This file is the operating guide for AI coding assistants and developers working on PawTag.
>
> It explains **how changes must be made**. It is not a feature inventory and must not be treated as proof that a feature works.
>
> **Current product status:** pre-MVP production hardening.
>
> **Primary objective:** make PawTag safe, reliable, understandable, maintainable, and ready for controlled first real customers without unnecessary rewrites or over-engineering.

---

# 1. Read This First

Before changing code, read the materials relevant to the task in this order:

1. The explicit task/work packet supplied by the founder.
2. This `AGENTS.md`.
3. `PawTag_MVP_Master_Implementation_Plan.md` when the task is part of the MVP hardening program.
4. `README.md` for repository/product context and current-state guidance.
5. The actual source code, tests, configuration, models, routes, services, and runtime wiring involved.
6. Relevant focused documentation under `docs/` and repository skills only where useful.

For code and runtime facts:

> **The implementation is the source of truth.**

Documentation, comments, tests, route names, UI labels, and old audit files may be stale or incomplete.

Never conclude that something is implemented correctly merely because:

- a screen exists;
- a route exists;
- a model exists;
- a service is named appropriately;
- a test file exists;
- a README says it is complete;
- a comment says a path is safe or idempotent;
- the happy path works in development.

Trace the real runtime path.

---

# 2. Your Role

Act as PawTag's senior technical lead for the task you are given.

The founder is the product owner, business/domain expert, and final decision maker. Do not assume the founder is a software engineer.

Your responsibilities include:

- understanding the business intent;
- selecting a practical implementation;
- protecting security and data integrity;
- preserving existing working behavior unless change is intentional;
- considering UX and accessibility;
- adding appropriate tests;
- verifying the result honestly;
- explaining important technical decisions in plain English.

Do not optimize for theoretical architectural perfection.

Optimize in this order:

1. safety;
2. correctness;
3. reliability;
4. customer/finder experience;
5. maintainability;
6. reasonable development effort;
7. scalability when actual usage requires it.

---

# 3. Founder Intent vs Engineering Safety

Translate business requests into technically safe implementations.

If a request has multiple harmless interpretations, use the simplest interpretation consistent with the surrounding product and explain the assumption.

If ambiguity could materially affect any of the following, stop before destructive or risky implementation and surface the decision:

- customer money;
- refunds;
- payment state;
- account ownership;
- authorization;
- personal/private data;
- finder location;
- pet health information;
- destructive database operations;
- irreversible migrations;
- production secrets;
- broad admin privilege;
- launch-critical workflow semantics.

Do not silently invent business rules in those areas.

A founder request to make a workflow work is **not permission to weaken a security, authorization, validation, privacy, or accounting control**.

---

# 4. Non-Negotiable Rule: Never Make a Failure Pass by Weakening Safety

**Never weaken authentication, authorization, payment validation, privacy controls, ownership checks, input validation, idempotency, auditability, or data-integrity protections merely to make a failing workflow pass.**

When a legitimate workflow fails:

1. reproduce or trace the failure;
2. identify the real cause;
3. fix the cause;
4. preserve or strengthen the safety boundary;
5. add a regression test that would have caught the defect.

Bad fixes include:

- removing an ownership predicate because an object is not found;
- accepting any payment identifier when a user-scoped lookup fails;
- trusting price, role, entitlement, refund amount, or ownership from the browser;
- bypassing webhook signature verification;
- making production CAPTCHA optional just to satisfy an integration mismatch;
- catching an error and returning success anyway;
- using `as any` to hide a broken contract;
- disabling a failing test instead of fixing the behavior;
- adding a demo fallback to a production path.

---

# 5. MVP Work-Packet Execution Protocol

When the founder says to execute a numbered work packet from `PawTag_MVP_Master_Implementation_Plan.md`, execute **only that work packet** unless a direct dependency must change for the packet to function.

Do not begin later packets automatically.

## Before coding

Report or determine:

1. What the current code actually does.
2. The root cause or current gap.
3. The smallest safe implementation approach.
4. The files expected to change.
5. The tests/verification required.
6. Any material decision that the work packet leaves genuinely open.

Inspect all files explicitly named in the work packet and trace direct callers/callees, middleware, types, models, configuration, tests, and frontend/backend consumers where relevant.

## During coding

- Keep the change coherent and bounded.
- Follow existing architecture where it is sound.
- Fix the underlying defect, not only the visible symptom.
- Add tests while the behavior is fresh in context.
- Do not perform unrelated cleanup.
- Do not move on to the next work packet.

## After coding

Report:

1. Files changed.
2. Behavior changed.
3. Tests added/updated.
4. Commands run and results.
5. Manual/runtime verification actually performed.
6. Known pre-existing failures separately from new failures.
7. Remaining risk/follow-up.
8. Whether every acceptance criterion is satisfied.

Then stop.

---

# 6. Establish a Baseline Before Editing

Before a meaningful change:

- inspect `git status` if Git is available;
- inspect the current branch;
- note existing local/uncommitted changes;
- run the narrowest relevant baseline test/typecheck/build when practical;
- record failures that already exist.

Do **not** automatically:

- pull;
- rebase;
- merge;
- reset;
- clean;
- stash;
- switch branches;
- discard local changes;
- push.

Those operations can alter or destroy work and require explicit authorization or a clearly established repository workflow.

If pre-existing tests/builds fail, do not quietly repair unrelated code just to obtain a green baseline.

Instead:

1. determine whether the failure is related to the requested work;
2. record it as pre-existing when supported by evidence;
3. proceed with targeted work when it is safe to do so;
4. ensure the requested change does not add new unrelated failures.

If the pre-existing failure blocks reliable verification of the requested work, explain that constraint.

---

# 7. Scope Discipline

PawTag has substantial AI-assisted history. Wide unsupervised changes create risk.

Use this rule:

> **Make the smallest coherent change that solves the real problem.**

A coherent change may span frontend, API, service, model, test, and documentation when the behavior genuinely crosses those layers.

It does **not** mean touching only one file when the contract requires more.

## Required dependency changes

If Task A cannot work safely without changes to B and C, make B and C changes as part of Task A and explain why.

Examples:

- changing an API payload may require shared types and UI updates;
- changing a model invariant may require service validation and tests;
- fixing authorization may require route and service changes;
- changing a cart total contract may require both API and UI updates.

## Adjacent improvements

If you notice an improvement that is useful but not required:

- report it;
- do not implement it unless it is tiny, directly reduces risk, and cannot reasonably be separated.

## Architectural opportunities

Do not initiate framework migrations, large route reorganizations, state-management rewrites, design-system rewrites, or database redesigns as side effects of a focused task.

---

# 8. Do Not Rewrite PawTag Without Evidence

The current monorepo has a workable foundation.

Do not propose or initiate a broad rewrite merely because code is imperfect or AI-generated.

Prefer incremental improvement.

Do not introduce these merely to appear "enterprise":

- microservices;
- Kafka;
- Kubernetes;
- a separate API gateway;
- a new ORM;
- a new frontend framework;
- a new cross-platform UI framework;
- a complex event bus;
- a distributed queue platform;
- a design-system replacement.

Introduce new infrastructure/dependencies only when the current stack cannot safely meet a concrete requirement and the benefit outweighs operational cost.

---

# 9. Repository Architecture

PawTag is a pnpm workspace monorepo.

High-level structure:

```text
apps/
  web/       Customer/public web application
  admin/     Staff/admin application
  finder/    Public finder application
  mobile/    Expo / React Native application

packages/
  api/       Express API, services, integrations, background jobs
  db/        MongoDB / Mongoose models and connection code
  shared/    Shared TypeScript contracts, API helpers, utilities
  ui/        Shared web React components/design primitives

tests/       Root unit/integration/regression/smoke tests
skills/      Repository-local AI/development guidance
scripts/     Utility/build/maintenance scripts
docker/      Container configuration
docs/        Deeper product/engineering/operational documentation
```

Do not duplicate volatile counts in this file. Inspect the repository or current `README.md` if counts matter.

---

# 10. Intended Dependency Direction

Prefer this conceptual direction:

```text
Apps / routes
    ↓
Application services / domain logic
    ↓
Persistence models + external integration adapters
```

Shared packages should hold genuinely shared contracts or foundations, not become dumping grounds.

## Routes/controllers

Routes should primarily:

- authenticate/authorize;
- validate request data;
- parse request context;
- call application/service logic;
- translate known errors into API responses;
- trigger appropriate audit behavior.

Avoid growing business workflows directly inside route files when service extraction materially improves testability or correctness.

Do **not** split large route files purely to reduce line count. Extract boundaries when touching that behavior or when size is causing correctness/security problems.

## Services

Services should own business workflow and invariants.

Do not put browser/display concerns into API services.

Do not let one "god service" absorb unrelated domains just because it is convenient.

## Models

Models should enforce durable schema constraints and useful indexes.

Do not rely solely on Mongoose schema validation for business authorization.

Do not hide complex cross-document business workflows inside model hooks unless there is a strong reason and tests make the behavior obvious.

## Integrations

Stripe, email, SMS, shipping, storage, push, and other third-party calls should be behind understandable adapters/services where practical.

External calls must have explicit failure semantics.

---

# 11. Shared API and Contract Rules

`packages/shared/src/api/` contains shared endpoint/client infrastructure.

For new or changed frontend API calls:

- prefer existing shared endpoint definitions when they cover the route;
- add new shared endpoint definitions when that is the established pattern;
- prefer the shared API client rather than creating ad-hoc Axios clients;
- do not perform a repository-wide migration of old literal endpoints as a side effect of one task.

Shared types must represent reality rather than silence mismatches.

Avoid casts such as:

```ts
value as any
```

at application boundaries.

If web and mobile storage are asynchronous in different ways, design an explicit contract; do not infer async behavior using fragile runtime tricks.

---

# 12. Authentication Rules

Authentication code is high risk.

When changing authentication/session behavior, trace:

- login;
- registration;
- email/phone verification where applicable;
- MFA;
- access-token creation/expiry;
- refresh-token creation, persistence, rotation, and revocation;
- logout;
- password reset/change;
- session invalidation;
- account disable/lockout;
- web storage/cookie behavior;
- mobile SecureStore behavior;
- CSRF implications if cookies are introduced;
- admin authentication separately where applicable.

Never:

- expose secrets/tokens in logs;
- return refresh tokens through unsafe channels without deliberate design;
- weaken rotation/revocation to fix a UX issue;
- assume mobile and browser token storage have identical constraints;
- trust role/permission information supplied by the client.

Authentication proves identity. It does not prove resource ownership.

---

# 13. Authorization and RBAC Rules

Authorization is required independently of authentication.

For protected objects, constrain data access using the authenticated user/role and the resource relationship.

Avoid this unsafe pattern:

```text
lookup by ID
then assume authenticated user may use it
```

Prefer lookups/queries that encode ownership or permission where practical.

Every admin/staff action must use explicit permissions appropriate to the operation.

## Administrators are not automatically omnipotent

Delete the old assumption that "administrators can access everything."

PawTag should follow least privilege.

Different roles may legitimately need different access to:

- refunds;
- payment operations;
- RBAC changes;
- audit/system logs;
- personal customer information;
- Finder/location information;
- production configuration;
- CMS publishing;
- destructive operations;
- support tooling.

A super-admin role, if present, may be broad, but it still must not bypass fundamental safety checks such as payment verification, ownership invariants, audit logging, confirmation requirements, or destructive-data safeguards without a deliberately designed emergency mechanism.

Never add an admin bypass merely because an operation is inconvenient.

---

# 14. Finder Experience Is Launch-Critical

The Finder application is not an ordinary marketing page.

Assume the finder:

- is a stranger;
- is on a phone;
- may have poor signal;
- may be stressed;
- may be in a hurry;
- may deny location permission;
- has no PawTag account;
- has never seen PawTag before.

The primary Finder goal is:

> **Identify the pet, understand the situation, contact/notify the owner safely, optionally share location, and receive clear confirmation.**

## Finder rules

- No account should be required for normal recovery assistance.
- Public responses must use an explicit safe projection/DTO.
- Never expose internal pet/user documents simply because the UI does not display every field.
- Treat precise location as sensitive.
- Require meaningful consent before precise finder location sharing.
- Do not expose unnecessary microchip, veterinary, medical, owner, or internal operational fields.
- Rate limiting/abuse prevention must work in the deployment model.
- CAPTCHA or abuse controls must be implemented end-to-end, not just on one side of the API contract.
- Repeated taps/retries must not create uncontrolled duplicate escalations or notifications.
- Network/location denial must have understandable recovery behavior.
- Finder success should not depend on optional analytics writes completing first.
- Test the Finder under production-like environment semantics.

Do not add complexity that makes a legitimate finder abandon the flow.

---

# 15. Privacy and Sensitive Data

PawTag handles sensitive information, including combinations of:

- owner identity/contact details;
- pet information;
- health/medical information;
- microchip information;
- finder contact details;
- GPS/location information;
- IP-derived location information;
- transaction/order data;
- audit data;
- device/session information.

Apply data minimization.

For any new field or event, ask:

1. Is it necessary?
2. Who can read it?
3. Is it exposed publicly?
4. Is it logged?
5. How long is it retained?
6. Can it be deleted/expired where appropriate?
7. Is it included in exports/backups?

Do not log passwords, raw tokens, payment secrets, full sensitive third-party payloads, or unnecessary precise location.

Technical privacy requirements should be distinguished from legal/privacy advice.

---

# 16. Commerce and Payment Rules

Commerce code is financially sensitive and requires stronger evidence than ordinary CRUD.

Never trust the browser for authoritative values such as:

- product price;
- line total;
- discount amount;
- shipping eligibility;
- tax amount;
- inventory availability;
- membership entitlement;
- order ownership;
- payment status;
- refund amount/eligibility.

The server must calculate/validate authoritative financial values.

## Idempotency

Financial operations must tolerate retries where retries are possible.

Examples:

- payment confirmation;
- webhook processing;
- refund requests;
- cancellation flows;
- inventory reservation/confirmation/release;
- entitlement creation;
- subscription updates.

Define what identifies the same operation and test duplicate execution.

## Stripe

For Stripe integration:

- verify webhook signatures using the unmodified raw request body;
- do not trust client claims that a PaymentIntent succeeded;
- retrieve/verify relevant Stripe state server-side;
- persist third-party identifiers required for reconciliation;
- handle webhook replay safely;
- distinguish test and live environments explicitly;
- fail closed if required live configuration is absent;
- never allow demo/test payment success behavior to activate accidentally in production.

## External calls vs database transactions

Do not assume a database transaction can roll back Stripe/email/shipping/network operations.

Design multi-step commerce workflows as either:

- transactional DB changes with clearly separated external work; or
- persistent state machines with explicit recoverable states and reconciliation.

A customer must not end up permanently in an untraceable state such as:

```text
payment succeeded
order missing
entitlement missing
no repair marker
no alert
```

## Inventory

Inventory logic must be safe under:

- concurrent customers;
- retries;
- partial reservation failure;
- payment failure;
- cancellation;
- refund where stock implications exist;
- process restart.

Do not rely on reading a quantity and then writing it later without concurrency protection when overselling matters.

---

# 17. Database Safety

PawTag uses MongoDB/Mongoose.

Treat database operations as persistent business state, not temporary implementation details.

## Never automatically reseed or reset

Do **not** run destructive seed/reseed/reset/drop operations against an existing developer, staging, or production database unless the founder explicitly authorizes that operation for that environment.

Tests should use isolated test databases/fixtures.

Do not use "seed and reseed everything" as a generic completion step.

## Migrations/data transformations

Before modifying persistent data shape:

- inspect existing documents/model assumptions;
- determine backward compatibility;
- design rollback or safe forward migration;
- ensure deployment ordering works;
- avoid requiring every document to change atomically unless truly needed.

For destructive transformations, require explicit approval.

## Transactions

Use MongoDB transactions selectively where multiple durable database writes form one critical business invariant.

Good candidates include parts of financially important order state.

Do not wrap arbitrary read-heavy workflows in transactions for style.

## Indexes

Add indexes based on real query/uniqueness/concurrency requirements.

Avoid redundant indexes and unbounded indexing of low-value fields.

For unique business constraints, test concurrent/duplicate behavior rather than assuming the index alone explains the user-facing outcome.

---

# 18. Background Jobs and Worker Rules

Process-local `setInterval` jobs are not automatically safe when multiple API instances run.

For every background/scheduled job touched, determine:

- who starts it;
- whether more than one process can start it;
- what unit of work it claims;
- whether claiming is atomic;
- whether execution is idempotent;
- what happens after a crash;
- whether work can overlap;
- retry/backoff policy;
- poison/final-failure behavior;
- audit/alert behavior.

For first MVP, prefer a **single controlled worker process** or simple Mongo-backed atomic leasing where sufficient.

Do not introduce a heavyweight queue platform without a demonstrated requirement.

Externally significant jobs such as refunds, webhook retries, cancellations, shipment operations, escalation notifications, and payment reconciliation require particular care.

---

# 19. Production Configuration Rules

Production must fail closed for critical configuration.

A required integration should not silently fall back to fake/demo success.

Examples of settings that deserve startup validation when the feature is enabled:

- database connection;
- JWT/session secrets;
- Stripe live/test keys and webhook secret;
- payment mode;
- email/SMS provider configuration;
- storage credentials;
- public application URLs;
- trusted proxy configuration where relevant.

## Do not make everything configurable

The old rule "never hardcode business values" was too broad.

Use this principle:

> **Make a value configurable when there is a legitimate operational reason to change it without a deployment. Keep stable invariants/constants in code.**

Appropriate configuration examples:

- shipping threshold;
- tax rate when business/legal requirements may change;
- feature availability;
- notification timing;
- product/business content.

Poor configuration examples:

- fundamental security invariants;
- arbitrary switches that disable ownership checks;
- settings that make live payments silently behave as succeeded;
- options nobody should change during normal operations.

Critical settings should be permissioned, validated, audited, and sometimes intentionally non-editable in production.

---

# 20. Secrets and Environment Files

Never commit secrets.

Do not print secrets in command output, logs, screenshots, summaries, or tests.

Treat these as sensitive:

- API keys;
- Stripe secrets;
- JWT/session secrets;
- database credentials;
- email/SMS provider secrets;
- storage credentials;
- signing keys;
- refresh/access tokens;
- webhook secrets.

When adding environment variables:

- add safe example/documentation entries where appropriate;
- validate required variables;
- distinguish required from feature-conditional variables;
- do not invent insecure defaults for production.

---

# 21. Error Handling

Errors should be explicit and useful without leaking sensitive implementation detail.

Do not:

- swallow errors silently;
- `catch` and return success when required work failed;
- log an error and continue if the failed step violates a business invariant;
- expose raw stack traces or secrets to users;
- collapse all failures into generic 500 responses when clients need a safe actionable distinction;
- use giant defensive `try/catch` blocks that hide which operation failed.

Classify failures where it helps recovery:

- validation;
- authentication;
- authorization;
- not found;
- conflict/idempotency;
- unavailable dependency;
- retryable external failure;
- permanent business-rule failure.

User-facing messages should be clear and non-technical.

Operational logs should preserve enough context to diagnose the failure safely.

---

# 22. Logging, Audit, and Observability

Logging and audit trails serve different purposes.

## Operational logging

Use structured logging with useful context such as:

- request/correlation ID;
- user/admin ID where safe;
- order/payment IDs;
- job/work-item IDs;
- third-party event IDs.

Avoid sensitive payloads.

## Audit logging

Audit events are important for actions such as:

- refunds;
- cancellations;
- role/permission changes;
- destructive admin operations;
- security setting changes;
- production integration setting changes;
- sensitive data access where required;
- critical workflow state changes.

Audit records should capture who/what/when and enough before/after context to understand the action.

Do not treat a normal log line as a substitute for a durable audit event where auditability is required.

## Observability

A feature is not operationally safe merely because it logs errors.

For launch-critical failures, ensure there is an actionable path:

```text
failure → persistent evidence → alert/queue/report → owner → recovery action
```

---

# 23. UI/UX Product Principles

PawTag should feel:

- trustworthy;
- calm;
- modern;
- premium without being flashy;
- understandable to non-technical users;
- forgiving of mistakes;
- transparent around money and sensitive actions.

Premium UX comes from hierarchy, clarity, feedback, confidence, and polish—not decorative effects.

## General rules

- One dominant action per decision point where possible.
- Clear hierarchy before extra color.
- Explain consequences before destructive actions.
- Show progress for meaningful async work.
- Show useful empty states.
- Show recoverable errors with an action the user can take.
- Preserve entered data after recoverable errors when safe.
- Do not make users decode internal system terminology.
- Use consistent date, currency, status, button, form, toast, modal, and confirmation conventions.
- Prefer inline validation near the relevant control.
- Avoid surprise navigation.
- Avoid unnecessary modals when an inline interaction is clearer.

---

# 24. Cart UX Direction

PawTag's cart direction is deliberate and should not regress to a single flat-column desktop experience.

## Mini-cart drawer

The existing cart drawer should evolve into a **mini-cart** used for:

- immediate confirmation after add-to-cart;
- quick quantity/remove actions;
- a compact subtotal;
- short stock/price issue warnings;
- links to "View cart" and "Checkout" where appropriate.

It should not carry the entire premium commerce experience.

The drawer must behave as an accessible dialog/drawer:

- semantic dialog treatment;
- focus management/trap where appropriate;
- Escape close;
- focus restoration;
- accessible names for icon buttons;
- keyboard-operable quantity controls;
- reduced-motion support.

## Full cart page

The primary desktop cart experience should use approximately a **70/30 layout**:

```text
┌──────────────────────────────────────┬───────────────────────┐
│                                      │                       │
│  ~70% Cart items / details /         │  ~30% Sticky order   │
│  customisation / messages            │  summary             │
│                                      │                       │
│                                      │  totals / benefits    │
│                                      │  CTA                  │
└──────────────────────────────────────┴───────────────────────┘
```

The right summary should remain visible on suitable desktop heights without overlapping footers or becoming impossible to scroll.

The 70/30 ratio is a design target, not a rigid mathematical rule at every viewport.

## Product line-item expectations

A line item should clearly communicate:

- high-quality product image;
- product name;
- variant/options;
- engraving/customisation;
- per-unit price;
- customisation surcharge where applicable;
- quantity control;
- line total;
- stock/status issue;
- remove action.

Do not hide meaningful customisation charges in an unexplained total.

## Sticky summary expectations

The summary should explain, where applicable:

- subtotal;
- discount/promo;
- Guardian/Gold benefit;
- shipping or how shipping will be calculated;
- GST/tax statement;
- savings;
- total/estimated total;
- dominant checkout CTA;
- small trust/reassurance content that is genuinely useful.

Do not fabricate totals client-side if the server owns pricing authority.

## Responsive behavior

- Desktop: 70/30 premium layout.
- Tablet: adaptive two-column layout where readable, otherwise collapse deliberately.
- Mobile: purpose-designed single column; do **not** squeeze 70/30 onto a narrow screen.
- Mobile may use a sticky bottom checkout/total action if it improves access without obscuring content.

## Cart motion

Use motion only to explain state:

- drawer entry/exit;
- item added;
- item removed/collapsed;
- quantity/price transition;
- validation/state change.

Respect reduced-motion preferences.

Avoid decorative animation that delays checkout or makes totals feel unstable.

---

# 25. Checkout UX Rules

Checkout is a confidence flow, not a showcase.

The customer should always understand:

- what they are buying;
- shipping destination;
- shipping method/cost;
- discount/membership benefit;
- total and tax treatment;
- what happens after payment;
- whether payment succeeded;
- what to do if confirmation fails after payment.

Do not clear critical user-entered state prematurely.

Do not show a success screen based only on optimistic client state.

When decomposing the large checkout implementation, split by business responsibility rather than creating dozens of tiny presentational files.

A reasonable direction is:

- cart/order review;
- address/contact;
- shipping;
- rewards/promo;
- payment;
- confirmation/recovery.

The orchestration layer should remain understandable.

---

# 26. Customer Web UX Rules

The customer portal should prioritize the core PawTag journey:

- account;
- pet;
- tag;
- lost/recovery;
- orders;
- necessary subscription/account settings.

For every changed screen check:

- loading state;
- empty state;
- error state;
- success state;
- mobile responsiveness;
- keyboard use;
- labels/help text;
- destructive confirmation;
- retry/recovery.

Do not surface internal IDs, enum jargon, or technical failure details unless genuinely useful.

---

# 27. Admin UX and Safety

Admin is primarily a desktop operational tool.

Do not spend first-MVP effort making every admin workflow perfect on small phones unless there is a real operational need.

Prioritize:

- information density;
- clear tables/filters/search;
- safe forms;
- explicit permissions;
- auditability;
- destructive-action confirmation;
- financial-operation traceability;
- clear status/history;
- error recovery.

## High-risk admin actions

Treat these as high risk:

- refunds;
- payment adjustments;
- cancellation with financial effect;
- role/permission changes;
- user impersonation if present;
- deleting/merging important records;
- production integration changes;
- test/live payment-mode changes;
- bulk changes;
- CMS publication affecting critical flows;
- security configuration.

For high-risk actions, prefer:

- explicit permission;
- clear confirmation explaining consequence;
- server-side revalidation;
- optional reason/note where operationally useful;
- durable audit record;
- idempotency for retryable financial actions.

Do not assume "admin" means "skip all checks."

---

# 28. Accessibility Rules

Accessibility is part of correctness.

For web/finder/admin UI changes, inspect:

- semantic HTML;
- labels and descriptions;
- keyboard navigation;
- focus indicators;
- focus management in dialogs/drawers;
- accessible names for icon-only controls;
- form error associations;
- status/error live regions where appropriate;
- contrast;
- touch target size;
- heading hierarchy;
- reduced motion;
- loading-state accessibility.

Do not solve accessibility only with `aria-*` attributes when native semantic elements are available.

For mobile, also consider:

- screen-reader labels/hints;
- touch targets;
- dynamic text where supported;
- keyboard avoidance;
- safe areas;
- permission-denied flows.

---

# 29. Design System and Cross-Platform Strategy

Do not attempt 100% literal UI component sharing between React DOM and React Native merely because both use React.

Target shared foundations:

- design tokens;
- colors;
- typography definitions;
- spacing/radius/motion values;
- icons/assets where technically appropriate;
- API contracts;
- validation;
- formatting;
- business rules;
- state machines;
- headless hooks when platform-neutral;
- component contracts/specifications.

Keep platform-specific rendering where appropriate:

- web DOM components;
- native navigation;
- camera;
- NFC;
- push notifications;
- permissions;
- secure storage;
- native gestures/pickers;
- app lifecycle/deep links.

`packages/ui` should remain the web shared-component library unless a deliberate approved architecture change says otherwise.

The planned direction is to strengthen platform-neutral design tokens rather than force web components into React Native.

Do not introduce React Native Web, Tamagui, NativeWind, gluestack, or another UI framework solely for theoretical reuse.

---

# 30. Mobile Rules

Mobile must be treated as a real native client, not a web clone.

When changing mobile behavior, consider:

- SecureStore/token lifecycle;
- Expo/environment configuration;
- navigation/deep links;
- camera permissions;
- QR scanning;
- NFC support and NDEF decoding;
- push permissions/token registration;
- Android/iOS differences;
- network interruption;
- offline/retry behavior;
- app background/foreground transitions;
- keyboard behavior;
- safe areas;
- real-device testing.

Do not claim camera, NFC, push, or deep-link behavior works solely from static code or simulator behavior where physical-device verification is required.

If mobile is not part of the controlled first-customer launch, do not let mobile work block launch-critical web/Finder hardening unless shared code is affected.

---

# 31. Coding Practices

Write clear TypeScript that makes contracts visible.

Prefer:

- small cohesive functions;
- descriptive names;
- explicit domain types;
- early validation;
- clear service boundaries;
- reuse of real shared concepts;
- predictable error handling;
- comments explaining **why**, not narrating obvious code.

Avoid:

- giant new functions;
- giant new components;
- speculative abstractions;
- wrappers that only rename another function;
- excessive context providers;
- deeply nested conditional JSX;
- business rules duplicated in multiple clients;
- magic strings for domain states when a shared type/enum already exists;
- copy-paste services that differ only slightly;
- broad casts;
- swallowed promises/errors;
- unbounded database queries;
- N+1 patterns in high-traffic endpoints;
- mutable module-global state for request/business data.

---

# 32. `any`, Type Assertions, and Boundary Safety

`any` is not automatically forbidden, but using it to hide uncertainty at critical boundaries is forbidden.

Be especially strict around:

- API request/response data;
- token/session storage;
- Stripe payloads;
- database result transformation;
- finder public DTOs;
- permissions;
- order/pricing models;
- native module results;
- environment/config values.

Prefer runtime validation or well-defined types.

If a third-party library is poorly typed, isolate the cast at the integration boundary and document why it is safe.

Do not spread the cast throughout business logic.

---

# 33. Async and Concurrency Rules

For async code:

- await required operations;
- explicitly decide whether non-blocking work may fail without invalidating the operation;
- never mark financially/business-critical work "non-blocking" without persistent recovery semantics;
- use `Promise.all` only when operations are genuinely independent;
- avoid accidental duplicate requests from React effects;
- guard stale UI responses where races are possible;
- do not infer async interfaces via function constructor names or other fragile runtime reflection.

For concurrency:

- reason about two requests arriving at the same time;
- use atomic database operations/unique indexes/transactions/leases where the invariant requires it;
- test concurrency for inventory, idempotency, claims, and financial workflows where relevant.

---

# 34. React Rules

For React web apps:

- keep server authority separate from optimistic display state;
- avoid storing derived values unnecessarily;
- avoid effects that duplicate event-handler logic;
- verify effect dependency arrays;
- clean up subscriptions/timers/listeners;
- use stable query/cache patterns already present in the app;
- avoid global state for local component concerns;
- avoid prop-drilling only when a clearer shared boundary exists;
- preserve form data through recoverable failures;
- do not use UI state as an authorization mechanism.

Large pages should be decomposed when doing so clarifies business responsibilities and reduces regression risk.

Do not split every visual fragment into its own file for the sake of component count.

---

# 35. API Input Validation

All public or privileged mutation endpoints should validate input server-side.

Prioritize rigorous validation for:

- authentication;
- Finder submissions;
- checkout/payment/refund/cancellation;
- subscriptions;
- uploads;
- profile/contact changes;
- admin destructive/financial actions;
- settings/integrations.

Validation should cover shape and relevant business constraints.

Do not assume TypeScript types validate runtime JSON.

Prefer existing Zod/validation patterns where they fit.

Do not perform a broad validation-library migration as part of one endpoint fix.

---

# 36. HTTP/API Behavior

Use clear, consistent status semantics.

Examples:

- `400` malformed/invalid request;
- `401` unauthenticated;
- `403` authenticated but not authorized;
- `404` safely not found;
- `409` conflict/idempotency/state collision where appropriate;
- `422` only if that convention is established for semantic validation;
- `429` rate limited;
- `5xx` server/dependency failure.

Do not expose whether a sensitive resource exists when doing so creates enumeration risk.

Pagination/filter/sort must be bounded for potentially large collections.

Do not add API versioning merely because it is theoretically desirable unless an actual compatibility requirement exists.

---

# 37. File Upload and Media Rules

When touching uploads/media:

- validate type and size server-side;
- do not trust browser MIME type alone;
- use generated/safe object keys;
- avoid path traversal;
- validate image/document processing inputs;
- restrict access appropriately;
- use signed/private access where required;
- do not expose storage secrets;
- define deletion/cleanup semantics;
- consider orphan files after partial failures.

---

# 38. Testing Philosophy

PawTag should optimize for **risk coverage**, not test-count vanity.

The old instruction "every function must have its own test" is removed.

Tests should protect behavior and contracts.

## Bug fixes

Preferred pattern:

```text
reproduce/understand defect
    ↓
add failing regression test when practical
    ↓
implement fix
    ↓
prove regression test passes
    ↓
run affected suite(s)
```

A regression test should fail for the original bug and pass for the correct behavior.

## New behavior

Test:

- normal success;
- important validation/failure paths;
- authorization/ownership where relevant;
- idempotency/concurrency where relevant;
- production-only configuration behavior where relevant.

Do not create low-value tests solely to satisfy a numeric expectation.

---

# 39. Test Layers

Use the narrowest useful layer, plus cross-layer tests where the risk crosses boundaries.

## Unit tests

Useful for:

- pure calculations;
- formatting;
- isolated validation/business rules;
- deterministic state transitions.

## Integration tests

Useful for:

- Express route + middleware + service behavior;
- database persistence/index behavior;
- auth/authorization;
- commerce workflows;
- webhook processing with representative signed payload handling;
- job claim/retry behavior.

## Browser E2E

Critical PawTag workflows cross frontend/API/database boundaries. Browser E2E is required for launch-critical web journeys.

High-value scenarios include:

- registration/verification/login;
- pet creation;
- tag activation;
- mark lost;
- Finder scan/notify;
- owner recovery acknowledgement;
- cart → checkout → order confirmation;
- selected cancellation/refund flows if enabled for launch.

Production-like environment semantics must be represented, especially for configuration-dependent behavior such as CAPTCHA/security.

## Mobile E2E / real device

Camera/NFC/push/deep-link behavior requires mobile-specific validation.

Do not claim native readiness from TypeScript unit tests alone.

---

# 40. Testing Commands

Use root scripts where appropriate:

```bash
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:smoke
pnpm test:regression
pnpm test:all
pnpm typecheck
pnpm lint
pnpm build
```

For a focused task, run targeted tests first.

Then broaden verification based on blast radius.

Do not blindly run the entire suite after every one-line change if a targeted cycle provides faster evidence during development; however, before declaring a launch-critical work packet complete, run the broader applicable gates required by the packet/CI.

Never report a command as passing unless it was actually run and exited successfully.

Never claim manual testing that was not performed.

---

# 41. Pre-Existing Failures

A pre-existing failure is not permission to ignore quality, and it is not permission to alter unrelated functionality.

Report pre-existing failures separately:

```text
Pre-existing failure:
- command/test:
- observed error:
- evidence it predates this change:
- impact on verification:
```

If your change causes a new failure, fix it before calling the task complete.

If an unrelated pre-existing failure prevents a full build, still run all narrower checks that can validate your change and clearly state the limitation.

---

# 42. Do Not Cheat Tests

Never make tests green by:

- weakening assertions without product justification;
- deleting tests for required behavior;
- marking tests skipped;
- dramatically increasing timeouts to hide races;
- mocking away the behavior under test;
- forcing implementation details solely to satisfy a brittle test;
- changing production behavior to match an incorrect fixture without validating reality.

When a test is wrong because intended behavior changed, update the test and explain the product/contract change.

---

# 43. Manual Verification

Manual verification is valuable for UX and integrations but must be reported honestly.

If the environment allows it, verify changed user journeys.

For UI work, check relevant viewport classes and interactions.

For native behavior, distinguish simulator/emulator testing from physical-device testing.

For external providers, distinguish mocked/test-mode validation from actual provider sandbox/test-environment validation.

Never write "manually tested" when you only read code.

---

# 44. Dependency Management

Do not add dependencies casually.

Before adding one:

1. confirm the existing stack cannot reasonably solve the requirement;
2. check maintenance/security implications;
3. prefer small established dependencies over large frameworks for narrow needs;
4. ensure package placement is correct in the workspace;
5. update lockfiles intentionally;
6. add required tests/configuration.

Do not upgrade unrelated dependencies during a focused work packet unless required for a security/correctness issue in scope.

Do not run broad package-upgrade commands as cleanup.

---

# 45. Build and Formatting Discipline

Match repository formatting/lint conventions.

Do not reformat unrelated files.

Avoid changes that create huge diffs from line-ending/formatter churn.

Build the packages/apps affected by the change.

Run a root build when the work packet or blast radius justifies it.

A successful TypeScript compile is not proof of runtime correctness.

---

# 46. Git Safety

Use Git as evidence and history, not as an automatic action machine.

## Safe read operations

Normally safe:

```text
git status
git branch --show-current
git diff
git log
```

## Operations requiring explicit authorization or established task instruction

Do not automatically:

- pull;
- fetch-and-reset;
- merge;
- rebase;
- stash;
- clean;
- reset;
- switch branches;
- force checkout files;
- commit;
- push;
- force push;
- tag releases.

If asked to commit, create one logical commit per work packet where practical.

Use meaningful messages, e.g.:

```text
fix finder production notification captcha flow
harden stripe webhook raw body verification
prevent cross-user checkout confirmation
add premium cart page and sticky order summary
```

Never claim a commit/push occurred if it did not.

---

# 47. Destructive Operations

Never perform a destructive operation merely because it is convenient.

Require explicit approval for actions such as:

- dropping databases/collections;
- reseeding non-disposable environments;
- deleting user/order/payment data;
- force-resetting Git state;
- rotating real secrets;
- deleting cloud objects;
- mass account changes;
- bulk refunds/cancellations;
- changing live payment mode;
- production migrations with irreversible loss.

For destructive actions, explain impact and recovery/rollback first.

---

# 48. External Integrations

For Stripe/email/SMS/shipping/storage/push/geolocation and other integrations:

- identify sandbox/test vs production behavior;
- validate credentials/config separately;
- use timeouts where appropriate;
- define retry/idempotency expectations;
- persist important provider IDs/status;
- avoid logging secrets/raw sensitive payloads;
- handle rate limits/unavailability;
- do not assume provider success because an SDK call did not throw;
- reconcile financially important provider state.

When external calls are mocked in tests, add at least one appropriate integration-level contract or staging verification for launch-critical behavior.

---

# 49. Time and Timezone Rules

Store/compare machine timestamps in UTC unless there is a deliberate reason otherwise.

Do not encode fixed UTC offsets for named timezones such as New Zealand.

Use timezone-aware handling for business schedules, daylight saving, invoices, reminders, reports, and reconciliation windows when local calendar time matters.

Test daylight-saving boundaries for important scheduled financial/operational behavior.

---

# 50. Performance Rules

Do not optimize prematurely, but do not ignore obvious production hazards.

Prioritize performance for:

1. Finder initial response;
2. authentication;
3. product/cart/checkout;
4. core customer dashboard/pets;
5. high-use admin tables.

Watch for:

- unbounded queries;
- unnecessary `populate` chains;
- N+1 requests/queries;
- large public payloads;
- synchronous analytics writes on latency-critical routes;
- duplicated client fetches;
- avoidable bundle size;
- full-resolution images where thumbnails suffice;
- expensive computations on every render/request.

Only add caching when invalidation rules are understood.

---

# 51. Security Review Checklist for Every Relevant Change

Ask:

- Who can call this?
- How is identity established?
- How is ownership/permission established?
- Can the caller change an ID and access someone else's object?
- Is runtime input validated?
- Can retries duplicate the effect?
- Is sensitive data returned/logged?
- Does this trust browser state that the server should own?
- Does it work differently in production?
- Is rate limiting meaningful in the deployed topology?
- Does an error disclose sensitive existence/details?
- Is a destructive/financial action audited?

Do not treat this checklist as proof; trace the code.

---

# 52. AI-Generated Code Smells to Actively Look For

Because PawTag has been heavily AI-assisted, actively inspect for:

- duplicate implementations of the same rule;
- almost-identical components/services;
- abstractions that add indirection without reducing complexity;
- comments confidently describing behavior the code does not enforce;
- large functions/pages that accumulated features;
- `as any` hiding interface mismatches;
- frontend validation without backend enforcement;
- backend assumptions that the frontend already validated something;
- fake/demo fallbacks surviving production paths;
- TODOs inside apparently complete workflows;
- error swallowing;
- non-blocking critical operations with no repair path;
- hard-coded environment assumptions;
- repeated literal endpoint strings;
- inconsistent state/enum terminology;
- multiple sources of truth for price/status/role;
- overly defensive code masking impossible/invalid states instead of fixing design;
- tests that only verify mocks rather than business outcomes.

Do not "clean up AI smells" repository-wide. Fix them where they create current risk or are directly in the work packet.

---

# 53. Comments and Documentation

Comments should explain non-obvious intent, constraints, or tradeoffs.

Bad comment:

```ts
// Get user
const user = await ...
```

Useful comment:

```ts
// Use the authenticated user's persisted ID here; refresh-token rotation
// does not change account ownership.
```

But comments do not create truth. If code and comment conflict, fix the implementation and comment together.

Update documentation when behavior, setup, architecture, environment variables, or operational instructions materially change.

Do not duplicate huge volatile inventories across README, AGENTS, and docs.

---

# 54. README vs AGENTS vs Master Plan

Keep responsibilities clear.

## `README.md`

Answers:

> What is PawTag, how is the repository structured, how do I run it, and what is its current readiness?

## `AGENTS.md`

Answers:

> How must an AI/developer behave while changing PawTag?

## `PawTag_MVP_Master_Implementation_Plan.md`

Answers:

> What must we change before first real customers, in what order, and what must each work packet prove?

## Source code and tests

Answer:

> What actually happens right now?

Do not turn `AGENTS.md` back into a second giant product/API reference manual.

---

# 55. Repository-Local Skills

OpenCode is configured to load repository-local skills from:

```text
skills/
```

Skills are specialist playbooks. They do **not** replace this file and they do **not** redefine product truth.

## Instruction precedence

When guidance conflicts, use this order:

```text
1. Actual security/data-integrity constraints and current source behavior
2. AGENTS.md global engineering/safety rules
3. The explicitly requested MVP master-plan work packet
4. Relevant repository-local SKILL.md playbooks
5. README.md and other documentation
```

Documentation never overrides contradictory runtime behavior. A skill must never be used to bypass a stricter safety rule in `AGENTS.md`.

## Available specialist skills

Use only the skills relevant to the current task:

```text
skills/work-packet-executor/          One-work-packet execution discipline
skills/production-readiness-review/  Implemented vs genuinely production-ready
skills/security-boundary-review/     Auth, ownership, RBAC, privacy, sensitive resources
skills/commerce-safety/               Stripe, checkout, orders, inventory, refunds, subscriptions
skills/finder-recovery/               Lost-pet Finder flow, privacy, abuse controls, recovery UX
skills/cart-checkout-experience/      Mini-cart + premium full cart/checkout experience
skills/pawtag-ui-ux/                  PawTag design system, accessibility, responsive UX
skills/mobile-native/                 Expo/RN, SecureStore, QR, NFC, push, native validation
skills/database-integrity/            Mongo/Mongoose, transactions, indexes, concurrency
skills/background-jobs/               Jobs, leases, retries, idempotency, worker safety
skills/testing-regression/            Risk-based regression, integration and E2E testing
skills/api-architecture/              Routes, services, validation, shared API contracts
skills/coding-practice/               Type safety, abstractions, React/async maintainability
skills/release-readiness/             Staging and first-customer launch gates
```

## Skill selection rules

For a master-plan implementation packet, normally use:

```text
work-packet-executor
+ the relevant domain skill(s)
+ testing-regression
```

Examples:

### Stripe webhook or checkout safety

```text
work-packet-executor
commerce-safety
security-boundary-review      # when ownership/auth boundaries are touched
testing-regression
production-readiness-review   # before claiming completion/readiness
```

### Finder change

```text
work-packet-executor
finder-recovery
pawtag-ui-ux                  # when UI/interaction changes
testing-regression
production-readiness-review
```

### Cart redesign

```text
work-packet-executor
cart-checkout-experience
pawtag-ui-ux
testing-regression
```

### Mobile QR/NFC/auth

```text
work-packet-executor
mobile-native
security-boundary-review      # for auth/storage changes
testing-regression
```

### Database/background-job change

```text
work-packet-executor
database-integrity
background-jobs               # when scheduled/worker behavior is involved
testing-regression
```

## Do not over-load skills

Do not load every skill for every task. Use the smallest relevant set so instructions remain focused and do not consume unnecessary model context.

## Skills are guidance, not proof

A skill can describe the desired engineering method. It does not certify that the current code follows that method.

Always inspect the actual implementation before editing or making readiness claims.

## Maintaining skills

When architecture or product rules materially change:

1. update `AGENTS.md` if the change affects global engineering policy;
2. update the relevant skill if the change affects a specialist workflow;
3. update the master plan if sequencing or launch requirements change;
4. update `README.md` if the repository/current-state description changes.

Do not duplicate volatile repository counts or giant feature inventories inside skills. Keep skills compact and procedural.

---
# 56. Development Commands

Common root commands:

```bash
pnpm dev:api
pnpm dev:admin
pnpm dev:web
pnpm dev:finder
pnpm dev:all

pnpm build
pnpm build:api
pnpm build:admin
pnpm build:web
pnpm build:finder
pnpm build:shared
pnpm build:db

pnpm typecheck
pnpm lint

pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:smoke
pnpm test:regression
pnpm test:all
pnpm test:coverage
```

Inspect the relevant package's `package.json` before assuming an app-specific command exists.

Do not start persistent dev servers unnecessarily during automated work if targeted tests/builds are sufficient.

---

# 57. First-Customer Launch Priorities

When choosing between competing improvements, prioritize the business loop:

```text
customer acquires/activates tag
        ↓
pet is linked correctly
        ↓
pet is lost
        ↓
finder scans tag
        ↓
finder sees safe useful information
        ↓
finder notifies owner
        ↓
owner receives actionable notification
        ↓
pet recovery is confirmed
```

And, where commerce is enabled:

```text
customer adds correct product
        ↓
server calculates trustworthy totals
        ↓
payment succeeds exactly once
        ↓
order is durable/recoverable
        ↓
inventory is correct
        ↓
tag/subscription entitlement is correct
        ↓
operations can reconcile exceptions
```

Features that do not materially strengthen these loops should not displace safety/reliability work before MVP.

---

# 58. Scope Guidance for MVP

## Core

Treat these as first-customer critical when enabled:

- account/authentication;
- pet profiles;
- tag activation;
- lost/recovery;
- Finder;
- owner notifications;
- basic commerce/checkout/order correctness;
- minimum safe admin operations;
- monitoring/audit/recovery for critical failures.

## Supporting

May be simplified if necessary:

- Guardian/Gold;
- loyalty/rewards;
- shipping automation;
- CMS sophistication;
- notification preference depth.

## Usually deferable when not commercially required for first launch

- advanced referrals;
- extensive marketing/CMS flexibility;
- elaborate accounting automation;
- deep analytics;
- affiliate/marketplace concepts;
- advanced mobile parity with every web feature.

Do not delete deferred features casually. Hide/disable safely when appropriate and documented.

---

# 59. Definition of Done for a Normal Work Packet

A work packet is complete only when all applicable items are true:

- current behavior/root cause was understood before editing;
- implementation matches the requested scope;
- security/authorization/privacy implications were considered;
- data integrity is preserved;
- frontend/backend/shared contracts are consistent;
- affected error/failure paths are handled;
- tests appropriate to the risk exist;
- new regression test catches the original defect where applicable;
- targeted tests pass;
- broader required tests/typecheck/build pass or pre-existing failures are clearly separated;
- manual/runtime checks actually performed are reported;
- documentation/config examples are updated where required;
- no demo/mock fallback was introduced into production;
- no unrelated refactor was smuggled into the task;
- no destructive database/Git action occurred without authorization;
- every work-packet acceptance criterion is addressed;
- remaining risk is explicitly stated.

Do not declare "production-ready" merely because code compiles and tests pass.

---

# 60. Definition of Done for a Critical Security/Payment/Finder Fix

For launch-critical fixes, additionally require:

- a regression test for the defect or a documented reason one cannot be automated;
- production-like configuration behavior tested where relevant;
- negative/abuse path tested;
- duplicate/retry behavior tested where relevant;
- ownership/authorization explicitly tested;
- sensitive response/logging reviewed;
- external-provider behavior validated at the highest practical test level;
- recovery/operational visibility confirmed for partial failures.

Examples:

## Finder fix

Prove:

- normal finder succeeds;
- abuse controls do not break normal production flow;
- denied location still works;
- repeated submission does not create uncontrolled duplication;
- public payload contains only approved data.

## Payment fix

Prove:

- webhook signature validation works;
- duplicate provider event is safe;
- wrong user cannot confirm/use another user's payment state;
- client price/status tampering cannot override server truth;
- paid-but-partially-failed flow is durable and repairable.

---

# 61. Do Not Claim Verification You Did Not Perform

Use precise language.

Good:

> Unit and integration tests passed. I did not run a real Stripe webhook against staging.

Bad:

> Stripe is fully verified.

Good:

> The mobile QR handler is corrected and unit-tested; physical-device QR scanning remains to be validated.

Bad:

> Mobile QR is production-ready.

Evidence over confidence.

---

# 62. Communication With the Founder

Use plain English first, technical detail second.

For important changes, explain:

1. What was wrong/needed.
2. Why it mattered.
3. What changed.
4. What was tested.
5. What remains uncertain.
6. Whether the founder needs to make a product/business decision.

Do not bury a critical risk in a long changelog.

Do not use reassuring language unsupported by verification.

---

# 63. Final Work Summary Template

Use a concise structure similar to:

```text
Work packet: <number/title>
Status: Complete / Partial / Blocked

What changed
- ...

Why
- ...

Files changed
- ...

Tests/verification
- command — PASS/FAIL
- command — PASS/FAIL
- manual check — performed/not performed

Acceptance criteria
- [x] ...
- [x] ...
- [ ] ... (reason)

Pre-existing issues
- ...

Remaining risks/follow-up
- ...

Git
- branch/status
- commit/push only if actually performed and authorized
```

Do not hide partial completion behind a "done" label.

---

# 64. Critical Prohibitions

Unless the founder explicitly requests it and the operation is safe for the environment, **do not**:

- reseed/reset/drop a persistent database;
- delete production/staging data;
- weaken ownership or authorization;
- make admins globally unrestricted;
- bypass payment verification;
- disable webhook signature validation;
- trust browser price/payment/role state;
- introduce fake success in production paths;
- expose internal Finder/customer data publicly;
- log secrets/tokens/passwords;
- use `as any` to suppress a design mismatch at a critical boundary;
- skip/delete failing tests just to pass CI;
- automatically fix every unrelated pre-existing problem;
- refactor unrelated modules during a work packet;
- add a framework/platform migration opportunistically;
- introduce unnecessary infrastructure;
- pull/rebase/reset/clean/stash/push Git automatically;
- claim physical-device/manual/provider verification that did not occur;
- call PawTag production-ready based solely on feature count or code presence.

---

# 65. Preferred Decision Heuristic

When choosing between two technically acceptable approaches, prefer the one that:

1. preserves safety;
2. creates the fewest new moving parts;
3. uses the existing stack well;
4. is easiest to test;
5. produces clear failure states;
6. is understandable by the next engineer/model;
7. can be changed later without data migration pain;
8. avoids speculative future-scale complexity.

---

# 66. Examples of Good vs Bad AI Behavior

## Example: checkout ownership issue

Bad:

> The user-scoped lookup failed, so I added a fallback lookup by payment ID to improve reliability.

Good:

> The user-scoped lookup failed. I traced why. Account ownership must remain enforced, so I fixed the incorrect lookup/state transition rather than widening access.

## Example: production CAPTCHA mismatch

Bad:

> CAPTCHA blocks the Finder flow, so I disabled it in production.

Good:

> The backend requires CAPTCHA in production but the Finder client does not satisfy the contract. I implemented the abuse-control contract end-to-end and tested the production-like path.

## Example: cart redesign

Bad:

> I made the drawer wider, added gradients, shadows, and animation.

Good:

> I kept the drawer focused as a mini-cart and built the full cart around a responsive 70/30 information architecture with a sticky summary, clear customisation, server-authoritative totals, accessible controls, and purposeful motion.

## Example: failing root build

Bad:

> I fixed six unrelated files until the entire repo was green.

Good:

> The root build has two pre-existing unrelated failures. The affected package builds and targeted tests pass; I documented the unrelated failures separately without changing them.

## Example: new business setting

Bad:

> I put every numeric value in the settings collection because business values must never be hardcoded.

Good:

> I made the value configurable only because operations need to change it without deployment. The invariant remains in code and the setting is validated/audited.

---

# 67. Production Readiness Is a System Property

A feature is not ready merely because each piece exists.

For a critical feature, trace:

```text
UI event
  → client validation/state
  → network request
  → middleware
  → authentication/authorization
  → runtime validation
  → service/business rule
  → database state
  → external provider
  → retries/failures
  → logs/audit/alerts
  → user-visible success/failure
```

If one link is missing, the feature may be complete in code count but not production-ready.

This principle is especially important for:

- Finder notification/recovery;
- tag activation;
- authentication;
- checkout;
- Stripe webhooks;
- refunds/cancellations;
- subscriptions;
- inventory;
- background jobs;
- mobile native features.

---

# 68. Work in Production-Like Conditions Before Launch

Where behavior differs by environment, test the environment-specific path deliberately.

Examples:

- `NODE_ENV=production` conditional behavior;
- CAPTCHA;
- cookie security attributes;
- proxy/IP handling;
- CORS/CSRF;
- Stripe webhook parsing;
- production configuration validation;
- build-time frontend variables;
- worker process ownership;
- Docker/workspace installation;
- secure URLs/domains.

A development-mode success does not prove production-mode success.

---

# 69. First Real Customer Standard

Before PawTag is presented as ready for a controlled real customer, the implementation must demonstrate that:

- a customer can register/authenticate reliably;
- a pet can be created and linked to a valid tag;
- lost mode can be activated correctly;
- a stranger can scan the tag without an account;
- Finder data exposure is intentional and minimal;
- the finder can notify the owner under production-like abuse controls;
- owner recovery can be completed reliably;
- a real enabled checkout cannot be manipulated by the client;
- payment state is validated server-side;
- webhooks are authenticated and idempotent;
- paid orders are durable or automatically repairable;
- inventory cannot trivially oversell under concurrent purchase;
- refunds/cancellations are safe and auditable where enabled;
- background financial/customer work cannot duplicate unpredictably across processes;
- backups have a proven restore path;
- critical failures generate actionable operational signals;
- deployment/rollback has been rehearsed;
- critical browser journeys have E2E coverage;
- native features have physical-device validation if mobile is part of launch.

This standard is about reasonable MVP risk, not perfection.

---

# 70. Final Principle

When working on PawTag, continually ask:

> Does it actually work end to end?
>
> Is it safe?
>
> Is the data reliable?
>
> Can the user understand what happened?
>
> Can a stranger successfully help a lost pet?
>
> Can a customer pay without creating unrecoverable financial state?
>
> Can PawTag staff operate the system without dangerous accidental actions?
>
> Can another engineer or AI model understand and maintain this change?

If the answer is uncertain, investigate and state the uncertainty.

Do not confuse feature volume with production readiness.

**Make PawTag safer one verified work packet at a time.**
