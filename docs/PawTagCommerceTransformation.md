# PawTag Commerce Transformation — Autonomous Phased Implementation Plan

You are working on the PawTag repository:

Your mission is to transform PawTag's existing commerce functionality into a **fully custom, first-party PawTag Commerce system**, built directly into the existing application architecture.

The business operates in **New Zealand**.

I am the **Product Owner, Subject Matter Expert, Vision Holder and Business Decision Maker**. I am not a software engineer. You are responsible for the technical architecture and implementation decisions, while keeping me informed in clear, non-technical language.

---

# THE PRIMARY OBJECTIVE

PawTag must own its own commerce orchestration and business logic.

I do **NOT** want to use any full e-commerce platform as the core of PawTag Commerce.

Do not introduce or depend on:

* WooCommerce
* Shopify
* Saleor
* BigCommerce
* Any other full e-commerce platform

PawTag owns all commerce business logic directly.

The target architecture is:

```text
PawTag Application
        │
        ▼
PawTag Commerce Engine
        │
        ├── Products & Pricing
        ├── Cart
        ├── Checkout
        ├── Orders
        ├── Inventory
        ├── Payments
        ├── Shipping
        ├── Fulfilment
        ├── Tracking
        ├── Refunds
        └── Commerce Administration
                │
                ▼
        External Provider Adapters
                │
        ┌───────┼────────┬──────────┐
        ▼       ▼        ▼          ▼
     Payments Shipping Notifications Maps/Other
```

PawTag should own the **business rules and orchestration**.

Specialised and regulated infrastructure should be delegated to appropriate external providers where sensible. We are not trying to reinvent payment processors, courier networks, mapping infrastructure or regulated financial systems.

---

# IMPORTANT WORKING STYLE

You are expected to work autonomously and progressively.

Do not simply produce a theoretical architecture document and stop.

After completing the initial assessment in **Phase 0**, create and follow an implementation plan through the phases below.

However, do not blindly follow this prompt if the actual repository shows that a different sequence is safer or more appropriate. Adapt the implementation plan to the real codebase while preserving the objectives.

## Before making significant changes

1. Inspect the relevant existing code.
2. Understand what already works.
3. Reuse good existing PawTag infrastructure wherever practical.
4. Avoid unnecessary rewrites.
5. Make a clear plan for the current phase.
6. Implement the phase.
7. Test the phase.
8. Fix problems discovered during testing.
9. Document what changed.
10. Only then proceed to the next phase.

Do not repeatedly stop and ask me technical questions unless there is a genuine **business decision** that only I can make.

If there are several technically valid options, make a sensible recommendation based on PawTag's existing architecture, simplicity, maintainability, cost and suitability for a New Zealand business.

---

# NON-NEGOTIABLE RULES

* Inspect the actual repository before making assumptions.
* Documentation may be outdated; actual code is the source of truth.
* Do not introduce another full e-commerce platform.
* Do not remove existing functionality until its dependencies are understood and safely replaced.
* Do not rewrite working parts of PawTag without a clear reason.
* Prefer extending the existing architecture over creating unnecessary parallel systems.
* Keep the technology stack consistent with the repository unless there is a compelling reason not to.
* Use provider interfaces/adapters where PawTag may need to change providers later.
* Do not store raw credit-card numbers, CVVs or prohibited payment credentials.
* Use PCI-compliant payment providers for card handling.
* Prioritize security, reliability and data integrity.
* Design for real-world failures, not just the happy path.
* Avoid over-engineering.
* Build what PawTag needs now, while leaving clean extension points for future growth.
* Preserve backward compatibility where practical during migration.
* Make database migrations safe and reversible where possible.
* Do not make destructive database or production changes without clearly identifying them.
* Never fake successful integrations or tests.
* If something is unknown, investigate it. If it cannot be determined, explicitly document it rather than guessing.

---

# PHASE 0 — REPOSITORY DISCOVERY AND CURRENT-STATE BASELINE

**This is the only phase where you should primarily investigate before making major commerce changes.**

Thoroughly inspect the PawTag repository and establish the actual current state.

Review and verify:

### Application architecture

