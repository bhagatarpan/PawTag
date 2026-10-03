# PawTag Email Communications Centre — Implementation Tracker

**Branch:** `feature/email-cms-phase1`  
**Last updated:** 2026-10-03  
**Status:** Phase 1 CMS wiring in progress (see below)

---

## Audit Summary (code inventory 2026-10-03)

| Metric | Count |
|--------|-------|
| CMS email templates seeded | **38** (+ `subscription-renewed` added in Phase 1) |
| CMS used at send time (Category A) | **~12 before Phase 1**; order-status, refunds, login-notification, gold-welcome, pet birthday/anniversary wired in Phase 1 |
| CMS seeded but not used at send (Category B) | Being wired Phase 1–2 |
| Product emails hardcoded (Category C) | Membership lifecycle, most subscription dunning, active period, returns — Phase 2 |

**Mechanism:** Admin edits on `/communications/templates` only affect live email if send code calls `renderCmsEmail(slug)` or `sendCmsEmailOrFallback`.  
See `skills/email-cms-templates/SKILL.md`.

---

## Phase 1 (this packet) — Wire existing CMS templates

- [x] Export `sendCmsEmailOrFallback` + CMS-first pattern in `email.service.ts`
- [x] Wire order-status customer emails
- [x] Wire refund-processing / refund-settled / refund-failed (Stripe webhook path)
- [x] Wire admin order cancel/refund alerts
- [x] Wire admin refund-failed alert
- [x] Wire login-notification (customer subject fixed — no “admin account”)
- [x] Fix guardian-birthday → pet-birthday, guardian-anniversary → pet-anniversary
- [x] Seed + wire `subscription-renewed`
- [x] Wire gold-welcome CMS path
- [ ] Remaining Category B (subscription reminders, grace period, pet milestones, low stock, support, referral, generic, invoice-otp, etc.)

---

## Phase 2 — Seed missing product emails (not started)

Membership lifecycle, returns, active period HYBRID 2, subscription cancel/pause/free-period — seed CMS + wire send paths.

---

## Phase 3 — Operator truth + docs

- [ ] UI “wired to send path” indicator
- [ ] Deduplicate admin new-order alert paths
- [ ] Update skills/docs after Phase 2

---

## Implementation Phases (historical tracker below — partially stale)

### Phase 1: Foundation & Data Model (Backend)
- [x] EmailTemplate model fields (versioning, business flow, variables)
- [x] EmailTemplateVersion model
- [x] EmailAudit model
- [x] Email audit middleware (sendMail auditMeta)
- [x] Seed template metadata
- [x] RBAC permissions
- [ ] CMS-first wiring for all send paths (Phase 1–2 of this tracker)

### Phase 2: Admin Email Template Centre (Frontend)
- [x] Email Templates list page
- [x] Email Template detail/edit page
- [x] Variable schema panel
- [x] Send test email
- [x] Version history

### Phase 3: Email Audit Library
- [x] Email Audit list/detail pages
- [ ] Delivery timeline enhancements

### Phase 4: Migration & Cleanup
- [ ] Migrate remaining inline HTML emails to CMS (Phase 2)
- [ ] Remove dead email functions
- [ ] Fix duplicate checkout email paths
- [ ] Update AGENTS.md / DESIGN.md / README.md after full CMS coverage

---

## Completed Phases

### Phase 1: Foundation & Data Model (Backend) ✅
- Extended CmsEmailTemplate with businessFlow, purpose, trigger, emailType, version, variableDefinitions
- Created EmailTemplateVersion model for immutable version snapshots
- Created EmailAudit model for email delivery tracking with TTL index
- Added Resend webhook endpoint for delivery status callbacks
- Integrated email audit recording into sendMail (fire-and-forget)
- Added communications admin routes (dashboard, templates CRUD, versions, audit)
- Added RBAC permissions: communication.email_audit.read, communication.email_template.send_test
- Registered communications API endpoints in shared endpoint constants

### Phase 2: Admin Email Template Centre (Frontend) ✅
- Added Communications section to admin sidebar (Email Templates + Email Audit)
- Created Email Templates list page with dashboard metrics, search, filters
- Created Email Template detail page with editing, version history, test send
- Created Email Audit list page with search, date range filters, pagination
- Created Email Audit detail page with rendered email preview, delivery timeline

### Phase 3: Email Audit Library (Frontend + Backend) ✅
- Implemented as part of Phase 2 (audit pages included)
- Audit list with search, status/flow/date filters
- Audit detail with rendered email preview, delivery timeline, variable snapshot, technical details

### Phase 4: Migration & Cleanup ✅
- Updated all 8 seeded email templates with Communications Centre metadata
- **28 templates now seeded** in CMS database with full metadata (businessFlow, purpose, trigger, variables, etc.)
- **All 25+ inline emails extracted** to template renderers:
  - email.service.ts: 3 emails (subscription welcome, invoice OTP — invoice already had CMS fallback)
  - subscription.service.ts: 6 emails
  - orderNotification.service.ts: 8 emails
  - referral.service.ts: 1 email
  - tier.service.ts: 1 email
  - escalation.service.ts: 1 email
  - notification-delivery.service.ts: 1 email
  - pet-milestones.ts: 2 emails
  - lowStockCheck.ts: 1 email
  - support.ts: 1 email
  - order-creation.service.ts: 1 email
