---
name: financial-document-integrity
description: Implement or review PawTag invoices, credit notes, donation receipts, PDFs, document numbering, secure online access, email attachment delivery, replacement/void workflows, object storage, and auditability. Use when changing Invoice, invoice access tokens, receipt rendering, PDF/storage, document email links, financial document lifecycle, or donation receipts.
---

# Financial Document Integrity

Financial documents are durable business records. Reuse rendering/storage/email primitives where appropriate, but preserve domain-specific semantics.

## Document types

Keep concepts distinct, for example:
- commerce invoice;
- credit note;
- donation receipt;
- replacement donation receipt.

Do not force donation data into a commerce invoice merely to reuse code.

## Rendering: one shared engine, distinct types

All document **rendering** flows through the shared engine in `packages/api/src/services/finance/`:

- `invoice-document.ts` — assembly: single source of truth for presentation (parties, payment, items, totals, kind-specific notes) with `channel: 'customer' | 'admin'`.
- `invoice-document-html.ts` — the **one canonical layout**, consumed by invoices, credit notes, AND donation receipts in both the browser viewer and PDF output (`printMode: true` embeds Inter + A4 print rules). `invoice-pdf.service.ts` assembles the model and dispatches to the engine selected by `FINANCE_PDF_RENDERER` (`legacy` pdf-lib redraw — default until founder sign-off; `weasyprint` = canonical HTML via a guarded python3 child process — `docs/PDF-RENDERER-REPLACEMENT.md`). Never fork a PDF-only layout beside the HTML template. Donation receipts keep their own tax wording/semantics via the model's `notes` — the engine is shared, the document type is not.

Rules:
- `cardBrand`/`cardLast4` snapshot onto the document at **creation** (every creation site; membership invoices go through the exported `createMembershipInvoice` factory). Renderers fall back to legacy Order/Membership joins for old records.
- Stripe card extraction (`finance/payment-snapshot.ts`) is best-effort and never blocks document issuance.
- New document kinds must reuse this engine rather than adding another renderer.

## Channel rule (provider identifiers)

Customer documents — viewer HTML, PDFs, email template variables, and the customer invoice API — **never expose Stripe provider IDs** (`pi_`, `in_`, `ch_`). The invoice/order/receipt number is the customer's reference. Admin/CSR surfaces render the `admin` channel, which includes those IDs for troubleshooting. The channel is determined by `InvoiceAccessToken.issuedToAdmin` (durable server flag set at token creation) — never trust a client query param.

## Downloads

Customer and admin downloads are **real PDFs** (server-generated — never a browser print dialog) via authenticated blob downloads (`apps/*/src/lib/downloadFile.ts`) or pre-verified token endpoints with `Content-Disposition: attachment`. Never the browser print dialog; never `window.open` after an async call (popup blockers silently drop those — use same-tab `window.location.assign`). Invoice links returned by the API are relative paths — the frontend resolves its actual origin; absolute URLs only in emails.

## Invariants

- Numbers are unique and never recycled.
- Issued documents are not silently mutated.
- Corrections create an auditable replacement/void chain.
- Document amount/status must derive from authoritative financial state.
- Customer access is owner-authorized or uses a deliberate opaque/revocable access-token mechanism.
- Object storage is private or accessed through controlled signed/authenticated paths.
- Email and portal must reference the same authoritative document record/PDF.
- Email retry must not generate a new financial document.
- PDF/email failure must not falsify payment state; persist a repairable document-delivery state.

## Security

Do not expose sequential internal IDs as unauthenticated document access. Avoid donor/customer PII in object keys. Never log secure document tokens.

## Verification

Test numbering concurrency, access control, expired/revoked links, render content, attachment identity, replacement lifecycle, refund effects, email retry, storage failure, and customer/admin visibility.
