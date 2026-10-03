---
name: email-cms-templates
description: Implement or review PawTag customer/admin email CMS templates for /communications/templates. Use when seeding CmsEmailTemplate slugs, wiring send paths to renderCmsEmail, fixing templateSlug audit meta, or ensuring admin-editable emails actually control live sends. Enforces CMS-first + hardcoded fallback and refund destination truthfulness.
---

# Email CMS Templates

Admin UI: **Communications → Email Templates** (`/communications/templates`).  
Model: `CmsEmailTemplate`. Send authority: **only** `renderCmsEmail(slug)` / `sendCmsEmailOrFallback`.

## Core rule

**A template on the CMS page does nothing unless the send path loads it.**

```text
Admin edits CMS template
        ↓
send path calls renderCmsEmail('slug') or sendCmsEmailOrFallback({ slug, ... })
        ↓
Active CMS template → admin copy wins
Else → hardcoded fallback HTML (never block customer email)
```

`sendMail(..., { templateSlug })` is **audit only** — it does **not** render CMS body.

## Pattern (preferred)

```ts
import { sendCmsEmailOrFallback } from './email.service';

await sendCmsEmailOrFallback({
  slug: 'order-status',
  to: customerEmail,
  vars: { orderNumber, status, viewOrderUrl },
  fallbackSubject: `Order ${orderNumber} has shipped`,
  fallbackHtml: renderOrderStatusEmail({ ... }),
  businessFlow: 'orders_commerce',
  relatedEntityType: 'order',
  relatedEntityId: order._id.toString(),
  relatedEntityDisplay: order.orderNumber,
});
```

## Seeding a new template

1. Add object to `emailTemplates` in `packages/api/src/seeds/seed-cms.ts`
2. Unique lowercase `slug`
3. `subject`, `title`, `body` with `{{var}}` / `{{#var}}…{{/var}}`
4. `variables[]` + `variableDefinitions[]` for admin UI
5. `businessFlow`, `emailType`, `isCritical`, `version`
6. Run seed (create if missing; bump `version` to overwrite admin-safe seed content when intentional)
7. Wire send path with fallback + `auditMeta.templateSlug`

## Refund / return copy constraints

- Refund emails must keep **original payment method** destination wording (`formatRefundDestination*` / Brand ••••last4).
- Do not invent “refund to a different card”.
- Warehouse address in return instruction emails uses `commerce.returns.warehouseAddress` when set; else contact email (`commerce.returns.warehouseContact`, default `support@pawtag.co.nz`).
- Money emails: never mark refunded in copy unless Stripe accepted (service already enforces this).

## Phase 1–2 wiring status

| Area | Status |
|---|---|
| Auth welcome/verify/password/MFA/pet-found/order-confirmation/invoice-paid/guardian* | CMS used |
| Order status + refund processing/settled/failed | CMS-first |
| Login notification | CMS-first; customer subject |
| Pet birthday/anniversary | CMS `pet-birthday` / `pet-anniversary` |
| Subscription renewal | CMS `subscription-renewed` |
| Gold welcome | CMS `gold-welcome` |
| Membership welcome/cancelled/resumed/tier-changed/expired/renewal-reminder | **CMS Phase 2** |
| Returns request/admin/tracking/CSR refund | **CMS Phase 2** |
| Active period expired/today/7d/30d | **CMS Phase 2** |
| Subscription cancellation | **CMS Phase 2** |
| Remaining Category B (reminders, grace, milestones, low stock, support, referral, generic) | Still unwired — later packet |

## Monitoring

- Email Audit: `templateSlug`, `businessFlow` via `sendMail` auditMeta  
- Communications send-test: `POST /api/admin/communications/templates/:id/send-test`  
- Logs: `logger` on CMS miss fallback

## Out of scope unless requested

- SMS templates (separate `CmsSmsTemplate`)
- Rewriting all membership/subscription emails in one packet (Phase 2)
- Fail-closed money emails when CMS inactive (keep hardcoded fallback unless product decides otherwise)
