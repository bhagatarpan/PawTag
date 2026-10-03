---
name: returns-refunds
description: Implement or review PawTag customer returns and refunds end-to-end. Use for return requests, CSR refund processing, warehouse receipt rules, refund-without-return exceptions, return tracking, return/refund emails, and wiring Return documents to Stripe refunds. Enforces single money path, original-payment-method destination, server-authoritative amounts, and no fake refunded status.
---

# Returns & Refunds

`AGENTS.md`, `commerce-safety`, and `refund-visibility` remain authoritative.

## Domain rules

1. **PawTag does not provide return shipping.** Customer arranges shipping and includes invoice, reasonable condition, packaging if available, and tracking.
2. **Return request ≠ Stripe refund.** Creating/updating a Return document must not invent money movement.
3. **Default money path requires warehouse receipt** (`received`) before Process Refund.
4. **Refund without return** is an explicit exception: permission `order.refund`, required reason, CSR identity, audit, `refundWithoutReturn=true`.
5. **Reason is mandatory** for every refund request (customer and admin). Validate server-side.
6. **Server owns amounts.** Client estimates are display only.
7. **Stripe refund destination is always the original payment method.**
8. **Never mark refunded unless Stripe accepted** the refund request.
9. **One logical refund must not create two Stripe refunds** (idempotency + remaining balance).
10. **Partial refunds** must respect remaining refundable balance on the order payment.
11. **Do not break** customer cancel refund or Admin Orders Refund Order.
12. **Do not create a third Stripe refund implementation** — reuse `stripePaymentProvider.createRefund`.
13. **Shipped orders:** customer **Request Return** (not Cancel); admin **Refund Order** allowed (`shipped → refunded` in orderStatus). Return money path still uses warehouse receipt / exception.

## Current architecture

| Piece | Location |
|---|---|
| Return model | `packages/db/src/models/Return.ts` |
| Customer create return | `packages/api/src/routes/customer-returns.ts` |
| Admin returns status | `packages/api/src/routes/admin-returns.ts` |
| Process refund command | `POST /api/admin/commerce/returns/:id/refund` |
| Refund-without-return | `POST /api/admin/commerce/returns/:id/refund-without-return` |
| Return refund service | `packages/api/src/commerce/services/return-refund.service.ts` |
| Stripe provider refund | `packages/api/src/commerce/providers/stripe/index.ts` |
| Workflow + mockups | `docs/RETURNS-REFUNDS-WORKFLOW.md` |

## Customer portal return status

When showing return status on order detail:

| Status | Customer copy |
|---|---|
| pending | Under review; instructions if approved; tracking form hidden |
| approved / received | Ship yourself + add tracking; no PawTag-paid shipping |
| **rejected** | **“Return rejected”** + no refund will be processed; show **PawTag note** (`Return.notes` if set); label amount **“Requested (not refunded)”**; contact `support@pawtag.co.nz`; **hide tracking form** |
| refunded | Show refund to original payment method |
| refund_failed | Failure reason + support path |

Do **not** show soft “under review” language after reject. Do **not** show Process Refund UI on customer portal.

## Return lifecycle (current)

```text
pending → approved → received → refunded
pending → rejected
rejected → approved          (CSR can reverse until money refunded)
approved → rejected          (CSR can reverse until money refunded)
received → rejected          (change mind before Process Refund)
refunded → (terminal — no approve/reject)
```

- **Approve ≠ money.** Warehouse receipt + Process Refund remain separate.
- **CSR can Approve/Reject until payment is refunded** (business rule).
- Modal: Close (X) button + Escape; Approve/Reject shown on all statuses except `refunded`.
- Re-decides send customer emails again (`return-approved` / `return-rejected`).

Do **not** treat bare `PUT status → refunded` as money movement.

## Phase 3 rules (current)

1. Customer tracking: `POST /api/customer/returns/:id/tracking` only when status is **`approved`** (until warehouse `received`). Customer can edit tracking if they made a mistake. Tracking ≠ warehouse receipt.
2. Warehouse address appears in **return instruction email** when `commerce.returns.warehouseAddress` is set; otherwise customers email support for the address. Do not require a large warehouse address block on the order page.
3. Remaining refundable balance is computed in **cents** from PaymentTransaction (`succeeded` + `pending`); over-amount refunds are rejected server-side.
4. Admin order partial refunds must **not** set the whole order to `refunded` unless the capture is fully refunded.
5. Item-level state (`Order.items[].refundedQuantity` / `refundStatus`) is **display/enforcement** only — money truth is PaymentTransaction + Return.
6. Block create-return for lines already fully refunded.
7. Playwright E2E is out of scope for Phase 3; use integration/unit tests.
8. Admin email on tracking submit uses `commerce.returns.notificationEmail` (default `return@pawtag.co.nz`).

## Permissions

| Action | Permission |
|---|---|
| View returns | `order.read` |
| Approve / reject / received | `order.update` |
| Process refund / refund-without-return | `order.refund` |

## Configurable settings (do not hardcode)

- `commerce.returns.warehouseAddress` — street address for instruction emails; **empty until set in Admin**
- `commerce.returns.warehouseContact` — **email only** (`support@pawtag.co.nz`); no phone
- `commerce.returns.notificationEmail` (default `return@pawtag.co.nz`)
- Existing `commerce.refunds.enabled`, `maxDaysAfterPurchase`, `partialEnabled`

## Founder smoke test (Stripe test mode only)

Before launch, founder verifies: Request Return → Approve → tracking → Mark Received → Process Refund.  
Checklist: `docs/RETURNS-REFUNDS-WORKFLOW.md` § Progress tracker.  
Do not process live refunds as part of automated AI verification unless explicitly authorized.

## Observability

Every refund operation must write:

- operational `logger` context (returnId, orderId, refundId, amount, actor, result)
- durable audit event
- order activity entry

Webhook refund updates remain the settlement source of truth.

## Admin notification when customer requests a return

On successful `POST /api/customer/returns`:

1. **Customer email** — request received + return instructions (warehouse address in email if configured, else email support for address). CMS slug: `return-request-received`.
2. **Admin email** — to `commerce.returns.notificationEmail` (default `return@pawtag.co.nz`) and `ADMIN_ALERT_EMAIL` if set. CMS slug: `return-request-admin`.
3. **Admin in-app notification** — `Notification.audience: 'admin'`, `type: 'return_requested'`.
4. **CSR approve** — customer email CMS `return-approved` (ship instructions + warehouse address/contact).
5. **CSR reject** — customer email CMS `return-rejected`.
6. **Tracking submit/edit** — allowed only while status is **`approved`** (until warehouse marks `received`). Customer can edit tracking if they made a mistake. Admin email `return-tracking-admin` + customer `return-tracking-received` on first submit. Activity `tracking_submitted` / `tracking_updated`.
7. **Process Refund** — customer email `refund-processed-csr` + Stripe webhook refund emails.
8. **Sidebar badge** — amber pending count.
9. **Dashboard tile** — “Pending Returns” (no blinking).

Approve ≠ money. Warehouse receipt + Process Refund remain separate.

Monitored via: `logger.info` on create/tracking, Notification collection, email send logs.

## Tests expected

- Customer request: ownership, reason required, items, server amount
- Admin process refund: permission, received gate, amount ceiling, Stripe fail-closed
- Refund without return: permission + reason + audit flags
- Idempotency: double process does not double-charge
- Regression: cancel refund + admin order refund still pass
- Destination snapshot + ARN when Stripe provides it

## Out of scope unless requested

- PawTag-paid return shipping
- Refund to a different card chosen by customer
- Automatic bank payouts
