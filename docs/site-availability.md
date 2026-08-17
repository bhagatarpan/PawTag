# Site Availability Controls

PawTag has two global system availability controls that administrators can use to manage site status:

1. **Site Under Maintenance** — Visitors can browse but cannot perform actions
2. **Site Offline** — The site is completely unavailable to visitors

## Precedence

**OFFLINE always takes precedence over MAINTENANCE.**

| Maintenance | Offline | Effective State |
|-------------|---------|-----------------|
| OFF | OFF | ONLINE |
| ON | OFF | MAINTENANCE |
| OFF | ON | OFFLINE |
| ON | ON | OFFLINE |

If Offline is subsequently disabled while Maintenance remains enabled, the effective state returns to MAINTENANCE. The two settings remain independently stored.

## Settings

All settings are stored in the database via the existing `Setting` model (category: `site`).

| Key | Default | Description |
|-----|---------|-------------|
| `site.maintenanceMode` | `false` | Toggle maintenance mode |
| `site.offlineMode` | `false` | Toggle offline mode |
| `site.maintenanceTitle` | `PawTag is currently under maintenance` | Banner heading |
| `site.maintenanceMessage` | `Some website functionality is temporarily unavailable. Please check back shortly.` | Banner body |
| `site.offlineTitle` | `PawTag is currently offline` | Offline page heading |
| `site.offlineMessage` | `Please come back later.` | Offline page body |
| `site.availabilityPollingInterval` | `30` | Polling interval in seconds |

## RBAC

Only the following roles can manage site availability settings:

- **SUPER_ADMIN** — Full access (bypass)
- **ADMIN** — Has `setting.read` and `setting.update` permissions
- **WEBSITE_EDITOR** — Has `setting.read` and `setting.update` permissions

The following roles do NOT have access:
- CUSTOMER_SERVICE
- CUSTOMER
- Any other role without `setting.read`/`setting.update`

## API Endpoints

### Public Status Endpoint (always accessible)

```
GET /api/public/system/status
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "ONLINE" | "MAINTENANCE" | "OFFLINE"
  }
}
```

This endpoint remains accessible even when the site is Offline.

### Admin Settings (requires authentication + `setting.read`/`setting.update`)

```
GET  /api/admin/site-availability/status
PUT  /api/admin/site-availability/status
```

## API Enforcement

### Maintenance Mode

- Allows GET/HEAD/OPTIONS requests (read-only browsing)
- Blocks POST/PUT/PATCH/DELETE requests (mutations)
- Returns `503 Service Unavailable` with `code: "SITE_MAINTENANCE"` for blocked requests

### Offline Mode

- Blocks all non-exempt requests
- Returns `503 Service Unavailable` with `code: "SITE_OFFLINE"` for blocked requests

### Exempt Paths

The following paths are always accessible regardless of site status:

- `/health`
- `/api/public/system/status`
- `/api/admin/*` (admin recovery)
- `/api/auth/*` (admin login)
- `/api/tags/:tagId/qr` and `/api/tags/:tagId/sticker` (read-only)

## Caching

The site availability status is cached in-memory with a 10-second TTL. This ensures:

- Fast propagation of status changes (max 10-second delay)
- Minimal database queries
- Quick recovery when status is restored

Cache is cleared immediately when an administrator updates the settings.

## Frontend Behavior

### Web App (`apps/web`)

- **ONLINE:** Normal behavior
- **MAINTENANCE:** Shows maintenance banner (top, 10-15% height, red, pulsing), site remains browsable
- **OFFLINE:** Shows dedicated offline page, replaces all normal routes

### Finder Portal (`apps/finder`)

- **ONLINE:** Normal behavior
- **MAINTENANCE:** Shows pet info (read-only), action buttons (Notify Owner, Share Location) are disabled
- **OFFLINE:** Shows branded offline screen

### Mobile App (`apps/mobile`)

- **ONLINE:** Normal behavior
- **MAINTENANCE:** Normal behavior (backend blocks mutations)
- **OFFLINE:** Shows branded offline screen

### Admin Portal (`apps/admin`)

- Always accessible regardless of site status
- Shows current status badge (Online/Maintenance/Offline)
- Settings page at `/site-availability`

## Audit Logging

All changes to site availability settings are logged via the existing audit system:

- `site_availability.maintenanceMode_changed` — When maintenance mode is toggled
- `site_availability.offlineMode_changed` — When offline mode is toggled
- `site_availability.*_changed` — When messages or polling interval are updated

Offline activation is logged as CRITICAL severity. Maintenance activation is logged as HIGH severity.

## Recovery

Recovery is simple and requires no deployment or environment variable changes:

1. Admin logs into Admin Portal (always accessible)
2. Navigates to Site Availability settings
3. Disables Offline Mode → effective state becomes MAINTENANCE (if maintenance is still on) or ONLINE
4. Disables Maintenance Mode → effective state becomes ONLINE

No server restart is required. Changes propagate within 10 seconds.