* Frontend applications
* Backend/API
* Mobile application
* Database
* ORM/data access layer
* Authentication and authorization
* Admin portal
* Background jobs, queues and scheduled jobs
* Caching
* File/image storage
* Environment configuration
* Deployment configuration
* Logging, monitoring and error tracking
* Testing infrastructure

### Existing commerce functionality

Inspect the actual implementation of:

* Products
* Product variants/options
* Categories
* Pricing
* Cart
* Cart items
* Checkout
* Orders
* Payments
* Refunds
* Shipping
* Fulfilment
* Tracking
* Inventory
* Discounts/promotions
* Customer accounts and addresses
* Admin commerce management

### Existing integrations

Search the entire repository for references to:

* Stripe
* PayPal
* Apple Pay
* Google Pay
* shipping
* courier
* fulfilment
* tracking
* cart
* checkout
* order
* refund
* payment
* webhook
* inventory
* product
* customer
* address
* tax
* GST
* discount
* coupon
* promotion

Also identify:

* External APIs
* Webhooks
* API routes
* Database models
* Background workers
* Environment variables
* Provider SDKs/packages

## Phase 0 deliverable

Before major implementation begins, create a concise but useful file:

`docs/commerce/current-state-baseline.md`

It must explain in plain English:

1. **What PawTag already has**
2. **What currently works**
3. **What is incomplete or problematic**
4. **Exactly what the external commerce platform currently does**
5. **What PawTag already owns versus what the external platform owns**
6. **What external providers currently do**
7. **What functionality is missing**
8. **Which existing components should be kept**
9. **Which components should be replaced or refactored**
10. **Every known external commerce dependency**
11. **The safest high-level migration path**

Include a simple table such as:

| Area     | Current Implementation | Status                  | Decision             |
| -------- | ---------------------- | ----------------------- | -------------------- |
| Products | ...                    | Working/Partial/Missing | Keep/Improve/Replace |
| Cart     | ...                    | ...                     | ...                  |
| Checkout | ...                    | ...                     | ...                  |
| Payments | ...                    | ...                     | ...                  |
| Shipping | ...                    | ...                     | ...                  |
| Orders   | ...                    | ...                     | ...                  |

Also create:

`docs/commerce/implementation-roadmap.md`

This should translate the findings into the actual implementation phases for **this repository**.

After completing Phase 0, do not remain in analysis mode. Begin implementation according to the phases below.

---

# PHASE 1 — COMMERCE FOUNDATION AND CORE DOMAIN

Create or consolidate the internal foundation for **PawTag Commerce**.

The objective is to ensure commerce business logic has a clear home inside PawTag without unnecessarily creating a separate application.

Establish clean domain boundaries for:

* Products
* Pricing
* Cart
* Checkout
* Orders
* Payments
* Shipping
* Inventory
* Fulfilment

Where appropriate, establish interfaces so external providers are behind adapters rather than embedded directly throughout business logic.

For example:

```text
Commerce Core
    │
    ├── Payment Provider Interface
    ├── Shipping Provider Interface
    ├── Notification Interface
    └── Other specialised integrations
```

Do not create abstractions purely for theoretical purity. Keep them practical.

### Required outcomes

* Clear ownership of commerce modules
* Clear boundaries between business logic and providers
* Consistent error handling
* Consistent identifiers and state handling
* Auditability for important commerce operations
* Safe database transaction patterns where appropriate

Document the resulting architecture in:

`docs/commerce/architecture.md`

---

# PHASE 2 — PRODUCT, CATALOGUE, PRICING AND INVENTORY FOUNDATION

Inspect what already exists before changing anything.

Build or improve only what PawTag actually needs.

The product system should support, where relevant:

* Products
* Variants
* SKU
* Product images
* Product descriptions
* Product attributes/options
* Categories
* Product status and availability
* Related products where useful
* Bundles only if genuinely required

Do not build unnecessary marketplace-style functionality.

## Pricing

Create a single reliable source of truth for pricing.

Support the features PawTag genuinely needs, such as:

* Base price
* Sale price
* Compare-at price where useful
* Variant pricing
* Promotional pricing
* Discount codes
* Automatic discounts where appropriate

