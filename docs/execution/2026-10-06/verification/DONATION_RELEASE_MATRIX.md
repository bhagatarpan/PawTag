# Donation Release Verification Matrix

## External legal/accounting

| Requirement | Status | Evidence/owner |
|---|---|---|
| PawTag legal entity confirmed | | |
| Donee status confirmed/configured | | |
| IRD number confirmed if applicable | | |
| Charities registration confirmed if applicable | | |
| Receipt wording approved | | |
| GST/accounting treatment approved | | |
| Refund/receipt tax treatment approved | | |
| Retention policy approved | | |

## Functional

| Journey | Test mode | Production controlled smoke | Evidence |
|---|---|---|---|
| Guest one-time donation | | | |
| Existing customer one-time | | | |
| Duplicate submission/idempotency | | | |
| Payment failure | | | |
| Duplicate/out-of-order webhook | | | |
| Receipt record | | | |
| PDF generated/private storage | | | |
| Receipt email | | | |
| Online receipt access | | | |
| Supporter account activation | | | |
| Customer donation history | | | |
| Monthly recurring creation | | | |
| Recurring payment receipt | | | |
| Recurring payment failure | | | |
| Recurring cancellation | | | |
| Admin search/detail | | | |
| Admin refund | | | |
| Receipt replacement/reissue | | | |
| Reconciliation mismatch/repair | | | |
| Export/RBAC | | | |

## Security

- [ ] Client amount manipulation rejected.
- [ ] Invalid Stripe signature rejected.
- [ ] Donor A cannot view Donor B records/receipts.
- [ ] Guest cannot enumerate receipt IDs.
- [ ] Admin permissions enforced for refund/export/reissue/reconciliation.
- [ ] Card data not stored/logged.
- [ ] Account enumeration prevented.
- [ ] Duplicate customer creation concurrency protected.
- [ ] Donation/subscription/refund idempotency proven.
- [ ] Issued receipt immutability proven.

## Public enablement

- [ ] Feature flag disabled during controlled production smoke.
- [ ] Live one-time donation verified end-to-end.
- [ ] Live refund verified.
- [ ] Live recurring donation verified.
- [ ] Live recurring cancellation verified.
- [ ] Monitoring/alerts/reconciliation observed.
- [ ] Only then enable public Donate CTA.
