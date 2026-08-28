# PawTag — Enterprise Commerce Transformation & Custom Commerce Engine

## ROLE

Act as a multidisciplinary senior engineering team:

* Senior Software Architect
* Senior Full-Stack Engineer
* E-commerce Systems Architect
* Payments Integration Architect
* Logistics & Shipping Integration Architect
* Database Architect
* Security Engineer
* DevOps / Infrastructure Engineer
* NZ E-commerce Technical Consultant
* QA / Test Architect
* Technical Product Architect

You are working on the existing **PawTag** application.

I am a business owner and I am not a technical person.

Therefore:

* Do not assume I understand technical terminology.
* Explain important decisions in plain English.
* Do not guess when the repository can provide the answer.
* Do not immediately start modifying code.
* First understand what already exists.
* Do not rebuild working functionality unnecessarily.
* Treat the actual repository as the source of truth.

---

# PRIMARY OBJECTIVE

PawTag is an existing application.

There is currently an existing admin area:

`http://localhost:3001/admin`

That admin area already contains many administrative/business functions that are NOT necessarily commerce-related.

I want to add a completely separate top-level admin area/menu called:

# Shop & Commerce

This should become a **fully featured, enterprise-grade commerce administration system**, comparable in capability and usability to mature commerce administration platforms such as WooCommerce and OpenCart.

However:

* Do NOT install WooCommerce.
* Do NOT install OpenCart.
* Do NOT install Shopify.
* Do NOT install Medusa.
* Do NOT replace Medusa with another full e-commerce platform.
* Do NOT introduce another third-party commerce engine.
* Build the commerce functionality natively inside PawTag.
* Use external specialist providers only where they are appropriate.

The ultimate goal is to create:

# PawTag Commerce Engine

The commerce system should own PawTag's commerce business logic, commerce data, workflows, administration, orchestration, and customer commerce experience.

External providers should handle specialist infrastructure such as payment processing, shipping networks, maps, email delivery, SMS, etc.

---

# IMPORTANT MEDUSA CONTEXT

## Medusa has ALREADY been uninstalled from the PawTag repository.

This is critical.

Do NOT assume Medusa is currently installed.

Do NOT attempt to uninstall Medusa.

Do NOT spend implementation time removing an active Medusa dependency.

Instead, during the repository audit:

1. Verify that Medusa is actually no longer installed.
2. Search for any remaining Medusa references.
3. Identify orphaned code/configuration/environment variables/packages.
4. Identify any remaining Medusa-related database structures or data.
5. Identify commerce functionality that may previously have depended on Medusa.
6. Determine whether any current PawTag functionality is broken, incomplete, or missing because Medusa was removed.
7. Determine whether any legacy Medusa data still needs to be recovered or migrated.
8. Determine whether any Medusa-related cleanup is still required.
9. Do NOT delete remaining legacy code/data until its purpose and dependencies are understood.

The project is NOT:

```text
PawTag → Remove Medusa → Build Commerce
```

The project is now:

```text
Current PawTag
      ↓
Audit Current State
      ↓
Identify Legacy Medusa Remnants
      ↓
Understand Existing Commerce
      ↓
Design Custom PawTag Commerce
      ↓
Build Missing Commerce Capabilities
      ↓
Clean Up Remaining Legacy Dependencies
```

If the audit confirms there are no meaningful Medusa remnants, state that clearly and move on.

---

# CRITICAL WORKFLOW RULE

You MUST work in these stages:

```text
PHASE 1
Repository Audit
        ↓
PHASE 2
Current-State Report
        ↓
PHASE 3
Commerce Gap Analysis
        ↓
PHASE 4
Target Architecture
        ↓
PHASE 5
Migration / Cleanup Strategy
        ↓
PHASE 6
Implementation Roadmap
        ↓
USER APPROVAL
        ↓
PHASE 7
Implementation
        ↓
PHASE 8
Testing
        ↓
PHASE 9
Production Hardening
```

## DO NOT MODIFY CODE DURING PHASES 1–6.

Do not:

* create production code
* delete files
* modify database schema
* install packages
* remove dependencies
* change APIs
* change environment variables
* change deployment configuration
* modify existing commerce logic
* migrate data

until the audit, architecture and implementation plan have been presented and understood.

The first objective is understanding, not coding.

If you identify an urgent security issue, explain it before changing anything.

---

# PHASE 1 — THOROUGHLY AUDIT THE EXISTING PAWTAG REPOSITORY

Inspect the actual repository thoroughly.

Do not rely solely on README files or documentation.

The repository itself is the source of truth.

Determine the current:

## Application Architecture

Identify:

* frontend framework
* backend framework
* application structure
* monorepo or single repository
* packages
* services
* modules
* server architecture
* API architecture
* rendering strategy
* state management
* routing
* middleware
* authentication
* authorization

---

# DATABASE AUDIT

