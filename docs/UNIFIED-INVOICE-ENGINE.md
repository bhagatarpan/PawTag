# Unified Invoice Engine — Consistent Financial Documents

**Status:** In progress (checklist at bottom)
**Branch:** `feature/unified-invoice-engine`
**Scope:** Invoice/credit-note/donation-receipt creation metadata, shared document assembly + rendering (HTML viewer + PDF), customer-safe payment presentation, admin/CSR visibility.

---

## 1. Problem

Financial documents are inconsistent across sources:

- **11 separate `Invoice.create` sites** each populate different metadata (payment method, card brand/last4, Stripe IDs)
- The Invoice record itself stores almost no payment data — renderers join the linked `Order` at display time, which fails for non-order invoices (membership, subscriptions) and doesn't exist for donations
- **Donations** bypass the Invoice system entirely (separate `DonationReceipt` model + its own PDF/HTML renderers, zero payment metadata)
- Credit notes cannot produce a PDF (HTML-only via the browser print flow)
- The customer-facing invoice viewer exposes the raw **Stripe PaymentIntent ID** (`pi_…`) — provider disclosure with zero customer value
- Admin/CSR customer-profile invoice tab shows only number/status/date/amount — insufficient for payment troubleshooting

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Payment metadata | Snapshot `cardBrand`/`cardLast4` **onto the Invoice document at creation** (additive fields) | Self-contained documents; no fragile joins; legacy records keep working via render-time fallback joins |
| Stripe payment IDs | **Customer channel: never shown.** Admin channel: shown | Founder decision — invoice number is the customer reference; provider IDs stay internal for CSR/Stripe troubleshooting |
| Synthetic customer payment ID | **Not built** | `INV-…`/`WO-…` numbers already link everything internally; a parallel ID adds cost with no customer question it answers |
| Rendering | **One shared assembly layer** (`invoice-document.ts`) → one HTML path + one PDF path, with a `channel: 'customer' \| 'admin'` flag | Single source of truth; admin documents include provider IDs, customer documents never do |
| Donations | Keep `DonationReceipt` as a **distinct document type** (AGENTS.md: financial-document-integrity) but render it through the **shared PDF engine** with donation-specific wording preserved | Same visual engine + consistent payment details, without forcing tax receipts into commerce-invoice semantics |
| Numbering | Unchanged (`INV-`/`INVM-`/credit-note counter/donation receipt numbers) | Unique + never-recycled invariant already held; not in scope |
| Card extraction | Best-effort at snapshot time; failures never block document creation | External-call failure semantics (AGENTS.md §19) |

## 3. Architecture / Data Flow

```text
Creation sites (checkout, admin order, refund credit note, membership,
subscription webhooks, admin extend, donation issueReceipt)
    │  snapshot paymentMethod + cardBrand + cardLast4 (+ Stripe IDs already present)
    ▼
Invoice / DonationReceipt documents  (self-contained financial records)
    ▼
assembleInvoiceDocument(id, channel) / assembleDonationReceiptDocument(id, channel)
    │  ONE normalized InvoiceDocumentModel:
    │  identity · parties · payment (customer-safe + admin-only IDs) ·
    │  line items · totals · related numbers · kind-specific notes
    ├──► HTML viewer (customer or admin channel via admin-issued access token)
    └──► PDF generator (A4 shared layout; kind = invoice | credit_note | donation_receipt)
```

**Channel determination:** `InvoiceAccessToken.issuedToAdmin` (new additive flag) — admin view routes set it; the token status route assembles with `channel: 'admin'` when set. Never trust a client query param.

**Legacy documents:** no migration. Renderers fall back to the existing Order/Membership joins when the snapshot fields are absent.

## 4. Customer vs Admin presentation

| Field | Customer invoice/credit note/receipt | Admin (CSR) document + profile tab |
|---|---|---|
| Invoice/credit note/receipt number | ✅ | ✅ |
| Order number, billing period, dates | ✅ | ✅ |
| Card brand + ••••last4 | ✅ | ✅ |
| Payment method | ✅ | ✅ |
| Stripe PaymentIntent / Invoice ID | ❌ **never** | ✅ |
| Refund destination (credit notes) | ✅ | ✅ |

