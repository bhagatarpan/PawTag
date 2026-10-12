# Saved Payment Methods (multiple cards)

**Status:** In progress — branch `feature/multi-saved-payment-methods`  
**Decisions:** Settings → Payment Methods primary UI; explicit post-purchase save opt-in; No → leave PM on Customer but not default; membership/Keep paid preselect default PM; save UX on product **and** membership success

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
  POST /membership/payment-methods/confirm        (post-attach dedupe + "already saved" report)
  POST /membership/payment-methods/default
  POST /membership/payment-methods/detach
  POST /membership/payment-methods/portal         (secondary)
  POST /membership/payment-methods/confirm-save   (post-purchase opt-in; also dedupes)
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

Settings → Payment Methods
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
- **Duplicate cards** are identified by the provider fingerprint (`card.fingerprint`) — brand/last4/expiry alone is NEVER treated as proof. See section 10.
- **Expiring cards** are warned once per card per expiration period, 28 days ahead. See section 11.

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
- [x] UI: Settings → Payment Methods (`PaymentMethodsPanel`) + SaveCardBanner (checkout + membership success)
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
| 2026-10-13 | Saved-card selection at checkout/membership subscribe with server-side ownership validation |
| 2026-10-13 | Duplicate prevention (fingerprint dedupe), cleanup script, 28-day expiry notifications |

---

## 10. Duplicate prevention (provider fingerprint)

Stripe does not dedupe PaymentMethods on attach — re-entering the same card
(shop checkout `setup_future_usage`, or the add-card SetupIntent) created a new
`pm_` object with the same `card.fingerprint`. Rules:

- **Identity = `card.fingerprint`** (provider's stable card id). Cards without
  a fingerprint are ambiguous and never touched.
- `dedupeSavedCards()` (`payment-method.service.ts`) converges each fingerprint
  group to ONE canonical card. Canonical selection (deterministic):
  1. Stripe invoice default, when in the group;
  2. else the card referenced by the active membership;
  3. else the oldest attached (ties → lowest `pm_` id).
- Before detaching a redundant card, billing references are repointed:
  invoice default → subscription `default_payment_method` → local
  `UserMembership.paymentMethodId`. Already-detached errors are idempotent
  success. Historical `PaymentTransaction`/`Invoice` records are NEVER touched.
- Trigger points (all use the same service):
  - `payment_intent.succeeded` webhook (shop path — silent, post-payment);
  - `setup_intent.succeeded` webhook (`purpose: save_payment_method`);
  - `POST /membership/payment-methods/confirm` — add-card flow returns
    `alreadySaved: true` so the UI can say "This card is already saved";
  - `confirm-save` (post-purchase);
  - daily job backstop (section 11 scan re-dedupes via fingerprint grouping).
- Webhook dedupe re-verifies `metadata.userId` against
  `User.stripeCustomerId` — orphan Stripe Customers are skipped (report-only).
- **Cleanup of pre-existing duplicates:** `scripts/cleanup-duplicate-payment-methods.ts`
  — DRY-RUN BY DEFAULT (`--apply` requires interactive confirmation or `--yes`);
  `--json <file>` writes the report. Same canonical rules as live dedupe.
  Cross-customer matches (same card on multiple Stripe Customers) are REPORT-ONLY.

## 11. Expiry notifications (28 days)

Daily background job `saved-card-expiry-check` (`runSavedCardExpiryCheckJob`):

- A card is valid **through the last instant of its expiry month (UTC)**;
  eligibility window = 28 days before that instant.
- Email is CMS-first (slug `saved-card-expiring`, seeded; hardcoded fallback),
  plus an in-app `Notification` (`type: saved_card_expiring`,
  `actionUrl: /account/settings`).
- The in-app notice is created directly — **not** entitlement-gated — because
  this is payment-continuity messaging (dunning precedent), not a tier benefit.
- Idempotency: `SavedCardExpiryNotice` unique index on
  `{userId, paymentMethodId, expMonth, expYear}` — ONE notification per card
  per expiration period. Failed sends retry up to 3 attempts, then require
  manual follow-up (job logs a warning).
- Duplicate cards (same fingerprint) notify once for the canonical card.
- Cards already inside the window at first deploy ARE notified on the first
  run (deliberate: protects customers at renewal risk).
- Stripe Account Updater changes are picked up automatically — the job always
  reads live Stripe state; an updated expiry falls out of the window, a new
  expiry month starts a new notice period.
- Membership awareness: when the card is the active membership's billing card
  (same fingerprint), the email explains that renewals may be affected.
  Memberships are never cancelled or switched by this job.

**Operational setup (run once per environment):**

```bash
npx tsx packages/api/src/seeds/seed-background-jobs.ts   # registers saved-card-expiry-check
npx tsx packages/api/src/seeds/seed-cms.ts               # seeds saved-card-expiring template
```
