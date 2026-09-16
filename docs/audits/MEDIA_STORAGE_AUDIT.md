# Media Storage Architecture Audit

**Date:** 2026-09-17
**Auditor:** Lead Software Engineer
**Status:** Complete

---

## Executive Summary

PawTag currently has **two incompatible file storage systems** with no unified abstraction:

| Storage System | Used By | When |
|---------------|---------|------|
| **Cloudflare R2** | Pet photos, profile pictures, product images | When `R2_*` env vars are set |
| **Local disk** | CMS media (always), profile pictures (R2 fallback) | Always for CMS; when R2 unavailable for avatars |

**Customer-facing bug:** Pet photo upload requires R2. When `R2_*` env vars are not configured, `isR2Configured()` returns `false` and the upload route returns HTTP 500 with the message "File storage is not configured. Please set R2 environment variables."

---

## Upload Endpoints

### 1. POST /api/upload/pet-photo

**File:** `packages/api/src/routes/upload.ts:112-170`
**Auth:** JWT (authenticate middleware)
**Storage:** R2 only
**R2 Required:** Yes — returns 500 if R2 not configured
**Local Fallback:** No
**Max Size:** 5MB
**Allowed Types:** image/jpeg, image/jpg, image/png, image/gif, image/webp, image/avif
**R2 Key Prefix:** `pets/`
**Filename:** `generateUniqueFilename()` (timestamp + random)
**Response:** `{ url: string, filename: string }`
**Audit:** Logged as `upload_pet_photo` (FILE/MEDIUM, fire-and-forget)

### 2. POST /api/upload/profile-picture

**File:** `packages/api/src/routes/upload.ts:216-290`
**Auth:** JWT (authenticate middleware)
**Storage:** R2 or local disk (conditional)
**R2 Required:** No
**Local Fallback:** Yes — saves to `packages/api/uploads/avatars/`
**Max Size:** 5MB
**Allowed Types:** image/jpeg, image/jpg, image/png, image/gif, image/webp, image/avif
**R2 Key Prefix:** `avatars/`
**Local Path:** `/api/uploads/avatars/{filename}`
**Response:** `{ url: string, user: User }`
**DB Update:** Updates `User.profilePicture`
**Audit:** Logged as `upload_profile_picture` (FILE/MEDIUM, fire-and-forget)

### 3. POST /api/upload/product-images

**File:** `packages/api/src/routes/upload.ts:325-390`
**Auth:** JWT + `product.update` permission
**Storage:** R2 only
**R2 Required:** Yes — returns 500 if R2 not configured
**Local Fallback:** No
**Max Size:** 5MB per file, up to 5 files
**Allowed Types:** image/jpeg, image/jpg, image/png, image/gif, image/webp, image/avif
**R2 Key Prefix:** `products/`
**Response:** `{ images: Array<{ url: string, filename: string }> }`
**Audit:** Logged as `upload_product_image` (FILE/MEDIUM, fire-and-forget)

### 4. DELETE /api/upload/product-images/:filename

**File:** `packages/api/src/routes/upload.ts:416-447`
**Auth:** JWT + `product.update` permission
**Storage:** R2 only
**R2 Required:** Yes — returns 500 if R2 not configured
**Deletion:** Calls `deleteFromR2('products/{filename}')`
**Audit:** Logged as `upload_product_image_delete` (FILE/MEDIUM, fire-and-forget)

### 5. POST /api/admin/cms/media/upload

**File:** `packages/api/src/routes/cms-admin.ts:744-793`
**Auth:** JWT + `cms.media.upload` permission
**Storage:** Local disk (always)
**R2 Required:** No — never uses R2
**Local Fallback:** N/A — always local
**Max Size:** 10MB per file, up to 10 files
**Allowed Types:** image/jpeg, image/jpg, image/png, image/gif, image/webp, image/avif, video/mp4, video/webm, application/pdf
**Local Path:** `packages/api/uploads/cms/{filename}`
**URL Pattern:** `${req.protocol}://${req.get('host')}/api/uploads/cms/${filename}`
**Duplicate Detection:** MD5 hash — if same hash exists, reuses existing `CmsMedia` record
**Response:** `{ files: Array<{ id, url, filename, ... }> }`
**Audit:** No audit logging for this endpoint

---

## Storage Provider Architecture

### Current R2 Service

**File:** `packages/api/src/services/r2.service.ts` (91 lines)

| Function | Lines | Purpose |
|----------|-------|---------|
| `uploadToR2(key, buffer, contentType)` | 26-43 | Upload buffer to R2 via S3 PutObjectCommand |
| `deleteFromR2(key)` | 49-58 | Delete object from R2 via DeleteObjectCommand |
| `getPresignedUrl(key, expiresIn)` | 66-72 | Generate presigned download URL (UNUSED) |
| `generateUniqueFilename(originalFilename)` | 79-83 | Generate unique filename: `{timestamp}-{random9}.{ext}` |
| `isR2Configured()` | 89-91 | Check if all 4 R2 env vars are set |

