# Staging Deployment Guide

How to deploy PawTag to the staging environment for pre-production testing.

---

## Architecture

Staging mirrors production with separate infrastructure and test-mode credentials:

| Service | Provider | URL Pattern |
|---------|----------|-------------|
| API | Render | `pawtag-api-staging.onrender.com` |
| Web | Vercel | `pawtag-staging.vercel.app` |
| Admin | Vercel | `pawtag-admin-staging.vercel.app` |
| Customer | Vercel | `pawtag-customer-staging.vercel.app` |
| Finder | Vercel | `pawtag-finder-staging.vercel.app` |
| Database | MongoDB Atlas | Separate cluster (staging) |
| Payments | Stripe | Test mode (`sk_test_...`) |

---

## Prerequisites

- Render account with billing enabled
- Vercel account connected to GitHub
- MongoDB Atlas staging cluster created
- Stripe test-mode API keys
- All environment variables documented in `docs/environments.md`

---

## Deployment Process

### 1. API (Render)

1. Log in to [Render dashboard](https://dashboard.render.com)
2. Create new **Web Service**
3. Connect GitHub repo → select `packages/api` as root directory
4. Configure:
   - **Build Command**: `cd ../.. && pnpm install --frozen-lockfile && cd packages/api && pnpm build`
   - **Start Command**: `cd ../.. && cd packages/api && pnpm start`
   - **Environment**: Node
5. Set all environment variables (see `docs/environments.md`)
6. Deploy

### 2. Frontend Apps (Vercel)

For each app (web, admin, customer, finder):

1. Log in to [Vercel dashboard](https://vercel.com/dashboard)
2. **Add New Project** → Import GitHub repo
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/<app-name>`
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
4. Set environment variables:
   - `VITE_API_URL` → staging API URL (e.g., `https://pawtag-api-staging.onrender.com/api`)
5. Deploy

### 3. Database (Atlas)

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a new cluster (or use a dedicated staging cluster)
3. Create database user with read/write access
4. Whitelist Render/Vercel IP addresses (or use `0.0.0.0/0` for initial setup)
5. Get connection string → set as `DB_URL` in Render

### 4. Seed Staging Database

```bash
# Connect to staging cluster
export DB_URL="mongodb+srv://<staging-connection-string>"
cd packages/api && pnpm seed
```

---

## Verification Checklist

After deployment, verify:

- [ ] API health check: `GET /api/health` returns 200
- [ ] Admin login works with seeded admin account
- [ ] Customer portal loads and login works
- [ ] Finder page loads and tag lookup works
- [ ] Web shop loads and products display
- [ ] Stripe test checkout works (use `4242 4242 4242 4242`)
- [ ] Email delivery works (test password reset)
- [ ] Mobile app can connect (update API URL in mobile dev build)

---

## Environment Variables

See `docs/environments.md` for the complete reference. Key staging-specific values:

| Variable | Staging Value |
|----------|---------------|
| `NODE_ENV` | `staging` |
| `DB_URL` | Atlas staging cluster connection string |
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `FRONTEND_URL` | Vercel staging web URL |
| `ALLOWED_ORIGINS` | All staging Vercel URLs |
