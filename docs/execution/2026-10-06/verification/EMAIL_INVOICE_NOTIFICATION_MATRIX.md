# Email, Invoice, Notification, and Link Verification Matrix

For each row fill: trigger, source service, recipient source, template/document, link target, persistence/audit record, retry policy, provider evidence, tests.

| Event | Recipient | Expected artifact/channel | Link/route | Retry/idempotency | Status/evidence |
|---|---|---|---|---|---|
| Account verification | user email | verification email | verification route | token single-use/expiry | |
| Password reset | user email | reset email | reset route | token single-use/expiry | |
| MFA/OTP if email used | user | OTP | auth flow | rate/expiry | |
| Finder notify owner | owner/emergency contact as rules allow | email/SMS/in-app | recovery/customer destination | duplicate finder safe | |
| Order confirmation | purchasing customer | email + order link | Order detail | one per order/retry safe | |
| Commerce invoice issued | customer | email + PDF/link | Invoice detail/access token | same invoice on retry | |
| Shipment update | customer | email/in-app as configured | Order/tracking | provider event idempotent | |
| Order cancellation | customer | email/in-app | Order detail | state transition idempotent | |
| Refund requested/processed | customer + admin ops as appropriate | email/in-app + credit/refund context | Order/return/refund | refund idempotent | |
| Return request | admin ops + customer confirmation | email/in-app | Return detail | duplicate request safe | |
| Membership activation | customer | welcome/receipt | Membership | only after true entitlement | |
| Membership payment failed | customer | failure/recovery | Membership/payment method | dedupe per invoice/event | |
| Membership cancelled | customer | confirmation | Membership | webhook/request idempotent | |
| Donation one-time success | donor | thank-you + receipt PDF | Donation/receipt | one receipt/email job | |
| Donation recurring created | donor | recurring confirmation | Donation manage | one subscription | |
| Donation recurring payment | donor | receipt PDF | Donation payment/receipt | one per provider invoice | |
| Donation payment failed | donor | recovery notice | Donation manage | dedupe event | |
| Donation refund | donor | refund/receipt-status notice | Donation detail | one refund lifecycle | |
| Donation receipt replacement | donor | replacement receipt PDF | Receipt | old remains auditable | |

## Provider webhook verification

For Resend/provider delivery events verify signature/authenticity, effective route path, message ID mapping, duplicate event idempotency, and safe event payload logging.

## Invoice/document checks

- owner/admin access separately tested;
- access tokens opaque/revocable/expiring where intended;
- PDF/HTML/email all derive from same record;
- private object storage;
- numbering unique under concurrency;
- corrected/replaced documents preserve lineage.
