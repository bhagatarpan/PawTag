# Donation Settings Catalog (Configurable — Phase 14)

**Rule:** No donation product values are hardcoded in UI or domain logic.  
All values load from Setting via existing settings accessors/repository.

| Key | Type | Default | Description |
|---|---|---|---|
| `donation.enabled` | bool | `true` | Master switch for donation APIs |
| `donation.publicEnabled` | bool | `false` | Show public `/donate` CTA |
| `donation.currency` | string | `NZD` | Currency code (NZD only until approved) |
| `donation.frequenciesEnabled` | csv | `one_time,monthly` | Allowed frequencies |
| `donation.suggestedAmounts` | csv dollars | `5,10,20,50` | UI suggestion chips |
| `donation.minAmountCents` | int | `500` | Server minimum ($5) |
| `donation.maxAmountCents` | int | `1000000` | Server maximum ($10,000) |
| `donation.rateLimit.createPerHour` | int | `20` | Create donation rate limit |
| `donation.captcha.required` | bool | `false` | CAPTCHA on donate form |
| `donation.mission.headline` | string | Help reunite lost pets with their families | Donate page hero |
| `donation.mission.body` | string | Your support helps keep finder recovery working. | Donate page copy |
| `donation.receipt.organisationName` | string | `PawTag` | Legal/trading name on receipt |
| `donation.receipt.irdNumber` | string | *(empty)* | IRD — only when confirmed |
| `donation.receipt.charitiesNumber` | string | *(empty)* | Charities Services # if any |
| `donation.receipt.taxClassification` | enum | `neutral` | `neutral` \| `approved_donee` (only after legal) |
| `donation.receipt.statement` | string | Thank you for your donation to PawTag. | Neutral receipt line |
| `donation.receipt.signatory` | string | *(empty)* | Optional signatory |
| `donation.recurring.enabled` | bool | `true` | Allow monthly (Phase 16) |
| `donation.featureFlag` | bool | `false` | Extra kill-switch for donate module |

## Admin

Editable via existing Settings admin (`setting.read` / `setting.update`).  
Seeds in Phase 15 use `$setOnInsert` so admin edits are not overwritten on re-seed.

## Tax gate

If `donation.receipt.taxClassification` is `neutral`, UI and PDF **must not** show tax-credit claims.  
Flip to `approved_donee` only after founder/accountant confirmation in `03_EXTERNAL_OWNER_ACTIONS.md`.
