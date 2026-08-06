# Production Deployment Guide

How to deploy PawTag to production for live customers.

---

## Architecture

| Service | Provider | Production URL |
|---------|----------|----------------|
| API | Render | `api.pawtag.co.nz` |
| Web | Vercel | `www.pawtag.co.nz` |
| Admin | Vercel | `admin.pawtag.co.nz` |
| Customer | Vercel | `app.pawtag.co.nz` |
| Finder | Vercel | `find.pawtag.co.nz` |
| Database | MongoDB Atlas | Production cluster (paid tier) |
| Payments | Stripe | Live mode (`sk_live_...`) |

---

## Prerequisites

- All staging verification passed
- Domain names purchased and DNS configured
- SSL certificates auto-provisioned by Vercel/Render
- Stripe live-mode API keys
- MongoDB Atlas paid tier with backups enabled
- All environment variables documented in `docs/environments.md`

---

## Deployment Process

### 1. Pre-Deployment Checks

```bash
# Run full test suite
pnpm test
pnpm typecheck

# Verify no secrets in code
grep -r "sk_live_" packages/ apps/ --include="*.ts" --include="*.tsx"
grep -r "sk_test_" packages/ apps/ --include="*.ts" --include="*.tsx"
# Should return nothing — secrets belong in env vars only
```

### 2. Database Migration (if needed)

```bash
# If schema changes are involved, run migration first
# Atlas requires no migration step — Mongoose handles schema evolution
# But verify the new code works with the existing data
```

### 3. API Deployment (Render)

1. Push to `main` branch
2. Render auto-deploys from `main` (or trigger manual deploy)
3. Monitor deploy logs for errors
4. Verify: `GET https://api.pawtag.co.nz/health` → 200 OK

### 4. Frontend Deployment (Vercel)

1. Push to `main` branch
2. Vercel auto-deploys each connected project
3. Verify each URL:
   - `https://www.pawtag.co.nz` → loads
   - `https://admin.pawtag.co.nz` → loads, login works
   - `https://app.pawtag.co.nz` → loads, login works
   - `https://find.pawtag.co.nz` → loads, tag lookup works

### 5. Mobile App (EAS)

```bash
cd apps/mobile
eas build --profile production
# Wait for build to complete
eas submit --platform ios     # App Store
eas submit --platform android # Play Console
```

### 6. DNS Configuration

| Record | Type | Value |
|--------|------|-------|
| `www.pawtag.co.nz` | CNAME | `cname.vercel-dns.com` |
| `admin.pawtag.co.nz` | CNAME | `cname.vercel-dns.com` |
| `app.pawtag.co.nz` | CNAME | `cname.vercel-dns.com` |
| `find.pawtag.co.nz` | CNAME | `cname.vercel-dns.com` |
| `api.pawtag.co.nz` | CNAME | `<render-service-url>` |

---

## Post-Deployment Verification

- [ ] API health check returns 200
- [ ] All 4 frontend apps load correctly
- [ ] Login works on all apps
- [ ] Tag purchase flow works end-to-end (Stripe live mode)
- [ ] Tag activation works (QR + NFC)
- [ ] Finder notification flow works
- [ ] Email delivery works (production SMTP)
- [ ] SMS delivery works (Twilio production)
- [ ] Push notifications work (Expo production)
- [ ] Sentry error tracking is receiving errors (if any)
- [ ] Better Stack logging is working
- [ ] SSL certificates are valid (no browser warnings)

---

## Rollback Procedure

If something goes wrong after deployment:

1. **Render**: Dashboard → Service → Manual Deploy → select previous deploy
2. **Vercel**: Dashboard → Project → Deployments → promote previous deployment
3. **Database**: If schema change broke something, see `docs/rollback.md`

See `docs/rollback.md` for detailed rollback procedures.
