# Tag Activation Limit — hard cap, one-time fee, usage widgets

> Feature document for the founder-ruled activation cap: customers buy unlimited
> tags, but **activations** are limited; the next tag after the limit needs a
> one-time fee; beyond that only a tier upgrade unlocks more. Includes the
> customer dashboard + CSR drawer usage widgets. **Status: implementation in progress — update the checklist as phases complete.**

## 1. Business rules (founder decisions, verbatim semantics)

| # | Rule |
|---|---|
| R1 | Any customer (member or not) may **buy** as many tags as they wish — purchase is never capped. |
| R2 | **Activation** (redeem → attach to pet) is capped by an **effective tag limit**: paid member → their tier's `tag_limit` registry value (Gold 3 / Platinum 10 / Black 999); **non-member (incl. the free 3-month window and beyond) → commerce setting, default 2**. |
| R3 | `active < limit` → activate free. `active == limit` → **one** further activation after paying the **one-time tag activation fee** (commerce setting, default **$19.99 incl GST**; CPF charged per existing config). `active >= limit + 1` → **hard block**: the activate screen stays available but prompts membership — no fee option. |
| R4 | **Replacement tags (lost/damaged) bypass the cap** — same physical slot (AGENTS replacement rules), no fee. |
| R5 | The fee buys **one specific tag's activation** (bound to the tag id, idempotent). Permanent limit raise = tier upgrade only. No auto-refund of an unused paid fee (CSR refund paths handle exceptions). |
| R6 | Widgets: dashboard "Active Tags" card gets small text `N active · limit M`, **red when `active >= limit`**; the CSR customer drawer shows the same indicator **right-aligned in the header**. |

Money values live in **commerce settings** (`commerce.tagActivation.*`), prices/limits are never hardcoded in code.

## 2. Decision tree (server — `POST /customer/tags/redeem`)

```text
existing checks (owner / status inactive / not released / order shipped|delivered)
  ├─ tag.replacesTagId present           → NO cap check (R4) → activate
  ├─ activeCount < limit                 → activate
  ├─ activeCount == limit
  │    ├─ paid fee order exists for THIS tagId → activate (fee already spent)
  │    └─ else → 409 { code: 'tag_limit_reached', feeEligible: true,
  │                    limit, activeCount, feeAmount, upgradeUrl, feeUrl }
  └─ activeCount >= limit + 1            → 409 { code: 'tag_limit_reached', feeEligible: false,
                                               limit, activeCount, upgradeUrl }
```

- `activeCount` = `Tag.countDocuments({ ownerId, status: 'active', deletedAt: null })` — the **same**
  definition the widgets display (single source: `tag-activation.service.getTagUsage`).
- `resolveTagLimit(userId)` = paid tier's registry `tag_limit` → else `commerce.tagActivation.nonMemberLimit`.

## 3. Fee payment flow (reuses the existing money pipeline)

```text
RedeemTag (409 + payload)
  → /account/tag-activation-fee?tagId=…                [new page]
      POST /api/customer/tags/:tagId/activation-checkout
        · re-validates ownership + cap state (feeEligible)
        · idempotent: one PendingOrder per tagId — reuse unexpired pending
          (returns stored clientSecret), recreate expired; refuse to charge when
          an UNUSED paid fee order already exists (directs to that tag)
        · single line item: "Tag Activation Fee" (seeded digital Product —
          identity only), amount ALWAYS from commerce.tagActivation.feeAmount
        · GST extracted via the shared gstPortion helper; CPF folded via
          computeCpf — same schedule/config as every checkout; total =
          fee + CPF, charged exactly like a cart payment
        · stock: reserveAll on the fee product (stockPolicy 'allow') so the
          existing confirm pipeline's inventory step passes unchanged
        · PendingOrder.tagActivation = { tagId } → durable fee↔tag binding
      UI: summary (item / GST / CPF / total) + existing StripePaymentForm
          (default saved card + card chooser)
  → POST /api/checkout/confirm  (PendingOrder-based — works unchanged)
  → existing post-payment completion → Order + Invoice + **PDF receipt emailed
    with the standard purchase template** + activity/audit + points (fee product
    earns zero points) + no fulfilment (non-physical skipped)
  → navigate /account/redeem-tag?paidTagId=… → activate → link to pet (existing)
```

Key reuse: `stripePaymentProvider.createPaymentIntent`, `computeCpf`/`toCpfSnapshot`,
`gstPortion`, `getNumberSetting` (pending TTL), `generateOrderNumber`, Stripe-customer
ensurance, `reserveAll`, `confirmCheckout`/`confirmCheckout` pipeline, invoice engine,
`StripePaymentForm`, saved cards.

