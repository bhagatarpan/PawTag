# Baseline Recovery Evidence

**Executed:** 2026-10-06  
**Context:** Phase 00 evidence reset recorded a red baseline. Track A0 recovered quality gates on the current `main` working tree using founder product rules.  
**Rule:** counts below come from commands actually run in this environment.

---

## 1. Repository state at recovery

| Item | Value |
|---|---|
| Branch | `main` |
| Starting HEAD | `85925e1` (pack docs + Phase 00 evidence) |
| Upstream | `origin/main` (https://github.com/bhagatarpan/PawTag.git) |
| Working tree before recovery | Dirty — 153 modified files (uncommitted prior recovery + lint/type/test fixture work) |
| Node / pnpm | `v24.19.0` / `11.14.0` |

---

## 2. Product rules applied (founder decisions)

1. **Finder can only find active tags.** Public finder responses expose pet data only when HYBRID 2 calculated status is `active` and finder is enabled. Limited, expired, replaced, returned, inactive, deleted → `tagActive: false`, `petInfo: null`, message “This PawTag is no longer active.”
2. **Tag replacement:** customer activates the new tag again; old tag status becomes `replaced`; new tag start date (`activatedAt`) inherits from the old tag; remaining active/warranty period transfers when still valid; fresh period when the original already expired.
3. **Finder email for any customer:** when a finder notifies on an active tag, email the owner regardless of membership. Free customers get this for the 3-month Active Period; after that membership is required to keep the tag finder-active. In-app/push is delivered for free customers while the tag is active; paid tiers may still disable in-app via the entitlement registry.
4. **Commit and push** the recovered baseline.

---

## 3. Quality gates — final results (post-recovery)

| Command | Result | Counts |
|---|---|---|
| `pnpm typecheck` | **PASS** | all workspace packages |
| `pnpm lint` | **PASS** | 0 errors; warnings only |
| `pnpm test:unit` | **PASS** | 82 files / 923 tests |
| `pnpm test:integration` | **PASS** | 62 files / 767 passed / 2 skipped |
| `pnpm test:regression` | **PASS** | 2 files / 33 tests |
| `pnpm test:smoke` | **PASS** | 1 file / 6 tests |
| `pnpm build` | **PASS** | api, admin, web, finder exit 0 |

### Pre-recovery (Phase 00 snapshot, for contrast)

| Gate | Phase 00 | After Track A0 |
|---|---|---|
| typecheck | FAIL | PASS |
| lint | FAIL | PASS |
| unit | FAIL (2) | PASS |
| integration | FAIL (47 / 11 suites) | PASS (0 failed) |
| regression | PASS | PASS |
| smoke | FAIL | PASS |
| build | FAIL | PASS |

---

## 4. Remaining 6 integration failures — triage outcome

| Suite | Failure | Resolution |
|---|---|---|
| `finder.test.ts` notify creates notification | 0 owner notifications | **Fixture:** seed membership entitlements (production respects registry; tests must configure entitled owners). Not a weakened control. |
| `subscriptions.test.ts` ×3 | Finder DTO missing `subscriptionStatus` / grace/expired still “found” | **Product rule:** only active tags findable; public DTO does not expose internal `subscriptionStatus`. Tests updated to real public contract + HYBRID 2 dates. |
| `finder-full.test.ts` expired subscription | `tagActive` undefined | Same as above — limited/expired not findable. |
| `tag-replacement.test.ts` | Expected old tag `inactive` | **Product rule:** old tag → `replaced`. Test updated; start-date inheritance asserted. |

No authentication, authorization, payment, or privacy control was weakened.

---

## 5. Product code changes in Track A0

| File | Change |
|---|---|
| `packages/api/src/routes/finder.ts` | Only active tags return pet info; all non-active states return not-found style public response |
| `packages/api/src/routes/customer.ts` | Replacement redeem inherits start date + remaining periods; old tag → `replaced` |
| `packages/api/src/routes/finder.ts` | Active-only finder + email any customer on active-tag notify; free in-app during Active Period |
| `tests/integration/helpers.ts` | `createTag` sets HYBRID 2 period dates; entitlement seeding available |
| `tests/integration/finder.test.ts` | Notify tests seed entitlements; fixtures use real active-period dates |
| `tests/integration/finder-full.test.ts` | Align with only-active finder rule |
| `tests/integration/subscriptions.test.ts` | Finder subscription checks aligned to only-active + public DTO |
| `tests/integration/tag-replacement.test.ts` | Assert `replaced` + start-date inheritance |

Plus the pre-existing uncommitted working-tree recovery (type fixes, lint config, smoke mock, unit-test alignment) that was already present when Track A0 started and is included in the same push.

---

## 6. What this recovery did not do

- Did not start Phase 01
- Did not weaken auth/authz/payment/privacy controls
- Did not reseed/reset any database
- Did not run Stripe/Resend/Firebase/AWS/Apple real integrations
- Did not claim production readiness beyond automated quality gates

---

## 7. Remaining risks (explicit)

1. **Finder email for free customers — implemented.** Any customer with an active tag gets finder email (Active Period = 3 months; membership required after). Regression test: free non-member owner receives `sendPetFoundEmail` on active-tag notify.
2. Paid members may disable `in_app_notifications` via entitlement registry; email remains the guaranteed recovery channel for active tags.
3. Provider modes (Stripe/Resend/push/shipping/CAPTCHA) remain `CODED_NOT_RUNTIME_VALIDATED`.
4. No browser E2E, no CI workflows, no mobile physical-device evidence.

---

## 8. Rollback

Baseline recovery is committed to `main`. To roll back the recovery commit only:

```text
git revert <baseline-recovery-sha>
```

Do not `reset --hard` or force-push without explicit founder authorization.
