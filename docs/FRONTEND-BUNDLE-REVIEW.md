# Frontend Bundle and Route Loading

> Measure Vite bundles and optimize route loading.
> Finder should remain especially lean.
>
> Last updated: 2026-09-19

## Purpose

Ensure frontend applications load quickly, especially the Finder which must work on mobile networks with poor signal.

## Bundle Size Targets

### Finder

| Metric | Target | Maximum |
|---|---|---|
| Total bundle | < 100KB | 150KB |
| JavaScript | < 80KB gzip | 120KB gzip |
| CSS | < 20KB gzip | 30KB gzip |
| First paint | < 1s | 2s |

### Customer Web

| Metric | Target | Maximum |
|---|---|---|
| Total bundle | < 300KB | 500KB |
| JavaScript | < 250KB gzip | 400KB gzip |
| CSS | < 50KB gzip | 80KB gzip |
| First paint | < 1.5s | 3s |

### Admin

| Metric | Target | Maximum |
|---|---|---|
| Total bundle | < 400KB | 600KB |
| JavaScript | < 350KB gzip | 500KB gzip |
| CSS | < 50KB gzip | 80KB gzip |
| First paint | < 2s | 4s |

---

## Measurement

### Build Analysis

```bash
# Analyze Vite build
cd apps/web
pnpm build

# Check dist size
du -sh dist/
du -sh dist/assets/
```

### Lighthouse

```bash
# Run Lighthouse
npx lighthouse http://localhost:3003 --output html --output-path ./lighthouse.html
```

---

## Lazy Loading Strategy

### When to Lazy Load

- Heavy components (rich text editor, charts)
- Below-fold content
- Route-specific code
- Non-critical features (analytics, chat)

### When NOT to Lazy Load

- Critical path components
- Above-the-fold content
- Shared utilities
- Core UI components

### Implementation

```typescript
// Lazy load route
const Checkout = React.lazy(() => import('./pages/Checkout'));

// With Suspense
<Suspense fallback={<Skeleton />}>
  <Checkout />
</Suspense>
```

---

## Finder Optimization

The Finder must be especially lean:

### Critical Path

1. HTML shell
2. Critical CSS
3. Minimal JavaScript
4. Tag lookup
5. Pet info display

### Non-Critical (Lazy Load)

- Analytics
- Settings
- Font loading
- Non-essential images

### Optimization Checklist

- [ ] Remove unused dependencies
- [ ] Tree shake unused code
- [ ] Lazy load non-critical routes
- [ ] Inline critical CSS
- [ ] Compress assets (gzip/brotli)
- [ ] Cache static assets
- [ ] Optimize images (WebP, thumbnails)

---

## Route Splitting

### Customer Web Routes

| Route | Priority | Lazy Load |
|---|---|---|
| `/` (Home) | Critical | No |
| `/shop` | High | No |
| `/product/:id` | High | No |
| `/cart` | High | No |
| `/checkout` | High | Yes |
| `/account` | Medium | Yes |
| `/orders` | Medium | Yes |
| `/pets` | Medium | Yes |
| `/guardian` | Low | Yes |

### Admin Routes

| Route | Priority | Lazy Load |
|---|---|---|
| `/` (Dashboard) | Critical | No |
| `/orders` | High | No |
| `/customers` | High | Yes |
| `/products` | High | Yes |
| `/analytics` | Medium | Yes |
| `/settings` | Low | Yes |

---

## Code Splitting

### By Route

```typescript
// App.tsx
const Home = React.lazy(() => import('./pages/Home'));
const Shop = React.lazy(() => import('./pages/Shop'));
const Checkout = React.lazy(() => import('./pages/Checkout'));
```

### By Feature

```typescript
// Heavy feature
const Analytics = React.lazy(() => import('./features/Analytics'));
const CMS = React.lazy(() => import('./features/CMS'));
```

### By Vendor

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@pawtag/ui'],
        },
      },
    },
  },
});
```

---

## Image Optimization

### Formats

- WebP with JPEG fallback
- Responsive images with srcset
- Lazy loading for below-fold

### Sizes

- Thumbnail: 200x200px
- Medium: 400x400px
- Large: 800x800px
- Hero: 1200x600px

### Implementation

```html
<img
  src="image-400.webp"
  srcset="image-200.webp 200w, image-400.webp 400w, image-800.webp 800w"
  sizes="(max-width: 600px) 200px, (max-width: 1000px) 400px, 800px"
  loading="lazy"
  alt="Product image"
/>
```

---

## Monitoring

### Metrics to Track

1. **Bundle size** — Total, JS, CSS
2. **First Contentful Paint (FCP)** — Target < 1.5s
3. **Largest Contentful Paint (LCP)** — Target < 2.5s
4. **Time to Interactive (TTI)** — Target < 3s
5. **Total Blocking Time (TBT)** — Target < 200ms

### Tools

- Lighthouse
- WebPageTest
- Bundle analyzer
- Chrome DevTools Performance

---

## Related Documents

- `docs/FINDER-LATENCY-BUDGET.md` — Finder performance targets
- `docs/API-QUERY-REVIEW.md` — API query review
- `docs/MVP_IMPLEMENTATION_STATUS.md` — Current implementation status
