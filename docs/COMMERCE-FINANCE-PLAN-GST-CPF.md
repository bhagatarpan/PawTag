# Commerce Finance Plan — Refund GST/Engraving Rules + Card Processing Fee (CPF)

**Status:** `IMPLEMENTED (2026-10-20) — feature branch `feature/commerce-finance-gst-cpf`, switch SHIPPED OFF` (founder enables rates via Commerce Settings when ready)
**Created:** 2026-10-20 · **Supersedes:** `REFUND-CANCELLATION-GST-CPF.md` lineage (GST/engraving rules folded in here)
**Scope:** Full commerce end-to-end — checkout, payments, cancellation, refunds, emails, in-app notifications, invoices (screen + PDF), admin/CSR tooling, finance dashboard, configuration.

## Implementation progress (2026-10-20)

| Phase | Content | Status |
|---|---|---|
| 1 | Shared types (`commerce-finance.ts`), `cpf.service`, `refund-eligibility.service` + 24 unit tests | ✅ DONE |
| 2 | Config registry (`commerce.cpf.*`, switch default OFF) + CommerceSettings "Card payment fee" group | ✅ DONE |
| 3 | Checkout/intent/confirm/webhook: CPF in `pending.total` + order snapshot, brand capture + unsupported-brand auto-refund, merchant-fault path | ✅ DONE |
| 4 | Refund/cancellation enforcement: `maxRefundable` cap, breakdown snapshots on refund PaymentTransactions, `lines[]` admin API + `GET /orders/:id/refund-eligibility`, return estimate clamp, CSR balance fields | ✅ DONE |
| 5 | Admin UI: `RefundLinePicker` (Orders cancel/refund modals — qty steppers, per-line GST, locked CPF row, merchant-fault checkbox), Returns response fields, OrderRefunds CPF card | ✅ DONE |
| 6 | `finance.view` RBAC (admin+CSR seeded), `GET /admin/commerce/finance/overview`, **FinanceDashboard.tsx** (6 sections), `cpf-reconciliation` job (Stripe fee backfill → variance) | ✅ DONE |
| 7 | Customer surfaces: checkout review/payment/sticky totals show "Card payment fee (incl. GST)" + explainer; invoice screen+PDF totals row; order-confirmation email row; FAQ entry (seed + additive migration); totals-only refund comms (unchanged wording) | ✅ DONE |
| 8 | Credit-note scope accuracy (credited-only itemization + own totals from the breakdown snapshot; admin-channel retained note; legacy fallback) + regression suites + docs | ✅ DONE |

### Implementation deviations / notes (authoritative over earlier drafts)

- **Cart drawer/cart page do NOT show the fee row** — the fee is a payment-stage charge (like shipping, which the drawer already defers: "calculated at checkout"). Disclosure happens on checkout review + payment steps before authorisation, matching the exact Stripe amount.
- **FAQ entry is number-free by design** (nothing hardcoded): copy says "A card payment fee (including GST)… The exact fee is shown at checkout" — appended idempotently to the CMS `faq` page by the seed (never overwrites admin edits).
- **Amount-only legacy admin refunds** allocate the amount proportionally across eligible lines (`allocateAmountToBreakdown`) so records/dashboard stay truthful (D16).
- **Fail-closed cancellation**: if eligibility cannot be computed (DB failure), strict cancellations return REFUND_FAILED instead of silently refunding past the cap.
- **Customer emails/notifications remain totals-only** (D1) — retained-charge detail appears only on admin surfaces + admin-channel credit notes.

### Monitoring & audit (verified present)

| Signal | Where |
|---|---|
| Cancellation refund + breakdown | `PaymentTransaction.breakdown` + `logPaymentEvent`/`logRefundEvent` + audit service |
| Admin refund + selection | `auditAdminEvent` (CRITICAL) + breakdown on txn + 400s with reasons |
| CPF exception refunds (unsupported brand / merchant fault) | `PaymentTransaction` notes + `logRefundEvent` + `logger.warn` (SystemLogs, INTEGRATION) |
| CPF config changes | Settings audit (`commerce_settings_updated`, keyed list) |
| Reconciliation | BackgroundJob run history + structured logs |
| Fee collected vs Stripe fee variance | Finance dashboard CPF ledger (backfilled by `cpf-reconciliation` job) |

---

## 1. Confirmed founder decisions (complete log)

