# Payment, Webhook, and Critical Route Verification Matrix

The paths below are based on the reviewed source snapshot. Re-derive effective paths if router mounts change.

| Effective area/path | Method | Source | Purpose | Must verify |
|---|---|---|---|---|
| `/api/checkout/payment-intent` | POST | `routes/checkout.ts` | create/reuse authoritative checkout payment | auth, quote ownership, idempotency, reservations, payment mode |
| `/api/checkout/confirm` | POST | `routes/checkout.ts` | finalize paid/zero-total order | ownership, provider verification, idempotency, recovery states |
| `/api/checkout/pending` | GET | `routes/checkout.ts` | current pending checkout | ownership, stale/expiry behavior |
| `/api/checkout/status/:paymentIntentId` | GET | `routes/checkout.ts` | payment/order recovery | ownership, no cross-user lookup fallback |
| `/api/webhooks/stripe` | POST | `routes/stripe-webhooks.ts` | Stripe event intake | raw body, signature, event ID, duplicate/out-of-order, stale processing |
| `/api/webhooks/resend/...` | POST | `routes/resend-webhooks.ts` | email delivery state | **verify effective route; current router adds `/resend`**, signature/authenticity, duplicate event |
| `/api/shipping/rates` | GET | `routes/shipping.ts` | server shipping rates | server cart total, address validation, race/stale response |
| `/api/shipping/select` | POST | `routes/shipping.ts` | choose shipping method | stable method ID, server cost, synthetic fallback IDs |
| `/api/finder/:tagId` | GET | `routes/finder.ts` | public recovery data | public DTO, invalid/deactivated states, latency/privacy |
| `/api/finder/:tagId/notify` | POST | `routes/finder.ts` | notify owner | production CAPTCHA/rate limit, consent/contact validation, dedupe |
| `/api/finder/:tagId/share-location` | POST | `routes/finder.ts` | precise finder location | production CAPTCHA/rate limit, numeric coords, consent, retention |
| `/api/auth/login` | POST | `routes/auth.ts` | browser/native login | rate limit, MFA state, cookie/body contract, lockout |
| `/api/auth/refresh` | POST | `routes/auth.ts` | rotate session | cookie/native contract, rotation/revocation, CSRF/origin |
| `/api/auth/logout` | POST | `routes/auth.ts` | revoke session | cookie clear, token revoke, device push cleanup where applicable |
| `/api/auth/mfa/verify` | POST | `routes/auth.ts` | MFA completion | cookie/native token contract, replay/expiry/rate limit |
| `/api/membership/subscribe` | POST | `routes/membership.ts` | start membership payment | payment mode, incomplete state, no premature entitlement |
| `/api/membership/activate` | POST | `routes/membership.ts` | membership activation | authoritative payment/provider state, idempotency |
| `/api/membership/cancel` | POST | `routes/membership.ts` | cancel membership | provider/local saga, webhook reconciliation |
| `/api/membership/change-tier` | POST | `routes/membership.ts` | tier change | pricing/provider state, rollback/repair, entitlement timing |
| customer subscription routes | mixed | `routes/customer-subscriptions.ts` | manage subscription | ownership, provider portal, cancellation/renewal idempotency |
| customer return routes | mixed | `routes/customer-returns.ts` | returns/cancel/tracking | ownership, status rules, no money movement from status alone |
| admin returns/refunds | mixed | `routes/admin-returns.ts`, `admin-refunds.ts` | financial admin actions | explicit RBAC, confirmation, server amount, idempotent provider refund |
| invoice access routes | mixed | `routes/invoice-access.ts` | customer/admin/opaque invoice access | ownership/RBAC, token persistence/expiry/revocation, no enumeration |
| push token routes | mixed | `routes/push-tokens.ts` | device registration | token provider/type/platform, ownership, logout removal |

## For every mutation endpoint

Verify server-side validation, auth/authz/ownership, stable error codes, idempotency when retryable, audit event where sensitive, rate limit where abuse-prone, and regression/integration coverage.
