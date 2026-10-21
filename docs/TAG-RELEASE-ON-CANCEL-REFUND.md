# Tag Release on Order Cancellation / Refund

> Feature document for the tag-lifecycle gap audit completed 2026-10-21 and its remediation.
> Implements the founder decisions recorded in the audit review. **Status: implementation in progress — update the checklist as phases complete.**

## 1. Problem

A PawTag tag ID is generated when the warehouse assigns it (or at fulfilment creation in
auto-create mode), *before* shipping. Until now, **no cancellation or refund path touched
generated tags**:

| Path | Behaviour before this feature |
|---|---|
| `cancelOrder` (statuses `pending`/`pending_payment`/`paid`/`packing`) | Tags untouched — stayed `inactive`, owned by the refunded customer; Fulfilment doc never cancelled; subscriptions never cancelled |
| Direct admin refund `POST /api/admin/orders/:id/refund` | No tag handling — an already-**activated** tag kept `finderEnabled: true` after a full refund |
| Returns refund with `refundWithoutReturn` (goods kept) | Detach deliberately skipped — tag kept working |
| Returns refund with goods received | Correct (detach → `returned`) |

## 2. Founder decisions (2026-10-21)

1. **Fix all gaps** — cancellation, refunds, assign-tag guard, subscription auto-cancel, dead code.
2. **Freeze the tag when its money went back and the customer kept the goods**
   (refund-without-return / direct full refund) — "you don't pay, you don't get the recovery service".
3. **Never freeze a tag the customer paid for.** Two-tag invariant: order with tag A refunded/returned
   and tag B paid-and-kept → tag A released, **tag B keeps working**.
4. **Delete the dead `order-creation.service`** (creates unredeemable tags + subscriptions; zero callers).

## 3. Decision tree (per tag)

```text
Order cancelled (pre-ship only: pending/pending_payment/paid/packing)
  └─ every non-returned tag → RELEASED  (goods never left PawTag, no partial case)
     + Fulfilment → cancelled + tag Subscriptions cancelled

Order refunded / return processed
  ├─ tag's goods physically received (Return.items[].tagIds / detach ran)
  │     └─ tag → 'returned' (existing detach — unchanged)
  ├─ tag NOT returned, money for that tag went back
  │     (Return with refundWithoutReturn, OR whole capture fully refunded)
  │     └─ tag → RELEASED ('cancelled')
  ├─ tag NOT returned, money NOT fully refunded for it (partial refund, paid & kept)
  │     └─ tag UNTOUCHED — keeps working  ← founder invariant
  └─ attribution ambiguous (partial line refund without tagIds)
        └─ no freeze + warn log (customer-safety first; freeze needs exact attribution)
```

"Released" = new tag status **`cancelled`**: finder disabled, hidden from customer lists,
unredeemable, never resurrected by background jobs. `ownerId`/`petId` are **kept** (audit trail),
unlike `returned` which clears ownership. No customer-facing unfreeze exists; a CSR restore would
be a future feature.

## 4. Architecture / data flow

```text
cancellation.service (step 5b)          return-refund.service (success block)      admin refund route
        │                                          │                                      │
        ▼                                          ▼                                      ▼
        └──────────────────► tag-release.service.ts ◄──────────────────────────────────────┘
                              ├─ releaseTagsForOrder(orderId, reason)        [cancel: all tags]
                              ├─ releaseTagsByIds(tagIds, reason)           [return: exact tags]
                              ├─ cancelFulfilmentForOrder(orderId)          [cancel only]
                              └─ cancelSubscriptionsForTags(...)            [reuses subscription.service.cancelSubscription]

Single sources of truth reused (never re-derived):
• attribution  → Return.items[].tagIds + Fulfilment.tagAssignments[].orderItemId (durable signals)
• status rules → tag-status.service.calculateTagStatus (one 'cancelled' branch = finder + access + UI)
• subscription cancel → subscription.service.cancelSubscription (idempotent, Stripe-aware)
```