| # | Decision | Answer |
|---|---|---|
| D1 | Customer-facing surfaces do **NOT** itemize retained CPF/engraving "in any form" — kept under the hood; **one FAQ entry** explains the card fee | ✅ confirmed |
| D2 | Interactive, actionable **finance dashboard** (GST, CPF, refunds) for CSR/admins | ✅ confirmed — all six sections in §10 |
| D3 | **Flick-of-switch** CPF control — future provider/rate changes must never require re-development | ✅ confirmed |
| D4 | Everything meaningful end-to-end: in-app notifications, emails, dashboards, on-screen invoices, PDFs | ✅ confirmed |
| D5 | Heavyweight job — think/review twice; phased with review gates | ✅ confirmed |
| D6 | Nothing hardcoded; **reuse-first** (search codebase before writing anything) | ✅ confirmed |
| D7 | Fee shape: `percent% of order payable (before the fee) + fixed per transaction`, **GST-inclusive** | ✅ confirmed |
| D8 | Seed placeholder rates (2.65% + $0.30), switch **OFF** by default; founder sets real numbers later | ✅ confirmed |
| D9 | Scope: **shop checkout only** — membership/tag-subscription recurring billing and donations excluded until separately decided | ✅ confirmed |
| D10 | `cpf.refundOnMerchantFault = true` — fee refunded when PawTag cannot fulfil | ✅ confirmed |
| D11 | New **`finance.view`** RBAC permission; all permissions default to admin; `finance.view` also granted to CSR | ✅ confirmed |
| D12 | FAQ wording: agent draft now, founder finalises later | ✅ confirmed |
| D13 | Execution order: phases 1→8 top to bottom | ✅ confirmed |
| D14 | Engraving retention after PawTag-ID generation = **hard cap** (server refuses) | per §2 rules (default accepted) |
| D15 | Shipping on cancellation: unchanged (fully refunded) | per §2 rules |
| D16 | Amount-only legacy admin refund path kept; proportional derived breakdown | per §9 rules |
| D17 | Historical orders/refunds untouched; rules apply forward from deployment | per §15 |

---

## 2. Business rules (merged matrix)

GST is **never computed independently** — every price is GST-inclusive; GST travels with whatever amount moves. Withholding a line automatically withholds its GST.

| Scenario | Product line | Engraving line | CPF | GST behavior |
|---|---|---|---|---|
| Checkout (Visa/MC) | Charged | Charged if saved | **Charged** (config schedule, incl. GST) | All inclusive; CPF gross with recorded GST portion |
| Cancel before PawTag ID generated | Refundable | **Refundable** | **Retained** | GST refunded proportionally with refunded amounts |
| Cancel after PawTag ID generated | Refundable | **Retained** (hard cap) | **Retained** | GST = Σ refunded lines only |
| Return + product refund | Per returned qty | Per **untagged** unit only | **Retained** | Proportional per line |
| Partial refund | Proportional per line | Only eligible + selected units | **Retained** | Proportional per line |
| Goodwill / refund-without-return | Refundable | Eligible units only | **Retained** | Proportional per line |
| PawTag-caused failure (cannot fulfil) | Refundable | Refundable | **Refunded** (`cpf.refundOnMerchantFault=true`) | Follows amounts |
| Unsupported brand post-capture (non-Visa/MC) | — | — | **Auto-refunded** (audited exception) | Follows |
| $0 / fully-rewarded order | — | — | None (no card charge) | — |
| CPF switch OFF | — | — | Never charged; historical snapshots preserved | — |

**Master cap enforced by every money path:**
`maxRefundable = captured − cpfRetained − engravingRetained − Σ(prior succeeded/pending refunds)`

---

## 3. Current architecture (traced 2026-10-20)

