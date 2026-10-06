# Email, Invoice, Notification, and Link Verification Matrix

For each row fill: trigger, source service, recipient source, template/document, link target, persistence/audit record, retry policy, provider evidence, tests.

**Phase 03 update (2026-10-06):** automated evidence recorded; live provider proof still required.

| Event | Recipient | Expected artifact/channel | Link/route | Retry/idempotency | Status/evidence |
|---|---|---|---|---|---|
| Account verification | user email | verification email | verification route | token single-use/expiry | **CODED_NOT_RUNTIME_VALIDATED** — sendMail audit recorded; production missing Resend fails closed (Phase 01 PROVEN automated) |
| Password reset | user email | reset email | reset route | token single-use/expiry | **CODED_NOT_RUNTIME_VALIDATED** |
| MFA/OTP if email used | user | OTP | auth flow | rate/expiry | **CODED_NOT_RUNTIME_VALIDATED** |
| Finder notify owner | owner | email for active tags (any customer; free = 3-month Active Period) | recovery | duplicate finder safe (5-min window) | **PROVEN (automated)** — free-customer email regression test; finder notify tests green |
| Order confirmation | purchasing customer | email + order link | Order detail | EmailAudit idempotencyKey `order-confirmation:{orderNumber}` | **CODED_NOT_RUNTIME_VALIDATED** — audit key coded; live Resend not run |
| Commerce invoice issued | customer | email + PDF/link | Invoice detail/access token | InvoiceAccessToken hashed/expiring/OTP | **CODED_NOT_RUNTIME_VALIDATED** — ownership/token rules present; live email not run |
| Shipment update | customer | email/in-app | Order/tracking | orderNumber-based audit keys where used | **CODED_NOT_RUNTIME_VALIDATED** |
| Order cancellation | customer | email/in-app | Order detail | state transition idempotent | **CODED_NOT_RUNTIME_VALIDATED** |
| Refund requested/processed | customer + admin | email/in-app + credit/refund context | Order/return/refund | refund idempotent (Phase 02 partial) | **CODED_NOT_RUNTIME_VALIDATED** |
| Membership activation | customer | welcome/receipt only after true entitlement | Membership | Stripe status must be active/trialing before local activate | **PROVEN (automated)** — `membership-activation-payment-gate.test.ts` refuses incomplete Stripe sub |
| Membership payment failed | customer | failure/recovery | Membership/payment method | dunning path coded | **CODED_NOT_RUNTIME_VALIDATED** |
| Membership cancelled | customer | confirmation | Membership | webhook/request idempotent | **CODED_NOT_RUNTIME_VALIDATED** |
| Donation * | — | — | — | Phase 14–17 | **NOT_STARTED** |

## Provider webhook verification (Resend)

| Check | Evidence |
|---|---|
| Effective route path | **PROVEN (automated)** — `/api/webhooks/resend` (no double `/resend`) |
| Signature authenticity | **PROVEN (automated)** — Svix HMAC; production missing secret → 500; invalid sig → 400 |
| Message ID mapping | EmailAudit.providerMessageId updated via `updateEmailAuditStatus` |
| Duplicate event idempotency | **PROVEN (automated)** — WebhookEvent `{source:'resend', eventId:svix-id}` + timeline no-dupe |
| Spoofed events rejected | **PROVEN (automated)** — unsigned/invalid signature rejected |

## Invoice/document checks

| Check | Evidence |
|---|---|
| Owner/admin access separately tested | Customer invoice routes ownership-scoped; admin uses permissions |
| Access tokens opaque/revocable/expiring | InvoiceAccessToken: hashed token, expiresAt TTL, OTP gate |
| PDF/HTML/email same record | generateInvoiceHtml from Invoice document |
| Numbering | counters collection (concurrency-safe increment) |
| Private object storage | R2/local storage driver (CODED_NOT_RUNTIME_VALIDATED live) |

## Notification provider alignment

| Check | Evidence |
|---|---|
| Expo vs FCM mismatch documented | **PROVEN** — `verification/PUSH_PROVIDER_ARCHITECTURE.md` |
| Production never reports fake push delivery | **PROVEN (automated)** — fail-closed tests Phase 01 |
| Native push after Capacitor | **DEFERRED** Phase 09/10 |

## Remaining external validation

- Live Resend outbound + delivery webhook
- Live Stripe membership activate/renew/fail paths
- Physical-device push (Capacitor) — Phase 10