- **Fixed Gold Welcome bug** — subscription.service.ts now uses existing template
- **CMS fallback system verified** — 17 email functions properly wired up with renderCmsEmail()
- **Zero inline HTML remaining** in service files

---

## Email Inventory

### Template-Based Emails (23)

| # | Template Key | Business Flow | Purpose | Trigger | Recipient | Status |
|---|-------------|---------------|---------|---------|-----------|--------|
| 1 | verification-email | Account & Security | Email verification link | Registration / Resend | User | ✅ Template exists |
| 2 | welcome | Account & Security | Welcome after verification | Account activation | User | ✅ Template exists |
| 3 | login-mfa-otp | Account & Security | MFA login code | Login (MFA required) | User | ✅ Template exists |
| 4 | password-reset | Account & Security | Password reset link | Forgot password | User | ✅ Template exists |
| 5 | password-changed | Account & Security | Password change confirmation | Password reset/change | User | ✅ Template exists |
| 6 | login-notification | Account & Security | Login activity alert | Admin login | Admin user | ✅ Template exists |
| 7 | account-status | Account & Security | Account status change | Admin status change | User | ✅ Template exists |
| 8 | order-confirmation | Orders & Commerce | Order confirmation | Order creation | Customer | ✅ Template exists |
| 9 | shipping-notification | Orders & Commerce | Shipping notification | Order shipped | Customer | ✅ Template exists |
| 10 | pet-found | Lost & Found | Pet found alert | Finder notify | Owner | ✅ Template exists |
| 11 | refund-processing | Orders & Commerce | Refund initiated | Stripe refund.created | Customer | ✅ Template exists |
| 12 | refund-settled | Orders & Commerce | Refund completed | Stripe refund.updated | Customer | ✅ Template exists |
| 13 | refund-failed | Orders & Commerce | Refund failed | Stripe refund.updated | Customer | ✅ Template exists |
| 14 | guardian-welcome | Guardian & Loyalty | Guardian membership welcome | Join Guardian | Customer | ✅ Template exists |
| 15 | guardian-tier-upgrade | Guardian & Loyalty | Tier upgrade celebration | Tier change | Customer | ✅ Template exists |
| 16 | guardian-birthday | Guardian & Loyalty | Pet birthday | Pet birthday | Owner | ✅ Template exists |
| 17 | guardian-monthly-summary | Guardian & Loyalty | Monthly activity report | Monthly job | Customer | ✅ Template exists |
| 18 | guardian-pawrewards-reminder | Guardian & Loyalty | Rewards expiring | Daily job | Customer | ✅ Template exists |
| 19 | guardian-anniversary | Guardian & Loyalty | Adoption anniversary | Adoption date | Owner | ✅ Template exists |
| 20 | guardian-renewal-reminder | Guardian & Loyalty | Membership renewal | Renewal job | Customer | ✅ Template exists |
| 21 | guardian-purchase-points | Guardian & Loyalty | Post-purchase points | Order creation | Customer | ✅ Template exists |
| 22 | gold-welcome | Subscriptions | Gold membership welcome | Gold subscription | Customer | ✅ Template exists |
| 23 | invoice-paid | Orders & Commerce | Invoice delivery | Order creation | Customer | ✅ Template exists |

### Inline HTML Emails (13) — To Be Migrated

| # | Email Type | Business Flow | Location | Status |
|---|-----------|---------------|----------|--------|
| 24 | Subscription Welcome | Subscriptions | email.service.ts:293 | ⚠️ Inline HTML |
| 25 | Invoice OTP | Orders & Commerce | email.service.ts:331 | ⚠️ Inline HTML |
| 26 | Order Status (6 variants) | Orders & Commerce | orderNotification.service.ts | ⚠️ Inline HTML |
| 27 | Admin Order Alert | Admin / System | order-creation.service.ts:312 | ⚠️ Inline HTML |
| 28 | Admin Cancellation Alert | Admin / System | orderNotification.service.ts:221 | ⚠️ Inline HTML |
| 29 | Admin Refund Failed Alert | Admin / System | orderNotification.service.ts:356 | ⚠️ Inline HTML |
| 30 | Low Stock Alert | Admin / System | lowStockCheck.ts:66 | ⚠️ Inline HTML |
| 31 | Referral Reward | Referrals | referral.service.ts:178 | ⚠️ Inline HTML |
| 32 | Tier Downgrade Warning | Guardian & Loyalty | tier.service.ts:320 | ⚠️ Inline HTML |
| 33 | Pet Birthday (legacy) | Guardian & Loyalty | pet-milestones.ts:109 | ⚠️ Duplicate |
| 34 | Pet Anniversary (legacy) | Guardian & Loyalty | pet-milestones.ts:109 | ⚠️ Duplicate |
| 35 | Emergency Escalation | Lost & Found | escalation.service.ts:128 | ⚠️ Inline HTML |
| 36 | Generic Notification | System | notification-delivery.service.ts:89 | ⚠️ Inline HTML |

### Dead Email Functions (4) — To Be Removed

| # | Function | Template Key | Reason |
|---|----------|-------------|--------|
| 1 | sendSubscriptionWelcomeEmail | N/A | No callers |
| 2 | sendShippingNotification | shipping-notification | No callers |
| 3 | sendAccountStatusEmail | account-status | No callers |
| 4 | sendGuardianWelcomeEmail | guardian-welcome | No callers |