Identify:

* database technology
* ORM
* schema
* migrations
* seed scripts
* existing commerce tables
* existing commerce models
* relationships
* indexes
* constraints
* transactions
* database-level locking
* soft deletion
* audit/history mechanisms

Pay particular attention to existing tables/models related to:

```text
products
product variants
categories
inventory
stock
customers
addresses
cart
checkout
orders
payments
refunds
shipping
fulfilment
tracking
discounts
promotions
returns
```

---

# EXISTING COMMERCE AUDIT

Determine exactly what PawTag currently has.

Inspect:

* product catalogue
* products
* variants
* SKUs
* pricing
* categories
* collections
* images
* product attributes
* inventory
* cart
* cart items
* checkout
* orders
* order items
* customers
* customer addresses
* payment flows
* refunds
* shipping
* fulfilment
* tracking
* discounts
* coupons
* promotions
* tax
* returns
* notifications

For each area determine:

* whether it exists
* where it exists
* whether it works
* whether it is production-ready
* whether it is incomplete
* whether it is legacy
* whether it should be reused
* whether it should be replaced

---

# MEDUSA LEGACY AUDIT

Although Medusa has already been uninstalled, search the entire repository for:

```text
Medusa
medusa
@medusajs
medusa-js
medusaClient
medusaStore
medusaAdmin
```

Also search for Medusa-related:

* environment variables
* configuration
* database references
* API endpoints
* services
* adapters
* comments
* documentation
* package-lock entries
* package.json entries
* Docker configuration
* deployment configuration
* scripts
* tests
* generated files

Determine whether anything remains.

Categorize remnants as:

### Safe to remove

### Requires investigation

### Still used indirectly

### Historical/documentation only

Do NOT remove anything during the audit.

---

# SEARCH THE ENTIRE REPOSITORY

Search for all references to:

```text
WooCommerce
Shopify
Medusa

Stripe
Windcave
POLi
PayPal
Apple Pay
Google Pay
Afterpay
Zip
Laybuy

payment
payment_intent
payment_intent
refund
refunds
transaction

shipping
shipment
shipments
fulfilment
fulfillment
tracking
carrier
delivery

NZ Post
NZ Couriers
Aramex
DHL
FedEx
UPS

cart
checkout
order
orders

product
products
variant
variants

inventory
stock
reservation

customer
customers
address
addresses

tax
GST

discount
coupon
promotion

webhook
queue
job
worker

email
SMS
notification

storage
S3
Cloudinary
Supabase

Postmark
SendGrid
Resend
Twilio
```

Also inspect:

* `.env`
* `.env.example`
* configuration
* CI/CD
* Docker
* deployment
* tests
* scripts
* background jobs
* scheduled jobs
* logs
* monitoring
* error handling

---

# PHASE 1 OUTPUT

Before proposing implementation, produce:

## 1. Current Architecture Diagram

Show the actual architecture.

For example:

```text
Customer Browser
       ↓
PawTag Frontend
       ↓
PawTag Backend
       ├── Database
       ├── Authentication
       ├── Commerce
       ├── Payments
       ├── Shipping
       └── Other Services
```

This is only an example.

Replace it with the actual architecture discovered in the repository.

---

# 2. Technology Inventory

Create:

| Area           | Technology | Evidence | Status    |
| -------------- | ---------- | -------- | --------- |
| Frontend       | ...        | ...      | Confirmed |
| Backend        | ...        | ...      | Confirmed |
| Database       | ...        | ...      | Confirmed |
| ORM            | ...        | ...      | Confirmed |
| Authentication | ...        | ...      | Confirmed |
| Payments       | ...        | ...      | Confirmed |
| Shipping       | ...        | ...      | Confirmed |

Use:

* Confirmed
* Partially confirmed
* Unknown
* Not present

Do not guess.

---

# 3. Existing Commerce Inventory

Create:

| Area      | Current Implementation | Location | Status | Recommendation       |
| --------- | ---------------------- | -------- | ------ | -------------------- |
| Products  | ...                    | ...      | ...    | Keep/Improve/Replace |
| Variants  | ...                    | ...      | ...    | ...                  |
| Inventory | ...                    | ...      | ...    | ...                  |
| Cart      | ...                    | ...      | ...    | ...                  |
| Checkout  | ...                    | ...      | ...    | ...                  |
| Payments  | ...                    | ...      | ...    | ...                  |
| Orders    | ...                    | ...      | ...    | ...                  |
| Shipping  | ...                    | ...      | ...    | ...                  |
| Tracking  | ...                    | ...      | ...    | ...                  |
| Refunds   | ...                    | ...      | ...    | ...                  |

---

# PHASE 2 — CURRENT-STATE REPORT

Explain exactly what PawTag has today.

Separate:

### What PawTag already owns

### What was previously handled by Medusa

### What is currently handled by external providers