CSR invoice tab additionally shows: document type badge (Order / Membership / Subscription / Credit note / Donation), payment method, card, Stripe payment ID, billing period, related order number, View + Download actions.

## 5. Business rules

1. Payment snapshot is written once at document creation; issued documents are never silently mutated
2. Card extraction is best-effort — a Stripe lookup failure never blocks or falsifies document issuance
3. Customer documents never contain provider identifiers (`pi_`, `in_`, `ch_`)
4. Donation receipts keep neutral tax wording (existing `donation-pdf` statements) — no tax claims invented
5. All money values round via `roundToCents` before persistence (monetary-precision skill)
6. Existing numbering counters and uniqueness invariants untouched

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| HTML renderer refactor breaks the CMS invoice template branch | CMS template kept; only its variable set changes (paymentRef removed for customer channel, Stripe IDs added for admin) |
| Stripe retrieve for donation card data fails / slow | Best-effort try/catch with timeout-free short-circuit; receipt issues without card details |
| Credit-note PDF misses refund semantics | Assembly carries refund destination + related original invoice number; PDF renders both |
| Old invoices without snapshots | Render-time fallback to Order/Membership joins (unchanged behaviour) |

## 7. Implementation checklist

- [x] Phase 1 — Models: additive `cardBrand`/`cardLast4` on Invoice; `cardBrand`/`cardLast4` on DonationReceipt; `issuedToAdmin` on InvoiceAccessToken
- [x] Phase 2 — Shared assembly layer (`finance/invoice-document.ts`) for invoice/credit-note/donation receipt + shared HTML renderer (`finance/invoice-document-html.ts`) + best-effort `finance/payment-snapshot.ts`
- [x] Phase 3 — Payment snapshots at every creation site (order checkout, admin order, credit note, membership purchase + `createMembershipInvoice` factory, Stripe webhook renewal converted to the factory, tag-subscription webhooks, subscription service, donation receipt issuance)
- [x] Phase 4 — HTML renderer consumes assembly; channel-aware via `issuedToAdmin` tokens; Stripe IDs removed from customer surfaces (viewer, credit note, CMS email variable, customer detail API)
- [x] Phase 5 — PDF renderer consumes assembly; credit notes PDF-capable; donation receipts (HTML + PDF + email attachment) moved onto the shared engine; old `donation-pdf.ts` deleted
- [x] Phase 6 — Admin/CSR: enriched customer-profile invoice tab (type badge, payment method + card, Stripe payment IDs, billing period, order id, View + PDF actions; popup-prone window.open fixed) and admin Invoices list (source badges + Payment column)
- [x] Phase 7 — Verification: typecheck (api/shared/web/admin) + builds (web/admin/api) clean; real-data dev-DB run: shop invoice customer HTML/PDF contains NO `pi_` IDs while admin HTML does; membership invoice + donation receipt render via the shared engine with valid PDFs
- [x] Phase 8 — Docs: this doc, AGENTS.md, README.md, financial-document-integrity skill

## 8. Verification evidence (2026-10-16, dev DB)

| Check | Result |
|---|---|
| Typecheck api / shared / web / admin | **PASS** (0 errors) |
| Build web / admin / api | **PASS** |
| INV-000042 customer HTML vs admin HTML | customer: no `pi_` ID · admin: `pi_` ID present · card shown in both |
| INV-000042 PDFs (customer + admin channels) | both generate (`%PDF-`), admin larger (extra ID lines) |
| INVM-000003 membership invoice | renders via shared engine (legacy record without card snapshot — expected; new invoices snapshot at creation) |
| PTD-000004 donation receipt | shared engine: "DONATION RECEIPT" title, no customer `pi_`, valid PDF (fake-mode donation → no card, correct) |
| Credit note PDF path | engine-supported (no credit note exists in dev DB to render; path type-checked) |

**Pre-existing risk observed (not fixed — out of scope):** the tag-subscription webhook numbers invoices via `Invoice.countDocuments() + 1`, which is race-prone under concurrent webhooks. The membership factory uses an atomic counter; migrating subscription numbering to a counter would be a separate hardening task.
