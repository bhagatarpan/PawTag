---
name: stripe-integration
description: Implement or review any PawTag Stripe integration — client construction, subscriptions, payment intents, webhooks, billing portal, refunds, price IDs, API version, payment mode. Use whenever code touches Stripe SDK, STRIPE_* env keys, or provider adapters. Enforces a single client factory and no scattered hardcodes.
---

# Stripe Integration

Follow `AGENTS.md` first. Commerce safety remains mandatory (`skills/commerce-safety/`).

## Single client factory (non-negotiable)

**All Stripe SDK construction goes through:**

```text
packages/api/src/lib/stripe-client.ts
  getStripeClient()
  setStripeClientForTests(client)   // tests only
  resetStripeClientCache()          // tests only
```

### Never

- Call `new Stripe(...)` in feature code, routes, or services
- Read `STRIPE_SECRET_KEY` outside the factory / payment-mode / validateEnv
- Copy-paste local `_stripe` caches per service
- Hardcode API version in feature files

### Configuration (one place each)

| Concern | Source |
|---|---|
| Secret key | `STRIPE_SECRET_KEY` env |
| API version | `STRIPE_API_VERSION` env or `@pawtag/shared` `STRIPE_DEFAULT_API_VERSION` |
| Payment mode | `PAYMENT_MODE` via `commerce/payment-mode.ts` (`fake` \| `stripe_test` \| `stripe_live`) |
| Webhook secret | `STRIPE_WEBHOOK_SECRET` (server only — never web env) |
| Default currency | `@pawtag/shared` `STRIPE_DEFAULT_CURRENCY` (`nzd`) |
| Key prefixes / demo IDs | `@pawtag/shared` `src/stripe.ts` |

### Import pattern

```ts
import { getStripeClient } from '../lib/stripe-client';
// or from route: '../../lib/stripe-client'

if (isFakeMode()) { /* local-only path */ }
const stripe = getStripeClient();
```

Re-export for legacy callers/tests:

```ts
// membership.service.ts
export { getStripeClient, setStripeClientForTests, resetStripeClientCache } from '../lib/stripe-client';
```

## Payment mode rules

| Mode | Behavior |
|---|---|
| `fake` | No Stripe API calls. `getStripeClient()` throws. |
| `stripe_test` | Real Stripe Test API (`sk_test_` / `pk_test_`). |
| `stripe_live` | Production only. Requires live keys + `PAYMENT_MODE=stripe_live`. |

Production `validateEnv` rejects test/demo keys. Never enable fake mode in production paths.

## Shared constants

Use `@pawtag/shared` stripe/membership modules — do not redefine:

- `STRIPE_DEFAULT_API_VERSION`
- `STRIPE_KEY_PREFIXES`, `isStripeTestSecretKey`, `isStripeDemoSecretKey`
- `isStripeDemoSubscriptionId`
- `STRIPE_DEFAULT_CURRENCY`
- Gold setting keys: `GOLD_BILLING_SETTING_KEYS`, `goldStripePriceSettingKey`

## Subscriptions & tier changes

- Membership tier change / Option A: `skills/membership-tier-change/`
- Error classification: `packages/api/src/services/stripe/stripe-subscription-errors.ts`
- Portal cancel/resume: shared `resolveStripeCancelSyncAction` + `billing-cancel-sync.service.ts`
- Reject demo/`non-sub_` IDs before any Stripe call

## Webhooks

- Mount with **raw body** before `express.json`
- Verify signature with unmodified raw body
- Dedupe via `WebhookEvent` `{source, eventId}`
- Domain handlers in services — route orchestrates only

## Testing Stripe code

```ts
import { setStripeClientForTests, resetStripeClientCache } from '../lib/stripe-client';

beforeEach(() => {
  process.env.PAYMENT_MODE = 'stripe_test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
  setStripeClientForTests(mockStripe);
});

afterEach(() => {
  resetStripeClientCache();
  process.env.PAYMENT_MODE = 'fake';
  delete process.env.STRIPE_SECRET_KEY;
});
```

Do not spy on per-service `getStripeClient` — inject at the factory.

## Checklist before any Stripe PR

- [ ] Uses central factory only
- [ ] No new `new Stripe(` outside `lib/stripe-client.ts`
- [ ] No hardcoded API version / currency / price fallbacks in Stripe mode
- [ ] Fake mode does not call Stripe
- [ ] Errors classified; fail closed for money paths
- [ ] Webhook raw body + signature + idempotency preserved
- [ ] Secrets not logged; webhook secret not in web `.env`
- [ ] Tests inject factory client; targeted membership/commerce suites pass
