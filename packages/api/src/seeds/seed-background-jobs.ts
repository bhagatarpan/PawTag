import { connectDatabase, BackgroundJob } from '@pawtag/db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const jobs = [
  {
    name: 'reminder-service',
    displayName: 'Reminder Service',
    description: 'Sends finder reminders for pets found 24+ hours ago and onboarding nudges for new users.',
    category: 'notification',
    intervalMs: 60 * 60 * 1000, // 1 hour
    lockName: 'reminder',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'services/reminder.service.ts',
    functionName: 'runReminderJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'subscription-service',
    displayName: 'Subscription Service',
    description: 'Manages subscription lifecycle: expiring subs, grace periods, auto-renewals, payment retries, tag expiry notifications.',
    category: 'financial',
    intervalMs: 60 * 60 * 1000, // 1 hour
    lockName: 'subscription',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'services/subscription.service.ts',
    functionName: 'runSubscriptionJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'escalation-service',
    displayName: 'Escalation Service',
    description: 'Notifies emergency contacts when pet owner does not respond to pet-found notification within configured time.',
    category: 'notification',
    intervalMs: 60 * 1000, // 1 minute
    lockName: 'escalation',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'services/escalation.service.ts',
    functionName: 'runEscalationJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'low-stock-check',
    displayName: 'Low Stock Check',
    description: 'Monitors product inventory levels and sends admin alerts when stock falls below threshold.',
    category: 'maintenance',
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    lockName: 'low-stock',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'jobs/lowStockCheck.ts',
    functionName: 'runLowStockJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'pet-milestones',
    displayName: 'Pet Milestones',
    description: 'Awards Guardian Points for pet birthdays and adoption anniversaries, sends congratulatory emails.',
    category: 'notification',
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    lockName: 'pet-milestones',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'jobs/pet-milestones.ts',
    functionName: 'runPetMilestonesJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'pawrewards',
    displayName: 'PawRewards',
    description: 'Allocates monthly PawRewards to eligible subscribers, expires old rewards, re-qualifies tiers annually.',
    category: 'financial',
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    lockName: 'pawrewards',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'jobs/pawrewards.ts',
    functionName: 'runPawRewardsJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'orphan-payment-detection',
    displayName: 'Orphan Payment Detection',
    description: 'Recovers payments where the order was not created due to network or processing failures.',
    category: 'financial',
    intervalMs: 60 * 1000, // 60 seconds
    lockName: 'orphan-payment',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'jobs/orphanPaymentDetection.ts',
    functionName: 'runOrphanPaymentJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'order-auto-cancel',
    displayName: 'Order Auto-Cancel',
    description: 'Automatically cancels unpaid orders after configurable timeout, releases reserved stock.',
    category: 'financial',
    intervalMs: 60 * 1000, // 60 seconds
    lockName: 'order-auto-cancel',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'jobs/orderAutoCancel.ts',
    functionName: 'runOrderAutoCancelJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'shipping-tracking-poll',
    displayName: 'Shipping Tracking Poll',
    description: 'Polls carrier APIs for tracking updates on active shipments, triggers delivery notifications.',
    category: 'maintenance',
    intervalMs: 5 * 60 * 1000, // 5 minutes
    lockName: 'shipping-tracking',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'jobs/shippingTrackingPoll.ts',
    functionName: 'runShippingTrackingJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'webhook-retry',
    displayName: 'Webhook Retry',
    description: 'Retries failed Stripe webhook events with exponential backoff, marks dead-letter events after max attempts.',
    category: 'financial',
    intervalMs: 60 * 1000, // 60 seconds
    lockName: 'webhook-retry',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'jobs/webhookRetry.ts',
    functionName: 'runWebhookRetryJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'payment-reconciliation',
    displayName: 'Payment Reconciliation',
    description: 'Compares local order payment state against Stripe actual state, logs mismatches for admin review.',
    category: 'reconciliation',
    intervalMs: 5 * 60 * 1000, // 5 minutes
    lockName: 'payment-reconciliation',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'jobs/paymentReconciliation.ts',
    functionName: 'runPaymentReconciliationJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'refund-reconciliation',
    displayName: 'Refund Reconciliation',
    description: 'Syncs refund status from Stripe, updates local records, processes failed refund retries.',
    category: 'reconciliation',
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    lockName: 'refund-reconciliation',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'jobs/refundReconciliation.ts',
    functionName: 'runRefundReconciliationJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'privacy-retention',
    displayName: 'Privacy Retention',
    description: 'Anonymizes finder contact info, GPS locations, IP addresses, and device info per data retention policy.',
    category: 'compliance',
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    lockName: 'privacy-retention',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'jobs/privacyRetention.ts',
    functionName: 'runPrivacyRetentionJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'audit-retention',
    displayName: 'Audit Retention',
    description: 'Enforces audit event retention policies: archives old events, deletes expired records per legal requirements.',
    category: 'compliance',
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    lockName: 'audit-retention',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'jobs/auditRetention.ts',
    functionName: 'runAuditRetentionJob',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  // ─── Membership Jobs ──────────────────────────────────────────
  {
    name: 'membership-expiry-check',
    displayName: 'Membership Expiry Check',
    description: 'Checks for expired memberships and deactivates them. Sends expiry notifications to customers.',
    category: 'financial',
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    lockName: 'membership-expiry',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'services/membership.service.ts',
    functionName: 'checkExpiredMemberships',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
  {
    name: 'membership-renewal-reminders',
    displayName: 'Membership Renewal Reminders',
    description: 'Sends renewal reminders to members before their membership expires (30 and 7 days before).',
    category: 'notification',
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    lockName: 'membership-renewal',
    lockLeaseMs: 120000,
    processTarget: 'worker',
    filePath: 'services/membership.service.ts',
    functionName: 'sendRenewalReminders',
    enabled: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  },
];

async function seedBackgroundJobs() {
  try {
    await connectDatabase();
    console.log('Connected to MongoDB');

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const jobData of jobs) {
      const existing = await BackgroundJob.findOne({ name: jobData.name });
      if (existing) {
        // Update config fields if they changed
        const updates: Record<string, any> = {};
        if (existing.displayName !== jobData.displayName) updates.displayName = jobData.displayName;
        if (existing.description !== jobData.description) updates.description = jobData.description;
        if (existing.category !== jobData.category) updates.category = jobData.category;
        if (existing.intervalMs !== jobData.intervalMs) updates.intervalMs = jobData.intervalMs;
        if (existing.lockName !== jobData.lockName) updates.lockName = jobData.lockName;
        if (existing.filePath !== jobData.filePath) updates.filePath = jobData.filePath;
        if (existing.functionName !== jobData.functionName) updates.functionName = jobData.functionName;

        if (Object.keys(updates).length > 0) {
          await BackgroundJob.updateOne({ _id: existing._id }, { $set: updates });
          updated++;
          console.log(`  ~ ${jobData.displayName} (${jobData.name}) — updated`);
        } else {
          skipped++;
        }
        continue;
      }

      await BackgroundJob.create(jobData);
      added++;
      console.log(`  + ${jobData.displayName} (${jobData.name})`);
    }

    console.log(`Background Jobs: ${added} added, ${updated} updated, ${skipped} unchanged`);
    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seedBackgroundJobs();
