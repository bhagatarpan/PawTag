# Customer Portal Invoices (`/account/invoices`)

**Status:** Implemented on branch `feature/customer-invoices-portal` — awaiting approval to commit/push  
**Decisions:** credit notes included (type badge); page size **20**; separate detail route `/account/invoices/:id`

---

## 1. Objective

Authenticated customers can list all their invoices, open details, and view/download via the existing secure invoice viewer — **no duplicate invoice HTML/OTP/download logic**.

---

## 2. Workflow

```text
Customer → Account → Invoices
  → GET /api/customer/invoices (userId, paginated)
  → List rows (number, date, amount, status, type, download icon)
  → Row click → /account/invoices/:id
  → "View or Download Invoice"
  → POST /api/customer/invoices/:id/access
  → open secureUrl → existing /invoice/:token (InvoiceView + print/PDF)
```

---

## 3. Architecture / reuse

| Layer | Reuse | New |
|---|---|---|
| Access/download | `POST /customer/invoices/:id/access` | — |
| Document | `InvoiceView` + token routes | — |
| List UI chrome | `StatusBadge`, `CopyButton`, `EmptyState`, MembershipManage row pattern, DESIGN.md cards | Thin list page |
| API | Ownership `userId` + Invoice model | `GET /api/customer/invoices` + detail |
| Shared | `API.customer.invoices.access` | `API.customer.invoices.list` / `.get` + list DTO + page size |

**Never:** admin commerce invoice list; silent catch on download; reimplement OTP/print.

---

## 4. Business rules

- List = **only** invoices where `Invoice.userId === authenticated user`
- Include `type: invoice | credit_note`
- Sort `createdAt` desc; page size from shared constant (20)
- Download/view = existing access endpoint (OTP/token model unchanged)
- Detail page is summary only; full document = secure viewer

---

## 5. UI states

| State | UI |
|---|---|
| Loading | Spinner |
| Empty | `EmptyState` — “No invoices yet” |
| List | Card rows: icon, number, date, amount, StatusBadge, download icon |
| Error | Inline recoverable message |
| Detail | Summary + primary **View or Download Invoice** |

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
