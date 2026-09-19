# API Query Review of Critical Endpoints

> Use query logging/profiling on critical endpoints to identify performance issues.
>
> Last updated: 2026-09-19

## Purpose

Review critical API endpoints for query performance issues that could affect user experience, especially for the Finder application.

## Critical Endpoints to Review

### 1. Finder Lookup

**Route:** `GET /api/finder/:tagId`

**Current Query:**
```typescript
// Find pet by tag ID
const pet = await Pet.findOne({ tagId }).populate('ownerId');
```

**Review Checklist:**
- [ ] Index on `tagId` field
- [ ] Minimal populate (only required fields)
- [ ] No unnecessary subdocuments loaded
- [ ] Response time < 500ms

**Optimizations:**
- Add compound index: `{ tagId: 1, status: 1 }`
- Use `.select()` to project only needed fields
- Consider lean() for read-only queries

---

### 2. Customer Dashboard

**Route:** `GET /api/customer/dashboard`

**Review Checklist:**
- [ ] No N+1 queries for pets/orders
- [ ] Pagination for large collections
- [ ] Minimal data returned
- [ ] Response time < 1s

**Common Issues:**
- Loading all pets without pagination
- Populating full user document
- Running multiple sequential queries

---

### 3. Pets List/Detail

**Routes:**
- `GET /api/customer/pets`
- `GET /api/customer/pets/:id`

**Review Checklist:**
- [ ] Pagination for list endpoint
- [ ] Index on `userId` field
- [ ] Minimal fields returned
- [ ] No unnecessary populate

**Optimizations:**
- Use cursor-based pagination for large lists
- Project only required fields
- Add index: `{ userId: 1, createdAt: -1 }`

---

### 4. Cart

**Routes:**
- `GET /api/cart`
- `POST /api/cart/items`
- `PUT /api/cart/items/:id`

**Review Checklist:**
- [ ] Efficient item lookup
- [ ] Stock validation query is fast
- [ ] No full product documents loaded unnecessarily
- [ ] Response time < 200ms

**Optimizations:**
- Index on `userId` for cart lookup
- Project only required product fields
- Cache product prices (validate server-side but don't re-fetch every time)

---

### 5. Checkout

**Route:** `POST /api/checkout/confirm`

**Review Checklist:**
- [ ] Payment verification is efficient
- [ ] Order creation is atomic
- [ ] Inventory update is fast
- [ ] No unnecessary queries in sequence
- [ ] Response time < 2s

**Critical Path:**
1. Validate cart
2. Verify payment with Stripe
3. Create order
4. Update inventory
5. Clear cart

**Optimizations:**
- Use database transactions for multi-document writes
- Minimize Stripe API calls
- Batch inventory updates

---

### 6. Orders List/Detail

**Routes:**
- `GET /api/customer/orders`
- `GET /api/customer/orders/:id`

**Review Checklist:**
- [ ] Pagination for list endpoint
- [ ] Index on `userId` and `createdAt`
- [ ] Minimal fields returned
- [ ] No N+1 queries for order items

**Optimizations:**
- Cursor-based pagination
- Index: `{ userId: 1, createdAt: -1 }`
- Project only required fields

---

### 7. Admin Order/Customer Search

**Routes:**
- `GET /api/admin/orders`
- `GET /api/admin/users`

**Review Checklist:**
- [ ] Search queries are indexed
- [ ] Pagination is enforced
- [ ] No unbounded result sets
- [ ] Response time < 1s

**Optimizations:**
- Index on searchable fields (email, orderNumber)
- Enforce pagination limits
- Use text indexes for full-text search

---

## Common Performance Issues

### 1. N+1 Queries

**Problem:** Loading a list of items, then making a separate query for each item's related data.

**Example:**
```typescript
// Bad: N+1 query
const orders = await Order.find({ userId });
for (const order of orders) {
  order.items = await OrderItem.find({ orderId: order._id }); // N queries
}

// Good: Single query with populate
const orders = await Order.find({ userId }).populate('items');
```

### 2. Unnecessary Population

**Problem:** Loading full related documents when only a few fields are needed.

**Example:**
```typescript
// Bad: Full population
const pet = await Pet.findById(id).populate('ownerId');

// Good: Selective population
const pet = await Pet.findById(id).populate('ownerId', 'fullName email');
```

### 3. Unbounded Result Sets

**Problem:** Returning all matching documents without pagination.

**Example:**
```typescript
// Bad: No limit
const orders = await Order.find({ userId });

// Good: With pagination
const orders = await Order.find({ userId })
  .sort({ createdAt: -1 })
  .skip(page * limit)
  .limit(limit);
```

### 4. Missing Indexes

**Problem:** Queries scanning full collection instead of using indexes.

**Check:**
```javascript
// Check if query uses index
db.orders.find({ userId: '123' }).explain('executionStats');
```

### 5. Returning Full Documents

**Problem:** Returning all fields when only a subset is needed.

**Example:**
```typescript
// Bad: All fields
const user = await User.findById(id);

// Good: Selective fields
const user = await User.findById(id).select('fullName email role');
```

---

## Index Strategy

### Current Indexes

Review and document existing indexes:

```javascript
// Check indexes for a collection
db.orders.getIndexes()
db.pets.getIndexes()
db.tags.getIndexes()
```

### Recommended Indexes

| Collection | Index | Reason |
|---|---|---|
| `pets` | `{ tagId: 1, status: 1 }` | Finder lookup |
| `pets` | `{ userId: 1, createdAt: -1 }` | User's pets list |
| `orders` | `{ userId: 1, createdAt: -1 }` | User's orders list |
| `orders` | `{ orderNumber: 1 }` | Order lookup |
| `carts` | `{ userId: 1 }` | Cart lookup |
| `tags` | `{ tagId: 1 }` | Tag lookup |

### Adding Indexes

```javascript
// Add index
db.pets.createIndex({ tagId: 1, status: 1 })

// Add unique index
db.orders.createIndex({ orderNumber: 1 }, { unique: true })
```

---

## Query Logging

### Enable Query Logging

```typescript
// In development
mongoose.set('debug', true);

// In production (use middleware)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 100) {
      logger.warn({ path: req.path, duration }, 'Slow request');
    }
  });
  next();
});
```

### Slow Query Threshold

- Development: Log all queries
- Staging: Log queries > 100ms
- Production: Log queries > 200ms, alert on > 1s

---

## Monitoring

### Metrics to Track

1. **Query duration** — p50, p95, p99
2. **Query count per request** — Identify N+1 issues
3. **Index usage** — Ensure indexes are being used
4. **Connection pool** — Monitor active connections

### Tools

- MongoDB Atlas Performance Advisor
- Mongoose query logging
- Custom middleware for request timing

---

## Related Documents

- `docs/FINDER-LATENCY-BUDGET.md` — Finder performance targets
- `docs/OPERATIONS-RUNBOOK.md` — Operations runbook
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
