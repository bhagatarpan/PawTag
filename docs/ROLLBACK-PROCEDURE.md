# Rollback Procedure

> Step-by-step procedures for rolling back PawTag deployments.
> PawTag should prioritize pet recovery availability over commerce during an incident.
>
> Last updated: 2026-09-19

## Rollback Principles

1. **Finder recovery is launch-critical** — If an incident affects commerce but not Finder, keep Finder online
2. **Data integrity first** — Never roll back database changes that could lose customer data
3. **Document everything** — Record every rollback action for post-incident review
4. **Test before production** — Rehearse rollback procedures in staging first

---

## Scenario 1: Application Rollback (Docker/Render)

### Situation
A new deployment introduces a bug that affects customer-facing functionality.

### Steps

1. **Identify the last known-good version**:
   ```bash
   # Check recent commits
   git log --oneline -10
   
   # Check deployed tags
   git tag -l
   ```

2. **Roll back to previous version**:
   - **Render**: Dashboard → Service → Manual Deploy → Select previous commit
   - **Docker Compose**:
     ```bash
     # Update docker-compose.yml to use previous image tag
     docker-compose down
     docker-compose up -d
     ```

3. **Verify rollback**:
   ```bash
   curl http://localhost:5000/api/health
   curl http://localhost:5000/api/health/ready
   ```

4. **Monitor logs** for errors after rollback

### Estimated Time: 5-15 minutes

---

## Scenario 2: Database Migration Rollback

### Situation
A database migration was applied that causes issues.

### Important Rules

- **Never automatically roll back migrations** that could lose data
- **Always backup before attempting migration rollback**
- **Test migration rollback in staging first**

### Steps

1. **Take backup** (if not already done):
   ```bash
   ./scripts/backup-restore-rehearsal.sh backup
   ```

2. **Assess the migration**:
   - Does it add fields? (Usually safe to keep)
   - Does it remove fields? (Requires careful handling)
   - Does it transform data? (May need reverse transformation)

3. **For additive migrations** (new fields/indexes):
   - Simply roll back the application code
   - New fields/indexes are harmless — leave them in place
   - No database rollback needed

4. **For destructive migrations** (removed fields/transformed data):
   - Restore from backup to a new database
   - Verify data integrity
   - Update application connection string
   - Restart services

5. **Verify after rollback**:
   - Check application logs
   - Test critical workflows (login, pet creation, Finder scan)
   - Verify data integrity

### Estimated Time: 30 minutes - 2 hours (depending on data volume)

---

## Scenario 3: Configuration Rollback

### Situation
A configuration change (environment variable, setting) causes issues.

### Steps

1. **Identify the problematic configuration**:
   - Check recent environment variable changes
   - Review application logs for configuration errors

2. **Revert configuration**:
   - **Render**: Dashboard → Environment → Revert to previous values
   - **Docker Compose**: Revert `.env` file changes
   - **Database settings**: Use admin API or direct database update

3. **Restart affected services**:
   ```bash
   # API
   docker-compose restart api worker
   
   # Or on Render: trigger manual deploy
   ```

4. **Verify configuration rollback**:
   ```bash
   curl http://localhost:5000/api/health/dependencies
   ```

### Estimated Time: 5-10 minutes

---

## Scenario 4: Stop Worker Processing

### Situation
A background job is causing issues and needs to be stopped immediately.

### Steps

1. **Stop the worker process**:
   - **Docker Compose**:
     ```bash
     docker-compose stop worker
     ```
   - **Render**: Dashboard → Worker Service → Cancel deploy / manually stop
   - **PM2** (if used):
     ```bash
     pm2 stop pawtag-worker
     ```

2. **Verify worker is stopped**:
   ```bash
   # Check no worker process is running
   docker-compose ps worker
   
   # Check job logs for last execution
   docker-compose logs worker --tail=50
   ```

3. **When safe, restart worker**:
   ```bash
   docker-compose start worker
   ```

### Important Notes

- Stopping the worker does NOT affect the API or customer-facing applications
- Webhook retries will queue up and process when worker restarts
- Finder notifications are sent synchronously, not through the worker
- Background jobs will resume from where they left off

### Estimated Time: 1-2 minutes

---

## Scenario 5: Disable Checkout (Keep Finder Online)

### Situation
A payment or commerce issue requires disabling checkout while keeping pet recovery functional.

### Architecture

PawTag is designed with separate concerns:
- **Finder** (`apps/finder`) — Pet recovery, no commerce
- **Customer Web** (`apps/web`) — Commerce + account features
- **API** (`packages/api`) — Shared backend

