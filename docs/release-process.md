# Release Process

How to ship a new version of PawTag safely.

---

## Branch Strategy

```
main          ← production, auto-deploys to Render/Vercel
  └── develop ← staging, auto-deploys to staging
       └── feature/*  ← individual features
       └── fix/*      ← bug fixes
```

- `main` → production (protected, requires PR review)
- `develop` → staging (auto-deploys)
- `feature/*` → individual features, merge into `develop` first
- `fix/*` → bug fixes, merge into `develop` then `main`

---

## Release Checklist

### Before Merging to Main

1. **Tests pass**:
   ```bash
   pnpm test
   pnpm typecheck
   ```

2. **No secrets in code**:
   ```bash
   grep -r "sk_live_\|sk_test_\|password\|secret" packages/ apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".env"
   ```

3. **CHANGELOG updated** (if maintaining one)

4. **PR reviewed** by at least one other developer (or self-review carefully if solo)

### Deploying to Staging

1. Merge feature branch → `develop`
2. Vercel auto-deploys staging
3. Test on staging:
   - Login flows
   - Core business flows (purchase, activate, scan, notify)
   - Admin CRUD operations
   - Mobile app connectivity

### Deploying to Production

1. Merge `develop` → `main`
2. Render auto-deploys API
3. Vercel auto-deploys frontends
4. Verify post-deployment (see `docs/deployment/production.md`)
5. Monitor Sentry for new errors

### Mobile App Release

1. Update `apps/mobile/package.json` version (semver)
2. Run `eas build --profile production`
3. Test on physical device
4. Submit to App Store / Play Console
5. Wait for review (Apple: 24-48 hours, Google: hours to days)

---

## Hotfix Process

For critical production bugs:

1. Create `fix/*` branch from `main`
2. Make the fix
3. Test locally
4. Merge to `main` directly (skip staging for urgent fixes)
5. Verify deployment
6. Also merge to `develop` to keep branches in sync

---

## Version Numbering

- **Major** (1.0.0 → 2.0.0): Breaking changes (rare for this project)
- **Minor** (1.0.0 → 1.1.0): New features, non-breaking
- **Patch** (1.0.0 → 1.0.1): Bug fixes, security patches

Current version: tracked in `packages/api/package.json` and `apps/mobile/package.json`.