### What is missing

### What is partially implemented

### What is broken/incomplete

### What should be preserved

### What should be replaced

Do not assume that because Medusa was uninstalled, every commerce feature disappeared.

Inspect the actual code and database.

---

# MEDUSA LEGACY / POST-UNINSTALL REPORT

Provide a specific section:

# What Remains From Medusa

Explain:

* whether any packages remain
* whether any code remains
* whether any configuration remains
* whether any environment variables remain
* whether any database artifacts remain
* whether any data remains
* whether any business logic still references Medusa
* whether there are any orphaned components

If nothing meaningful remains, say:

> Medusa has been successfully removed from the application and no meaningful runtime dependency was identified.

Do not invent migration requirements if there is nothing to migrate.

---

# PHASE 3 — COMMERCE GAP ANALYSIS

Compare:

```text
CURRENT PAWTAG
      ↓
TARGET PAWTAG COMMERCE
```

Create a comprehensive gap analysis.

For every major feature classify it:

### EXISTING — KEEP

Already works and should be reused.

### EXISTING — IMPROVE

Exists but requires enhancement.

### PARTIAL

Some functionality exists.

### MISSING — BUILD

Needs to be created.

### EXTERNAL — INTEGRATE

Should be handled by a provider.

### OPTIONAL — LATER

Useful but not necessary initially.

### NOT REQUIRED

Should not be built.

This prevents unnecessary rewriting.

---

# PHASE 4 — DESIGN THE CUSTOM PAWTAG COMMERCE ENGINE

The target system should be:

# PawTag Commerce Engine

Architecture:

```text
                 PAWTAG
                    │
        ┌───────────┴───────────┐
        │                       │
 Existing Admin          Shop & Commerce
                                │
                        PawTag Commerce Engine
                                │
       ┌────────┬────────┬──────┼──────┬────────┐
       │        │        │      │      │        │
    Catalog   Cart   Checkout Orders Inventory Customers
       │        │        │      │      │        │
       └────────┴────────┴──────┴──────┴────────┘
                                │
                      Provider Abstraction
                                │
       ┌──────────────┬─────────┼──────────────┐
       │              │         │              │
    Payments       Shipping    Maps       Notifications
       │              │         │              │
   Provider       Provider   Provider       Provider
```

The PawTag Commerce Core should own the business rules.

---

# PRODUCT MANAGEMENT

Design support for:

* products
* variants
* SKU
* barcode
* images
* videos
* descriptions
* attributes
* options
* categories
* subcategories
* tags
* brands
* collections
* related products
* recommended products
* bundles
* availability
* status
* backorders
* preorders
* digital products if applicable
* subscriptions if applicable

Classify each feature:

* REQUIRED NOW
* RECOMMENDED
* OPTIONAL
* NOT REQUIRED

---

# PRICING

Design support for:

* base price
* sale price
* compare-at price
* variant-specific pricing
* customer-specific pricing
* quantity pricing
* bulk pricing
* promotional pricing
* coupon codes
* discount codes
* automatic discounts
* Buy X Get Y
* free shipping promotions
* gift cards
* store credit

Only recommend complexity that PawTag actually needs.

---

# SHOPPING CART

Design a robust cart system supporting:

* guest carts
* logged-in carts
* persistent carts
* cart merging
* add/remove items
* quantity changes
* variants
* options
* saved carts
* discount codes
* shipping estimates
* tax estimates
* cart totals
* currency
* cart expiration
* abandoned carts

Design:

* database model
* API
* lifecycle
* expiration
* concurrency handling

---

# CHECKOUT

Design a production-grade checkout.

Support:

* guest checkout
* customer checkout
* email
* phone
* billing address
* shipping address
* address validation
* shipping selection
* delivery estimates
* payment selection
* promo codes
* tax
* shipping
* final total
* terms acceptance
* confirmation

Protect against:

* duplicate orders
* duplicate payments
* double clicking Pay
* browser refresh
* browser crashes
* network failures
* payment failures
* webhook delays
* partial failures

Use idempotency appropriately.

---

# PAYMENTS

This is a critical system.

Research current payment providers suitable for a New Zealand business.

Evaluate relevant providers such as:

* Stripe
* Windcave
* current NZ alternatives to POLi where appropriate
* PayPal
* Apple Pay
* Google Pay
* Afterpay
* Zip
* other commercially relevant NZ payment methods

Do not assume that an older payment service is still commercially or technically appropriate.

Research current capabilities.

Compare:

* NZ availability
* API quality
* developer experience
* PCI implications
* hosted checkout/payment elements
* payment intents
* authorisation
* capture
* refunds
* partial refunds
* webhooks
* recurring payments
* fraud prevention
* 3DS
* Apple Pay
* Google Pay
* settlement
* reporting
* fees
* reliability

Recommend ONE primary payment provider.

Explain why.