### Option A: Feature Flag (Recommended)

If a feature flag exists for checkout:

1. **Disable checkout via feature flag**:
   ```bash
   # Via admin API or database
   curl -X PUT http://localhost:5000/api/admin/settings/commerce.feature.checkout \
     -H "Authorization: Bearer <admin-token>" \
     -H "Content-Type: application/json" \
     -d '{"value": "false"}'
   ```

2. **Verify checkout is disabled**:
   - Customer web shows "Checkout temporarily unavailable"
   - Finder still works normally
   - API health check still passes

### Option B: Environment Variable

If no feature flag exists:

1. **Set checkout disable flag**:
   ```bash
   # Add to environment
   PAWTAG_CHECKOUT_DISABLED=true
   
   # Restart API
   docker-compose restart api
   ```

2. **Update nginx to show maintenance message** (optional):
   - Add conditional route in nginx.conf
   - Serve static maintenance page for `/checkout` paths

### Option C: Deploy Separate Finder

If using separate deployments:

1. **Finder deployment continues** — unaffected by customer web changes
2. **Customer web deployment** — can be rolled back or disabled independently
3. **API** — remains online, only checkout-related endpoints affected

### Verification

After disabling checkout:

```bash
# Finder should still work
curl http://localhost:3003/

# API health should pass
curl http://localhost:5000/api/health

# Checkout endpoint should return appropriate error
curl http://localhost:5000/api/checkout/confirm
```

### Estimated Time: 2-5 minutes

---

## Scenario 6: Complete Service Rollback

### Situation
Multiple services need to be rolled back simultaneously.

### Steps

1. **Stop all services**:
   ```bash
   docker-compose down
   ```

2. **Restore database** (if needed):
   ```bash
   ./scripts/backup-restore-rehearsal.sh restore <backup-directory>
   ```

3. **Deploy previous application versions**:
   ```bash
   # Update docker-compose.yml to use previous image tags
   # Or deploy previous commits on Render/Vercel
   ```

4. **Start services in order**:
   ```bash
   # 1. Start database (if using local MongoDB)
   # 2. Start API
   docker-compose up -d api
   # 3. Wait for API to be healthy
   curl http://localhost:5000/api/health/ready
   # 4. Start worker
   docker-compose up -d worker
   # 5. Start frontend apps
   docker-compose up -d web admin finder
   ```

5. **Verify all services**:
   ```bash
   docker-compose ps
   curl http://localhost:5000/api/health
   curl http://localhost:3000/
   curl http://localhost:3001/
   curl http://localhost:3003/
   ```

### Estimated Time: 15-30 minutes

---

## Rollback Checklist

Before performing a rollback:

- [ ] Identify the root cause
- [ ] Determine if rollback is necessary (vs. hotfix)
- [ ] Check if database changes are involved
- [ ] Take backup if database changes exist
- [ ] Notify team/stakeholders
- [ ] Document the rollback reason

After rollback:

- [ ] Verify application health
- [ ] Test critical workflows
- [ ] Monitor logs for errors
- [ ] Check Finder functionality
- [ ] Check payment/commerce functionality (if applicable)
- [ ] Document what happened
- [ ] Schedule post-incident review

---

## Communication Template

### During Rollback

```
[INCIDENT] PawTag Rollback in Progress

What: Rolling back [service] due to [issue]
Impact: [affected functionality]
ETA: [estimated time]
Workaround: [if any]

Finder recovery is operational.
```

### After Rollback

```
[RESOLVED] PawTag Rollback Complete

What: Rolled back [service] from [version] to [version]
Root cause: [brief description]
Impact during rollback: [what was affected]
Prevention: [what will prevent this in the future]
```

---

## Testing Rollback Procedures

Before first customer, rehearse:

1. **Application rollback** — Roll back to previous Docker image
2. **Configuration rollback** — Revert environment variables
3. **Worker stop/start** — Stop and restart worker process
4. **Checkout disable** — Disable checkout while keeping Finder online
5. **Database restore** — Restore from backup (covered in 11.4)

Document results in `docs/BACKUP-RESTORE-REHEARSAL.md`.

---

## Related Documents

- `docs/disaster-recovery.md` — Full disaster recovery procedures
- `docs/BACKUP-RESTORE-REHEARSAL.md` — Backup and restore rehearsal
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
- `docs/JOB-ERROR-POLICY.md` — Background job error handling
