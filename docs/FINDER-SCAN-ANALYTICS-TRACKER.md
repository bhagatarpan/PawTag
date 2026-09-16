# Finder Scan Analytics - Implementation Tracker

**Feature:** Finder Scan Analytics Dashboard + Scan History Tabs
**Branch:** `feature/finder-scan-analytics`
**Created:** 2026-09-16
**Status:** In Progress

---

## Overview

Enhance the finder portal scan tracking to capture:
- Parsed device info (browser, OS, device type) from User-Agent
- IP-based geolocation (city, region, country)
- Separate GPS location (when finder explicitly shares)

Add admin analytics dashboard and scan history tabs to Tag/Pet detail pages.

---

## Implementation Phases

### Phase 1: Enhanced FinderScan Model
**Status:** ✅ Completed
**Files:** `packages/db/src/models/FinderScan.ts`
**Changes:**
- Add `deviceBrowser`, `deviceOS`, `deviceType` fields
- Add `ipLocation` field (city, region, country, latitude, longitude)
- Rename `location` to `gpsLocation` for clarity
- Add new indexes for efficient querying

### Phase 2: Install geoip-lite
**Status:** ✅ Completed
**Files:** `packages/api/package.json`
**Changes:**
- Add `geoip-lite` dependency
- Add `@types/geoip-lite` dev dependency

### Phase 3: Update geo-location Utility
**Status:** ✅ Completed
**Files:** `packages/api/src/lib/geo-location.ts`
**Changes:**
- Add `getIpGeoData()` function
- Primary: `geoip-lite` (local database)
- Fallback: `ip-api.com` (current implementation)

### Phase 4: Update Finder Routes (View Tag)
**Status:** ✅ Completed
**Files:** `packages/api/src/routes/finder.ts`
**Changes:**
- Parse User-Agent using existing `parseUserAgent()`
- Call `getIpGeoData()` for IP geolocation
- Store parsed device info and IP location in FinderScan
- Update audit events with device info

### Phase 5: Update Finder Routes (Notify)
**Status:** ✅ Completed
**Files:** `packages/api/src/routes/finder.ts`
**Changes:**
- Move GPS location to `gpsLocation` field
- Update audit events with device info

### Phase 6: Add Admin API Endpoints
**Status:** ✅ Completed
**Files:** `packages/api/src/routes/admin.ts`
**Changes:**
- Enhance `GET /admin/finder-scans` with filters
- Add `GET /admin/finder-scans/analytics`
- Add `GET /admin/tags/:id/scans`
- Add `GET /admin/pets/:id/scans`

### Phase 7: Add Endpoint Constants
**Status:** ✅ Completed
**Files:** `packages/shared/src/api/endpoints.ts`
**Changes:**
- Add `finderScans` endpoints to admin section

### Phase 8: Create Scan Analytics Dashboard
**Status:** ✅ Completed
**Files:** `apps/admin/src/pages/ScanAnalytics.tsx` (new)
**Changes:**
- Summary cards (total scans, period scans, unique tags/pets)
- Device type breakdown (horizontal bar chart)
- Browser breakdown (horizontal bar chart)
- Operating system breakdown (horizontal bar chart)
- Action breakdown (horizontal bar chart)
- Top scanned tags (clickable)
- Top scanned pets (clickable)
- Scans by day chart
- Recent scans feed
- Date range picker (default: This Month)

### Phase 9: Add Tag Scan History Tab
**Status:** ✅ Completed
**Files:** `apps/admin/src/pages/Tags.tsx`
**Changes:**
- Add 'scans' tab to DetailDrawer
- Fetch scans by tagId
- Display scan history with device info, browser, OS, location
- Date range picker (default: Last 30 days)
- Filter by action, device type
- Click row → Open Pet detail drawer

### Phase 10: Add Pet Scan History Tab
**Status:** ✅ Completed
**Files:** `apps/admin/src/pages/Pets.tsx`
**Changes:**
- Add 'scans' tab to DetailDrawer
- Fetch scans by petId
- Display scan history with device info, browser, OS, location
- Date range picker (default: Last 30 days)
- Filter by action, device type
- Click row → Open Tag detail drawer

