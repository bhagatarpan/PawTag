# Returns & Refunds — Workflow, Design & Progress

**Status:** Active implementation program  
**Branch:** `feature/returns-refunds-e2e`  
**Owner:** Founder / product + engineering  
**Last updated:** 2026-10-03  

---

## 1. Purpose

Connect customer return/refund requests to a **single authoritative Stripe refund path**, with:

- clear CSR workflow
- warehouse-receipt default
- explicit refund-without-return exception
- audit, notifications, permissions, idempotency
- no fake “refunded” status when Stripe has not accepted money

This document is the **source of truth for process + design intent**. Source code remains source of truth for runtime behaviour.

---

## 2. Current state (as of branch start)

| Path | Behaviour |
|---|---|
| Customer cancel (pre-shipment) | **Works** — `cancellation.service` → Stripe |
| Admin Orders “Refund Order” | **Works** — Stripe + ARN + PaymentTransaction |
| Customer “Request Return” (delivered OK) | **Request only** — creates `Return` pending |
| Admin Returns “Process Refund” | **Broken for money** — status-only, no Stripe |
| Return lifecycle emails | **Missing** |
| Customer return status page | **Missing** |
| Item-level Order status | **Missing** |
| Warehouse address / return email settings | **Missing** (must add) |

**Critical defect:** CSR can mark a return `refunded` without moving money.

---

## 3. Domain model (target)

Separate concepts (do not collapse into one status):

| Concept | Meaning | Storage |
|---|---|---|
| **Return request** | Customer/CSR asks for money back for items | `Return` |
| **Return shipment** | Customer ships goods (PawTag does **not** pay/arrange) | Return tracking fields |
| **Warehouse receipt** | PawTag confirms physical receipt | `receivedAt` / `received` |
| **Refund authorization** | CSR confirms amount + reason | Return notes + audit |
| **Stripe refund** | Financial transaction | Order + PaymentTransaction + Return.refundId |
| **Refund settlement** | Card issuer completes | Webhook updates |

### Return lifecycle (target)

```text
pending (requested)
  → approved | rejected
  → shipped (customer tracking submitted)     [Phase 2]
  → received (warehouse)                      [default before money]
  → refund_pending / refund_processing
  → refunded | refund_failed

Exception path:
  approved
  → refund_without_return_approved (permission + reason + audit)
  → refund_pending → refunded
```

**Phase 1 mapping to existing enum:**  
`pending → approved → received → refunded`  
Money is only allowed on the **dedicated refund command**, not on bare status flip.

---

## 4. Decision tree

```text
Customer order eligible?
├─ cancelled/refunded → no return
├─ paid/packing/shipped/delivered → allow Request Return (server-validated)
│
Customer submits return
├─ reason required (server)
├─ items + qty validated against order lines
├─ server calculates default refund amount
├─ Return created pending
├─ activity: return_requested
└─ email requested (Phase 2)
│
CSR reviews return
├─ Reject → terminal (no money)
├─ Approve → customer ships (PawTag does not provide shipping)
│
Customer ships
├─ Submits carrier + tracking (Phase 2)
└─ Admin notified (Phase 2)
│
Warehouse receives goods?
├─ YES → CSR marks received
│    └─ CSR processes refund → Stripe
└─ NO, exception needed
     ├─ Requires order.refund permission
     ├─ Requires reason + CSR identity + audit
     ├─ Sets refund_without_return=true
     └─ Then refund → Stripe
│
Stripe refund
├─ Success → persist refundId/ARN/arrival, Return.refunded, notify
├─ Failure → Return refund_failed / order refundable state, NO fake success
└─ Duplicate submit → idempotent (no second Stripe refund)
```

---

## 5. Business rules (non-negotiable)

1. **PawTag does not provide return shipping.** Customer arranges and pays.  
2. **Customer must include:** printed invoice, product in reasonable condition, original packaging if available, return tracking.  
3. **Warehouse address** from configurable settings — never hardcode.  
4. **Reason is mandatory** for every refund request (customer + admin).  
5. **Default money path requires warehouse receipt** before Process Refund.  
6. **Refund without return** is an explicit authorized exception, not a silent bypass.  
7. **Server owns refund amount** — browser estimate is display only.  
8. **Stripe refund goes to original payment method** only.  
9. **Never mark refunded unless Stripe accepted** the refund request.  
10. **One logical refund ≠ two Stripe refunds** (idempotency).  
11. **Partial refunds** use remaining refundable balance; never exceed captured amount.  
12. **Do not break** customer cancel refund or Admin Orders Refund Order.

---

## 6. Architecture

```text
Customer Return Request          Admin initiate refund
         │                                │
         ▼                                ▼
   Return domain  ──────────────►  Refund domain (authoritative)
   (request/logistics)                      │
                                            ▼
                              Stripe payment provider
                              (existing createRefund)
                                            │
                                            ▼
                              Order + PaymentTransaction + Return
                              Audit + Activity + Emails + Webhooks
```