**Dependencies:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

**Issue:** `getPresignedUrl()` is exported but **never called** anywhere in the codebase. All R2 files are served via public URL.

### Local Storage (Ad-hoc)

- **Profile pictures:** `packages/api/uploads/avatars/` — served via `express.static`
- **CMS media:** `packages/api/uploads/cms/` — served via `express.static`
- **Static serving:** `app.use('/api/uploads', express.static(...))` — unauthenticated

---

## Database Models with Image References

### Pet Model

**File:** `packages/db/src/models/Pet.ts`

| Field | Type | Max | Validation |
|-------|------|-----|------------|
| `photos[].url` | `String` (required) | 5 photos | `z.string().min(1)` (no URL validation) |
| `photoUrl` | `String` (optional) | 1 | `z.string().url()` |

### User Model

**File:** `packages/db/src/models/User.ts`

| Field | Type | Max | Validation |
|-------|------|-----|------------|
| `profilePicture` | `String` (optional) | 1 | `z.string().url()` |

### Product Model

**File:** `packages/db/src/models/Product.ts`

| Field | Type | Max | Validation |
|-------|------|-----|------------|
| `images` | `[String]` | Unbounded | `z.array(z.string())` (no URL validation) |
| `variants[].image` | `String` (optional) | 1 | `z.string()` (no URL validation) |

### CmsMedia Model

**File:** `packages/db/src/models/CmsMedia.ts`

| Field | Type | Validation |
|-------|------|------------|
| `url` | `String` (required) | None |
| `filename` | `String` (required, indexed) | None |
| `originalName` | `String` (required) | None |
| `mimeType` | `String` (required, indexed) | None |
| `size` | `Number` (required) | None |
| `width` | `Number` (optional) | Never populated |
| `height` | `Number` (optional) | Never populated |
| `hash` | `String` (required, indexed) | MD5 |
| `thumbnails` | `Mixed` (optional) | Never populated |

---

## Frontend Upload Components

### Web App

| Component | File | Upload Endpoint | Preview | Progress | Error Handling |
|-----------|------|----------------|---------|----------|----------------|
| PhotoManager | `apps/web/src/pages/account/MyPets.tsx:45-123` | pet-photo | No | No | `setError()` |
| AvatarUpload | `apps/web/src/components/AvatarUpload.tsx` | profile-picture | Yes (modal) | No | `alert()` |

### Admin App

| Component | File | Upload Endpoint | Preview | Progress | Error Handling |
|-----------|------|----------------|---------|----------|----------------|
| PhotoManager | `apps/admin/src/pages/Pets.tsx:141-236` | pet-photo | No | No | `setError()` |
| Product Images | `apps/admin/src/pages/Products.tsx:674-703` | product-images | No | No | `toast.error()` |
| CmsMedia | `apps/admin/src/pages/cms/CmsMedia.tsx` | cms/media/upload | No | No | `alert()` |
| ImagePicker | `apps/admin/src/components/ImagePicker.tsx` | cms/media/upload | No | No | `alert()` |

### Code Duplication

`PhotoManager` is **copy-pasted** between:
- `apps/web/src/pages/account/MyPets.tsx` (lines 45-123)
- `apps/admin/src/pages/Pets.tsx` (lines 141-236)

Both have identical upload logic, validation, error handling, and UI structure. Only styling classes differ.

### API Endpoint Constants

**File:** `packages/shared/src/api/endpoints.ts:680-685`

```typescript
upload: {
  profilePicture: '/upload/profile-picture',
  petPhoto: '/upload/pet-photo',
  productImages: '/upload/product-images',
  deleteProductImage: (filename: string) => `/upload/product-images/${filename}`,
}
```

CMS media endpoints (lines 345-349):
```typescript
media: {
  list: '/admin/cms/media',
  upload: '/admin/cms/media/upload',
  update: (id) => `/admin/cms/media/${id}`,
  delete: (id) => `/admin/cms/media/${id}`,
}
```

---

## Inconsistencies

| # | Issue | Severity |
|---|-------|----------|
| 1 | Pet photos and product images REQUIRE R2 (500 error); profile pictures have local fallback | High |
| 2 | CMS media ALWAYS uses local disk — completely separate storage system | High |
| 3 | CMS media uses original filenames (collision risk); upload.ts generates unique names | Medium |
| 4 | Different file size limits: 5MB (upload.ts) vs 10MB (CMS) | Low |
| 5 | Different allowed types: images only vs images+video+PDF | Low |
| 6 | CMS media delete is soft-delete only — files remain on disk forever | High |
| 7 | No delete routes for pet photos or profile pictures | Medium |
| 8 | No orphan file cleanup for any storage system | High |
| 9 | Product deletion doesn't clean up R2 images | Medium |
| 10 | `getPresignedUrl()` exported but never used | Low |
| 11 | CmsMedia `width`/`height`/`thumbnails` fields never populated | Low |
| 12 | No upload-specific rate limiting | Low |
| 13 | No image processing/compression | Low |
| 14 | `AvatarUpload.tsx` uses hardcoded path instead of API constant | Medium |

