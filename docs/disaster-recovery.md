# Disaster Recovery Runbook

Step-by-step procedures for recovering from data loss, infrastructure failure, or account compromise.

---

## Recovery Objectives

| Metric | Target | Rationale |
|--------|--------|-----------|
| **RTO** (Recovery Time Objective) | 4 hours | Maximum acceptable downtime; covers Atlas restore + service redeploy |
| **RPO** (Recovery Point Objective) | 24 hours | Atlas continuous backups enable point-in-time recovery; daily snapshots are minimum |

---

## Scenario 1: Database Corruption / Accidental Data Loss

### Symptoms
- Data missing or corrupted
- Users reporting errors after a bad migration
- Admin accidentally deleted important records

### Recovery Steps

1. **Stop the API immediately** to prevent further damage:
   - Render dashboard → PawTag API service → Cancel deploy / manually stop

2. **Restore from Atlas backup**:
   - Log in to [MongoDB Atlas](https://cloud.mongodb.com)
   - Select your cluster → **Backup** tab
   - Choose the backup timestamp *before* the corruption occurred
   - Click **Restore** → choose "Point-in-Time Recovery" or a specific snapshot
   - Target: restore to a new cluster (don't overwrite production directly)

3. **Verify restored data**:
   - Connect to the restored cluster with MongoDB Compass or `mongosh`
   - Check: users exist, pet counts match, recent orders are present
   - Compare with the last known-good state

4. **Swap connection string**:
   - Once verified, update `DB_URL` in Render environment variables to point to the restored cluster
   - Or, if restored in-place, confirm the connection string is correct

5. **Restart the API**:
   - Render dashboard → Trigger manual deploy
   - Monitor logs for errors

6. **Notify affected users** if any data loss occurred beyond the RPO window

### Estimated Time: 1–2 hours

---

## Scenario 2: Complete Infrastructure Loss (Render/Vercel Account Compromised)

### Symptoms
- All deployed services are unreachable
- Cannot log in to Render or Vercel dashboards
- Domain DNS still points to old infrastructure

### Recovery Steps

1. **Secure accounts first**:
   - Change passwords for Render, Vercel, MongoDB Atlas, Stripe, GitHub
   - Enable 2FA on everything
   - Rotate all API keys and secrets

2. **Redeploy API from GitHub**:
   ```bash
   # If Render account is lost, create a new one
   # Connect GitHub repo → select packages/api as root
   # Set environment variables (see docs/environments.md)
   # Deploy
   ```

3. **Redeploy frontend apps from GitHub**:
   ```bash
   # For each app (web, admin, customer, finder):
   # Create new Vercel project → connect GitHub repo
   # Set root directory, build command, output directory
   # Configure environment variables
   # Deploy
   ```

4. **Restore database** (if Atlas was also affected):
   - Follow Scenario 1 steps

5. **Update DNS**:
   - Point domains to new Vercel/Render URLs
   - Wait for DNS propagation (up to 48 hours)

6. **Verify everything works**:
   - Health check: `GET /api/health`
   - Test login, pet creation, tag scan flow
   - Check email delivery (send a test password reset)

### Estimated Time: 2–4 hours

---

## Scenario 3: Stripe Account Compromise

### Symptoms
- Unauthorized charges
- Strange webhook events
- Stripe dashboard shows suspicious activity

### Recovery Steps

1. **Log in to Stripe dashboard** → immediately revoke all API keys
2. **Contact Stripe support** to freeze the account
3. **Review recent transactions** for unauthorized charges
4. **Generate new API keys**:
   - New `STRIPE_SECRET_KEY`
   - New webhook endpoint secret
   - Update webhook URL in Stripe dashboard
5. **Update Render environment variables** with new keys
6. **Redeploy API** to pick up new environment variables
7. **Notify affected customers** if any data was exposed

### Estimated Time: 1–2 hours (plus Stripe support response time)

---

## Scenario 4: MongoDB Atlas Cluster Failure

### Symptoms
- Atlas dashboard shows cluster unavailable
- API logs show connection timeouts
- Users see "Service unavailable" errors

### Recovery Steps

1. **Check Atlas status page**: [status.mongodb.com](https://status.mongodb.com)
   - If it's a widespread outage, wait for Atlas to resolve
   - If it's your cluster only, proceed

2. **Check cluster health** in Atlas dashboard:
   - Metrics tab → look for connection limits, storage limits
   - If storage is full, upgrade tier or clean up data

3. **If cluster is unrecoverable**:
   - Create a new cluster in the same region
   - Restore from latest backup
   - Update `DB_URL` in Render
   - Redeploy API

### Estimated Time: 30 min – 2 hours depending on cause

---

## Scenario 5: Expo Push Notification Service Outage

### Symptoms
- Push notifications not delivered
- Expo push token registration fails
- No impact on other app functionality

### Recovery Steps

1. **Check Expo status**: [status.expo.dev](https://status.expo.dev)
2. **If Expo is down**: notifications will queue and deliver when service recovers — no action needed
3. **If it's your Expo project**:
   - Log in to [expo.dev](https://expo.dev) → check project settings
   - Verify push notification credentials are valid
   - For iOS: ensure APNs key is still valid

### Estimated Time: 0–1 hour (usually resolves itself)

---

## Scenario 6: Complete Code Repository Loss

### Symptoms
- GitHub repository deleted or compromised
- Local copy also lost

### Recovery Steps

1. **Check GitHub recycle bin** — deleted repos can be restored within 90 days
2. **If permanently lost**, recover from:
   - Any developer's local clone (check with team)
   - CI/CD build cache (Vercel keeps deployment artifacts)
   - Render deploy cache
3. **Restore from latest clone**:
   ```bash
   git clone <restored-repo-url>
   pnpm install
   # Follow docs/developer-setup.md for full rebuild
   ```

### Estimated Time: 30 min – 2 hours depending on backup availability

---

## Prevention Checklist

| Action | Frequency | Owner |
|--------|-----------|-------|
| Atlas automated backups enabled | Continuous | Auto (Atlas) |
| Atlas backup tested (restore to scratch) | Monthly | Founder |
| All env vars documented in `docs/environments.md` | Ongoing | Developer |
| GitHub 2FA enabled | Once | Founder |
| Render/Vercel 2FA enabled | Once | Founder |
| Stripe API keys rotated | Quarterly | Founder |
| Atlas database user passwords rotated | Quarterly | Founder |
| This runbook reviewed and updated | Quarterly | Founder |

---

## Emergency Contacts

| Service | Support |
|---------|---------|
| MongoDB Atlas | [cloud.mongodb.com](https://cloud.mongodb.com) → Support tab |
| Stripe | [support.stripe.com](https://support.stripe.com) |
| Render | [render.com/docs](https://render.com/docs) → Support |
| Vercel | [vercel.com/docs](https://vercel.com/docs) → Support |
| Expo | [expo.dev](https://expo.dev) → Support |
| GitHub | [support.github.com](https://support.github.com) |
