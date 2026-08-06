# Rollback Procedures

How to undo a deployment if something goes wrong.

---

## API Rollback (Render)

### Quick Rollback (Previous Deploy)

1. Log in to [Render dashboard](https://dashboard.render.com)
2. Select PawTag API service
3. Go to **Deploys** tab
4. Find the last working deploy
5. Click **Manual Deploy** → **Deploy previous commit**

This takes ~2 minutes and restores the previous working version.

### Environment Variable Rollback

If a bad env var was deployed:

1. Render dashboard → Service → **Environment** tab
2. Revert the changed variable to its previous value
3. Service auto-restarts

---

## Frontend Rollback (Vercel)

### Quick Rollback (Previous Deployment)

1. Log in to [Vercel dashboard](https://vercel.com/dashboard)
2. Select the project (web, admin, customer, or finder)
3. Go to **Deployments** tab
4. Find the last working deployment
5. Click **...** → **Promote to Production**

This takes ~30 seconds and instantly reverts the live site.

---

## Database Rollback (MongoDB Atlas)

### If Schema Change Broke Something

Mongoose is schema-flexible, so most changes are backward-compatible. But if a migration script corrupted data:

1. **Stop the API** (prevent further damage)
2. **Restore from Atlas backup**:
   - Atlas dashboard → Cluster → **Backup** tab
   - Select backup from before the bad migration
   - Restore to a new cluster (don't overwrite production directly)
3. **Verify restored data** on the new cluster
4. **Swap connection string** in Render environment variables
5. **Restart the API**

See `docs/disaster-recovery.md` for detailed steps.

### If Bad Data Was Written by API

If the API wrote incorrect data (e.g., wrong order status, corrupted pet records):

1. **Identify affected records**:
   ```javascript
   // In MongoDB Compass or mongosh
   db.orders.find({ createdAt: { $gte: ISODate("2024-01-01T00:00:00Z") } })
   ```
2. **Rollback manually**:
   ```javascript
   // Revert specific field values
   db.orders.updateMany(
     { createdAt: { $gte: ISODate("2024-01-01T00:00:00Z") } },
     { $set: { status: "previous_status" } }
   )
   ```
3. **Restart the API**

---

## Mobile App Rollback

### Before Store Approval

If the app was submitted but not yet approved:
- Withdraw the submission
- Fix the issue
- Resubmit

### After Store Approval

If a bad version was released:
- **iOS**: Apple doesn't allow direct rollback — submit a hotfix version
- **Android**: Play Console allows rolling back to a previous version in production track

---

## Stripe Rollback

If a bad webhook or payment flow was deployed:

1. **Immediately pause the webhook** in Stripe dashboard → Developers → Webhooks
2. **Refund any incorrect charges** via Stripe dashboard
3. **Fix the code** and redeploy
4. **Re-enable the webhook**

---

## Decision Tree

```
Something is broken in production
│
├── Is it the API?
│   ├── Code bug → Roll back API on Render
│   └── Bad env var → Fix env var in Render
│
├── Is it a frontend?
│   └── Promote previous Vercel deployment
│
├── Is it data corruption?
│   ├── Stop API → Restore Atlas backup → Swap connection string
│   └── Manual data fix → Restart API
│
├── Is it the mobile app?
│   └── Submit hotfix version (no direct rollback possible)
│
└── Is it payments?
    └── Pause webhook → Fix code → Redeploy → Refund incorrect charges
```