---

## Security Observations

| Area | Status | Notes |
|------|--------|-------|
| Authentication on uploads | ✅ All endpoints require JWT | |
| Authorization on uploads | ✅ Product/CMS require RBAC | Pet photos require only auth (owner check missing) |
| Static file serving | ⚠️ Unauthenticated | `/api/uploads` serves all files without auth |
| R2 public access | ⚠️ All files public | No ACL or signed URL restrictions |
| Filename sanitization | ✅ Unique filenames generated | Except CMS which uses original names |
| File type validation | ✅ Server-side MIME check | But relies on client-provided Content-Type |
| File size limits | ✅ Enforced via multer | 5MB for upload.ts, 10MB for CMS |
| Path traversal | ✅ express.static protection | But static serving is unauthenticated |

---

## Environment Variables

### Required for R2

| Variable | Description | Default |
|----------|-------------|---------|
| `R2_ACCESS_KEY_ID` | R2 API access key ID | (empty) |
| `R2_SECRET_ACCESS_KEY` | R2 API secret access key | (empty) |
| `R2_BUCKET_NAME` | R2 bucket name | (empty) |
| `R2_ENDPOINT` | R2 S3-compatible endpoint URL | (empty) |
| `R2_PUBLIC_URL` | Public CDN URL for serving files | (empty) |

### Current Status

- `.env` file: **No R2 variables configured**
- `.env.example`: All 5 variables documented with comments

---

## Documentation Gaps

| Document | Coverage | Gap |
|----------|----------|-----|
| `.env.example` | ✅ Complete | — |
| `docs/environments.md` | ✅ Complete | — |
| `docs/ARCHITECTURE.md` | ⚠️ Partial | Missing upload flow details |
| `docs/DESIGN.md` | ❌ None | No upload UX specs |
| `AGENTS.md` | ❌ None | No storage architecture notes |
| `README.md` | ⚠️ Partial | Missing setup guide |
| `docs/launch-checklist.md` | ❌ Inaccurate | Claims "no local disk writes" but CMS always writes locally |
| R2 setup guide | ❌ Missing | No step-by-step instructions |
| Storage architecture doc | ❌ Missing | No dedicated document |

---

## Test Coverage

| Test File | What It Tests | Status |
|-----------|--------------|--------|
| `tests/integration/upload-r2.test.ts` | Pet photo upload, product images, R2 not configured, file type rejection | Exists |
| `tests/unit/upload-filename.test.ts` | Filename uniqueness generation | Exists |

### Missing Test Coverage

- Profile picture local fallback behavior
- CMS media upload to local disk
- CMS duplicate detection (MD5 hash)
- Product image deletion from R2
- Static file serving of uploaded files
- `getPresignedUrl()` (unused anyway)
- Authorization tests (cross-customer access)

---

## Target Architecture

```
                     PAWTAG APPS
                    (web, admin, mobile)
                          |
                          v
                    PAWTAG API
                          |
                          v
                  ┌───────────────┐
                  │ MEDIA SERVICE │
                  │  upload()     │
                  │  delete()     │
                  │  getUrl()     │
                  │  isConfigured │
                  └───────┬───────┘
                          |
                  ┌───────┴───────┐
                  │ STORAGE DRIVER │
                  │ local | r2     │
                  └───────┬───────┘
                          |
              ┌───────────┴───────────┐
              |                       |
              v                       v
     ┌─────────────────┐    ┌─────────────────┐
     │ LOCAL STORAGE   │    │ CLOUDFLARE R2   │
     │ uploads/        │    │ pets/           │
     │   pets/         │    │ avatars/        │
     │   avatars/      │    │ products/       │
     │   products/     │    │ cms/            │
     │   cms/          │    └─────────────────┘
     └─────────────────┘
```

---

## Recommendations

1. **Create unified MediaService** — single abstraction for all file operations
2. **Implement StorageProvider interface** — LocalStorageProvider + R2StorageProvider
3. **Add STORAGE_DRIVER env var** — explicit control over storage backend
4. **Add local fallback to all routes** — pet photos and product images should work without R2
5. **Migrate CMS media to unified storage** — use same service as other uploads
6. **Add delete routes for pet photos and profile pictures** — prevent orphaned objects
7. **Add orphan cleanup job** — periodic cleanup of unreferenced files
8. **Use unique filenames for CMS uploads** — prevent collision and overwrite
9. **Extract shared PhotoManager component** — eliminate duplication between web/admin
10. **Add upload-specific rate limiting** — prevent abuse