Do not give me ten vague alternatives.

---

# PAYMENT SECURITY

PawTag MUST NEVER store:

* raw card numbers
* CVV
* prohibited payment credentials

Use a PCI-compliant payment provider.

Preferred architecture:

```text
Customer
   ↓
PawTag Checkout
   ↓
Secure Provider Payment UI
   ↓
Payment Provider
   ↓
Provider Payment Reference
   ↓
PawTag
```

PawTag should store only appropriate:

* provider customer ID
* payment method reference/token
* payment intent ID
* transaction ID
* payment status
* amount
* currency
* timestamps
* provider metadata where appropriate

---

# APPLE PAY / GOOGLE PAY

Design:

* Apple Pay
* Google Pay
* express checkout
* wallet payments
* payment provider integration
* payment confirmation
* webhooks
* failure recovery
* order reconciliation

Explain exactly how these integrate into PawTag.

---

# ORDER MANAGEMENT

Design a complete order system.

Support:

* order number
* customer
* items
* quantities
* price at purchase
* discounts
* tax
* shipping
* payment status
* fulfilment status
* shipping status
* carrier
* tracking
* addresses
* notes
* timeline
* refunds
* returns
* cancellations
* partial fulfilment
* partial refunds
* amendments where appropriate

Do not use a simplistic single status field if separate state machines are more appropriate.

Consider separate:

```text
Order State
Payment State
Fulfilment State
Shipment State
Return State
```

Design the correct transitions.

---

# REFUNDS

Support:

* full refunds
* partial refunds
* item refunds
* shipping refunds
* refund reason
* refund status
* provider refund
* admin refund
* automatic refund where appropriate
* refund webhook
* audit trail

Prevent accidental duplicate refunds.

Use:

* idempotency
* database constraints
* provider reconciliation

---

# SHIPPING

Shipping must be independent of Medusa.

Create:

```text
PawTag Commerce
       ↓
Shipping Interface
       ↓
Shipping Adapter
       ↓
Carrier
```

Research appropriate NZ providers, including:

* NZ Post
* NZ Couriers
* Aramex
* DHL
* FedEx
* UPS
* relevant NZ shipping aggregators

Determine which providers actually have suitable APIs.

Support where appropriate:

* shipping zones
* shipping methods
* shipping rates
* package weight
* dimensions
* delivery estimates
* address validation
* shipment creation
* labels
* tracking numbers
* tracking URLs
* tracking events
* delivery status
* failed delivery
* returned shipments
* cancellations
* domestic NZ shipping
* international shipping
* click & collect
* free shipping thresholds
* flat-rate shipping
* weight-based rates
* price-based rates

Recommend the best initial shipping strategy.

Do not integrate every carrier unnecessarily.

---

# REAL-TIME TRACKING

Design:

```text
label_created
      ↓
picked_up
      ↓
in_transit
      ↓
out_for_delivery
      ↓
delivered
```

Also support:

* delivery failed
* returned
* exception
* delayed
* tracking events

Design:

* carrier APIs
* webhooks
* polling fallback
* event storage
* customer tracking page
* admin tracking page
* notifications

---

# FULFILMENT

Build fulfilment independently from Medusa.

Support:

* fulfilment orders
* picking
* packing
* shipment creation
* labels
* partial fulfilment
* multiple shipments
* warehouse/location support
* inventory reservation

Allow future third-party fulfilment providers through adapters.

---

# INVENTORY

Design proper inventory management.

Support:

* stock quantity
* reserved quantity
* available quantity
* low-stock thresholds
* inventory locations
* adjustments
* stock movements
* reservations
* reservation release
* deduction
* returns/restocking
* backorders
* out-of-stock behaviour

CRITICAL:

Explain how the system prevents this:

```text
Stock = 1

Customer A → buys item
Customer B → simultaneously buys item

Only one customer must successfully reserve/purchase it.
```

Use appropriate:

* database transactions
* atomic updates
* locking
* constraints
* reservation logic

---

# ADDRESS / MAPS

Research:

* address autocomplete
* address validation
* geocoding
* maps
* delivery address selection
* distance calculation
* click & collect

Consider:

* Google Maps Platform
* relevant alternatives

Do not store unnecessary precise location information.

---

# NZ TAX / GST

Research and design an appropriate tax abstraction.

Consider:

* GST
* GST-inclusive pricing
* tax on shipping
* tax invoices
* refunds
* domestic orders
* international orders
* tax calculations

Do not hard-code tax rules throughout the application.

Clearly identify anything requiring confirmation from a NZ accountant/tax professional.

---

# CUSTOMER ACCOUNTS

Support:

* registration
* login
* password reset
* profile
* addresses
* provider-based saved payment methods
* order history
* reorder
* saved carts
* wishlist if useful
* returns
* refund history
* communication preferences

Reuse existing PawTag customer/auth functionality wherever practical.

