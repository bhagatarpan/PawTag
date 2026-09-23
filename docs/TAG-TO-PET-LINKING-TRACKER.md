# Tag-to-Pet Linking — Implementation Tracker

**Branch:** `feature/tag-to-pet-linking`
**Created:** 2026-09-23
**Status:** In Progress

---

## Problem

After a customer activates a tag, there is NO way to link it to a pet. The UI tells them "link it to your pet" but the infrastructure doesn't exist. This breaks the core recovery loop — Finder scanning won't show pet info if `tag.petId` is never set.

## Solution

Build end-to-end tag-to-pet linking for customers.

---

## Phase Progress

| Phase | Description | Status |
|---|---|---|
| 1 | API: PUT /customer/tags/:id link-pet endpoint | ⬜ Pending |
| 2 | Shared endpoint definitions | ⬜ Pending |
| 3 | Web UI: Tag linking components | ⬜ Pending |
| 4 | Mobile UI: Tag linking screen | ⬜ Pending |
| 5 | Permission fix (tag.create for customers) | ⬜ Pending |
| 6 | Post-activation redirect improvements | ⬜ Pending |
| 7 | Monitoring verification (audit/system logs) | ⬜ Pending |
| 8 | Documentation updates | ⬜ Pending |
| 9 | Commit and push | ⬜ Pending |

---

## Customer Journey (After Fix)

```
Buy tag → Activate tag → Link tag to pet → Pet protected → Finder can scan
```

## Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `packages/api/src/routes/customer.ts` | Modify | Add PUT /customer/tags/:id endpoint |
| `packages/api/src/middleware/schemas.ts` | Modify | Add linkPet validation schema |
| `packages/shared/src/api/endpoints.ts` | Modify | Add linkPet endpoint |
| `apps/web/src/pages/account/RedeemTag.tsx` | Modify | Post-activation redirect to linking |
| `apps/web/src/components/PetCard.tsx` | Modify | Add "Link Tag" action |
| `apps/mobile/src/screens/tags/RedeemTagScreen.tsx` | Modify | Post-activation redirect |
| `apps/mobile/src/screens/pets/PetDetailScreen.tsx` | Modify | Add "Link Tag" option |
| `docs/TAG-TO-PET-LINKING-TRACKER.md` | Create | Progress tracking |
