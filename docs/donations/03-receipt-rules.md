# Donation Receipt Rules (Phase 14)

## Principle

Donation receipt is a **distinct financial document type**.  
Reuse PDF/storage/email/access **primitives**, not commerce `Invoice` meaning.

## Receipt number

- Sequence via dedicated counter e.g. `donationReceiptNumber` → `DNR-000001`.
- Unique under concurrency (atomic `$inc` on counters / DynamoDB ADD later).
- Immutable after issue.
- Correction → original `void`/`replaced` + **new** receipt number.
- Refund does **not** delete original receipt history.

## Fields (configuration-driven)

| Field | Source | Default until legal confirmed |
|---|---|---|
| receiptNumber | sequence | required |
| organisationName | Setting `donation.receipt.organisationName` | `PawTag` |
| irdNumber | Setting `donation.receipt.irdNumber` | **empty — not claimed** |
| charitiesNumber | Setting `donation.receipt.charitiesNumber` | empty |
| donorName | snapshot | required |
| amount / currency / issuedAt | payment | NZD |
| paymentReference | Stripe PI/invoice id | required |
| taxClassification | Setting `donation.receipt.taxClassification` | `neutral` (no IRD credit claim) |
| statement | Setting `donation.receipt.statement` | neutral thank-you wording |
| signatory | Setting `donation.receipt.signatory` | optional |
| pdfUrl | private storage | after render |

## Tax wording rule

**Until external gate confirms approved-donee / tax-credit status:**

- Do **not** print “IRD tax credit”, “tax deductible”, “claimable”, or equivalent.
- Use neutral: “Thank you for your donation to PawTag.”
- Tax classification config value remains `neutral` (or empty).

When accountant/legal confirm, change **settings only** — no hardcode migration of legal claims.

## PDF / email / portal

- One authoritative receipt record → HTML/PDF → email + portal + admin.
- Email uses CMS template `donation-receipt` with same variables.
- Access: authenticated owner or authorized token (reuse invoice access patterns **as primitives**, not commerce invoice semantics).
- Storage private; no public unguessable URLs without auth.

## Immutability

- No in-place edits after `issued`.
- Replace = void old + issue new; lineage via `relatedReceiptId`.