**Authoritative money service (Phase 1):**  
`packages/api/src/commerce/services/return-refund.service.ts`  
— validates return state, amount, permission context; calls `stripePaymentProvider`; persists Order/PaymentTransaction/Return; audit + notify.

**Do not create a third Stripe refund implementation.**  
Reuse `stripePaymentProvider.createRefund` and existing webhook/ARN patterns.

**Existing refund service note:**  
`refund.service.ts` is partially implemented and historically underused. Phase 1 uses a dedicated return-refund service that shares provider + persistence patterns; full consolidation of cancel/admin inline paths is a follow-up hardening packet.

---

## 7. Screen designs (mockups)

### 7.1 Customer — Request Return (`/account/orders/:id/return`)

```text
┌─────────────────────────────────────────────┐
│ Request Return                    WO-000486 │
├─────────────────────────────────────────────┤
│ Select items                                │
│  ☑ PawTag Scan          Qty 1   $9.99      │
│                                             │
│ Reason *                                    │
│  [Damaged / Wrong product / Other…]         │
│                                             │
│ Estimated refund (display only)   NZ$9.99   │
├─────────────────────────────────────────────┤
│ Return instructions                         │
│ • PawTag does not provide return shipping   │
│ • Send to warehouse (from settings)         │
│ • Include printed invoice                   │
│ • Product in reasonable condition           │
│ • Original packaging if available           │
│ • Add return tracking after you ship        │
├─────────────────────────────────────────────┤
│              [ Submit return request ]       │
└─────────────────────────────────────────────┘
```

### 7.2 Customer — Return status on Order Detail

```text
┌─────────────────────────────────────────────┐
│ Return Request — under review               │
│ Reason: Damaged                             │
│ Items: PawTag Scan × 1                      │
│ Requested: NZ$9.99                          │
│                                             │
│ Next: Our team reviews within 1–2 days.     │
│ If approved, ship the item yourself and     │
│ add tracking on this order.                 │
└─────────────────────────────────────────────┘
```

When tracking submitted:

```text
┌─────────────────────────────────────────────┐
│ Return — awaiting warehouse receipt         │
│ Carrier: NZ Post                            │
│ Tracking: NZ123…                            │
│ Status: Shipped by customer                 │
└─────────────────────────────────────────────┘
```

When refunded:

```text
┌─────────────────────────────────────────────┐
│ Refund completed                            │
│ Amount: NZ$9.99                             │
│ Destination: Visa ••••4242 (original method)│
│ Refund ID: re_…                             │
│ ARN: (when available)                       │
└─────────────────────────────────────────────┘
```

### 7.3 Admin — Returns list + detail

```text
┌ Returns ─────────────────────────────────────────────┐
│ Order      Customer    Reason      Status    Action  │
│ WO-000486  John S.     Damaged     Pending   View    │
└──────────────────────────────────────────────────────┘

Detail modal / drawer:
┌ Return Request ──────────────────────────────────────┐
│ Order / Customer / Phone / Email                     │
│ Reason / Requested amount / Items                    │
│ Status timeline                                      │
│ Tracking (Phase 2)                                   │
│ Refund panel (Phase 1):                              │
│   Refund amount [____]  (server default prefill)     │
│   Reason [required]                                  │
│   Warehouse received: Yes/No                         │
│   [Process refund]  ← order.refund permission        │
│   If not received: [Approve refund without return]   │
│     + exception reason required                      │
└──────────────────────────────────────────────────────┘
```

**Tokens:** reuse DESIGN.md teal primary, semantic status colors, amber for pending/exception, red for failed refunds. No new visual language.

---

## 8. Data model changes

### Return (extend)

| Field | Purpose |
|---|---|
| `refundId` | Stripe refund id |
| `refundStatus` | pending/succeeded/failed |
| `refundAmount` | actual processed amount |
| `refundArn` | when Stripe provides |
| `refundExpectedArrival` | when Stripe provides |
| `refundProcessedAt` | timestamp |
| `refundFailureReason` | CSR-visible failure |
| `returnShipProvider` / `returnTrackingNumber` / `returnTrackingUrl` | Phase 2 |
| `returnTrackingSubmittedAt` / `By` / `source` | Phase 2 |
| `refundWithoutReturn` | boolean exception |
| `refundExceptionReason` | required when exception |
| `requestedByType` / snapshot fields | audit accuracy |
| `activity[]` | chronological return events |

### Order (extend carefully)

| Field | Purpose |
|---|---|
| Existing refund fields | Reuse |
| `partiallyRefunded` or use `refundStatus` + remaining balance | Prefer remaining balance + refundStatus; avoid blindly setting full `refunded` on partial |

### Settings (add)

| Key | Default |
|---|---|
| `commerce.returns.warehouseAddress` | empty (must configure) |
| `commerce.returns.warehouseContact` | optional |
| `commerce.returns.notificationEmail` | `return@pawtag.co.nz` |
| Existing `commerce.refunds.*` | Enforce on returns path |

