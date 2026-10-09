# NZ Post Real Shipping Integration

**Status:** In progress  
**Branch:** `feature/nzpost-real-shipping`  
**Date:** 2026-10-09

## Problem

PawTag's NZ Post shipping provider (`packages/api/src/commerce/providers/nz-shipping/index.ts`) fabricated realistic-looking fake tracking numbers with no production gate:

1. **Invented endpoints** — called `POST /shipments` and `GET /trackings/{id}/events` on `api.sandbox.nzpost.co.nz`. NZ Post has no such endpoints.
2. **No production gate** — the only demo-vs-real switch was empty DB settings. In production with default settings, it fabricated tracking and reported success.
3. **Silent live→demo fallback** — API errors returned fabricated demo tracking instead of failing.
4. **Request body typo** — `parcels` misspelled as `parcells`.
5. **Hardcoded from-address** — "123 PawTag Street, Auckland 1010".

## Solution

Rebuild against the real NZ Post **ParcelLabel API** and **ParcelTrack API** (MuleSoft suite, OAuth 2.0 client-credentials). Credentials come from environment variables (matching the Stripe pattern), not DB settings.

### NZ Post API contract (from RAML specs v3.0.0)

**ParcelLabel** — `https://api.uat.nzpost.co.nz/parcellabel/v3` (UAT) / `https://api.nzpost.co.nz/parcellabel/v3` (live)

```
POST /labels          → 202 { consignment_id: "X63CC2" }
GET  /labels/{id}     → { labels: [{ tracking_reference: "LX022120977NZ" }] }
GET  /labels/{id}?format=PDF  → PDF label
```

Request body: `carrier`, `account_number`, `lodgement_date`, `format`, `sender_details`, `pickup_address`, `receiver_details`, `delivery_address`, `parcel_details[]` (with `service_code: "CPOLP"`, `dimensions`).

**ParcelTrack** — `https://api.uat.nzpost.co.nz/parceltrack/v3` (UAT) / `https://api.nzpost.co.nz/parceltrack/v3` (live)

```
GET /parcels?tracking_reference=LX022120977NZ
→ { results: [{ tracking_reference, tracking_events: [{ date_time, status, description }] }] }
```

**OAuth** — `https://oauth.nzpost.co.nz/as/token.oauth2` (same host for UAT and live, client-credentials grant).

### Environment variables

| Key | Purpose |
|---|---|
| `NZPOST_CLIENT_ID` | MuleSoft client ID |
| `NZPOST_CLIENT_SECRET` | MuleSoft client secret |
| `NZPOST_ACCOUNT_NUMBER` | NZ Post business account number (label request) |
| `NZPOST_LIVE` | `false` = UAT, `true` = production |

### Modes

| Mode | When | Behavior |
|---|---|---|
| **demo** | No credentials set, non-production | Fabricated tracking, `isDemo: true`, carrier "NZ Post (Demo)" |
| **test (UAT)** | Credentials set, `NZPOST_LIVE=false` | Real ParcelLabel/ParcelTrack on `api.uat.nzpost.co.nz` |
| **live** | Credentials set, `NZPOST_LIVE=true` | Real ParcelLabel/ParcelTrack on `api.nzpost.co.nz` |
| **fail-closed** | No credentials, production | Error — no fabricated tracking |

### Production safety rules

1. In production (`NODE_ENV=production`), missing `NZPOST_CLIENT_ID`/`NZPOST_CLIENT_SECRET` → `createShipment` returns `{ success: false, error: ... }`. No fabricated tracking.
2. Real-credentials path: API error → return `{ success: false, error: ... }`. Never fall back to demo tracking.
3. Demo results are marked `isDemo: true` and persisted on Shipment/Order so emails and UI can show "demo tracking" honestly.

### From-address (operational, DB setting)

The hardcoded "123 PawTag Street" moves to DB settings (configurable in admin):

- `commerce.shipping.fromCompanyName`
- `commerce.shipping.fromStreet`
- `commerce.shipping.fromSuburb`
- `commerce.shipping.fromCity`
- `commerce.shipping.fromPostcode`
- `commerce.shipping.fromPhone`
- `commerce.shipping.fromEmail`

NZ Post request also needs the from-address split into street_number/street/suburb. The setting stores a full street string; the provider parses the leading number.

### Removed

- DB settings `commerce.shipping.nzpostClientId` / `nzpostClientSecret` / `nzpostLive` (secrets are env now)
- Orphaned env vars `SHIPPING_PROVIDER_API_KEY`, `COMMERCE_SHIPPING_NZPOST_CLIENT_ID` (nothing reads them)
- Admin CommerceSettings NZ Post credential fields (secrets are env now)

## Implementation checklist

- [x] Rewrite `nz-shipping/index.ts` against ParcelLabel + ParcelTrack
- [x] Add `isDemo` to `ShipmentResult` interface
- [x] Add `isDemo` to Shipment model, `isDemoTracking` to Order model
- [x] Update commerce config: remove secret settings, add from-address + service code
- [x] Update health check to read `NZPOST_CLIENT_ID`
- [x] Update `.env.example`
- [x] Add NZ Post production fail-closed warning to `validateEnv.ts`
- [x] Update CommerceSettings admin UI (remove secrets, add from-address)
- [x] Persist `isDemo` in shipment.service.ts and shipping.service.ts
- [x] Tests: production fail-closed, UAT path, demo path, no-silent-fallback (14 tests)
- [x] Run typecheck, lint, unit, integration, smoke, regression, build

## Verification results (2026-10-09)

| Command | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS (0 errors, 890 pre-existing warnings) |
| `pnpm test:unit` | PASS — 92 files / 972 tests |
| `pnpm test:smoke` | PASS — 6 tests |
| `pnpm test:regression` | PASS — 33 tests |
| `pnpm build` | PASS — api/admin/web |
| Focused integration (shipping + donation) | PASS — 11 tests |
| `tests/unit/nzpost-provider.test.ts` | PASS — 14 tests (new) |

**Status:** CODED_NOT_RUNTIME_VALIDATED — real NZ Post UAT API not called this session (requires live credentials in `.env.local`). Demo path and production fail-closed are PROVEN via automated tests.
