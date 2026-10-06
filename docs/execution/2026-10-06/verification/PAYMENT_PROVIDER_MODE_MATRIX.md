# Payment / Provider Mode Verification Matrix

Fill every row with evidence. `Expected production` must never silently fall back to fake/demo behavior.

**Phase 01 update (2026-10-06):** automated evidence recorded below. Runtime/provider/staging evidence remains `CODED_NOT_RUNTIME_VALIDATED` until live Stripe/Resend/Firebase runs.

| Capability | Local/dev | Integration/staging | Production expected | Missing-config behavior | Evidence |
|---|---|---|---|---|---|
| Commerce payment | `fake` allowed; deterministic | `stripe_test` real Stripe Test API | `stripe_live` | fail startup/feature closed | **PROVEN (automated):** `validateEnv` throws if production `PAYMENT_MODE` missing/invalid/not `stripe_live`; rejects test/demo Stripe keys and placeholder webhook secrets. `getStripeClient()` throws in fake mode. Tests: `tests/integration/production-payment-config.test.ts`, `tests/unit/validateEnv.test.ts`, `tests/unit/payment-mode.test.ts`, `tests/unit/stripe-client-factory.test.ts`. DB Setting `commerce.payment.provider` does not override env `PAYMENT_MODE` (env-only resolution). |
| Stripe webhook | signed test fixture/test endpoint | real Stripe test webhook | real live webhook | reject / unhealthy | **CODED + automated partial:** raw body mounted before `express.json`; signature verify via provider `constructEvent`; invalid signature → 400 (not success); unique `{source,eventId}` idempotency; failed events record identity from raw Buffer; retry job recovers stranded `processing` after 5 min. Live Stripe delivery **not run**. Tests: `stripe-webhook-raw-body.test.ts`, `stripe-webhook-durability.test.ts`. |
| Subscription billing | fake only if explicit | real Stripe test Billing | live Stripe Billing | no active entitlement | **CODED_NOT_RUNTIME_VALIDATED:** production cannot be fake mode (`validateEnv` requires `stripe_live`); membership demo activation only under `isFakeMode()`. Live Billing not run. |
| Refund | fake deterministic only | Stripe test refund | Stripe live refund | fail/retry/manual review | **CODED_NOT_RUNTIME_VALIDATED** — covered in later financial phases; factory rejects fake mode for Stripe calls. |
| Transactional email | local adapter/log allowed if explicit | real Resend to test recipients | real Resend | failed dispatch, not sent | **PROVEN (automated):** production missing `RESEND_API_KEY` → `sendMail` returns `{success:false}` and records failed audit; never reports demo success. Dev/test demo path only. |
| Resend delivery webhook | optional local fixture | signed provider event | signed provider event | reject unauthenticated | **PROVEN (automated):** route mounted at `/api/webhooks/resend` (no double `/resend`); raw body + Svix HMAC verify when `RESEND_WEBHOOK_SECRET` set; production missing secret → 500; invalid signature → 400. Test: `resend-webhook-signature.test.ts`. |
| Object storage | local adapter | non-prod private storage | production private storage | document/media operation fails safely | **CODED_NOT_RUNTIME_VALIDATED** — `STORAGE_DRIVER=r2` requires R2 env keys via `validateEnv`. |
| Shipping quote | seeded/local rules | sandbox/real configured rules | authoritative live/manual config | unavailable, not client-priced | **CODED_NOT_RUNTIME_VALIDATED** — quote path not fully live-validated this phase. |
| Shipment/tracking | fake clearly labeled local only | sandbox/manual | real provider or explicit manual fulfilment | never fabricate tracking | **PROVEN (automated fail-closed):** production missing `SHIPPING_PROVIDER_API_KEY` → `createShipment` returns `{success:false}` with no tracking number. Demo tracking only outside production. Test: `provider-fail-closed.test.ts`. |
| Push | local no-op may be explicit | real non-prod device token/provider | real production provider | failed/not configured, never “delivered” | **PROVEN (automated fail-closed):** production unconfigured Firebase → `sendPushToUser` returns `{sent:0, failed:N, error}` — never claims delivered. Demo log path only non-production. |
| CAPTCHA/abuse | local bypass explicit | production semantics | production semantics | fail/controlled degraded policy | **CODED_NOT_RUNTIME_VALIDATED** — finder CAPTCHA middleware present; production-like notify path not re-proven this phase. |

## Required tests — Phase 01 results

| Requirement | Result |
|---|---|
| production `PAYMENT_MODE=fake` rejected | PASS (`production-payment-config.test.ts`, `validateEnv.test.ts`) |
| production test Stripe key rejected if live required | PASS |
| missing live webhook secret rejected/unhealthy | PASS (Stripe + Resend) |
| provider missing config never returns fake success | PASS (push, shipping, SMS, email) |
| fake mode never contacts live providers | PASS (`getStripeClient` throws in fake) |
| test/live IDs/keys are not mixed | PASS (validateEnv live-key checks) |
| health/readiness exposes sanitized status only | PASS (`/health/dependencies` exposes mode/configured booleans only — no secrets) |
| Stripe webhook duplicate/out-of-order | PASS idempotency index + completed short-circuit; full out-of-order suite partial (fake-mode processing path) |
| Browser refresh cookie + no localStorage refresh token | PASS (`browser-auth-session.test.ts`, `browser-token-storage.test.ts`) |

## External validation still required (not claimed)

- Real Stripe `stripe_test`/`stripe_live` webhook delivery against staging
- Real Resend outbound + delivery webhook with provider secret
- Real Firebase push to a device
- Real courier shipping API once implemented
- CAPTCHA production-like finder notify rehearsal
