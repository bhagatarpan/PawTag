# Phase 01 — Production Security, Provider Modes, Webhooks, and Session Boundaries

## Objective

Make production/test behavior explicit and fail closed. Remove any path where missing configuration or provider failure can be reported as success, and complete high-risk session/webhook boundaries before deeper financial work.

## Depends on

Phase 00 `PROVEN` baseline.

## Required skills

`work-packet-executor`, `security-boundary-review`, `commerce-safety`, `stripe-integration`, `production-readiness-review`, `testing-regression`, `api-architecture`

## Primary areas/files to inspect

- `packages/api/src/commerce/payment-mode.ts`
- `packages/api/src/config/validateEnv.ts`
- `packages/api/src/index.ts`
- `packages/api/src/lib/stripe-client.ts`
- `packages/api/src/routes/stripe-webhooks.ts`
- `packages/api/src/jobs/webhookRetry.ts`
- `packages/db/src/models/WebhookEvent.ts`
- `packages/api/src/routes/auth.ts`
- `packages/api/src/services/auth.service.ts`
- `packages/api/src/middleware/auth.ts`
- `packages/shared/src/api/client-factory.ts`
- `apps/web/src/lib/api.ts`, `apps/admin/src/lib/api.ts`
- `packages/api/src/routes/resend-webhooks.ts`
- `packages/api/src/services/email.service.ts`
- `packages/api/src/services/push-notification.service.ts`
- shipping provider/adapters and production fulfilment configuration
- subscription/membership activation paths

## Tasks

### A. Payment environment contract

1. Verify/finish explicit modes: `fake`, `stripe_test`, `stripe_live`.
2. `fake` is local/dev deterministic behavior only.
3. `stripe_test` uses real Stripe Test API/webhooks/test cards, not synthetic success.
4. production must hard-fail unless configured for `stripe_live` when commerce is enabled.
5. Database/admin settings must not silently downgrade production provider mode.
6. Health/readiness output may expose only sanitized mode/state, never secrets.
7. Add tests proving forbidden production combinations fail startup.

### B. Stripe webhook safety/durability

1. Verify raw request body reaches Stripe signature verification before JSON parsing.
2. Normalize event ID/type before processing so failure recording never loses identity.
3. Persist unique Stripe event IDs and idempotent business side effects.
4. Define statuses such as pending/processing/succeeded/failed plus attempt/lease timestamps.
5. Retry stale failed events and recover events stranded in `processing` after a crash.
6. Test duplicate and out-of-order delivery.
7. Do not return false success for invalid signatures.

### C. Browser session contract

1. Verify login/refresh/MFA set HttpOnly refresh cookie **before** sending response.
2. Browser clients must not persist refresh tokens in localStorage after the migration.
3. Native-shell strategy is separate: native secure storage bridge may receive/store appropriate tokens if required by final auth design.
4. Analyze and implement CSRF/SameSite/origin protections appropriate to cookie auth.
5. Verify logout, password change/reset, lockout, session revocation, and refresh rotation.
6. Admin auth must receive the same security scrutiny, not a privileged bypass.

### D. Provider fail-closed behavior

Audit email, push, storage, shipping, CAPTCHA and any provider adapter for patterns such as:

```text
missing credential -> log warning -> return success/demo value
```

Production must either execute a real supported provider path or fail explicitly into a durable repair/operational state.

Examples to verify from prior audit evidence:
- Resend missing key must not report sent;
- Resend webhook route/signature must be correct and authenticated/verified;
- push missing provider config must not report delivered;
- shipping/NZ Post missing credentials must not fabricate a valid tracking number;
- subscription provider failure must not create an active paid entitlement.

## Tests

- production config matrix;
- Stripe signed webhook integration fixture;
- duplicate/out-of-order/stale-processing webhook tests;
- login/refresh/MFA/logout cookie and revocation tests;
- CSRF/origin negative tests where applicable;
- provider-missing-config tests that assert failure, not fake success;
- subscription activation negative tests.

## Acceptance gate

- Production configuration has no silent demo-success path for money, shipment, email, push, or entitlement.
- Stripe webhook verification/idempotency/recovery is proven by tests.
- Browser refresh-token storage/cookie behavior is consistent and tested.
- Security controls were not weakened to satisfy clients.
- `verification/PAYMENT_PROVIDER_MODE_MATRIX.md` is updated with evidence.

## Rollback

Configuration changes must be reversible without weakening production safety. If a provider cannot be proven, disable the dependent production feature rather than re-enable a demo fallback.

## Stop

Stop before Phase 02.