| Area | Current state |
|---|---|
| GST model | NZ inclusive (`commerce.tax.inclusive=true`); `simple-gst` extracts `lineTotal × rate/(1+rate)`; order stores embedded `tax`; refunds return inclusive amounts |
| Engraving storage | Per-unit `customizationTotal` on cart/order items; `totalPrice = (unitPrice + customizationTotal) × qty` |
| PawTag-ID signal | `Fulfilment.tagAssignments` per `orderItemId`+quantity is durable/authoritative; `Order.items[].tagId` unreliable; **no refund path consults it today** |
| Cancellation | Refunds **full captured amount unconditionally** (`cancelOrder`) |
| Return estimate | `Σ(unit + customisation) × qty` — engraving always included |
| Return/admin refunds | Balance guard = captured − refunded only; admin free-text amount; no engraving/CPF awareness |
| Intent creation | `createPaymentIntent` — server totals → PendingOrder + Stripe intent; **card unknown at this point**; `confirmCheckout` revalidates `payment.amount == pending.total` |
| Card entry | Saved card (brand known upfront) or PaymentElement (brand observable pre-confirm; country only post-capture) |
| Card capture | Webhook records `cardBrand`; `payment-snapshot.ts` persists brand/last4; **country not captured**; **Stripe's actual fee (`balance_transaction`) never fetched** |
| Credit notes | Itemize **full order at full qty + original order totals** — misleading on partial refunds |
| Customer comms | No breakdown anywhere; no fee concepts |
| Fee/surcharge logic | **None exists** |
| Admin surfaces | `Orders.tsx` cancel/refund modal (free-text amount), `Returns.tsx` amount override, `OrderRefunds.tsx`, `CommerceSettings.tsx` (grouped validated settings w/ toggle/number/select), dashboard patterns in `Dashboard.tsx`/`Statistics.tsx` (**no chart lib — cards+tables only, no new deps**) |
| Customer FAQ | CMS `faq` page via Puck (`Faq.tsx` → `useCmsPage('faq')`) — admin-editable |

### Gaps vs rules

| Rule | Verdict |
|---|---|
| GST refunded proportionally | ✅ implicit (inclusive); ⚠️ credit note shows wrong GST on partials |
| Engraving non-refundable post PawTag-ID | ❌ never enforced |
| Engraving refundable pre PawTag-ID | ❌ accidental only; inverse case also full-refunds |
| CPF concept | ❌ absent entirely |
| Credit notes reflect credited scope | ❌ full-order items + totals |
| Breakdown persistence | ❌ nothing records retained amounts; re-derivation unsafe (tags detach on return) |

---

## 4. Design principles (D6 — nothing hardcoded, reuse-first)

| Needed | Reused/extended existing asset |
|---|---|
| Cents-safe money math | `@pawtag/shared` money helpers (`roundToCents`, `toStripeAmount`, add/subtract/multiply) |
| Config without hardcoding | `commerce/config.ts` validated registry → **`CommerceSettings.tsx`** (labels/tooltips/groups; audit via existing settings audit) |
| Refund line-breakdown architecture | `RefundBreakdownSnapshot` on `PaymentTransaction` (+ credit-note subdoc, admin channel) — this plan §5 |
| Engraving eligibility | `Fulfilment.tagAssignments` matching (proven pattern: `tag-return-detach.service`) |
| Card brand/capture | Existing webhook capture + `payment-snapshot.ts` (extended with country + cpf) |
| Refund engine | `stripePaymentProvider.createRefund` + existing idempotency/dedupe/reconciliation patterns |
| Audit | `auditAdminEvent` / `logCommerceEvent` for config changes + exception refunds + cancellations |
| Admin RBAC | Existing permission system + `requirePermission` (new `finance.view`, D11) |
| Dashboard | `Dashboard.tsx`/`Statistics.tsx` patterns: aggregate API + stat cards + filterable tables, lucide icons, `@pawtag/ui` StatusBadge/EmptyState/Loader — **no chart library** |
| FAQ | CMS `faq` Puck page — one new admin-editable block |
| Emails | `sendCmsEmailOrFallback` + existing seeds (totals-only edits, CMS-first) |
| Notifications | `Notification` + `notifyCustomerOfStatusChange` / `notifyRefundUpdate` |
| Invoices/credit notes | Shared finance engine (`invoice-document.ts`, canonical HTML, PDF dispatcher via `FINANCE_PDF_RENDERER`) |
| Reconciliation | Existing DB job scheduler (locks, leases, retry semantics per background-jobs rules) |
| Tests | Existing suites: cart-service, money, return-refund-service, refund-credit-note-email, invoice/PDF tests |
| Stripe client | Single factory / `stripePaymentProvider` — no scattered Stripe code |

**Rule for implementation: search before writing; extend before creating; no new dependencies without explicit founder approval.**

---

## 5. Data model