Status read surfaces updated in one pass: `calculateTagStatus`, `checkTagAccess`, finder
`nonFindableRawStatuses`, customer/membership tag queries (`$nin: ['returned','cancelled']`),
admin `Tags.tsx` badge.

## 5. Business rules

- R1 Freeze scope is **per tag** — never blanket-freeze on partial refunds (Decision 3).
- R2 Cancel path freezes all order tags — safe because cancellation is impossible after `shipped`.
- R3 Release is idempotent: already `returned`/`cancelled` tags are skipped; re-running is a no-op.
- R4 Ambiguous attribution → no freeze + warning log (a wrongly-frozen pet-recovery tag is the
  worse failure mode).
- R5 Fulfilment mutations (`assign-tag`) reject `cancelled`/`refunded` orders with 409.
- R6 Tag Subscriptions are cancelled whenever their tag is released or returned (Stripe too).
- R7 Background jobs must never resurrect a released tag: `calculateTagStatus('cancelled')`
  returns `'cancelled'`, and membership/active-period queries exclude it.
- R8 Unpaid auto-cancel job (`orderAutoCancel`) needs no release step — it only cancels
  `pending_payment` orders, which never have tags.

## 6. UI/UX states

- **Customer**: released tags disappear from tag lists / Manage-Your-Tags (server-side filter);
  redeeming one → clear 409 "released after order cancellation/refund" (not "already activated").
- **Finder**: released tag scan → existing generic "This PawTag is no longer active." response;
  audit reason `cancelled`.
- **Admin**: Tags page badge `cancelled` (gray/red, XCircle); Fulfilment rows can show
  `cancelled`; no other surfaces change.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Freezing a paying customer's tag by mistake (R1) | Attribution only via Return tagIds / full-capture refund; ambiguous → warn, no freeze; regression test for the 2-tag case |
| Jobs overwriting `cancelled` (R7) | `calculateTagStatus` returns `cancelled`; queries `$nin` — regression test |
| Dead-code deletion breaks a hidden caller | Grep-verified zero imports repo-wide (only self-doc); docs references updated |
| Legacy direct refund route partial-refund ambiguity (R4) | Freeze only on full refund there; partial attribution stays in the returns flow (which owns tagIds) |

## 8. Implementation checklist

- [x] P1 Data model: `TagStatus.CANCELLED` (shared enum), Tag schema/interface, `FulfilmentStatus` + schema
- [x] P2 Status engine: `calculateTagStatus` branch, `checkTagAccess` branch, finder guard + audit reason, query excludes (customer list, unredeemed count, membership manage, membership-expiry loop), admin badge
- [x] P3 `tag-release.service.ts`: release (all/by-ids), fulfilment cancel, subscription cancel — idempotent
- [x] P4 Wire `cancellation.service` (step 5b)
- [x] P5 Wire `return-refund.service` (refundWithoutReturn freeze; full-refund leftovers; subscription cancel after detach)
- [x] P6 Wire direct admin refund (full-refund freeze + partial warn)
- [x] P7 `assign-tag` + fulfilment status guards (409 on cancelled/refunded orders)
- [x] P8 Delete dead `order-creation.service.ts`; update `docs/BUSINESS-RULES.md` references
- [x] P9 Tests: unit (`tests/unit/tag-release.test.ts` — 11 cases; `return-refund-service.test.ts` — 3 new incl. the 2-tag invariant) + integration (`tests/integration/tag-release.test.ts` — 4 cases: cancel cascade, list/redeem/finder UX, both route guards)
- [x] P10 Docs: this checklist, `AGENTS.md` §17 (status + release rules), `skills/membership-lifecycle` + `skills/returns-refunds`, admin Fulfilment/Tags pages show `cancelled`
- [ ] P11 Verification gates: lint / typecheck / build / unit suite / integration suite / CI green on the feature branch