---

# NOTIFICATIONS

Design:

* order confirmation
* payment confirmation
* payment failure
* order processing
* shipment confirmation
* tracking update
* out for delivery
* delivered
* refund confirmation
* cancellation
* password reset

Potential channels:

* email
* SMS
* push

First inspect existing PawTag notification infrastructure and reuse it if suitable.

---

# WEBHOOKS

Build a robust webhook architecture.

External sources may include:

* payment providers
* shipping providers
* fulfilment providers
* email providers
* other integrations

Support:

* signature verification
* idempotency
* replay protection
* retries
* logging
* event history
* dead-letter handling
* duplicate events
* out-of-order events
* reconciliation

---

# SHOP & COMMERCE ADMIN PANEL

The existing:

`/admin`

must remain intact.

Add a separate:

# Shop & Commerce

section.

It should feel like a complete commerce operating system.

Recommended structure:

```text
Shop & Commerce
│
├── Dashboard
│
├── Catalog
│   ├── Products
│   ├── Add Product
│   ├── Categories
│   ├── Collections
│   ├── Brands
│   ├── Tags
│   └── Attributes
│
├── Inventory
│   ├── Stock
│   ├── Locations
│   ├── Adjustments
│   ├── Transfers
│   └── Stock History
│
├── Orders
│   ├── All Orders
│   ├── Pending
│   ├── Processing
│   ├── Fulfilled
│   ├── Shipped
│   ├── Delivered
│   ├── Cancelled
│   └── Returns
│
├── Customers
│   ├── Customers
│   ├── Segments
│   └── Customer History
│
├── Discounts
│   ├── Coupons
│   ├── Discount Codes
│   └── Promotions
│
├── Payments
│   ├── Transactions
│   ├── Authorisations
│   ├── Captures
│   ├── Refunds
│   └── Failed Payments
│
├── Shipping
│   ├── Methods
│   ├── Zones
│   ├── Rates
│   ├── Shipments
│   ├── Labels
│   └── Tracking
│
├── Fulfilment
│   ├── Pending
│   ├── Picking
│   ├── Packing
│   └── Fulfilled
│
├── Returns
│
├── Tax
│
├── Notifications
│
├── Reports
│   ├── Sales
│   ├── Orders
│   ├── Products
│   ├── Customers
│   ├── Inventory
│   ├── Payments
│   └── Refunds
│
├── Integrations
│
├── Webhooks
│
├── Audit Logs
│
└── Settings
```

This is a starting point.

Modify it based on PawTag's actual needs.

---

# ADMIN CAPABILITIES

The admin should support enterprise-grade workflows such as:

* global search
* advanced filtering
* sorting
* pagination
* bulk actions
* bulk product editing
* bulk inventory updates
* bulk order operations
* CSV import/export where useful
* saved filters
* order timelines
* customer timelines
* activity history
* audit logs
* role-based permissions
* confirmation dialogs
* destructive-action protection
* alerts
* low-stock alerts
* failed payment alerts
* fulfilment exception alerts
* configurable settings
* reporting
* dashboards

Do not make the admin panel merely visually impressive.

It must be operationally useful.

---

# DATABASE ARCHITECTURE

Design the required commerce schema.

Evaluate entities such as:

```text
customers
customer_addresses

products
product_variants
product_images
categories
collections

carts
cart_items

orders
order_items

payments
payment_transactions
refunds

shipping_methods
shipping_rates
shipments
shipment_items
tracking_events

fulfilments

inventory
inventory_locations
inventory_movements
inventory_reservations

discounts
coupons
promotions

returns
return_items

webhook_events
audit_logs
```

Do NOT automatically create every table.

Only create tables justified by the actual architecture.

For every major entity explain:

* why it exists
* what it owns
* relationships
* important fields
* indexes
* constraints
* lifecycle

Provide an ER-style diagram.

---

# API ARCHITECTURE

First inspect the existing PawTag API conventions.

Then recommend whether PawTag should use:

* REST
* GraphQL
* existing API architecture
* hybrid

Do not introduce GraphQL simply because it is popular.

## Customer APIs

Evaluate:

```text
GET cart
POST cart/items
PATCH cart/items
DELETE cart/items

apply discount
estimate shipping

start checkout
create payment
confirm payment
create order

GET order
GET orders

request return
GET tracking
```

## Admin APIs

Evaluate:

```text
create product
update product
archive product

manage categories

manage inventory

list orders
view order
update order

refund order

create shipment
view tracking

manage discounts
manage shipping

manage integrations

view payments
view webhooks
view audit logs
```

Reuse existing PawTag API conventions where appropriate.

---

# EXTERNAL PROVIDER ARCHITECTURE

Use adapter interfaces.

For example:

