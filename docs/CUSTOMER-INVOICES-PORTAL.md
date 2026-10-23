# Customer Portal Invoices (`/account/invoices`)

**Status:** Implemented — in-app View + unified token-viewer chrome added 2026-10-24  
**Decisions:** credit notes included (type badge); page size **20**; separate detail route `/account/invoices/:id`

---

## 1. Objective

Authenticated customers can list all their invoices, open details, and view/download via the existing secure invoice viewer — **no duplicate invoice HTML/OTP/download logic**.

---

## 2. Workflow

```text
Customer → Account → Invoices
  → GET /api/customer/invoices (userId, paginated)
  → List rows (number, date, amount, status, type, View + Download icons)
  → Row click → /account/invoices/:id (summary)
In-app document view (same UX as donation receipts):
  → View (list row or detail) → GET /api/customer/invoices/:id/html
  → engine HTML → openDocumentInNewTab (same-tab blob nav, popup-safe)
Download:
  → Download → GET /api/customer/invoices/:id/pdf (real PDF)
Emailed/forwardable links (unchanged):
  → POST /api/customer/invoices/:id/access → OTP → /invoice/:token
```

---

## 3. Architecture / reuse

| Layer | Reuse | New |
|---|---|---|
| In-app document | Shared finance engine (`generateInvoiceHtml`, customer channel) + donations' new-tab UX | `GET /customer/invoices/:id/html` (ownership-scoped, mirrors `/pdf`) |
| Access/download | `POST /customer/invoices/:id/access` (emailed links only) | — |
| Token viewers | One shared `FinancialDocumentViewer` shell for `/invoice/:token` + `/donations/receipt/:token` (toolbar, iframe render, Print, Download) | Extracted from the two pages |
| List UI chrome | `StatusBadge`, `CopyButton`, `EmptyState`, MembershipManage row pattern, DESIGN.md cards | View action beside Download |
| API | Ownership `userId` + Invoice model | `GET /api/customer/invoices` + detail |
| Shared | `API.customer.invoices.access` | `.list` / `.get` / `.pdf` / `.html` + list DTO + page size |

**Never:** admin commerce invoice list; silent catch on download; reimplement OTP/print; fork a second document layout (the engine output IS the invoice — donations and invoices share it).

---

## 4. Business rules

- List = **only** invoices where `Invoice.userId === authenticated user`
- Include `type: invoice | credit_note`
- Sort `createdAt` desc; page size from shared constant (20)
- In-app **View** = authenticated ownership-scoped HTML of the SAME canonical
  document the PDF renders (audited as `invoice_html_viewed`, customer channel —
  no Stripe provider IDs)
- Emailed/forwardable links keep the OTP/token model (`/invoice/:token`) unchanged
- Detail page is summary only; full document = engine HTML (View) or PDF (Download)

---

## 5. UI states

| State | UI |
|---|---|
| Loading | Spinner |
| Empty | `EmptyState` — “No invoices yet” |
| List | Card rows: icon, number, date, amount, StatusBadge, **View** + Download icons |
| Error | Inline recoverable message |
| Detail | Summary + **View** (engine document, new tab) + **Download PDF** |

---

## 6. Checklist

- [x] Feature branch `feature/customer-invoices-portal`
- [x] This doc
- [x] Shared: list DTO, page size, endpoint constant
- [x] API: `GET /api/customer/invoices` + `GET /api/customer/invoices/:id`
- [x] Web: helper + Invoices list + InvoiceDetail + routes + nav
- [x] Tests: ownership, pagination shape, credit_note included
- [x] API + shared typecheck
- [ ] Approval → commit/push

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| OTP friction on download | Existing 24h verified window / skip-OTP settings; reuse access only |
| Duplicate invoice UI | Reuse StatusBadge/EmptyState/InvoiceView only |
| Cross-user access | Server `userId` predicate + existing access ownership check |

---

## 8. Progress log

| Date | Update |
|---|---|
| 2026-10-05 | Implemented list/detail, API, shared contracts, tests |
| 2026-10-05 | Enriched detail projection (order items, totals, membership, subscription, credit notes) + sticky View/Download |
| 2026-10-24 | In-app **View** for invoices (auth ownership-scoped engine HTML, same new-tab UX as donation receipts) + shared `FinancialDocumentViewer` shell unifying `/invoice/:token` and `/donations/receipt/:token` chrome |
