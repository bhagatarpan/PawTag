# Payment / Provider Mode Verification Matrix

Fill every row with evidence. `Expected production` must never silently fall back to fake/demo behavior.

| Capability | Local/dev | Integration/staging | Production expected | Missing-config behavior | Evidence |
|---|---|---|---|---|---|
| Commerce payment | `fake` allowed; deterministic | `stripe_test` real Stripe Test API | `stripe_live` | fail startup/feature closed | |
| Stripe webhook | signed test fixture/test endpoint | real Stripe test webhook | real live webhook | reject / unhealthy | |
| Subscription billing | fake only if explicit | real Stripe test Billing | live Stripe Billing | no active entitlement | |
| Refund | fake deterministic only | Stripe test refund | Stripe live refund | fail/retry/manual review | |
| Transactional email | local adapter/log allowed if explicit | real Resend to test recipients | real Resend | failed dispatch, not sent | |
| Resend delivery webhook | optional local fixture | signed provider event | signed provider event | reject unauthenticated | |
| Object storage | local adapter | non-prod private storage | production private storage | document/media operation fails safely | |
| Shipping quote | seeded/local rules | sandbox/real configured rules | authoritative live/manual config | unavailable, not client-priced | |
| Shipment/tracking | fake clearly labeled local only | sandbox/manual | real provider or explicit manual fulfilment | never fabricate tracking | |
| Push | local no-op may be explicit | real non-prod device token/provider | real production provider | failed/not configured, never “delivered” | |
| CAPTCHA/abuse | local bypass explicit | production semantics | production semantics | fail/controlled degraded policy | |

## Required tests

- production `PAYMENT_MODE=fake` rejected;
- production test Stripe key rejected if live required;
- missing live webhook secret rejected/unhealthy;
- provider missing config never returns fake success;
- fake mode never contacts live providers;
- test/live IDs/keys are not mixed;
- health/readiness exposes sanitized status only.