```text
PawTag Commerce Core
│
├── Payment Adapter
│   └── Selected Payment Provider
│
├── Shipping Adapter
│   └── Selected Shipping Provider
│
├── Maps Adapter
│   └── Selected Maps Provider
│
├── Notification Adapter
│   ├── Existing Email Provider
│   └── Existing SMS Provider
│
└── Fulfilment Adapter
    └── Future Provider
```

The core commerce logic should NOT directly depend on provider-specific APIs.

---

# RELIABILITY

Explicitly design what happens when:

## Payment succeeds but browser crashes

## Payment succeeds but order creation fails

## Order succeeds but shipping API fails

## Shipping label creation fails

## Webhook arrives twice

## Webhook arrives out of order

## Customer refreshes checkout

## Customer clicks Pay twice

## Payment provider is unavailable

## Shipping provider is unavailable

## Database transaction fails

## Inventory becomes insufficient

## Refund provider request fails

Use where appropriate:

* idempotency keys
* database transactions
* queues
* retries
* dead-letter queues
* event processing
* reconciliation jobs
* provider status reconciliation

---

# OBSERVABILITY

Design:

* structured logs
* error tracking
* metrics
* payment monitoring
* webhook monitoring
* shipping monitoring
* failed-order monitoring
* failed-payment monitoring
* audit logs

Reuse existing PawTag monitoring infrastructure where possible.

---

# SECURITY

Review:

* authentication
* authorization
* admin roles
* permissions
* PCI scope
* payment security
* webhook signatures
* CSRF
* XSS
* SQL injection
* API security
* rate limiting
* encryption
* secret management
* session security
* audit logs
* fraud prevention
* idempotency
* sensitive data handling

The system must NEVER store raw:

* card numbers
* CVVs
* prohibited payment credentials

---

# TESTING

Create a comprehensive strategy covering:

* unit tests
* integration tests
* API tests
* database tests
* checkout tests
* payment tests
* webhook tests
* shipping tests
* inventory concurrency tests
* refund tests
* returns tests
* admin tests
* end-to-end tests

Use sandbox/test environments for external providers.

---

# PHASE 5 — RECOMMEND THE ACTUAL ARCHITECTURE

After inspecting the repository, provide ONE concrete architecture.

Use:

| Area          | Recommendation | Why |
| ------------- | -------------- | --- |
| Frontend      | ...            | ... |
| Backend       | ...            | ... |
| Database      | ...            | ... |
| ORM           | ...            | ... |
| Catalog       | ...            | ... |
| Cart          | ...            | ... |
| Checkout      | ...            | ... |
| Payments      | ...            | ... |
| Apple Pay     | ...            | ... |
| Google Pay    | ...            | ... |
| Shipping      | ...            | ... |
| Tracking      | ...            | ... |
| Fulfilment    | ...            | ... |
| Inventory     | ...            | ... |
| Maps          | ...            | ... |
| Tax           | ...            | ... |
| Notifications | ...            | ... |
| Queues        | ...            | ... |
| Caching       | ...            | ... |
| Monitoring    | ...            | ... |
| File Storage  | ...            | ... |

Do not give me ten vague alternatives.

Give me the architecture you believe is best after inspecting PawTag.

If something genuinely cannot be determined, say:

> Unknown — repository evidence is insufficient.

---

# PHASE 6 — LEGACY MEDUSA CLEANUP / DATA STRATEGY

Because Medusa has already been uninstalled, do NOT create a traditional "remove Medusa" implementation plan unless remnants actually exist.

Instead determine:

## A. Is there any remaining Medusa code?

## B. Are there any remaining Medusa packages?

## C. Are there any remaining environment variables?

## D. Are there any remaining configuration files?

## E. Are there any remaining database tables?

## F. Is there any legacy Medusa data?

## G. Is any current PawTag functionality still dependent on former Medusa concepts?

## H. Is any data recovery/migration required?

If no meaningful remnants exist:

```text
Medusa status:
REMOVED

Legacy cleanup:
NONE REQUIRED / MINIMAL

Commerce migration:
BUILD CUSTOM PAWTAG COMMERCE FROM CURRENT STATE
```

If remnants exist, create a safe cleanup plan.

Never delete legacy data without first verifying what it contains.

---

# DATA MIGRATION / RECOVERY

Only if legacy Medusa data exists, investigate:

* products
* variants
* customers
* addresses
* carts
* orders
* order items
* inventory
* discounts
* payments
* refunds
* shipping

For every category explain:

* source
* destination
* mapping
* transformation
* validation
* rollback
* whether migration is actually necessary

If no Medusa data exists, explicitly state that there is nothing to migrate.

---

# WHAT SHOULD NOT BE BUILT

Be disciplined.

Create three lists:

## Build Now

Features essential to PawTag commerce.

## Build Later

Features useful after the core commerce engine is stable.

## Do Not Build

Things that should remain external infrastructure.

Examples:

Do not build our own:

* card processor
* card network
* card vault
* fraud network
* shipping network
* carrier network
* email delivery network
* SMS network
* global maps database

Own:

* commerce business logic
* PawTag product data
* cart
* checkout orchestration
* orders
* inventory
* fulfilment orchestration
* promotions
* commerce administration
* provider integrations
* commerce audit trail

---

# PHASED IMPLEMENTATION ROADMAP

Create a realistic implementation plan.

Possible phases:

## Phase 1 — Commerce Foundation

## Phase 2 — Product Catalogue

## Phase 3 — Inventory

## Phase 4 — Cart

## Phase 5 — Checkout

## Phase 6 — Payments

## Phase 7 — Shipping

## Phase 8 — Fulfilment & Tracking

## Phase 9 — Refunds & Returns

## Phase 10 — Shop & Commerce Admin

## Phase 11 — Integrations & Webhooks

## Phase 12 — Testing

## Phase 13 — Production Hardening

## Phase 14 — Legacy Medusa Cleanup

Only include the final cleanup phase if there are actually remaining Medusa remnants.

Change the phases if repository analysis reveals a better dependency order.

For every phase explain:

* objective
* what we build
* why
* files/modules likely affected
* database changes
* APIs
* external services
* dependencies
* risks
* testing
* definition of done
* prerequisites for next phase

---

# BUSINESS-OWNER EXPLANATION

After the technical architecture, provide a simple explanation.

Explain:

## What PawTag already has

## What is missing

## What Medusa used to provide

## What remains from Medusa, if anything

## What PawTag will own

## What external companies will handle

## What customers will experience

## What administrators will experience

## What the biggest risks are

## What will cost money

## What will require the most development effort

Use plain English.

---

# REQUIRED FINAL REPORT

Your report MUST contain these sections:

# 1. Executive Summary

# 2. What PawTag Has Today

# 3. Current PawTag Architecture

# 4. Existing Commerce Functionality

# 5. What Medusa Used to Do

# 6. Remaining Medusa Remnants

# 7. Commerce Gap Analysis

# 8. What We Should Keep

# 9. What We Should Improve

# 10. What We Need to Build

# 11. Recommended Custom Commerce Architecture

# 12. Enterprise Shop & Commerce Admin Design

# 13. Complete Commerce Feature List

# 14. Product & Catalogue Architecture

# 15. Pricing & Promotions Architecture

# 16. Cart Architecture

# 17. Checkout Architecture

# 18. Payment Architecture

# 19. Apple Pay & Google Pay

# 20. Shipping Architecture

# 21. Tracking & Fulfilment Architecture

# 22. Inventory Architecture

# 23. Order & Refund Architecture

# 24. Returns Architecture

# 25. Customer Architecture

# 26. Tax / NZ GST Architecture

# 27. Database Architecture

# 28. API Architecture

# 29. External Integration Architecture

# 30. Notifications & Webhooks

# 31. Security Architecture

# 32. Observability

# 33. Testing Strategy

# 34. Legacy Medusa Cleanup / Data Strategy

# 35. Migration / Transition Plan

# 36. What NOT to Build

# 37. Risks & Potential Problems

# 38. Recommended MVP

# 39. Future Enhancements

# 40. Phased Implementation Roadmap

# 41. Exact "Do This First" Checklist

---

# FEATURE PRIORITIZATION

Every major proposed feature should be classified:

### 🔴 REQUIRED

Necessary for a production commerce system.

### 🟡 RECOMMENDED

Strongly recommended but not essential for first launch.

### 🟢 OPTIONAL

Useful later.

### ⚪ NOT REQUIRED

Should not be built unless future business requirements change.

This is important because I do not want the project to become unnecessarily complicated.

---

# ARCHITECTURAL DECISION FORMAT

For major decisions use:

```text
Decision:
[decision]

Recommendation:
[recommended approach]

Why:
[plain-English explanation]

Technical reason:
[technical explanation]

Business impact:
[impact]

Alternative considered:
[alternative]

Why we are not choosing it:
[reason]
```

---

# IMPORTANT ENGINEERING RULES

## Rule 1 — Inspect Before Assuming

Never assume a technology exists.

Verify it.

---

## Rule 2 — Repository Is the Source of Truth

Documentation may be outdated.

Use actual:

* source code
* configuration
* package manifests
* database schema
* migrations
* tests

as primary evidence.

---

## Rule 3 — Medusa Is Already Uninstalled

Do not tell me to uninstall Medusa.

Do not perform a fake "Medusa removal" task.

Only investigate and clean up remaining remnants if they actually exist.

---

## Rule 4 — No Premature Coding

Audit first.

Understand second.

Architect third.

Plan fourth.

Get approval fifth.

Implement sixth.

---

## Rule 5 — No Destructive Changes Without Approval

Do not:

* delete data
* drop tables
* delete legacy commerce code
* remove dependencies
* rewrite existing systems

without first explaining what will happen.

---

## Rule 6 — Preserve Working Functionality

If PawTag already has a good solution, reuse it.

Do not rewrite something merely because you prefer a different architecture.

---

## Rule 7 — Use Existing PawTag Technology

Prefer the existing stack.

Do not introduce a new framework or database unnecessarily.

---

## Rule 8 — No WooCommerce

Never introduce WooCommerce.

---

## Rule 9 — No Shopify

Never introduce Shopify.

---

## Rule 10 — No Medusa

Do not reinstall Medusa.

Do not build the new architecture around Medusa.

---

## Rule 11 — No Replacement E-commerce Platform

Do not replace Medusa with:

* another e-commerce platform
* another commerce engine
* another large third-party framework

Build commerce into PawTag.

---

## Rule 12 — External Providers Are Allowed

Use specialist providers for:

* payment processing
* shipping
* maps
* email
* SMS
* tax services
* fraud prevention
* fulfilment

where appropriate.

---

## Rule 13 — Provider Independence

Use interfaces/adapters.

Do not scatter provider-specific logic throughout PawTag.

---

## Rule 14 — Payment Security

Never store raw payment-card information.

---

## Rule 15 — NZ First

PawTag operates in New Zealand.

Prioritize:

* NZ payment methods
* NZ shipping
* GST
* NZ addresses
* NZ customer expectations
* NZ operational requirements

while keeping the architecture capable of future international expansion.

---

## Rule 16 — Avoid Overengineering

Do not build enterprise features just because they sound impressive.

Every feature needs a reason.

---

## Rule 17 — Explain Unknowns

If something cannot be determined:

> Unknown — repository evidence is insufficient.

Never guess.

---

## Rule 18 — Explain Major Decisions

For major architecture decisions explain:

* what
* why
* alternatives
* trade-offs
* business impact
* technical impact
* operational impact

---

## Rule 19 — Production Quality

The target system should consider:

* reliability
* security
* scalability
* maintainability
* observability
* backups
* recovery
* auditability
* testing
* monitoring

---

## Rule 20 — Commerce Correctness Comes First

Financial correctness and inventory correctness are more important than architectural elegance.

The system must not accidentally:

* charge customers twice
* create duplicate orders
* oversell inventory
* refund twice
* lose payment state
* lose shipment state
* lose order state

---

# IMPLEMENTATION GATE

After completing the audit, architecture and implementation roadmap:

STOP.

Do NOT begin implementation automatically.

Do NOT modify the repository.

Instead finish with:

```text
IMPLEMENTATION READY

Repository audit: COMPLETE
Current-state analysis: COMPLETE
Commerce gap analysis: COMPLETE
Medusa legacy analysis: COMPLETE
Target architecture: COMPLETE
Database architecture: COMPLETE
API architecture: COMPLETE
Payment architecture: COMPLETE
Shipping architecture: COMPLETE
Admin architecture: COMPLETE
Migration/cleanup strategy: COMPLETE
Implementation roadmap: COMPLETE

Recommended first implementation task:

[exact task]

Repository modifications have NOT been started.

Waiting for explicit approval before implementation.
```

Only begin implementation after I explicitly approve.

---

# FINAL OBJECTIVE

The final PawTag architecture should look conceptually like:

```text
                         PAWTAG
                            │
             ┌──────────────┴──────────────┐
             │                             │
       Existing Admin               Shop & Commerce
                                             │
                                    PawTag Commerce Engine
                                             │
          ┌──────────────┬──────────────┬────┴─────────────┐
          │              │              │                  │
       Catalog          Cart         Checkout            Orders
          │              │              │                  │
      Inventory       Pricing       Payments          Fulfilment
                                        │                  │
                                   Payment Provider     Shipping
                                        │                  │
                                  Apple Pay            Tracking
                                  Google Pay
```

PawTag should ultimately own:

* commerce data
* commerce business logic
* products
* variants
* pricing
* cart
* checkout orchestration
* orders
* inventory
* discounts
* promotions
* refunds
* fulfilment orchestration
* customer commerce history
* commerce administration
* provider integrations
* commerce audit trails

External providers should handle specialist infrastructure.

The result should be:

**A modern, production-ready, enterprise-grade PawTag Commerce Engine built natively into PawTag.**

It should provide the capabilities expected from a mature e-commerce system while remaining appropriate for PawTag's actual business.

Do not build a generic e-commerce platform for the sake of building one.

Build the commerce capabilities PawTag actually needs, using a clean architecture that can grow with the business.

Most importantly:

# AUDIT FIRST.

# UNDERSTAND SECOND.

# DESIGN THIRD.

# GET APPROVAL FOURTH.

# IMPLEMENT FIFTH.

# TEST THOROUGHLY.

# HARDEN FOR PRODUCTION.