## 4. Widgets / data flow

```text
tag-activation.service.getTagUsage(userId) → { activeCount, purchasedCount, limit }
        ├── GET /api/membership/status → data.tagUsage   (dashboard: zero new requests)
        │        → Dashboard SummaryCards "Active Tags" card, new `sub` slot
        │        → shared TagUsageIndicator (packages/ui) — red when active >= limit
        └── GET /api/admin/users/:id/tag-usage           (new endpoint, shared definition)
                 → Users drawer header, right-aligned before the close button
```

`purchasedCount` = owned tags excluding `returned`/`cancelled` (the customer list's
existing semantics). `limit` = `resolveTagLimit` (registry tier → commerce setting).

## 5. Configuration (Admin → Commerce Settings)

| Key | Default | Meaning |
|---|---|---|
| `commerce.tagActivation.nonMemberLimit` | `2` | Max active tags without a paid membership |
| `commerce.tagActivation.feeAmount` | `19.99` | GST-inclusive one-time fee for the single over-limit activation (charged amount is ALWAYS read here) |

Member limits stay in the **entitlement registry** (`tag_limit` per tier) — nothing duplicated.
CPF stays fully config-driven (`commerce.cpf.*`) and applies to the fee like any payment.

## 6. UI/UX states

- **RedeemTag**: normal form; on `tag_limit_reached` shows a limit panel instead of a generic
  error — fee-eligible: `You've activated all N tags in your plan` + `Activate one more for $X
  (one-time)` [Pay →] + `Or upgrade your membership →`; blocked: `Upgrade your membership to
  activate more tags →` (screen stays available, per R3).
- **Fee page**: order summary card (fee line, incl-GST note, CPF row when on, total) + the
  standard secure card form; success → back to activation with a "Payment received" banner.
- **Dashboard card**: value = active count; sub-line `4 active · limit 3` (red ≥ limit;
  two copy variants: at-limit "pay or upgrade" vs blocked "upgrade to activate more").
- **Admin drawer header**: same indicator, right-aligned, before the X.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Charging twice / double pending | One pending per tagId (reuse unexpired, recreate expired); unused paid fee blocks a second charge |
| Fee paid then abandoned | Fee order carries tagId → redeem later still passes; no auto-refund (R5), CSR refund path exists |
| Inventory step failing on the fee order | Fee product seeded `stockPolicy: 'allow'` with ample stock + `reserveAll` in the flow — confirm pipeline passes unchanged |
| Replacement tags wrongly charged | R4 bypass inside the cap check + test |
| Limit drift between portals | One service (`getTagUsage`) feeds both endpoints; widgets display, server enforces |
| Zero-point fee product polluting rewards | No special-casing: purchase points are total-based, so a fee order earns the normal purchase points like any other order (stated, intended) |

## 8. Implementation checklist

- [x] P1 Commerce settings registry + admin UI labels (new "Tag Activation" group); `tag-activation.service` (resolveTagLimit, countActiveTags, getTagUsage, checkActivationCap, hasPaidActivationFee)
- [x] P2 Redeem enforcement (typed 409 payloads, replacement bypass) + `Order`/`PendingOrder` `tagActivation` schema fields (incl. confirm-pipeline copy onto Order)
- [x] P3 `checkoutService.createTagActivationIntent` (shared money path: Stripe customer, order number, GST, CPF, PI, pending, reserveAll, idempotency) + endpoint + fee-product lookup by slug
- [x] P4 Fee page (`TagActivationFee.tsx`) + route + `RedeemTag` code-aware paywall branch + return-to-activate handoff
- [x] P5 Widgets: shared `TagUsageIndicator`, `SummaryCardData.sub`, dashboard wiring (`tagUsage` on `/membership/status`), admin endpoint + drawer header
- [x] P6 Seeds: fee reference product (seed-products + additive `scripts/migrate-fee-product.ts`, applied to dev DB); Order shippingAddress made optional (digital orders) + consumer guards; fee orders skip fulfilment + shipping-confirmation email; docs (this file ✓, AGENTS §17, README, membership-lifecycle skill)
- [x] P7 Tests: unit 11 (cap matrix/limits/unused-fee/replacement) + unit 3 (indicator red rule) + integration 9 (cap at redeem, fee checkout idempotency, confirm → order/invoice/no-fulfilment/redeem, ownership, both widget feeds)
- [x] P8 Gates: lint 0 errors, typecheck 0, builds (shared/db/api/ui/admin/web) all pass, unit 1243/1243, integration 9-file sweep (incl. completion/cancel/invoices/activation/tag-release/checkout) 75/75 — then summary → approval → commit/push/merge → CI (pending founder approval)
