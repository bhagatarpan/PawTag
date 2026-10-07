# Donation Security & Privacy (Phase 14)

## Identity & access

| Rule | Implementation target |
|---|---|
| No separate donor login system | Reuse `User` + `registrationContext: DONATION` |
| No pet/tag onboarding forced | Skip pet flows for donation-created users |
| Email enumeration prevention | Generic response whether or not email exists |
| Portal ownership | Server-side `userId` scoping on all donation reads |
| Secure activation later | Existing verification token / magic-link patterns |

## Money safety

| Rule | Phase |
|---|---|
| Server amount/frequency/currency | 15 |
| Stripe webhook authoritative | 15 |
| Idempotent create/pay/receipt/refund | 15–17 |
| RBAC for admin refund/export | 16 |
| No card data in logs | all |

## Privacy / retention

| Data | Rule |
|---|---|
| Donor name/email | Needed for receipt; minimize elsewhere |
| Marketing consent | Separate checkbox; **unchecked default** |
| Location | Not required for donation |
| Receipt PDFs | Private storage; authorized access |
| Financial records | Retain per founder policy (**BLOCKED_EXTERNAL** — suggest 7+ years NZ practice; confirm) |
| Logs | No secrets, no card PAN/CVC, no unnecessary PII |

## Abuse controls (Phase 15 settings)

| Setting key | Purpose | Default (configurable) |
|---|---|---|
| `donation.rateLimit.createPerHour` | Anti card-testing | `20` |
| `donation.captcha.required` | Optional CAPTCHA on donate | `false` (enable later) |
| `donation.minAmountCents` | Server min | `500` ($5) |
| `donation.maxAmountCents` | Server max | `1000000` ($10,000) |

## Public CTA

- `/donate` may exist behind feature flag `donation.publicEnabled`.
- Public enable only after Phase 17 controlled rehearsal (flag default **false** until then).

## Never

- Never log secrets/tokens/card data.
- Never expose another user’s donation/receipt.
- Never enable tax-credit claims without external confirmation.
- Never delete financial records on “cleanup”.
