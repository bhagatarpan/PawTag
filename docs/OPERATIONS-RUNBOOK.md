# Basic Operations Runbook

> How to answer common operational questions for the first customers.
> For the first customers, an elaborate dashboard is unnecessary.
>
> Last updated: 2026-09-19

## Purpose

This runbook provides step-by-step procedures for answering common operational questions using safe admin/log query paths.

---

## 1. Did Stripe Charge This Person?

### Question
A customer claims they were charged but didn't receive their order.

### Steps

1. **Check Stripe Dashboard**:
   - Log in to [Stripe Dashboard](https://dashboard.stripe.com)
   - Search by customer email or PaymentIntent ID
   - Verify payment status (succeeded, pending, failed)

2. **Check PawTag Orders**:
   ```bash
   # Via admin API
   curl http://localhost:5000/api/admin/orders?email=<customer-email> \
     -H "Authorization: Bearer <admin-token>"
   
   # Or via MongoDB
   mongosh "$MONGODB_URI" --eval "
     db.orders.find({ 'customer.email': '<customer-email>' }).sort({ createdAt: -1 }).limit(5)
   "
   ```

3. **Verify PaymentIntent**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.paymenttransactions.find({ stripePaymentIntentId: '<pi-id>' })
   "
   ```

### Expected Output
- Stripe shows payment status
- PawTag shows order with matching PaymentIntent ID
- Order status matches payment status

---

## 2. Did PawTag Create the Order?

### Question
Payment succeeded but customer didn't receive order confirmation.

### Steps

1. **Check Orders Collection**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     // Search by PaymentIntent ID
     db.orders.find({ 'payment.stripePaymentIntentId': '<pi-id>' })
     
     // Or by order number
     db.orders.find({ orderNumber: 'PT-2026-001' })
     
     // Or by customer email
     db.orders.find({ 'customer.email': '<email>' }).sort({ createdAt: -1 })
   "
   ```

2. **Check Pending Orders**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.pendingorders.find({ stripePaymentIntentId: '<pi-id>' })
   "
   ```

3. **Check Orphan Payment Detection**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     // Look for recovered orphan payments
     db.auditlogs.find({ eventType: 'orphan_payment_recovered' }).sort({ createdAt: -1 }).limit(10)
   "
   ```

### Expected Output
- Order exists with correct status
- Payment transaction matches
- If missing, check orphan payment detection job logs

---

## 3. Was Stock Confirmed?

### Question
Customer completed checkout but item is out of stock.

### Steps

1. **Check Order Items**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     const order = db.orders.findOne({ orderNumber: 'PT-2026-001' });
     printjson(order.items);
   "
   ```

2. **Check Inventory Movements**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.stockmovements.find({ orderId: '<order-id>' }).sort({ createdAt: -1 })
   "
   ```

3. **Check Product Stock**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.products.find({ _id: ObjectId('<product-id>') }).projection({ name: 1, stock: 1, reserved: 1 })
   "
   ```

### Expected Output
- Stock movement shows reservation/confirmation
- Product stock reflects current availability
- If mismatch, check inventory service logs

---

## 4. Was a Tag/Subscription Created?

### Question
Customer purchased a tag but it's not showing in their account.

### Steps

1. **Check Tags**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.tags.find({ userId: ObjectId('<user-id>') })
     
     // Or by order
     db.tags.find({ orderId: ObjectId('<order-id>') })
   "
   ```

2. **Check Subscriptions**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.subscriptions.find({ userId: ObjectId('<user-id>') })
   "
   ```

3. **Check Entitlements**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     // Check if tag was generated during checkout
     db.orders.findOne({ orderNumber: 'PT-2026-001' }).tagId
   "
   ```

### Expected Output
- Tag exists and is linked to user
- If missing, check checkout confirmation logs

---

## 5. Did an Owner Notification Send?

### Question
Finder scanned a tag but owner didn't receive notification.

### Steps

1. **Check Notifications**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.notifications.find({ userId: ObjectId('<owner-user-id>') }).sort({ createdAt: -1 }).limit(10)
   "
   ```

2. **Check Finder Scan**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.finderscans.find({ tagId: '<tag-id>' }).sort({ createdAt: -1 }).limit(5)
   "
   ```

3. **Check Email/SMS Delivery**:
   ```bash
   # Check email provider logs (Resend/SMTP)
   # Check SMS provider logs (Twilio)
   mongosh "$MONGODB_URI" --eval "
     db.notifications.find({ userId: ObjectId('<owner-user-id>'), type: 'pet_found' })
   "
   ```

### Expected Output
- Notification exists with correct type
- If missing, check Finder notify route logs
- If exists but not delivered, check provider logs

---

## 6. Did a Finder Report Arrive?

### Question
Finder says they reported a found pet but owner hasn't been notified.

### Steps

1. **Check Finder Scans**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.finderscans.find({ tagId: '<tag-id>' }).sort({ createdAt: -1 }).limit(10)
   "
   ```

2. **Check Escalation Records**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.escalationrecords.find({ petId: ObjectId('<pet-id>') }).sort({ createdAt: -1 })
   "
   ```

3. **Check Pet Status**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.pets.findOne({ _id: ObjectId('<pet-id>') }).projection({ name: 1, status: 1, lostMode: 1 })
   "
   ```

### Expected Output
- Finder scan exists with action 'notified_owner'
- Pet status is 'lost' (not 'found' — owner confirms recovery)
- If missing, check Finder route logs

---

## 7. Is a Refund Complete?

### Question
Customer requested a refund but hasn't received it.

### Steps

1. **Check Order Refund Status**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.orders.findOne({ orderNumber: 'PT-2026-001' }).projection({ 
       refundStatus: 1, 
       refundAmount: 1, 
       refundId: 1,
       status: 1
     })
   "
   ```

2. **Check Payment Transactions**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.paymenttransactions.find({ orderId: ObjectId('<order-id>') }).sort({ createdAt: -1 })
   "
   ```

3. **Check Stripe Refund**:
   - Log in to Stripe Dashboard
   - Search by refund ID or PaymentIntent ID
   - Verify refund status (pending, succeeded, failed)

4. **Check Refund Reconciliation**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     // Check refund retry queue
     db.orders.find({ 'refund.status': 'failed' }).sort({ createdAt: -1 })
   "
   ```

### Expected Output
- Order shows refund status
- Stripe shows matching refund
- If pending, check refund reconciliation job

---

## 8. Is a Job Stuck?

### Question
Background job seems to not be running or processing items.

### Steps

1. **Check Worker Process**:
   ```bash
   # Docker
   docker-compose ps worker
   docker-compose logs worker --tail=50
   
   # PM2
   pm2 status
   pm2 logs pawtag-worker
   ```

2. **Check Job Locks**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     db.job_locks.find()
   "
   ```

3. **Check Job Logs**:
   ```bash
   # Check recent job execution logs
   mongosh "$MONGODB_URI" --eval "
     db.systemlogs.find({ source: 'job' }).sort({ createdAt: -1 }).limit(20)
   "
   ```

4. **Check for Failed Jobs**:
   ```bash
   mongosh "$MONGODB_URI" --eval "
     // Webhook retry queue
     db.webhookevents.find({ status: { $in: ['failed', 'dead'] } }).sort({ createdAt: -1 })
     
     // Orphan payments
     db.pendingorders.find({ status: 'pending', createdAt: { $lt: new Date(Date.now() - 24*60*60*1000) } })
   "
   ```

### Expected Output
- Worker process is running
- Job locks show recent activity
- No jobs stuck in failed state
- If stuck, restart worker: `docker-compose restart worker`

---

## Quick Reference Commands

### Health Check
```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/health/ready
```

### Check User
```bash
mongosh "$MONGODB_URI" --eval "db.users.findOne({ email: '<email>' })"
```

### Check Order
```bash
mongosh "$MONGODB_URI" --eval "db.orders.findOne({ orderNumber: '<order-number>' })"
```

### Check Pet
```bash
mongosh "$MONGODB_URI" --eval "db.pets.findOne({ name: '<pet-name>' })"
```

### Check Tag
```bash
mongosh "$MONGODB_URI" --eval "db.tags.findOne({ tagId: '<tag-id>' })"
```

### Check Notifications
```bash
mongosh "$MONGODB_URI" --eval "db.notifications.find({ userId: ObjectId('<user-id>') }).sort({ createdAt: -1 }).limit(10)"
```

### Check Job Status
```bash
mongosh "$MONGODB_URI" --eval "db.job_locks.find()"
```

---

## Important Notes

1. **Always use MongoDB queries directly** — The admin UI may not have all the data
2. **Check timestamps** — Verify when events occurred
3. **Check relationships** — Ensure foreign keys are intact
4. **Document everything** — Record what you found and what you did
5. **Escalate if unsure** — If you can't determine the issue, escalate to technical team

---

## Related Documents

- `docs/ACTIONABLE-ALERTS.md` — Alert configuration
- `docs/JOB-ERROR-POLICY.md` — Background job error handling
- `docs/CORRELATION-IDS.md` — Correlation ID requirements
- `docs/disaster-recovery.md` — Disaster recovery procedures
- `docs/ROLLBACK-PROCEDURE.md` — Rollback procedures
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