| Change | Where |
|---|---|
| CPF config keys: `commerce.cpf.enabled` (toggle, default **false**), `commerce.cpf.percent` (default 2.65), `commerce.cpf.fixed` (default 0.30), `commerce.cpf.appliesTo` (default `visa,mastercard,amex` — Amex added Oct 2026), `commerce.cpf.refundOnMerchantFault` (default **true**), `commerce.cpf.scheduleVersion` | `commerce/config.ts` registry + CommerceSettings group "Card payment fee" |
| `Order.payment.cpf?: { amount, gst, percent, fixed, scheduleVersion, cardNetwork?, cardCountry?, refundedAmount }` — snapshot at intent creation; brand/country filled at capture | Order schema |
| `RefundBreakdownSnapshot`: `lines: [{orderItemId, productName, kind: 'product'\|'engraving', quantity, unitInclusive, refundedAmount, gstPortion, retainedAmount, retainedReason?}]` + `totals {refunded, refundedGst, retained, retainedGst}` + `cpfRetained {amount, gst}` (admin-only visibility) | shared type → `PaymentTransaction.breakdown` + credit-note `Invoice` subdoc (admin channel) |
| `PaymentTransaction.providerFee?` | schema + reconciliation job |
| Cancellation paths now set `items[].refundedQuantity/refundStatus` (existing fields) | `cancelOrder` |
| New RBAC permission `finance.view` | permissions registry + CSR role seed |

Historical documents: all fields optional → absent treated as 0 on every surface. **No data migration.**

---

## 6. Core services

| Service | Responsibility |
|---|---|
| `commerce/services/cpf.service.ts` | `computeCpf(payableCents)` → `{ amount, gst, percent, fixed, scheduleVersion }` (config-driven, cents-safe, GST-inclusive); `cpfForOrder(order)` → snapshot or 0 (switch off/absent); `verifyChargedBrand(order, brand, country)` → unsupported-brand auto-refund exception (audited, idempotent); `refundCpf(order, reason)` for merchant-fault/exception paths |
| `commerce/services/refund-eligibility.service.ts` | `getTaggedUnits(order, orderItemId)`; `lineRefundability(order)`; `gstPortion(amountCents)` (rate from `nzGstProvider`, never hardcoded); `buildBreakdown(order, selection)`; **`maxRefundable(order)`** — the single cap every money path consults |
| `jobs/cpf-reconciliation.ts` | For recent card payments: fetch `balance_transaction` fee → `providerFee`; flag `|cpf − providerFee|` variance; idempotent + locked; feeds dashboard |

**Checkout flow:** `createPaymentIntent` → `computeCpf(payable)` → CPF folded into `pending.total` (the existing `amount == pending.total` confirm invariant carries it — retry-safe, no duplicates). Zero-total bypass unchanged. Webhook capture fills brand/country → runs brand verification.

**Refund flow (all paths):** consult `maxRefundable` → build breakdown → move money → **snapshot breakdown on the refund PaymentTransaction** (durable truth — returned tags detach later; never re-derive) → credit note copies it → emails/notifications use totals only.

---

## 7. Scenario math example (reference for tests)

Order: product $39.99 + engraving $19.00 (GST incl.), shipping $0, CPF schedule 2.65% + $0.30.
Payable before fee = $58.99 → CPF = round(58.99 × 0.0265) + 0.30 = $1.56 + $0.30 = **$1.86** → captured = $60.85. CPF GST portion = 1.86 × 15/115 = **$0.24**.

| Case | Refund | Retained |
|---|---|---|
| Cancel before PawTag ID | $58.99 (product + engraving) | CPF $1.86 |
| Cancel after PawTag ID | $39.99 (product only) | CPF $1.86 + engraving $19.00 |
| Merchant-fault cancel (any time) | $60.85 (incl. CPF refund) | — |

---

## 8. Surface matrix

### 8a. Customer-facing — deliberately minimal (D1)

| Surface | Change |
|---|---|
| Cart drawer / cart page / checkout review | "Card payment fee (incl. GST)" row (only when enabled + card applies) + one-line explainer "covers payment-processing costs" + fee schedule text before payment; payable total = exact Stripe amount |
| Order confirmation email | Totals include CPF row — no commentary |
| Invoice (screen + PDF) | CPF as its own totals row with GST portion (legally accurate document) |
| Cancellation/refund emails + in-app notifications | **Accurate totals only** — real Stripe refund amount ("Refund of $X on its way"). No retained-charge lines, ever |
| Customer credit note (screen + PDF) | **Credited scope only** — refunded lines + totals; nothing about retained CPF/engraving |
| Order detail refund section | Refunded amount + destination (existing style) |
| **New FAQ entry** (CMS `faq` page) | Draft — §13 |

