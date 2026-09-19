# Backup and Restore Rehearsal Runbook

> This document describes the procedure for rehearsing backup and restore operations.
> A backup that has never been restored is not yet a proven backup strategy.
>
> Last updated: 2026-09-19

## Purpose

Before the first real customer, PawTag must prove that:
1. Backups can be taken successfully
2. Backups can be restored successfully
3. Data integrity is maintained after restore
4. The application works correctly with restored data

## Prerequisites

- Access to MongoDB Atlas (or local MongoDB for testing)
- `mongodump` and `mongorestore` tools installed
- PawTag API running against a test/staging database
- Test data seeded in the database

## Rehearsal Steps

### Step 1: Create Test Data

Seed the database with representative data:

```bash
# From the PawTag repository root
pnpm --filter @pawtag/api seed
```

This creates:
- Test users (admin, customer)
- Test pets with tags
- Test orders and payments
- Test notifications

### Step 2: Take a Backup

```bash
# Set connection string
export MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>/<dbname>"

# Take backup using mongodump
mongodump --uri="$MONGODB_URI" --out="./backup-$(date +%Y%m%d-%H%M%S)"

# Or use the backup script
./scripts/backup-restore-rehearsal.sh backup
```

Verify backup was created:
```bash
ls -la ./backup-*/
```

### Step 3: Record Pre-Restore State

Before modifying data, record the current state:

```bash
# Connect to MongoDB and record counts
mongosh "$MONGODB_URI" --eval "
  print('Users:', db.users.countDocuments());
  print('Pets:', db.pets.countDocuments());
  print('Tags:', db.tags.countDocuments());
  print('Orders:', db.orders.countDocuments());
  print('Carts:', db.carts.countDocuments());
  print('Notifications:', db.notifications.countDocuments());
"
```

Save this output for comparison after restore.

### Step 4: Delete/Alter Representative Data

Simulate data loss by deleting or altering data:

```bash
# Connect to MongoDB and delete some data
mongosh "$MONGODB_URI" --eval "
  // Delete a user's pets
  db.pets.deleteOne({ name: 'Test Pet' });
  
  // Delete an order
  db.orders.deleteOne({ orderNumber: 'PT-TEST-001' });
  
  // Corrupt a user's profile
  db.users.updateOne({ email: 'test@example.com' }, { \$set: { fullName: 'CORRUPTED' } });
  
  print('Data modified for rehearsal');
"
```

### Step 5: Restore from Backup

```bash
# Restore using mongorestore
mongorestore --uri="$MONGODB_URI" --drop "./backup-*/"

# Or use the backup script
./scripts/backup-restore-rehearsal.sh restore
```

### Step 6: Verify Data Integrity

After restore, verify all data is correct:

```bash
# Connect to MongoDB and verify restored state
mongosh "$MONGODB_URI" --eval "
  print('=== Post-Restore Verification ===');
  print('Users:', db.users.countDocuments());
  print('Pets:', db.pets.countDocuments());
  print('Tags:', db.tags.countDocuments());
  print('Orders:', db.orders.countDocuments());
  print('Carts:', db.carts.countDocuments());
  print('Notifications:', db.notifications.countDocuments());
  
  // Verify specific records
  const user = db.users.findOne({ email: 'test@example.com' });
  print('User restored:', user.fullName !== 'CORRUPTED');
  
  const pet = db.pets.findOne({ name: 'Test Pet' });
  print('Pet restored:', !!pet);
  
  const order = db.orders.findOne({ orderNumber: 'PT-TEST-001' });
  print('Order restored:', !!order);
  
  // Verify relationships
  if (pet && user) {
    print('Pet-User link:', pet.ownerId.toString() === user._id.toString());
  }
"
```

### Step 7: Verify Application Functionality

After restore, test that the application works:

1. **API Health Check**:
   ```bash
   curl http://localhost:5000/api/health
   ```

2. **Login**:
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Password123!"}'
   ```

3. **Fetch Pets**:
   ```bash
   curl http://localhost:5000/api/customer/pets \
     -H "Authorization: Bearer <token>"
   ```

4. **Fetch Orders**:
   ```bash
   curl http://localhost:5000/api/customer/orders \
     -H "Authorization: Bearer <token>"
   ```

### Step 8: Document Results

Record the rehearsal results:

| Step | Result | Notes |
|------|--------|-------|
| Backup created | ✅/❌ | |
| Backup size | | |
| Data deleted | | |
| Restore completed | ✅/❌ | |
| Restore duration | | |
| User count matches | ✅/❌ | |
| Pet count matches | ✅/❌ | |
| Tag count matches | ✅/❌ | |
| Order count matches | ✅/❌ | |
| Relationships intact | ✅/❌ | |
| API health check | ✅/❌ | |
| Login works | ✅/❌ | |
| Pet fetch works | ✅/❌ | |
| Order fetch works | ✅/❌ | |

## Frequency

This rehearsal should be performed:
- Before first customer launch
- Monthly thereafter
- After any database schema changes
- After any backup configuration changes

## Troubleshooting

### Backup fails

- Check MongoDB connection string
- Verify `mongodump` is installed and in PATH
- Check Atlas IP whitelist (if using Atlas)
- Verify database user has backup permissions

### Restore fails

- Check MongoDB connection string
- Verify `mongorestore` is installed and in PATH
- Check Atlas IP whitelist
- Verify database user has read/write permissions
- Ensure target database is empty or use `--drop` flag

### Data mismatch after restore

- Verify backup was taken after all test data was created
- Check for timezone issues in date comparisons
- Verify relationships (foreign keys) are intact
- Check for any post-backup writes that weren't captured

## Related Documents

- `docs/disaster-recovery.md` - Full disaster recovery procedures
- `docs/environments.md` - Environment configuration
- `docs/MVP_IMPLEMENTATION_STATUS.md` - Current implementation status
