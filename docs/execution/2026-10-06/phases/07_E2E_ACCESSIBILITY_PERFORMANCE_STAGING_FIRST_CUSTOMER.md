# Phase 07 — Browser E2E, CI, Accessibility, Performance, Staging Rehearsal, and First Controlled Web Customer

## Objective

Convert prior implementation claims into real end-to-end evidence and reach a controlled first-customer web launch without requiring DynamoDB, Donations, or the public store app.

## Required skills

`work-packet-executor`, `testing-regression`, `release-readiness`, `production-readiness-review`, `security-boundary-review`, `pawtag-ui-ux`

## A. Playwright/browser E2E

Create a stable E2E harness with isolated test data and production-like configuration semantics.

Mandatory journeys:

### Auth/account
- register/verify/login;
- MFA if enabled;
- refresh/restart behavior;
- logout/revocation;
- password reset;
- object-level authorization negative case.

### Pet/tag/recovery
- create pet;
- activate tag;
- mark lost;
- Finder web scan/notify;
- owner sees recovery notification/state.

### Commerce
- product -> cart;
- customization/engraving;
- quantity and inventory errors;
- promo/rewards where enabled;
- shipping/address;
- Cart 70/30 visual structure at desktop viewport;
- Checkout Delivery/Review/Payment persistent 70/30 shell;
- payment success using `stripe_test` or deterministic safe fake mode according to suite purpose;
- payment failure/3DS simulation where test infrastructure supports it;
- duplicate submit/reload recovery;
- order detail/invoice;
- cancellation/refund flow appropriate to policy.

### Subscription
- subscribe/payment/activation;
- failed payment does not activate;
- manage/cancel state.

## B. CI quality gate

CI should run at least typecheck, lint if supported, unit, integration, regression, smoke, build, and a practical E2E subset. Do not merge/declare release-ready on critical gate failure.

## C. Accessibility

Automated checks plus manual keyboard/screen-reader-oriented review for:
- Finder web;
- Cart/Checkout;
- auth forms;
- pet/lost mode;
- critical admin confirmations.

## D. Performance/poor network

Measure and improve:
- Finder first useful render;
- customer initial bundles/route loading;
- Cart/Checkout API duplication/races;
- critical API query counts;
- slow 4G/latency/retry behavior.

Do not optimize theoretical scale at the cost of correctness.

## E. Staging dress rehearsal

Use production-like deployment with real test providers:
- `stripe_test`, signed webhooks;
- real transactional email test recipients;
- real private storage;
- configured shipping test/sandbox or documented manual mode;
- worker process;
- monitoring/alerts.

Run complete business journeys and failure injection.

## F. Security abuse rehearsal

At minimum attempt:
- IDOR/BOLA on customer resources/order/invoice;
- invalid/duplicate Stripe webhook;
- price/shipping/reward manipulation;
- refund/cancel replay;
- auth/session abuse;
- Finder spam/enumeration/public field leakage;
- admin permission boundary.

## G. Real-person UX test

Have a non-developer perform:
- buy/customize a PawTag;
- Cart and Checkout on desktop and phone browser;
- create/manage pet;
- simulate lost pet and Finder browser recovery;
- find order/invoice/support.

Record confusion and fix launch-blocking usability issues.

## First controlled web customer gate

The founder may proceed to a controlled first customer only when `verification/FINAL_FIRST_CUSTOMER_GATE.md` is green. DynamoDB, Donations, and the public native store app are not prerequisites unless explicitly promoted to launch scope.

## Stop

After recording the first-customer gate result, stop before mobile-shell migration.