### 8b. Admin/CSR-facing — full transparency

| Surface | Change |
|---|---|
| Orders cancel/refund modal (`Orders.tsx`) | Line-item picker: product rows (qty steppers), engraving rows (untagged units only; tagged greyed "PawTag ID generated — non-refundable"), per-line GST, live totals footer + **locked CPF retained row** |
| Returns refund modal (`Returns.tsx`) | Same picker pre-filled from return items; amount-only legacy override kept (D16 — proportional derived breakdown) |
| Refund APIs | New optional `lines[]` payload (server derives amount+breakdown); ineligible engraving selection → 400 with reason; over-cap → 400 |
| `cancelOrder` service | Full-selection breakdown; ineligible engraving auto-excluded; refunds `totals.refunded`; all-retained edge → cancel with $0 refund |
| Order detail + `OrderRefunds.tsx` | Breakdown tables: per-line refunds+GST, retained engraving, retained CPF, Stripe-fee variance (when reconciled), actors/timestamps |
| Customer return estimate API + CSR balance | Per-line refundable/retained; balance response includes retained engraving + CPF |

---

## 9. Selection rules (admin picker — server-enforced, UI mirrors)

| Line | Selectable when | Notes |
|---|---|---|
| Product row (per item) | Always; qty ≤ (qty − refunded qty) | Qty stepper |
| Engraving row (per item) | Untagged units only; qty ≤ refundable units | Tagged units greyed with reason |
| CPF row | **Never selectable** | Locked footer row: "Card payment fee $X — non-refundable" |
| GST column | Read-only | `incl. GST $x.xx` per line |
| Totals footer | Live | Refund total (incl. GST) · Retained total (incl. GST) |

Server revalidation on every request: selection vs **fresh** tag state, `maxRefundable`, cents math. Client values never trusted.

---

## 10. Finance dashboard (D2 — all six sections confirmed)

**New:** `apps/admin/src/pages/FinanceDashboard.tsx` + `GET /api/admin/finance/overview` (permission `finance.view`) + sidebar entry. Date-range filter (7d/30d/90d/custom). Existing admin page patterns only.

| Section | Contents | Actions |
|---|---|---|
| Stat cards | Sales collected · GST collected · CPF collected · CPF retained on refunds · GST refunded · Total refunded · Net revenue | — |
| GST ledger table | Per order/invoice: GST charged, GST refunded (per credit note), net | Drill to order/invoice |
| CPF ledger | Collected · retained · auto-refunded exceptions · **Stripe actual fee vs CPF variance** (reconciliation) | Drill to payment; variance rows sorted first |
| Refunds table | Order, expandable per-line breakdown (amount+GST), retained engraving/CPF, status (pending/succeeded/failed), actor | Open order; **retry failed refund** (existing endpoint); status/reason filters |
| Exceptions queue | Failed refunds · bookkeeping-failed cancellations · CPF variance flags · unsupported-brand auto-refunds | Direct repair-flow links |
| Config footer | Current schedule + version; change history (settings audit) | Link to CommerceSettings |

All aggregates computed from existing collections (PaymentTransaction/Invoice/Order) — no new data stores.

---

## 11. CPF switch matrix (D3 — flick of switch)

| State | Checkout | Customer surfaces | Refunds/cancel | Dashboard | History |
|---|---|---|---|---|---|
| ON | Fee computed, in total, charged | Fee row shown | CPF in cap + retained (under-hood) | Live CPF columns | Snapshots preserved |
| **OFF** | No fee anywhere; UI row hidden; totals unchanged | No fee row | Cap uses `cpf = 0` for new orders; **old snapshots still enforced + shown** | Historical columns persist | Untouched |
| Rate changed | New orders snapshot new rate | — | Old orders per their snapshot | Version mix visible | Guaranteed |

Provider switch (future): point the Stripe adapter elsewhere; CPF config untouched — no code change (D3).

---

## 12. Email / notification / document accuracy rules (D1, D4)

- Every customer money figure equals the persisted record and Stripe: order total = captured; refund email amount = actual Stripe refund submitted.
- GST never appears as a separate customer refund line (inclusive pricing; embedded in every figure). GST-out detail lives in invoice totals rows + admin ledgers.
- Credit notes (customer channel) list **only credited scope**; admin channel may carry full breakdown.
- CMS email seeds bumped (version) only where totals wording needs it; hardcoded fallbacks kept in sync; no retained-charge copy anywhere customer-facing.

