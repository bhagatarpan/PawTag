# PawTag Email Communications Centre — Implementation Tracker

**Branch:** `feature/email-communications-centre`
**Started:** 2026-09-12
**Status:** In Progress

---

## Audit Summary

| Metric | Count |
|--------|-------|
| Total distinct email types | 36 |
| Structured template files | 23 |
| Inline HTML emails | 13 |
| CMS-overridable templates | 8 seeded, 16 supported |
| Dead/unused email functions | 4 |
| Email provider | Resend (v6.18.1) |
| Email audit/delivery tracking | None (to be created) |
| Email queue/retry | None (to be created) |
| Business flows discovered | 8 |

---

## Business Flow Categories

| # | Flow | Emails |
|---|------|--------|
| 1 | Account & Security | Verification, Welcome, Password Reset, Password Changed, Login Notification, MFA OTP, Account Status |
| 2 | Pet & Tag | Pet Found, Tag Expiry Reminders |
| 3 | Lost & Found | Pet Found, Emergency Escalation |
| 4 | Orders & Commerce | Order Confirmation, Invoice, Invoice OTP, Shipping, Order Status (6), Admin Alerts, Refunds (3), Low Stock |
| 5 | Subscriptions | Welcome, Expiry Reminders (3), Grace Period, Payment Failure, Payment Retry, Gold Welcome |
| 6 | Guardian & Loyalty | Welcome, Tier Upgrade, Tier Downgrade, Monthly Summary, PawRewards, Birthday, Anniversary, Renewal, Purchase Points |
| 7 | Referrals | Referral Reward |
| 8 | Admin / System | Support Request, Low Stock, Refund Alert, Cancellation Alert |

---

## Implementation Phases

### Phase 1: Foundation & Data Model (Backend)
- [ ] Create `EmailTemplate` model (enhanced CmsEmailTemplate with versioning, business flow, purpose, trigger, variables)
- [ ] Create `EmailTemplateVersion` model (immutable version snapshots)
- [ ] Create `EmailAudit` model (actual email send records)
- [ ] Add Resend webhook endpoint for delivery tracking
- [ ] Add email audit middleware (wrap sendMail)
- [ ] Register all 36 templates with metadata
- [ ] Seed template metadata
- [ ] Add RBAC permissions

### Phase 2: Admin Email Template Centre (Frontend)
- [ ] Restructure admin sidebar navigation
- [ ] Email Templates list page
- [ ] Email Template detail/edit page
- [ ] Variable schema panel
- [ ] Variable picker
- [ ] Variable validation
- [ ] Preview (desktop + mobile)
- [ ] Send test email
- [ ] Version history

### Phase 3: Email Audit Library (Frontend + Backend)
- [ ] Email Audit list page
- [ ] Email Audit detail page
- [ ] Actual rendered email preview
- [ ] Variable snapshot display
- [ ] Delivery timeline
- [ ] Technical details panel
- [ ] Related business records
- [ ] Email Audit dashboard metrics

### Phase 4: Migration & Cleanup
- [ ] Migrate inline HTML emails to template system
- [ ] Remove 4 dead email functions
- [ ] Fix duplicate checkout email paths
- [ ] Wire up pet-milestones to template system
- [ ] Update AGENTS.md
- [ ] Update DESIGN.md
- [ ] Update README.md

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
