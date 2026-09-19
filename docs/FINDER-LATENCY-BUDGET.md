# Finder Latency Budget

> Target a fast initial useful render for the Finder application.
> The Finder must work for a stressed stranger on a phone with poor signal.
>
> Last updated: 2026-09-19

## Purpose

The Finder is the most critical user-facing application. A finder may be:
- Stressed
- On a phone
- In poor signal
- In a hurry
- Has never seen PawTag before

The goal is to show pet information as fast as possible so the finder can help.

---

## Latency Targets

### Total Budget

| Phase | Target | Maximum |
|---|---|---|
| HTML/JS Load | < 1s | 2s |
| Tag Lookup | < 500ms | 1s |
| DB Query | < 100ms | 200ms |
| Image Load | < 1s | 2s |
| Geo Lookup | < 500ms | 1s |
| **Total Initial Render** | **< 2.5s** | **5s** |

### Breakdown

#### 1. HTML/JS Load (< 1s target)

- Static assets served via CDN/Nginx
- Minimal JavaScript bundle
- Lazy-load non-critical components
- Inline critical CSS

**Optimizations:**
- Code splitting for routes
- Tree shaking unused code
- Compress assets (gzip/brotli)
- Cache static assets aggressively

#### 2. Tag Lookup (< 500ms target)

- MongoDB index on `tagId`
- Minimal document projection
- No unnecessary populate/join

**Optimizations:**
- Compound index: `{ tagId: 1, status: 1 }`
- Project only required fields
- Consider read replica for high traffic

#### 3. DB Query (< 100ms target)

- Efficient query patterns
- Proper indexing
- Connection pooling

**Optimizations:**
- Avoid N+1 queries
- Use lean() for read-only queries
- Monitor slow queries

#### 4. Image Load (< 1s target)

- Optimized images for mobile
- Responsive images
- Lazy loading

**Optimizations:**
- WebP format with fallback
- Thumbnail generation
- CDN caching
- `loading="lazy"` for below-fold images

#### 5. Geo Lookup (< 500ms target)

- Optional, not blocking
- Graceful degradation
- Cached results

**Optimizations:**
- Cache geo results by IP
- Non-blocking fetch
- Show pet info immediately, update location later

---

## Measurement Points

### Frontend Metrics

```javascript
// Performance API measurements
const timing = performance.getEntriesByType('navigation')[0];

// Key metrics
const metrics = {
  dns: timing.domainLookupEnd - timing.domainLookupStart,
  tcp: timing.connectEnd - timing.connectStart,
  ttfb: timing.responseStart - timing.requestStart,
  domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
  load: timing.loadEventEnd - timing.navigationStart,
};
```

### Backend Metrics

```typescript
// Express middleware timing
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({ path: req.path, duration }, 'Request completed');
  });
  next();
});
```

### Database Metrics

```typescript
// Mongoose query timing
schema.pre('find', function() {
  this._startTime = Date.now();
});

schema.post('find', function() {
  const duration = Date.now() - this._startTime;
  if (duration > 100) {
    logger.warn({ duration, query: this.getQuery() }, 'Slow query');
  }
});
```

---

## Critical Path

The Finder critical path is:

```
1. User scans QR/NFC tag
   ↓
2. Browser loads Finder app (HTML/JS)
   ↓
3. Tag ID extracted from URL
   ↓
4. API call: GET /api/finder/:tagId
   ↓
5. MongoDB query: Find pet by tagId
   ↓
6. Response: Pet info + owner contact
   ↓
7. UI renders pet information
   ↓
8. Finder decides to notify owner
```

**Total target: < 2.5 seconds from scan to pet info displayed**

---

## Non-Blocking Operations

These should NOT block the initial render:

- Analytics/tracking
- Settings fetch
- Font loading
- Non-critical images
- Geolocation

**Rule:** Show pet information immediately, update secondary data async.

---

## Mobile Network Considerations

- 3G: ~1.5 Mbps, 200ms latency
- 4G: ~10 Mbps, 50ms latency
- WiFi: ~30 Mbps, 20ms latency

**Design for 3G:**
- Total page weight < 500KB
- Critical CSS inline
- JavaScript < 200KB gzipped
- Images < 300KB total

---

## Monitoring

### Production Metrics

Track these in production:

1. **Time to First Byte (TTFB)** — Target < 200ms
2. **First Contentful Paint (FCP)** — Target < 1.5s
3. **Largest Contentful Paint (LCP)** — Target < 2.5s
4. **Time to Interactive (TTI)** — Target < 3s
5. **Tag lookup duration** — Target < 500ms
6. **Image load time** — Target < 1s

### Alerting

Alert when:
- TTFB > 500ms
- FCP > 2s
- LCP > 4s
- Tag lookup > 2s

---

## Related Documents

- `docs/ACTIONABLE-ALERTS.md` — Alert configuration
- `docs/OPERATIONS-RUNBOOK.md` — Operations runbook
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
