# Activation Entitlements — Free 3-Month Activation with all features

> Feature document for modeling the "FREE 3 Month Activation with all features"
> promise (shown on every tag product card) inside the membership entitlement
> registry — plus the premium-gated Health button on `/account/pets` that
> depends on it. **Status: implementation in progress — update the checklist as phases complete.**

## 1. Problem

The promise exists only at the **tag level** (HYBRID 2: `activePeriodEndsAt` → finder access).
The **entitlement registry** requires an active paid membership (`hasAccess` → `getUserTierString`
→ `UserMembership` → none → `false`), so a first-time tag buyer in their free window is treated
as a below-base user:

| Registry-gated feature | Free-activation buyer got before this feature |
|---|---|
| Pet Health Records | Locked (403); the quick Health button opened a dead modal |
| Medical alerts on the finder view | **Stripped** (`finder.ts` hides `medicalAlerts` when untitled) |
| In-app/push + email notifications via shared delivery service | Suppressed |
| Emergency contact / pet-recovery escalation | Disabled |
| Free-shipping threshold / points multiplier / accessory discount | null (no perk) |

The finder notify-owner route was **hand-patched** ("Free customers: delivered while the tag is
finder-active") — one route honoring the promise while everything else doesn't, exactly the
anti-pattern AGENTS §16a forbids.

## 2. Founder decisions (recorded)

1. **Activation = all features except money perks** — medical alerts, health records, in-app +
   email notifications, emergency contact (+person, incl. in-app), pet recovery: **yes**.
   Free-shipping threshold, points multiplier, accessory discount: **no** (base behaviour).
2. **Black exclusives stay paid-only** — `black_friday_deal` off; `tag_limit` irrelevant until a
   paid membership exists (that tier governs then).
3. **Window ends → lock + ✦ upsell**; tag falls to `limited` per HYBRID 2 (unchanged).
4. **One combined packet** with the Health-button gating fix.
5. Tier access for paid members stays whatever the Admin → Membership → Entitlements page holds —
   no tier is ever hardcoded in code or copy.

## 3. Decision tree (benefit context resolution)

```text
hasAccess / getValue / getUserEntitlements(userId)
  └─ getUserBenefitContext(userId)
       ├─ active paid membership            → its tier          (unchanged)
       ├─ owns a tag with activePeriodEndsAt > now
       │    AND status ∉ {returned, cancelled, deleted}          → 'activation'
       └─ otherwise                          → null (locked / {})

Values resolve from MembershipTierBenefit rows for that context
(`activation` rows seeded per founder decisions; admin-editable).
```

- The activation clock is the **same `activePeriodEndsAt` the finder uses** — one source of truth.
- Released tags (cancelled/returned — see `docs/TAG-RELEASE-ON-CANCEL-REFUND.md`) never grant
  activation.
- Paid membership always wins over activation.

## 4. Seeded activation values

| Benefit | Activation value | Rationale |
|---|---|---|
| `medical_alerts` | true | Pet safety — finders see alerts |
| `pet_health_records` | true | Health button works during the window |
| `in_app_notifications` | true | Replaces the hand-patched finder route |
| `email_notifications` | true | " |
| `emergency_contact` | true | Feature, not money |
| `emergency_person_email` | true | " |
| `emergency_person_in_app` | true | "as if Black" |
| `pet_recovery` | true | " |
| `free_shipping_threshold` | disabled (null) | Money perk — base behaviour |
| `points_multiplier` | disabled → 1× | Money perk — base rate |
| `accessory_discount` | disabled → 0% | Money perk |
| `black_friday_deal` | disabled | Paid-tier exclusive |
| `tag_limit` | disabled | Only matters with a paid membership |

`activation` is a **pseudo-tier context**: values live in the same
`MembershipTierBenefit` table (`tier: 'activation'`) but **no `MembershipTier` product doc is
created**, so it can never be subscribed to. The Admin entitlements page gains a
"Free 3-Month Activation" column (matrix is dynamic; null values render as `—`).

## 5. Architecture / data flow

```text
Tag.activePeriodEndsAt (HYBRID 2 clock, set at fulfilment)
        │
        ▼
membership-entitlement.service.ts
  getUserBenefitContext(userId)  ← cached with existing TTL (60s), cleared by invalidateCache
  hasAccess / getValue / getUserEntitlements  (single source of truth)
        │
        ├── customer.ts health-records middleware (403 + upgradeUrl)
        ├── finder.ts medical-alerts gate + notify-owner in-app gate (hand-patch REMOVED)
        ├── notification-delivery.service (in-app/push/email gates)
        ├── escalation.service (emergency contact / pet recovery)
        ├── commerce (shipping threshold / points / accessory — resolve null = base)
        └── GET /api/membership/entitlements → PetCard (one fetch per page, not per card)
```

Admin surface: `getBenefitsMatrix` appends the `activation` context column; the entitlements
routes accept it via `isEditableTierContext()` (MembershipTier doc **or** the activation
context — one shared definition in the service, no duplicated lists).

## 6. Premium UI rules (Health button, `/account/pets`)

- One entitlement fetch per page (`MyPets`) → prop to `PetCard` (kills the per-card N+1).
- Single gate for both surfaces (quick button + menu): entitled → modal; locked → **visible ✦
  upsell** → `/membership` via SPA navigation. `Stethoscope` icon everywhere.
- Server stays authoritative: 403 + `upgradeUrl`, message is registry-neutral
  ("Pet health records are a PawTag membership benefit — upgrade to unlock") — never hardcodes
  tiers.
- Pattern documented in `docs/DESIGN.md` (gated premium feature).

## 7. Business rules

- R1 `activation` is earned by tag purchase, never subscribed; a paid tier always overrides it.
- R2 The window is the tag's Active Period dates — never a separately stored timer.
- R3 Released tags (cancelled/returned) never grant activation.
- R4 Money perks are off during activation (founder decision 1) — no revenue movement vs today.
- R5 After the window: locked + upsell; tag goes `limited` (HYBRID 2 — unchanged).
- R6 All checks go through the registry service — no route-level "free customer" special cases.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Extra Tag query per entitlement check | Cached with the existing entitlement cache; `ownerId` index exists |
| `getUserEntitlements` returns a map for free users (was `{}`) | Consumers audited (PetCard uses `=== true`; membership/Dashboard handle `tier: null`) |
| Admin edits to activation rows break the offer | Rows are ordinary admin-editable values with audit events — same governance as tiers (founder decision: registry is the source of truth) |
| Stale cache right after window expiry | 60s TTL — acceptable (finder itself is date-driven at request time) |

## 9. Implementation checklist

- [x] P0 Entitlement service: `ACTIVATION_CONTEXT`, `getUserBenefitContext`, context-aware
      `hasAccess`/`getValue`/`getUserEntitlements`, cache
- [x] P1 Seed + additive migration for `activation` rows (`scripts/lib/activation-entitlement-defaults.ts`
      as single value source, `seed-entitlements.ts` extended, `migrate-activation-entitlements.ts`
      dry-run-first); matrix column; admin tier validation (`isEditableTierContext`);
      `upsertBenefit` creates activation rows; admin table header dynamic + null cells render `—`.
      **Follow-up fix (founder-reported 500):** all five page mutations now audit via
      `auditService.log` with the canonical payload (eventType/eventCategory/operationType/
      actorType) — the hand-rolled `AuditEvent.create` was missing required fields and failed
      every cell save after the row write; regression test `tests/integration/admin-entitlements.test.ts` (5 cases)
- [x] P2 Remove the finder notify hand-patch → plain registry check
- [x] P3 Health button: single page-level entitlement fetch, gated quick button (✦ upsell,
      `useNavigate`), `Stethoscope` icon, generic 403 copy
- [x] P4 Tests: unit (11 — context matrix, values, admin validation) + integration (11 — health
      across contexts, entitlements map, finder medical alerts + notify via registry, released-tag
      regression, precedence) + helper support (`skipMembership`, `seedActivationEntitlements`,
      health RBAC permissions)
- [x] P5 Docs: this file ✓, registry plan, AGENTS §16a (benefit contexts), DESIGN.md gated-feature
      pattern, pawtag-ui-ux skill note, README tier table + activation paragraph
- [x] P6 Verification gates: lint 0 errors, typecheck 9/9, builds api/admin/web/finder green,
      unit 1228/1229 (1 known load-flake passes isolated), affected integration 100+/100 across
      14 files, dev DB migration applied + idempotent (13 rows), diff reviewed
- [ ] Founder approval → commit/push/merge + CI verification
