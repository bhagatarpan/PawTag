# PawTag Master Autonomous Execution Roadmap

This is the program-level map. The actual executable instructions live in `phases/00...18`.

## Outcome

Reach a state where PawTag can safely serve real customers, then ship a single-codebase customer app to iOS/Android, migrate persistence incrementally to DynamoDB, and add a production-grade donation domain without destabilizing the core business.

## Track A — Core PawTag first-customer readiness

### Phase 00 — Evidence reset
Re-run current tests/builds, correct optimistic status claims, establish real evidence.

### Phase 01 — Production safety/provider modes
Payment mode, webhook durability, session security, fail-closed external providers.

### Phase 02 — Financial state integrity
Authoritative quote, shipping, rewards/promo reservations, inventory, pending checkout expiry, order/payment recovery, refunds.

### Phase 03 — Communications/documents/subscriptions
Email delivery, Resend webhook, invoices/access, push architecture decision, subscription entitlement correctness.

### Phase 04 — Premium Cart/Checkout/customer web
Premium 8/4 Cart, persistent 8/4 Checkout shell across Delivery/Review/Payment, responsive/mobile-browser UX, accessibility/states.

### Phase 05 — Finder web only
No app. Browser recovery, privacy, consent, abuse control, poor-network behavior.

### Phase 06 — Admin/workers/deployment/observability
High-risk admin operations, worker leases/retries, Docker/env, backup/restore, rollback, alerts.

### Phase 07 — End-to-end proof and first controlled web customer
Playwright/CI, security abuse rehearsal, accessibility/performance, staging, real-person UX, first-customer gate.

## Track B — iOS/Android without duplicate product UI

### Phase 08 — Shared customer web foundation
Make `apps/web` genuinely mobile-app quality and introduce platform capability abstractions.

### Phase 09 — Capacitor shell and native bridges
Bundle the web app; secure session bridge; push, QR, NFC, deep links; shared checkout.

### Phase 10 — Physical devices and stores
TestFlight/Play internal, real camera/NFC/push/checkout/deep links, store declarations, then retire Expo duplication.

## Track C — MongoDB -> DynamoDB

### Phase 11 — Discovery only
Complete persistence/access-pattern/transaction/index inventory. No behavior changes.

### Phase 12 — Boundary/infrastructure/low-risk migration
Repository contracts, DynamoDB Local + real AWS non-prod, IaC, resumable migration tooling, first low-risk domain cutovers.

### Phase 13 — High-risk migration/cutover
Identity, recovery, commerce, inventory, membership, rewards, webhooks, jobs, audit. Failure injection and rollback required before Mongo retirement.

## Track D — Donation system

### Phase 14 — External/legal gate + architecture audit
Confirm what AI cannot decide; reconcile donation design with current platform/persistence.

### Phase 15 — One-time donation core
Supporter identity, server-authoritative amount, Stripe PaymentIntent/webhooks, idempotency, receipt trigger, `/donate`.

### Phase 16 — Recurring + receipts + portals/admin
Monthly Stripe Billing, immutable donation receipts/PDF/email, customer/admin management, refunds/corrections.

### Phase 17 — Reconciliation/security/public launch
Repair jobs, observability, security tests, controlled live donate/refund/recurring smoke, feature-flag enablement.

## Phase 18 — Program reconciliation
Full regression/evidence/doc/skills reconciliation after all active tracks.

## Why this order

1. It reduces simultaneous unknowns: stabilize current money/recovery paths before changing database and adding donations.
2. The mobile app then reuses a stable, premium customer web product instead of wrapping unfinished UI.
3. DynamoDB gets an access-pattern and repository foundation before high-risk state moves.
4. Donations are added after financial primitives and persistence conventions are trustworthy.
5. External legal/store/cloud blockers can progress in parallel without forcing unsafe guesses into code.

## Technical-lead rule

Do not optimize for a percentage of tasks checked off. Optimize for verified invariants: ownership, authoritative money, idempotency, recoverability, delivery, real provider behavior, and understandable customer experience.
