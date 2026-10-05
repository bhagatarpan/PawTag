# Saved Payment Methods (multiple cards)

**Status:** In progress — branch `feature/multi-saved-payment-methods`  
**Decisions:** Membership Manage primary UI; explicit post-purchase save opt-in; No → leave PM on Customer but not default; membership/Keep paid preselect default PM; save UX on product **and** membership success

---

## 1. Objective

Customers can save **multiple** Stripe PaymentMethods, designate **one default**, and use that default for future product purchases, yearly membership, and Keep/repair paid flows — without a parallel card-storage system.

---

## 2. Architecture (Stripe Customer = source of truth)

```text
User.stripeCustomerId
  └── Stripe PaymentMethods (cards)
        ├── default: invoice_settings.default_payment_method
        └── display only: brand •••• last4 + expiry (never PAN/CVC)

Reuse:
  GET  /membership/payment-methods
  POST /membership/payment-methods/setup-intent   (add card, no charge)
  POST /membership/payment-methods/default
  POST /membership/payment-methods/detach
  POST /membership/payment-methods/portal         (secondary)
  POST /membership/payment-methods/confirm-save   (post-purchase opt-in)
```

**No** custom card table. Stripe remains source of truth; UI reads live list.

---

## 3. Default rules

1. First saved PM + no default → **becomes default**
2. Add another PM + default exists → **keep existing default** unless customer sets otherwise
3. Explicit set-default → Stripe Customer `invoice_settings.default_payment_method`
4. Remove default → require another valid PM first if membership still requires a card
5. Future charges preselect **current default**; customer may pick another without changing default

---

## 4. Decision tree

```text
Payment success (product OR membership)
  → fetch saved PMs
  → if none: skip banner
  → if some: "Save this card for faster checkout?" Yes / Not now
       Yes → if no default: set first PM default; else keep default
       No  → do not set default (PM may remain on Stripe Customer)

Membership Manage → Payment Methods
  → list PMs, Default badge
  → Add (SetupIntent + Elements)
  → Set default / Remove (block if membership requires card & no replacement)
```

---

## 5. Business rules

- One **default** PM; multiple saved PMs allowed
- No raw card data in DB/logs
- Delete default blocked when active membership requires a card and no other valid PM
- Membership subscribe / repair / Keep paid: pass `default_payment_method` when valid; Elements fallback
- Server ownership: all ops scoped to authenticated user + their `stripeCustomerId`

---

## 6. UX states

| State | UI |
|---|---|
| No saved PMs | Empty + Add payment method |
| One / many | List + Default badge + actions |
| Add | SetupIntent → Elements |
| Set default / Remove | Confirm + success/error |
| Membership-required remove | Blocked + replace first |
| Post-purchase save | Optional banner on product **and** membership success |
| Stripe error / expired / detached | Friendly recovery |

---

## 7. Checklist

- [x] Feature branch `feature/multi-saved-payment-methods`
- [x] This doc
- [x] Shared DTOs + endpoints (`packages/shared/src/payment-methods.ts`)
- [x] Service: list (real default), setup-intent, set-default, detach, confirm-save
- [x] Routes under `/membership/payment-methods/*`
- [x] Charge paths pass `default_payment_method` when valid (subscribe + repair)
- [x] UI: MembershipManage PaymentMethodsPanel + SaveCardBanner (checkout + membership success)
- [x] Tests: contracts, list empty, validation, ownership 401
- [x] Docs/skills updates
- [ ] Approval → commit/push

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Membership-first never attaches PM to Customer | confirm-save + SetupIntent + subscribe passes default when present |
| Remove last card while membership active | Server blocks detach |
| Stripe desync | List always reads Stripe Customer live |
| Duplicate default changes | Idempotent set-default |

---

## 9. Progress log

| Date | Update |
|---|---|
| 2026-10-06 | Implemented multi-card service/routes/UI + save-after-purchase banners + default PM on subscribe/repair |
| 2026-10-06 | Cards visible without membership; honest save for shop + membership (SetupIntent when empty; no false saved) |
