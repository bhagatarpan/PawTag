# Keep My Membership — Implementation Plan

**Status:** In progress on branch `feature/keep-my-membership-hardening`  
**Owner:** Product + Engineering  
**Related:** `AGENTS.md` §16b, `skills/membership-lifecycle/`, `skills/membership-tier-change/`, `skills/commerce-safety/`

---

## 1. Objective

Customer-facing **Keep My Membership** for memberships in the **cancelling** state.

The customer experiences this as a simple reversal of cancellation. Backend owns all business logic. UI never calculates prices or payment requirements.

---

## 2. Business rules (confirmed)

| Scenario | Charge | Dates | Stripe |
|---|---|---|---|
| **A — Benefits still active** (`currentPeriodEnd` in future) | **No charge** | **Original** start/end preserved | Best-effort clear `cancel_at_period_end`; if Stripe sub already ended, **still keep** local membership for the paid period |
| **B — Benefits exhausted** (`currentPeriodEnd` past) | **Full current tier price** (CMS/tier doc) | **New period from payment date** (not original end) | `subscribeToTier` + payment; activate only after success |

### Eligibility

PawTag model has **no** `cancelling` enum. Cancelling = `cancelledAt` set **or** `status === 'cancelled'` (cancel window / webhook sync).

- Keep is for **cancelling** members (or benefits-exhausted paid rejoin).
- **Not** for ordinary active members who never cancelled.
- **Idempotent:** double-click / retry must **not** create duplicate memberships, Stripe subs, charges, points, or emails.

### Points / Guardian

Same-tier keep: entitlement registry multiplier applies again on next use. **No** extra points grant. No downgrade clawback.

---

## 3. Decision tree

```text
POST /api/membership/keep (authenticated, owns membership)
        │
        ▼
Load membership (latest for user)
        │
        ├─ pending_payment + Stripe clientSecret → return payment_required (idempotent)
        ├─ active + not cancelling + benefits ongoing → return resumed/already-active (idempotent)
        │
        ▼
requiresPaymentForKeep(membership)  // server-only
        │
   NO ──┴── YES
    │         │
    ▼         ▼
Path A      Path B
free        paid
    │         │
    ▼         ▼
Local keep  Close old +
+ dates     subscribeToTier full price
+ emails    clientSecret → payment
+ audit     activate after pay
            invoice + welcome
```

---

## 4. Architecture / data flow

```text
KeepMembershipPanel (web)
  → POST /api/membership/keep
  → membership.service.keepMyMembership(userId)
       → requiresPaymentForKeep()
       → Path A: local restore + best-effort Stripe resume
       → Path B: subscribeToTier (reuse) → payment → activateMembership
  → entitlement cache + tags re-eval
  → audit + email + notification
  → response { outcome, dates, paymentRequired, chargeAmount?, clientSecret? }
```

**Reuse:** Stripe factory, payment mode, `subscribeToTier`, `activateMembership`, entitlement registry, CMS emails, audit service.

**Do not:** second Stripe stack, client-side price calc, free upgrade without paid period, trust browser status.

---

## 5. UI/UX states

| State | UI |
|---|---|
| Cancelling, period active (`periodEnded=false`) | Keep panel: “Benefits until {date}. **No additional payment is required.**” CTA: **Keep My Membership** (no price) |
| Cancelling, period ended (`periodEnded=true`) | Keep panel: full price + saved card. CTA: **Keep My Membership — {price}** |
| Loading | Spinner “Keeping your membership...” — button disabled |
| Success (free) | Green: membership active until **original end date**; no payment |
| Success (paid) | Green: payment {amount} successful; invoice emailed |
| Error | Friendly “We couldn’t keep your membership… membership not changed” — no Stripe internals |

**UI rule:** paid idle copy is driven by **`periodEnded`** (membership `currentPeriodEnd`), **not** by a price prop. After keep, server `outcome`/`paymentRequired`/`chargeAmount` are authoritative.

Design tokens: amber keep panel / primary CTA / green success (`docs/DESIGN.md`).

---

## 6. Implementation checklist

- [x] Feature branch `feature/keep-my-membership-hardening`
- [x] This document
- [x] Shared: `requiresPaymentForKeep`, `isCancellingMembership`, `ALREADY_ACTIVE`, response fields
- [x] Service: eligibility + idempotency + free Path A (local keep if Stripe dead) + paid Path B
- [x] Route: ownership via userId; audit uses request context when present
- [x] Email: `membership-kept` free template; paid welcome/invoice on activate
- [x] Frontend: server-driven copy; free vs paid from `chargeAmount` / keep response
- [x] Admin audit: kept / reactivated labels + metadata
- [x] Tests: unit rules + integration free/paid/double-click/already-active/no membership
- [x] Docs/skills/AGENTS/README updated
- [ ] lint/typecheck/tests final run
- [ ] Approval → commit/push feature branch

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Double-click converts free → paid | Server short-circuit: already active + not cancelling → `resumed` |
| Non-cancelling member hits Keep | Eligibility guard rejects (or already-active success) |
| Stripe sub dead + period active | Free Path A still restores local membership |
| Paid path new dates | Confirmed Option A: period from payment date |
| Duplicate emails/audit | State-machine idempotency + existing activate invoice guard |
| Webhook desync | Portal sync remains; Keep is customer-triggered domain action |

---

## 9. Upgrade while local membership active but Stripe sub dead

When Keep Path A restores local Gold but Stripe subscription is already ended:

| Action | Behavior |
|---|---|
| Proration `change-tier` | 409 `membership.subscription_not_active` |
| **Repair upgrade** `POST /membership/change-tier/repair` | Full **target-tier price** (no proration); new Stripe sub; local benefits stay active until pay |
| After payment | Same membership `_id` → new tier, new period from payment date |
| UI | Tier cards + “Upgrade with a new subscription — {price}” → Stripe form |

Audit: `membership_upgrade_repair_started` / `membership_upgrade_repaired`.

---

## 8. Progress log

| Date | Update |
|---|---|
| 2026-10-05 | Plan confirmed (paid dates = A, free+dead Stripe = A, eligibility = active+cancelledAt, points = no extra grant) |
| 2026-10-05 | Implemented backend + UI + tests on feature branch |
| 2026-10-05 | **UI fix:** Keep panel free vs paid uses `periodEnded` only — never `chargeAmount > 0` alone (fixed false NZ$89 paid copy while benefits until Oct 2027) |
| 2026-10-05 | **Repair upgrade:** active membership + dead Stripe sub → full target-tier price via `POST /membership/change-tier/repair` |