Avoid putting pricing calculations independently in multiple frontend or backend locations.

## Inventory

Implement inventory safely where physical stock requires it.

Support as appropriate:

* On-hand quantity
* Reserved quantity
* Available quantity
* Low-stock thresholds
* Inventory adjustments
* Stock movements/audit history
* Reservation during checkout
* Release when checkout/payment fails or expires
* Deduction at the correct point in the order lifecycle

Pay particular attention to concurrency. Two customers must not successfully purchase the final unit because of a race condition.

### Phase completion criteria

* Products and variants can be reliably represented
* Prices are calculated consistently
* Inventory cannot be accidentally oversold
* Existing functionality remains working
* Automated tests cover critical pricing and inventory logic

---

# PHASE 3 — SHOPPING CART

Build a robust PawTag-native cart.

Support:

* Guest carts
* Logged-in customer carts
* Persistent carts where appropriate
* Add/remove items
* Quantity changes
* Variant/options selection
* Cart validation
* Cart totals
* Discounts
* Cart merging after login if appropriate
* Cart expiration/cleanup where appropriate

The cart should be fast and provide a modern user experience.

Cart totals should have a clear calculation model:

```text
Items
− Discounts
+ Shipping
+ Applicable Tax
= Final Total
```

Do not trust prices submitted by the browser. The server must validate products, prices, discounts and totals.

Create APIs consistent with the existing PawTag API architecture.

### Phase completion criteria

* Guest and authenticated carts work correctly
* Cart state survives normal user journeys
* Invalid or outdated products/prices are safely handled
* Cart calculations are server-authoritative
* Existing UI can consume the new or improved cart APIs
* Critical cart scenarios are tested

---

# PHASE 4 — CHECKOUT AND ORDER CREATION

Build a reliable, production-quality checkout orchestration flow.

Support as appropriate:

* Guest checkout
* Customer checkout
* Email
* Phone
* Billing address
* Shipping address
* Shipping method selection
* Discounts
* Tax
* Order summary
* Terms acceptance where required
* Payment method selection
* Order confirmation

The checkout must be designed for real-world failures.

Protect against:

* Customer double-clicking Pay
* Browser refreshes
* Network interruptions
* Duplicate order creation
* Duplicate payment attempts
* Payment succeeding while the browser closes
* Delayed webhooks
* Partial system failures

Use idempotency where appropriate.

Order creation and payment handling must have clearly defined responsibilities. Do not rely on the frontend alone to determine whether an order is paid.

### Order state model

Design an explicit and appropriate state model based on PawTag's real workflow.

Separate concepts where necessary rather than putting everything into one confusing status.

For example, payment status and fulfilment status may be separate state dimensions.

Do not blindly use this example; design the correct model:

```text
Order
Payment
Fulfilment
Shipment
```

### Phase completion criteria

* Checkout can safely recover from interruptions
* Duplicate orders/payments are prevented
* Orders accurately preserve the price and item details at the time of purchase
* Order state transitions are controlled and auditable
* Critical checkout failure scenarios are tested

---

# PHASE 5 — PAYMENTS AND EXPRESS WALLET CHECKOUT

This is a high-risk area. Implement carefully.

First inspect the current PawTag payment integration.

Then recommend and implement the most suitable payment architecture for PawTag's existing stack and a New Zealand business.

The payment provider should be selected based on real requirements such as:

* NZ availability
* Reliability
* API quality
* Security and PCI scope
* Apple Pay
* Google Pay
* Refunds and partial refunds
* Payment intents/authorisation where relevant
* Webhooks
* Fraud prevention
* 3DS
* Reporting
* Settlement
* Cost and commercial suitability

Do not store raw card data.

Use a provider abstraction where practical, but do not create a huge multi-provider framework unless PawTag genuinely needs one.

## Apple Pay and Google Pay

Support these through the selected payment provider where commercially and technically appropriate.

They should feel like a natural part of PawTag's custom checkout and, where supported, allow express checkout without bypassing PawTag's own order and inventory controls.

## Payment reliability

Ensure that:

* Payment success is verified server-side
* Webhook signatures are verified
* Duplicate webhooks are safe
* Payment events are idempotent
* Refunds cannot accidentally be processed twice
* Provider outages are handled sensibly
* Failed or ambiguous payments can be reconciled

### Phase completion criteria

* Test/sandbox payments work end-to-end
* Successful and failed payments are handled correctly
* Wallet payments work where configured
* Webhook processing is secure and idempotent
* Refund capability has the necessary foundation
* No prohibited payment credentials are stored by PawTag

---

# PHASE 6 — SHIPPING

This phase covers PawTag's shipping implementation.

PawTag now handles shipping directly via its own shipping service and NZ Post integration.

Create a practical shipping abstraction:

```text
PawTag Commerce
        │
        ▼
Shipping Service
        │
        ▼
Shipping Provider Adapter
        │
        ├── Provider A
        └── Future Providers
```

Research and select suitable shipping options for PawTag's New Zealand operations before choosing providers.

The architecture should support, as needed:

* NZ domestic shipping
* Shipping zones
* Shipping methods
* Flat-rate shipping
* Free shipping thresholds
* Weight/price-based rules where useful
* Rate calculation
* Package dimensions and weight
* Shipment creation
* Label creation where required
* Tracking numbers
* Delivery estimates

Do not integrate every NZ courier simply because it is possible. Start with the provider or approach that best suits PawTag's actual fulfilment requirements.

### Phase completion criteria

* PawTag can calculate and select shipping independently
* Shipping is connected through a clean provider boundary
* Checkout correctly incorporates shipping costs
* Failure handling is implemented
* Shipping can be tested independently

---

# PHASE 7 — FULFILMENT AND REAL-TIME TRACKING

Build fulfilment independently from the payment and cart systems.

Support PawTag's actual needs, including:

* Order fulfilment workflow
* Picking/packing status where useful
* Shipment creation
* Partial fulfilment if needed
* Multiple shipments where needed
* Shipment tracking numbers
* Carrier information
* Customer-facing tracking
* Admin tracking visibility

Tracking should support a normalised internal event model such as:

* Label created
* Picked up
* In transit
* Out for delivery
* Delivered
* Delivery failed
* Returned

Do not assume every carrier provides the same events.

Where available, use provider webhooks. Where webhooks are unavailable or unreliable, design a controlled polling/reconciliation mechanism.

Store meaningful tracking history so customers and administrators can understand what happened.

---

# PHASE 8 — REFUNDS, CANCELLATIONS AND RETURNS FOUNDATION

Implement refunds carefully as part of the order/payment domain.

Support:

* Full refunds
* Partial refunds
* Item-level refunds where appropriate
* Shipping refunds where appropriate
* Refund reasons
* Refund status
* Provider refund references
* Audit trail
* Idempotency protection

A failed provider refund must not leave PawTag falsely believing the customer has been refunded.

## Returns

Do not overbuild a complex returns portal unless PawTag needs it immediately.

Create the foundation for returns and exchanges where appropriate, but classify advanced return workflows as a later phase if they are not needed for launch.

---

# PHASE 9 — COMMERCE ADMINISTRATION

Extend the existing PawTag admin architecture rather than creating a disconnected administration system.

Administrators should be able to manage the commerce functionality PawTag needs, including:

* Products
* Categories
* Pricing
* Inventory
* Orders
* Customers where appropriate
* Payments
* Refunds
* Shipping
* Fulfilment
* Tracking
* Discounts/promotions if implemented

Provide useful order timelines and audit history.

Respect the existing PawTag authentication and role/permission architecture.

Do not give every administrator unrestricted access to sensitive financial actions.

---

# PHASE 10 — WEBHOOKS, BACKGROUND PROCESSING AND RELIABILITY

Consolidate all external event handling into a reliable pattern.

External events may come from:

* Payment providers
* Shipping providers
* Fulfilment providers
* Notification providers
* Other future integrations

Webhook handling must support:

* Signature verification
* Idempotency
* Event persistence where appropriate
* Duplicate delivery protection
* Retry handling
* Failure logging
* Safe replay where practical
* Event ordering considerations

Use existing PawTag queue/background infrastructure if it already exists and is suitable.

