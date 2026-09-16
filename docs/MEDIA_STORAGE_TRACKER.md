# Unified Media Storage — Implementation Tracker

**Feature Branch:** `feature/unified-media-storage`
**Created:** 2026-09-17
**Status:** In Progress

---

## Progress

| Phase | Description | Status | Commit | Date |
|-------|-------------|--------|--------|------|
| 0 | Create MEDIA_STORAGE_AUDIT.md | ⏳ Pending | — | — |
| 1 | Unified storage provider abstraction | ⏳ Pending | — | — |
| 2 | Local development storage provider | ⏳ Pending | — | — |
| 3 | Cloudflare R2 provider (refactor) | ⏳ Pending | — | — |
| 4 | Unify all upload routes | ⏳ Pending | — | — |
| 5 | Fix pet photo upload (customer fix) | ⏳ Pending | — | — |
| 6 | Update environment documentation | ⏳ Pending | — | — |
| 7 | Public/private media distinction | ⏳ Pending | — | — |
| 8 | Frontend upload UX improvements | ⏳ Pending | — | — |
| 9 | Presigned upload foundation | ⏳ Pending | — | — |
| 10 | Security/regression testing | ⏳ Pending | — | — |
| 11 | Final documentation | ⏳ Pending | — | — |

---

## Audit Summary (Phase 0)

### Upload Endpoints Found (5)
- `POST /api/upload/pet-photo` — R2 only, fails without R2
- `POST /api/upload/profile-picture` — R2 with local fallback
- `POST /api/upload/product-images` — R2 only, fails without R2
- `DELETE /api/upload/product-images/:filename` — R2 only
- `POST /api/admin/cms/media/upload` — Always local disk

### Storage Systems Found (2)
1. **Cloudflare R2** — via `r2.service.ts` (pet photos, profile pics, products)
2. **Local disk** — via `multer.diskStorage` (CMS media always, profile pics as fallback)

### Critical Issues
- Pet photo upload returns 500 when R2 not configured (THE CUSTOMER-FACING BUG)
- No unified storage abstraction
- CMS media uses completely separate storage system
- No orphan file cleanup
- No delete routes for pet photos or profile pictures

---

## Files Changed

Track all files modified during this feature:

| File | Phase | Change Description |
|------|-------|-------------------|
| `docs/audits/MEDIA_STORAGE_AUDIT.md` | 0 | Created |
| `docs/MEDIA_STORAGE_TRACKER.md` | 0 | Created |
