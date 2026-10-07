# Donation Implementation Plan (Phase 14 → 15–17)

## First-release scope (confirmed defaults)

| Item | Value | Configurable? |
|---|---|---|
| Currency | NZD only | Setting `donation.currency` (code still NZD-only until multi-currency approved) |
| Frequency | one_time + monthly | Setting `donation.frequenciesEnabled` |
| Suggested amounts (NZD) | 5, 10, 20, 50 | Setting `donation.suggestedAmounts` (comma-separated dollars) |
| Custom amount | Yes | min/max settings |
| Pet required | No | product rule |
| Public `/donate` | Yes, **flag off** until Phase 17 | `donation.publicEnabled` |
| Tax claims | **Off** (neutral) | `donation.receipt.taxClassification=neutral` |
| Legal name | `PawTag` | `donation.receipt.organisationName` |

## Configurable settings catalog (no hardcode)

All product values live in Setting (and later Settings repository). Example keys:

```text
donation.enabled                          true
donation.publicEnabled                    false
donation.currency                         NZD
donation.frequenciesEnabled               one_time,monthly
donation.suggestedAmounts                 5,10,20,50
donation.minAmountCents                   500
donation.maxAmountCents                   1000000
donation.rateLimit.createPerHour          20
donation.captcha.required                 false
donation.receipt.organisationName         PawTag
donation.receipt.irdNumber                (empty)
donation.receipt.charitiesNumber          (empty)
donation.receipt.taxClassification        neutral
donation.receipt.statement                Thank you for your donation to PawTag.
donation.receipt.signatory                (empty)
donation.mission.headline                 Help reunite lost pets with their families
donation.mission.body                     (configurable)
donation.recurring.enabled                true
```

Admin can edit via existing settings UI / API (`setting.read` / `setting.update`).

## Phase 15 — One-time core (next coding phase)

1. Shared types + Zod for donation requests  
2. Donation + DonationPayment + DonationReceipt models + repositories  
3. Settings seed for donation.* keys  
4. `POST /api/donations` + status endpoint  
5. Supporter identity (DONATION context)  
6. Stripe PaymentIntent via existing provider/factory  
7. Webhook handlers for PI succeeded/failed (idempotent)  
8. Receipt number + neutral PDF + email (CMS)  
9. Public `/donate` page (flag-gated)  
10. Admin list/detail + RBAC  
11. Tests: amount validation, idempotency, webhook, ownership, no enumeration  

**Stop before recurring UI polish if time-boxed; Phase 16 continues.**

## Phase 16 — Recurring + portals

- Stripe Billing monthly donations  
- Per-payment receipts  
- Customer My Donations portal  
- Admin refund/reissue/reconciliation UI  
- Email set (received/receipt/failed/cancelled)  

## Phase 17 — Hardening + controlled launch

- Reconciliation jobs + alerts  
- Security suite (IDOR, enumeration, webhook abuse)  
- Controlled live one-time + monthly test  
- Feature flag enable public donate only after rehearsal  

## Dependencies / blockers

| Blocker | Impact |
|---|---|
| NZ legal/tax (BLOCKED_EXTERNAL) | Neutral receipts only until confirmed |
| Stripe live + webhook endpoint on dashboard | Phase 17 only |
| Staging first-customer path | Parallel track — donations do not replace it |

## Persistence

- Mongo adapters behind repository interfaces (Phase 15).  
- DynamoDB for donations **later** (high-risk money; not first cutover).

## Success criteria Phase 15

- Configurable amounts/limits/receipt wording via settings  
- One-time NZD donation end-to-end with Stripe **test** webhook  
- Idempotent retries; ownership enforced  
- No tax-credit claims in UI/receipts  
- Admin can see donation; audit logged  
- Public flag remains false until Phase 17  

---

**Next:** Phase 15 implementation — **STOP. Do not start Phase 15 until founder says go.**
