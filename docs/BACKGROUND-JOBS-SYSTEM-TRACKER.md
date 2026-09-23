# Background Jobs Management System — Implementation Tracker

**Branch:** `feature/background-jobs-system`
**Created:** 2026-09-23
**Status:** In Progress

---

## Overview

Transform 14 background jobs from hardcoded `setInterval` timers into a DB-driven, admin-configurable, enterprise-grade job management system.

---

## PR Split

| PR | Scope | Status |
|---|---|---|
| PR1 | Model + Scheduler + Job Refactor + Locking | ⬜ Pending |
| PR2 | API Routes + Admin Portal UI | ⬜ Pending |
| PR3 | Notifications + Refund Persistence + History Purging | ⬜ Pending |

---

## PR1: Model, Scheduler, Job Refactor, Locking

### Phase 1: BackgroundJob Model
- [ ] `packages/db/src/models/BackgroundJob.ts` — Create model
- [ ] `packages/db/src/models/PendingRefundRetry.ts` — Create model

### Phase 2: Seed Data
- [ ] `packages/api/src/seeds/seed-background-jobs.ts` — Seed 14 jobs
- [ ] `packages/api/src/seeds/seed.ts` — Add job permissions

### Phase 3: Job Scheduler Service
- [ ] `packages/api/src/services/job-scheduler.service.ts` — Create scheduler

### Phase 4: Refactor Job Files (13 files)
- [ ] `services/reminder.service.ts` → `runReminderJob()` + lock
- [ ] `services/subscription.service.ts` → `runSubscriptionJob()` + lock
- [ ] `services/escalation.service.ts` → `runEscalationJob()` (has lock)
- [ ] `jobs/lowStockCheck.ts` → `runLowStockJob()` + lock
- [ ] `jobs/pet-milestones.ts` → `runPetMilestonesJob()` + lock
- [ ] `jobs/pawrewards.ts` → `runPawRewardsJob()` + lock
- [ ] `jobs/orphanPaymentDetection.ts` → `runOrphanPaymentJob()` + lock
- [ ] `jobs/orderAutoCancel.ts` → `runOrderAutoCancelJob()` (has lock)
- [ ] `jobs/shippingTrackingPoll.ts` → `runShippingTrackingJob()` (has lock)
- [ ] `jobs/webhookRetry.ts` → `runWebhookRetryJob()` (has lock)
- [ ] `jobs/paymentReconciliation.ts` → `runPaymentReconciliationJob()` (has lock)
- [ ] `jobs/refundReconciliation.ts` → `runRefundReconciliationJob()` (has lock)
- [ ] `jobs/privacyRetention.ts` → `runPrivacyRetentionJob()` + lock

### Phase 5: Audit Retention Job
- [ ] `packages/api/src/jobs/auditRetention.ts` — Create job

### Phase 6: Update Worker/API
- [ ] `packages/api/src/worker.ts` — Replace with scheduler
- [ ] `packages/api/src/index.ts` — Replace with scheduler

### Phase 7: Refund Retry Persistence
- [ ] `packages/api/src/commerce/services/refund-retry.service.ts` — Persist to MongoDB

### PR1 Verification
- [ ] `pnpm build`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test:unit`

---

## PR2: API Routes + Admin Portal UI

### Phase 8: API Routes
- [ ] `packages/api/src/routes/admin-background-jobs.ts` — Create routes
- [ ] `packages/shared/src/api/endpoints.ts` — Add endpoints
- [ ] `packages/api/src/index.ts` — Mount routes

### Phase 9: Admin Portal UI
- [ ] `apps/admin/src/pages/BackgroundJobs.tsx` — Create page
- [ ] `apps/admin/src/pages/BackgroundJobHistory.tsx` — Create history page
- [ ] `apps/admin/src/components/Sidebar.tsx` — Add menu item

### PR2 Verification
- [ ] `pnpm build:admin`
- [ ] `pnpm typecheck`

---

## PR3: Notifications + History Purging

### Phase 10: Notification System
- [ ] `packages/api/src/services/email/templates/job-notification.ts` — Email template
- [ ] `packages/api/src/services/job-notification.service.ts` — Notification service
- [ ] `packages/api/src/services/job-scheduler.service.ts` — Add notification calls

### Phase 11: History Purging
- [ ] `packages/api/src/routes/admin-background-jobs.ts` — Add purge endpoint
- [ ] `apps/admin/src/pages/BackgroundJobHistory.tsx` — Add purge UI

### PR3 Verification
- [ ] `pnpm build`
- [ ] `pnpm typecheck`

---

## Documentation Updates

- [ ] Update `AGENTS.md` — Background jobs section
- [ ] Update `README.md` — Background jobs architecture
- [ ] Update `docs/DESIGN.md` — No changes needed (no UI design changes)

---

## Commit Log

| Commit | Description | Branch |
|---|---|---|
| — | Pending | feature/background-jobs-system |