If background processing is required and the repository does not have an appropriate solution, recommend the smallest sensible addition rather than introducing unnecessary infrastructure.

Design reconciliation for important cases where a provider and PawTag could temporarily disagree.

---

# PHASE 11 — NZ TAX, ADDRESSES AND CUSTOMER EXPERIENCE

Review PawTag's tax and address architecture for New Zealand operations.

Support a clean tax abstraction rather than scattering tax calculations throughout the codebase.

Consider:

* GST-inclusive pricing
* GST calculation
* Tax on shipping where applicable
* Tax handling for refunds
* Tax invoices/order records
* Domestic versus future international sales

Clearly document anything that requires confirmation from a qualified New Zealand accountant or tax professional.

For addresses, evaluate the actual need for:

* Address autocomplete
* Address validation
* Delivery address support
* Click & collect locations if relevant

Do not unnecessarily collect or store precise location information.

---

# PHASE 12 — EXTERNAL COMMERCE REMOVAL — COMPLETE

**Status:** ✅ COMPLETE. External commerce platform has been fully removed from the codebase.

PawTag now operates as a single-system architecture with MongoDB as the sole database.

1. Re-scan the entire repository for external commerce references.
2. Identify runtime dependencies.
3. Identify package dependencies.
4. Identify environment variables.
5. Identify database/data dependencies.
6. Identify API dependencies.
7. Identify background job dependencies.
8. Identify deployment dependencies.
9. Identify documentation and configuration dependencies.

If existing data must be migrated, create a safe migration plan.

Prefer a staged approach:

```text
Existing external functionality
          │
          ▼
Build PawTag replacement
          │
          ▼
Test replacement
          │
          ▼
Switch PawTag traffic/workflows
          │
          ▼
Validate in controlled conditions
          │
          ▼
Remove unused external dependencies
          │
          ▼
Regression test entire application
```

Do not remove external functionality simply because this phase has been reached. Remove it only when the repository demonstrates that it is genuinely no longer required.

After removal:

* Remove unused packages
* Remove unused environment variables
* Remove obsolete configuration
* Remove obsolete code
* Update documentation
* Verify builds and deployments
* Run regression tests

The final repository should have no unnecessary external commerce dependency.

---

# PHASE 13 — SECURITY, OBSERVABILITY AND PRODUCTION HARDENING

Perform a final commerce-focused production readiness review.

## Security

Review:

* Authentication
* Authorization
* Admin permissions
* API validation
* Rate limiting
* Input validation
* CSRF where applicable
* XSS protection
* Injection risks
* Secrets management
* Webhook security
* Payment security
* Audit logging

## Reliability

Test scenarios including:

* Payment succeeds but browser closes
* Payment succeeds but order processing is interrupted
* Customer refreshes checkout
* Webhook arrives twice
* Webhooks arrive out of order
* Shipping provider is unavailable
* Payment provider is temporarily unavailable
* Inventory becomes unavailable
* Database operation fails
* Refund provider request fails

Use appropriate combinations of:

* Database transactions
* Idempotency keys
* Queues
* Retries
* Reconciliation
* Error handling

## Observability

Use or extend PawTag's existing infrastructure for:

* Structured logging
* Error tracking
* Important commerce events
* Failed payments
* Failed orders
* Failed webhooks
* Shipping failures
* Administrative audit logs

Do not introduce monitoring tools unnecessarily if suitable infrastructure already exists.

---

# TESTING REQUIREMENTS THROUGHOUT ALL PHASES

Do not leave testing until the end.

Every phase should add or improve tests relevant to the functionality being changed.

Use the repository's existing testing tools where possible.

Cover:

* Unit tests
* Integration tests
* API tests
* Database behaviour
* Payment sandbox tests
* Webhook tests
* Shipping tests
* Cart and checkout tests
* Inventory concurrency tests
* Refund tests
* End-to-end critical customer journeys where practical

A phase is not considered complete simply because the code compiles.

---

# REQUIRED DOCUMENTATION

Maintain a living documentation structure under:

`docs/commerce/`

At minimum:

```text
docs/commerce/
├── current-state-baseline.md
├── implementation-roadmap.md
├── architecture.md
├── provider-integrations.md
├── order-and-payment-lifecycle.md
├── shipping-and-fulfilment.md
├── database-model.md
├── api-map.md
├── security-and-reliability.md
└── commerce-migration.md
```

Do not create documentation that merely describes what the code was intended to do. Keep it aligned with the actual implementation.

Update relevant documentation as phases are completed.

---

# WHAT NOT TO BUILD UNLESS PAWTAG ACTUALLY NEEDS IT

Avoid automatically building enterprise features just because large e-commerce platforms have them.

Examples that should be evaluated carefully before implementation:

* Multi-vendor marketplace functionality
* Complex multi-warehouse optimisation
* Advanced ERP functionality
* A custom payment processor
* A custom courier network
* Complex international tax engines
* Loyalty programmes
* Gift cards
* Advanced subscription billing
* Customer-specific pricing engines
* Complex exchanges automation
* AI recommendation engines

Build a clean foundation that can support future growth, but do not delay PawTag's launch by building features that provide no immediate business value.

---

# IMPLEMENTATION PRIORITIES

Prioritize a reliable, launch-ready commerce experience.

The likely priority should be:

### Must be production-ready

1. Product catalogue
2. Inventory appropriate to PawTag's needs
3. Cart
4. Checkout
5. Secure payments
6. Apple Pay/Google Pay where supported and appropriate
7. Orders
8. NZ shipping
9. Fulfilment
10. Tracking
11. Refunds
12. Admin management
13. Security and monitoring

### Build later if needed

* Advanced returns portal
* Complex promotions
* Bundles
* Subscriptions
* Advanced reporting
* Loyalty
* Gift cards
* Multiple shipping providers
* International expansion features

The actual prioritisation should be adjusted after Phase 0 based on what PawTag already has.

---

# HOW TO WORK WITH ME

At the beginning of each major phase, briefly tell me:

* What you found
* What you are going to build or change
* Why it is necessary
* Any meaningful business risk or decision

Then implement the phase.

At the end of each major phase, provide a short summary:

### Completed

What was implemented.

### Changed

Major modules, APIs, database changes and integrations affected.

### Verified

What tests or validation were performed.

### Remaining

What comes next.

Keep explanations understandable for a non-technical Product Owner.

Do not overwhelm me with internal implementation details unless they are relevant to a decision.

---

# AUTONOMY AND DECISION MAKING

You are expected to act as the senior technical team responsible for this transformation.

Do not repeatedly ask me to decide:

* Which folder structure to use
* Which design pattern to use
* Which database transaction pattern to use
* Which API naming convention to use
* Other normal engineering decisions

Make those decisions based on the existing PawTag architecture and good production engineering practices.

Ask me only when there is a genuine business, commercial or product decision, for example:

* Which courier company PawTag has a commercial agreement with
* Whether PawTag wants to offer free shipping above a certain amount
* Whether international shipping is required for launch
* A payment provider commercial choice where multiple options have materially different business costs
* A customer-facing policy decision

When possible, provide a recommendation rather than simply presenting me with an open-ended technical question.

---

# FINAL SUCCESS CRITERIA

The work is successful when PawTag has a cohesive, first-party commerce system that:

* Fits naturally into the existing PawTag application
* Does not depend on another full e-commerce platform
* Owns PawTag's commerce business logic
* Uses specialised external providers only where appropriate
* Provides a modern shopping cart and checkout experience
* Handles payments securely
* Supports suitable New Zealand shipping
* Supports fulfilment and tracking
* Handles orders and refunds reliably
* Is resilient to real-world failures
* Is testable and maintainable
* Is documented
* Does not unnecessarily over-engineer PawTag

---

# START NOW

Start with **Phase 0: Repository Discovery and Current-State Baseline**.

Inspect the actual repository thoroughly.

Do not make major commerce changes until you have established the baseline and documented what PawTag currently has.

Once Phase 0 is complete, present me with the findings and the proposed repository-specific implementation sequence.

Then proceed through the implementation phases, completing and testing each phase systematically.

The goal is not merely to produce a plan.

**The goal is to progressively transform the actual PawTag repository into a production-ready, custom PawTag Commerce system.**
