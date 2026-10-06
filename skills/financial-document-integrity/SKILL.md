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
