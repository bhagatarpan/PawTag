# Invoice Document Parity — Line Items, Card Marks, Fonts, Save-Card Gating

**Status:** In progress (checklist at bottom)
**Branch:** `feature/invoice-document-parity`
**Origin:** Founder review of order WO-000507 (product + engraving) surfaced six document/UX defects.

---

## Issues & decisions

| # | Issue | Root cause | Decision |
|---|---|---|---|
| 1 | "Save this card?" shown after paying with an already-saved card | `CheckoutConfirmationStep` shows the banner for every signed-in purchase — never checks how the customer paid | Banner only when the payment used a NEW card (Checkout passes `usedSavedCard`) |
| 2a | Order confirmation email missing line items | The seeded CMS `order-confirmation` template body has no items section (the fallback renderer has one) | Add an `itemsHtml` variable (styled rows, server-built, names escaped) + items block in the seeded template + additive live-template migration |
| 2b/2c | Invoice (HTML + PDF) shows one combined item | The store model holds engraving as a per-unit surcharge on the product line; documents rendered exactly that | Shared assembly splits items with a surcharge into **two rows**: product (unit price) + "Engraving — Pet name: X" (surcharge × qty). Rows now sum to the subtotal; fixes HTML and PDF together |
| 2d | Card brand icons lost from invoices | Regression from the unified-engine rewrite (old HTML had Visa/MC/Amex SVGs) | Brand marks restored in HTML; PDF draws them with pdf-lib vector primitives (VISA wordmark, MC circles, Amex box, generic chip) |
| 2e | PDF fonts differ from the online invoice | Online uses per-OS `system-ui` (varies by device); PDF used stock Helvetica | Embed **Inter** (`@fontsource/inter` + `@pdf-lib/fontkit`) in the PDF generator — consistent premium look across all downloads; Helvetica fallback if embedding fails |
| 2f | PDF formatting differs from the online invoice | PDF was a simplified redraw | PDF brought into layout parity (block order, teal accents, engraving subtitles, card marks, totals styling) driven by the **same shared assembly** as the HTML so the two formats cannot drift |

## Architecture

```text
Order (unitPrice + customizationTotal + customisationTexts)
  → finance/invoice-document.ts assembly
      items: product row + engraving row (surcharge split)
      payment: card brand/last4 (+ admin-channel provider IDs)
  ├──► finance/invoice-document-html.ts  (brand SVG icons restored)
  └──► invoice-pdf.service.ts            (Inter embedded, vector brand marks, layout parity)

Order-confirmation email:
  sendOrderConfirmation → itemsHtml (styled, escaped) → CMS template {{itemsHtml}} (seed + live migration)
```

## Hardcoding rules honoured

- No prices/IDs/dates/limits hardcoded — all values flow from documents/settings
- Brand colours in PDF marks reference the same hexes the HTML uses (single source in the renderer module)
- Font files come from the `inter-font` package (versioned dependency, real TTFs for fontkit), not committed binaries
- Template changes are CMS-first: seed for fresh DBs, additive migration for the live template

## Risks

| Risk | Mitigation |
|---|---|
| Fontkit embedding fails at runtime | try/catch fallback to Helvetica — PDFs always generate |
| Live CMS template migration overwrites founder edits | Migration inserts the items block only, only if `{{itemsHtml}}` absent; everything else untouched (dry-run first) |
| Engraving split changes historical invoices retroactively | Intended: the presentation improves for ALL invoices; amounts unchanged |
| Save-card gating hides a legitimately useful prompt | Only the "already saved" case is suppressed; new-card flows unchanged |

## Checklist

- [x] Phase 1 — Save-card gating (`usedSavedCard` prop through Checkout → confirmation)
- [x] Phase 2 — `itemsHtml` in `sendOrderConfirmation`, seeded template update, live-template migration script
- [x] Phase 3 — Assembly engraving split (HTML + PDF parity for line items)
- [x] Phase 4 — Card brand marks: HTML SVGs restored, PDF vector marks
- [x] Phase 5 — Inter embedding in the PDF generator with Helvetica fallback
- [x] Phase 6 — Verification: WO-000507 regeneration (HTML + PDF + email), typecheck/builds, screenshot of new PDF; docs updates

## Verification evidence (WO-000507, dev DB, INV-000043)

- Assembly (customer channel) shows two line items summing to subtotal:
  - `PawTag Classic` qty 1 — lineTotal 19.99
  - `Engraving` (subtitle `Pet name: SNAP`) qty 1 — lineTotal 19.00
  - 19.99 + 19.00 = 38.99 subtotal; total 47.09 (matches invoice)
- Payment snapshot: `method: card`, `cardBrand: visa`, `cardLast4: 4242` (no `pi_`/`in_` on customer channel)
- HTML: VISA SVG icon + `•••• 4242` in the details panel; two item rows with separate prices
- PDF: Inter embedded (font-name scan found `Inter`, no `Helvetica` fallback); vector VISA mark + `•••• 4242`
- PDF raster screenshot confirmed layout, both line items, card mark, and totals
- `packages/api` + `apps/web` typecheck clean; live CMS `order-confirmation` template migrated (additive `{{itemsHtml}}`)
