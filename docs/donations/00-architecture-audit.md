# Donation Architecture Audit (Phase 14)

**Executed:** 2026-10-07  
**Status:** Architecture only — **no donation UI/payment code in this phase.**  
**Stripe test env:** `PAYMENT_MODE=stripe_test`, secret/webhook keys present in `packages/api/.env.local` (not printed).

## Objective reconciliation

PawTag already has hardened commerce/auth/email/invoice primitives (Phases 01–03). Donation is a **distinct financial domain** that reuses those primitives where semantics match, without becoming a shop SKU.

## Reusable components (current code)

| Component | Location | Reuse for donations | Notes |
|---|---|---|---|
| Stripe client factory | `packages/api/src/lib/stripe-client.ts` | **Yes** | Single factory; no `new Stripe` elsewhere |
| Payment mode | `commerce/payment-mode.ts` | **Yes** | `fake` / `stripe_test` / `stripe_live`; prod requires live |
| PaymentIntent create | `commerce/providers/stripe` | **Yes** | Server-owned amount |
| Webhook raw body + signature | `routes/stripe-webhooks.ts` | **Yes** | Mount before `express.json`; unique event idempotency |
| WebhookEvent ledger | `packages/db/src/models/WebhookEvent.ts` | **Yes** | `{source,eventId}` unique; extend source enum for `stripe` donations |
| Auth identity | `User` + `auth.service` | **Yes** | Donation supporter = customer context `DONATION`; no separate donor login |
| Refresh/session | HttpOnly cookies (Phase 01) | **Yes** | Browser refresh tokens not in localStorage |
| Email send + audit | `email.service.ts` + `EmailAudit` | **Yes** | CMS templates + fail-closed production; idempotencyKey |
| Email webhooks | `routes/resend-webhooks.ts` | **Yes** | Svix signature + WebhookEvent dedupe |
| Invoice/PDF pattern | `Invoice`, `invoice-html.service`, access tokens | **Partial** | Reuse PDF/storage/access **primitives**, **not** commerce invoice meaning |
| Number counters | `counters` collection `$inc` | **Yes** | Receipt sequence separate from order/INVM numbers |
| RBAC | `requirePermission` | **Yes** | New permissions e.g. `donation.read`, `donation.refund` |
| Audit events | `audit.service` | **Yes** | FINANCIAL events for donation create/pay/refund |
| Background jobs | `jobs/*` + worker | **Yes** | Receipt retry, reconciliation later |
| Settings | Setting + Settings repository | **Yes** | **All donation product values configurable** |
| Refund services | `refund.service` / returns | **Partial** | Donation refund is domain-specific; reuse Stripe refund primitives |
| Frontends | web/admin/finder | **Partial** | `/donate` + admin; Finder **not** involved |

## Gaps / must-build in Phase 15–17

| Gap | Phase |
|---|---|
| Donation domain models + repositories | 15 |
| `/donate` public page + API | 15 |
| Supporter identity context (no pet onboarding) | 15 |
| Donation receipt type (distinct from commerce invoice) | 15–16 |
| Configurable settings seed for donation | 15 |
| Recurring Stripe Billing for donations | 16 |
| Customer/admin donation portals | 16 |
| Reconciliation jobs + controlled launch flag | 17 |

## External legal/tax gate (BLOCKED_EXTERNAL)

See `docs/execution/2026-10-03_EXTERNAL_OWNER_ACTIONS.md` section C.  
**Engineering may build neutral payment/receipt infrastructure.**  
**Must not** code IRD tax-credit claims until founder/accountant confirms donee status.

| Item | Status |
|---|---|
| Legal organisation name | **BLOCKED_EXTERNAL** (config placeholder `PawTag`) |
| IRD number on receipt | **BLOCKED_EXTERNAL** (optional config; off by default) |
| Approved-donee status | **BLOCKED_EXTERNAL** — UI/receipts must not claim tax credit |
| Tax/GST wording | **BLOCKED_EXTERNAL** — neutral wording only |
| Refund tax treatment | **BLOCKED_EXTERNAL** |
| Data retention for donation records | **BLOCKED_EXTERNAL** (suggest 7 years; founder confirms) |

## Persistence decision

- **Phase 15–16:** MongoDB behind **repository interfaces** (same pattern as Settings Phase 12).
- **Not** embedding Mongoose in donation business logic.
- DynamoDB for donations deferred until after first web customer / later migration waves (donations are high-risk money — **not** first Dynamo cutover).

## Stripe environment confirmation (this session)

| Var | Observed |
|---|---|
| `PAYMENT_MODE` | `stripe_test` |
| `STRIPE_SECRET_KEY` | Present (`sk_test…`) |
| `STRIPE_WEBHOOK_SECRET` | Present (`whsec_…`) |
| `RESEND_API_KEY` | Present (`re_…`) |

Live Stripe donation rehearsal remains Phase 17 controlled launch (needs webhook URL on Stripe dashboard).