---

## 9. API design (aligned with existing conventions)

| Endpoint | Permission | Purpose |
|---|---|---|
| `POST /api/customer/returns` | auth + ownership | Request return (exists) |
| `GET /api/customer/returns` | auth | List own returns |
| `POST /api/customer/returns/:id/tracking` | auth + ownership | Submit tracking (Phase 2) |
| `PUT /api/admin/commerce/returns/:id/status` | order.update | Approve/reject/received (**not** money) |
| `POST /api/admin/commerce/returns/:id/refund` | **order.refund** | Process Stripe refund (Phase 1) |
| `POST /api/admin/commerce/returns/:id/refund-without-return` | **order.refund** | Exception + refund |

Avoid overloading status PUT for money.

---

## 10. Permissions

| Action | Permission |
|---|---|
| View returns | `order.read` |
| Approve / reject / mark received | `order.update` |
| Process refund | **`order.refund`** |
| Refund without return | **`order.refund`** + reason |
| Customer request / tracking | authenticated owner only |

---

## 11. Notifications & emails

| Event | Audience | Channel |
|---|---|---|
| Return requested | Customer + optional admin | Email + in-app |
| Return approved | Customer | Email |
| Return rejected | Customer | Email |
| Tracking submitted | Admin return mailbox | Email (configurable) |
| Warehouse received | Customer (optional) | Email |
| Refund processing / settled / failed | Customer | Existing refund templates + webhooks |
| Admin refund failure | Admin | Existing admin alert |

Reuse `sendMail` + existing template architecture.

---

## 12. Observability

| Signal | Where |
|---|---|
| Operational logs | `logger` with returnId, orderId, refundId, amount, actor |
| Audit events | `auditService` / `logRefundEvent` — refund processed, exception approved |
| Order activity | `return_requested`, `refund_processed`, `tracking_submitted` |
| Stripe webhooks | Existing refund.updated / charge.refunded |

Never log card numbers, CVV, or Stripe secrets.

---

## 13. Progress tracker

| Phase | Scope | Status | Completed |
|---|---|---|---|
| **0** | Discovery + this document | ✅ Complete | 2026-10-03 |
| **1** | Money path: return → Stripe refund (admin process refund) | ✅ Complete | 2026-10-03 |
| **1b** | Skill extraction + docs (AGENTS/README/DESIGN) | ✅ Complete | 2026-10-03 |
| **2** | Tracking, warehouse receipt gate, return emails, customer status UI | ✅ Complete (receipt gate + emails + status card + tracking submit) | 2026-10-03 |
| **2b** | Settings: warehouse address + return notification email | ✅ Complete (seeded contact + notification email; warehouse **street** address still empty until set in Admin) | 2026-10-03 |
| **3** | Item-level refund state, multi-refund balance hardening, full E2E tests | ✅ Complete (code + unit tests; Playwright skipped by decision) | 2026-10-03 |
| **4** | Merge to main after verification | 🔄 Branch `feature/returns-refunds-phase3` pending merge after tests | |

### Phase 3 acceptance criteria

- [x] Customer can submit return tracking after approval; admin sees it + gets email
- [x] Instruction email includes warehouse address when configured; else “email PawTag for address”
- [x] Remaining balance enforced in cents; over-refund rejected
- [x] Item-level refunded state updated on refund success; blocks double-return of same lines
- [x] Admin order partial refund does not mark whole order fully refunded incorrectly
- [x] Unit tests for balance helpers + over-amount + existing Phase 1 guards
- [ ] Full integration suite for return→refund API — not run this packet (unit coverage only)
- [ ] Configure `commerce.returns.warehouseAddress` in production settings

### Remaining work (not hidden)

- Integration tests for create-return / process-refund routes (optional follow-up)
- Browser E2E skipped per founder decision
- Consolidate cancel/admin-order Stripe call sites into one service (hardening later)
- Live Stripe verification on a real test order

---

## 14. Mockup token reference

Use existing DESIGN.md tokens only:

- Primary buttons: `primary-600` / hover `primary-700`
- Pending status: `amber-50` / `amber-700`
- Success: `green-50` / `green-700`
- Failure: `red-50` / `red-700`
- Cards: `bg-white rounded-2xl shadow-sm border border-gray-100`
- Admin density: smaller text, tables, explicit confirm dialogs for money

---

## 15. Related skills

- `skills/returns-refunds/` — specialist playbook for this domain  
- `skills/commerce-safety/` — Stripe, idempotency, server authority  
- `skills/refund-visibility/` — destination truthfulness  
- `skills/testing-regression/` — financial regression tests  

---

## 16. Out of scope (unless later requested)

- PawTag-paid return shipping labels  
- Refund to a new customer-selected card  
- Automatic bank payouts  
- Mobile return UI (web-first)  
- Full multi-CSR concurrent locking beyond atomic remaining-balance checks (Phase 3 hardening)