---

## 13. FAQ draft (D12 — founder finalises)

> **Why is there a card payment fee?**
> A fee (currently X% + $Y, including GST) applies when you pay by Visa, Mastercard or American Express. It covers the cost of processing your card payment and is included in the total you see before you confirm your payment. The fee is not refunded if you cancel your order or return an item, because your card payment processing cost is incurred at the moment you pay.

(Values rendered from config, not hardcoded in copy; wording editable in the CMS FAQ page.)

---

## 14. Permissions (D11)

| Role | `finance.view` | Notes |
|---|---|---|
| Admin (all roles) | ✅ default | Existing "all permissions to admin" behavior |
| CSR | ✅ granted | Seeded into CSR role |
| Others | ❌ | Dashboard + finance ledger endpoints gated by `requirePermission('finance.view')` |

Money-moving actions keep their existing, stricter permissions (`order.refund` etc.) — `finance.view` is read-only visibility.

---

## 15. Phases (D13 — sequential with review gates)

| Phase | Content | Gate before next |
|---|---|---|
| 1 | Shared types + `cpf.service` + `refund-eligibility.service` (pure, cents-safe) + unit tests | Math/rules walkthrough with founder |
| 2 | Config registry keys + CommerceSettings "Card payment fee" group (switch **OFF**) | Settings UX review |
| 3 | Checkout/intent/confirm/webhook integration + order snapshots + brand verification + merchant-fault refund path | Money-path trace review |
| 4 | Refund/cancellation enforcement: `maxRefundable`, breakdown snapshots, `lines[]` APIs, picker endpoints | Rules review |
| 5 | Admin UI: Orders/Returns pickers, order detail + OrderRefunds breakdowns, CSR balance display | UI review |
| 6 | Finance dashboard + `cpf-reconciliation` job + `finance.view` RBAC | Data-accuracy review |
| 7 | Customer surfaces: checkout fee row, invoice totals row, totals-only emails/notifications, FAQ entry | Copy review |
| 8 | Credit-note scope accuracy (credited-only itemization + own totals) + full regression + docs (`RETURNS-REFUNDS-WORKFLOW.md`, this plan status flip) | Final gate before enabling in any environment |

---

## 16. Test plan

| Layer | Cases |
|---|---|
| Unit — CPF | Percent+fixed math; GST split; cents invariants (`cpf = net + gst`); switch off → 0; rate change → new snapshots only; appliesTo filtering |
| Unit — eligibility | 0/1/2-of-N tagged units; qty clamps; multi-item orders; GST extraction rounding |
| Unit — checkout | CPF inside `pending.total`; intent amount == total; zero-total bypass; saved vs new card; retries/webhooks → single fee |
| Unit — cancellation | Pre/post PawTag-ID amounts; CPF retained both; all-retained edge ($0 refund + cancelled); merchant-fault full refund incl. CPF; breakdown persisted |
| Unit — refunds | Cap `captured − cpf − engraving − prior`; `lines[]` respected; ineligible engraving → 400; amount-only proportional fallback; duplicate/concurrent requests safe |
| Unit — documents | Invoice shows CPF totals row; customer credit note = credited scope only; admin channel carries breakdown; historical (no cpf field) docs render |
| Unit — emails/notifs | Totals-only wording; amounts match records; no retained-charge copy |
| Unit — dashboard | Aggregates equal raw ledger sums; permission gating |
| Regression | Existing money/cart/refund/email/PDF suites stay green; historical orders unaffected everywhere |

---

## 17. Rollout & migration

- Code ships with `commerce.cpf.enabled=false` → **zero behavior change** until founder configures rates and flips the switch on the settings page.
- No data migration; historical orders/refunds/credit notes untouched (D17); absent cpf fields = 0 everywhere.
- Reconciliation job starts collecting Stripe fees once enabled (backfill limited to recent window).
- Rollback = flip switch off (no code revert; snapshots/history preserved).

---

## 18. Explicitly excluded (until founder decides otherwise)

- Membership / tag-subscription recurring billing surcharges (D9)
- Donation payments (D9)
- Non-card payment methods
- New frontend charting dependencies (dashboard is cards + tables per existing patterns)