### Phase 11: Update Sidebar Navigation
**Status:** ✅ Completed
**Files:** `apps/admin/src/components/Sidebar.tsx`, `apps/admin/src/App.tsx`
**Changes:**
- Add "Scan Analytics" under Overview section
- Icon: `Scan` from Lucide
- Add route for Scan Analytics page

### Phase 12: Update Privacy Policy
**Status:** ✅ Completed
**Files:** `packages/api/src/seeds/seed-cms.ts`
**Changes:**
- Add IP geolocation disclosure
- Document browser/device collection
- Explain purpose (security, analytics)

### Phase 13: Update AGENTS.md
**Status:** ✅ Completed
**Files:** `AGENTS.md`
**Changes:**
- Add "Finder Scan Analytics" section
- Document dashboard features
- Document data captured
- Document admin routes
- Document RBAC permission

### Phase 14: Update README.md
**Status:** ✅ Completed
**Files:** `README.md`
**Changes:**
- Add "Admin Analytics" to Key Features
- Document scan analytics dashboard

### Phase 15: Update docs/DESIGN.md
**Status:** ✅ Completed
**Files:** `docs/DESIGN.md`
**Changes:**
- Add "Scan Analytics Dashboard" section
- Document design tokens for stat cards, bar charts, date range picker

---

## Design Tokens Used (from docs/DESIGN.md)

| Element | Token/Class |
|---------|-------------|
| Page background | `bg-gray-50` |
| Card | `bg-white rounded-2xl shadow-sm border border-gray-100 p-6` |
| Card header | `h3` (text-lg font-semibold text-gray-900) |
| Stat value | `text-3xl font-bold text-gray-900` |
| Stat label | `text-sm text-gray-500` |
| Bar chart bar | `bg-primary-500` |
| Bar chart background | `bg-gray-100` |
| Clickable card hover | `hover:border-primary-200 hover:shadow-md transition-all duration-300` |
| Primary button | `bg-primary-600 text-white rounded-xl font-semibold px-6 py-3 hover:bg-primary-700` |
| Date range picker | `border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500` |
| Tab active | `border-b-2 border-primary-600 text-primary-700` |
| Tab inactive | `border-b-2 border-transparent text-gray-500 hover:text-gray-700` |

---

## Reusable Components (DRY Compliance)

| Component | Source | Reuse |
|-----------|--------|-------|
| `parseUserAgent()` | `packages/api/src/lib/user-agent.ts` | Already exists |
| `getIpGeoData()` | `packages/api/src/lib/geo-location.ts` | Enhance existing |
| `DetailDrawer` | `packages/ui/src/components/DetailDrawer.tsx` | Existing component |
| `DataTable` | `packages/ui/src/components/DataTable.tsx` | Existing component |
| `Pagination` | `packages/ui/src/components/Pagination.tsx` | Existing component |
| `SearchBar` | `packages/ui/src/components/SearchBar.tsx` | Existing component |
| `StatusBadge` | `packages/ui/src/components/StatusBadge.tsx` | Existing component |

---

## RBAC Permission

- `finder_scan.read` — View finder scan events (ADMIN, CUSTOMER_SERVICE)

---

## Notes

- IP geolocation is PII under GDPR/NZ Privacy Act
- Privacy policy must be updated to disclose collection
- Data processed locally via MaxMind GeoLite2 database (no third-party sharing)
- GPS location only captured when finder explicitly consents

---

## Final Commit

**Status:** ✅ Completed
**Commit:** cac8d30
**Branch:** feature/finder-scan-analytics
**Changes:** 17 files changed, 1636 insertions(+), 24 deletions(-)
**Created files:**
- `apps/admin/src/pages/ScanAnalytics.tsx`
- `docs/FINDER-SCAN-ANALYTICS-TRACKER.md`

**Documentation Updated:**
- AGENTS.md
- README.md
- docs/DESIGN.md
