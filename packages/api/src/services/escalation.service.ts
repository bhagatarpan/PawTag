import { EscalationRecord, User, Notification, Setting } from '@pawtag/db';
import { sendMail } from './email.service';
import { renderEmergencyEscalationEmail } from './email/templates';
import { sendPushToUser } from './push-notification.service';
import logger from '../lib/logger';
import { logJob } from '../lib/timing';
import { createClaimedJob, generateWorkerId } from '../lib/job-claim';
import type { JobResult } from './job-scheduler.service';

const POLL_INTERVAL_MS = 60_000; // Check every minute
let pollingTimer: ReturnType<typeof setInterval> | null = null;
const workerId = generateWorkerId();

/**
 * Wrapped version of processOverdueEscalations with claiming.
 */
const claimedProcessOverdueEscalations = createClaimedJob(
  'escalation',
  workerId,
  async () => {
    await processOverdueEscalations();
  }
);

/**
 * Start the escalation polling service.
 * Checks for overdue escalations every minute and notifies emergency contacts.
 */
export function startEscalationService(): void {
  if (pollingTimer) return;

  logger.info('[Escalation] Starting escalation polling service');
  pollingTimer = setInterval(claimedProcessOverdueEscalations, POLL_INTERVAL_MS);
}

/**
 * Stop the escalation polling service.
 */
export function stopEscalationService(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    logger.info('[Escalation] Stopped escalation polling service');
  }
}

/**
 * Run the escalation job. Called by the job scheduler.
 */
export async function runEscalationJob(): Promise<JobResult> {
  try {
    await processOverdueEscalations();
    return { success: true };
  } catch (error: any) {
    logger.error({ err: error }, '[Escalation] Job error');
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Process all overdue escalation records.
 */
async function processOverdueEscalations(): Promise<void> {
  try {
    const now = new Date();

    // Check if escalation is enabled
    const enabledSetting = await Setting.findOne({ key: 'escalation.notifyEmergencyContact' });
    if (enabledSetting?.value === 'false') return;

    // Stage 2: Find overdue records pending emergency contact notification
    const stage2Records = await EscalationRecord.find({
      status: 'pending',
      stage: 'owner_notified',
      escalationDeadline: { $lte: now },
      escalatedAt: { $exists: false },
    }).populate('ownerId', 'fullName email emergencyContact')
      .populate('petId', 'name petId')
      .populate('tagId', 'tagId');

    // Stage 3: Find records where emergency contact was notified but PawTag team not yet notified
    const stage3Records = await EscalationRecord.find({
      status: 'escalated',
      stage: 'emergency_contact_notified',
      emergencyContactEscalatedAt: { $lte: new Date(now.getTime() - 30 * 60 * 1000) }, // 30 mins after EC notified
      pawtagTeamNotifiedAt: { $exists: false },
    }).populate('ownerId', 'fullName email emergencyContact phoneNumber address')
      .populate('petId', 'name petId species breed color photos medicalAlerts')
      .populate('tagId', 'tagId');

    const totalRecords = stage2Records.length + stage3Records.length;
    if (totalRecords === 0) return;

    await logJob('escalation-check', async () => {
      logger.info({ stage2Count: stage2Records.length, stage3Count: stage3Records.length }, 'Processing escalation records');

      // Process Stage 2 records (Owner → Emergency Contact)
      for (const record of stage2Records) {
        await processStage2Escalation(record);
      }

      // Process Stage 3 records (Emergency Contact → PawTag Team)
      for (const record of stage3Records) {
        await processStage3Escalation(record);
      }
    }, { overdueCount: totalRecords });
  } catch (err) {
    logger.error({ err }, '[Escalation] Error processing overdue escalations');
  }
}

/**
 * Process a single escalation record - Stage 2 (Owner → Emergency Contact).
 */
async function processStage2Escalation(record: any): Promise<void> {
  try {
    const owner = record.ownerId as any;
    const pet = record.petId as any;
    const tag = record.tagId as any;

    if (!owner?.emergencyContact?.name || !owner?.emergencyContact?.phone) {
      logger.info({ ownerId: owner?._id }, '[Escalation] No emergency contact for owner, skipping');
      // Mark as escalated but note no emergency contact
      await EscalationRecord.findByIdAndUpdate(record._id, {
        status: 'escalated',
        escalatedAt: new Date(),
        notes: 'No emergency contact configured',
      });
      return;
    }

    // Check owner's emergency contact entitlement from registry
    try {
      const { membershipEntitlementService } = await import('./membership-entitlement.service');
      const hasEmergencyContact = await membershipEntitlementService.hasAccess(owner._id, 'emergency_contact');

      if (!hasEmergencyContact) {
        logger.info({ ownerId: owner._id }, '[Escalation] Owner lacks emergency_contact entitlement - emergency contact not notified');
        await EscalationRecord.findByIdAndUpdate(record._id, {
          status: 'escalated',
          escalatedAt: new Date(),
          notes: 'Owner lacks emergency_contact entitlement - emergency contact not notified per entitlement rules',
        });

        // Notify owner that escalation requires upgrade
        try {
          await Notification.create({
            userId: owner._id,
            type: 'escalation_requires_upgrade',
            title: 'Emergency Contact Escalation',
            message: 'Your pet was found but your emergency contact could not be notified. Upgrade your membership to enable emergency contact escalation.',
            priority: 'high',
            actionUrl: '/membership',
          });
        } catch (notifErr) {
          logger.error({ err: notifErr }, '[Escalation] Failed to send upgrade notification');
        }

        return;
      }
    } catch (tierErr) {
      // If tier check fails, proceed with escalation (fail open for safety)
      logger.error({ err: tierErr }, '[Escalation] Failed to check owner tier, proceeding with escalation');
    }

    const ec = owner.emergencyContact;
    const petName = pet?.name || 'your pet';
    const ownerName = owner.fullName || 'the owner';

    // Try to find if emergency contact is a registered user
    const ecUser = await User.findOne({
      $or: [
        { email: ec.email },
        { phoneNumber: ec.phone },
      ],
      deletedAt: null, // Find ACTIVE users only (not deleted)
    }).select('_id fullName email');

    // Send in-app notification if EC is a registered user (isolated — must not block email)
    if (ecUser) {
      const notifTitle = `Emergency Contact: ${ownerName}'s pet ${petName} needs attention`;
      const notifMessage = `${ownerName} has not responded to a pet found notification for ${petName} (${tag?.tagId || ''}). As their emergency contact, please help reach them.`;

      try {
        await Notification.create({
          userId: ecUser._id,
          type: 'emergency_contact_escalation',
          title: notifTitle,
          message: notifMessage,
          priority: 'high',
          data: {
            ownerId: owner._id,
            ownerName,
            petId: pet?._id,
            petName,
            tagId: tag?.tagId,
            escalationRecordId: record._id,
          },
        });

        await sendPushToUser(ecUser._id.toString(), notifTitle, notifMessage, {
          type: 'emergency_contact_escalation',
          petId: pet?._id?.toString() || '',
        }).catch(() => {});
      } catch (notifErr) {
        logger.error({ err: notifErr, recordId: record._id }, '[Escalation] Failed to deliver in-app notification to emergency contact');
      }
    }

    // Send email to emergency contact (isolated — must not be blocked by in-app/push failure)
    if (ec.email) {
      try {
        const emailSubject = `Urgent: ${ownerName}'s pet ${petName} was found - action needed`;
        const emailHtml = renderEmergencyEscalationEmail({
          ownerName,
          petName,
          tagId: tag?.tagId || 'N/A',
          finderName: record.finderName,
          finderPhone: record.finderPhone,
          finderEmail: record.finderEmail,
          viewDetailsUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account`,
        });
        const { sendCmsEmailOrFallback } = await import('./email.service');

        await sendCmsEmailOrFallback({
          slug: 'emergency-escalation',
          to: ec.email,
          vars: {
            ownerName,
            petName,
            tagId: tag?.tagId || 'N/A',
            finderName: record.finderName || '',
            finderPhone: record.finderPhone || '',
            finderEmail: record.finderEmail || '',
            viewDetailsUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account`,
          },
          fallbackSubject: emailSubject,
          fallbackHtml: emailHtml,
          businessFlow: 'lost_found',
        }).catch(() => {});
      } catch (emailErr) {
        logger.error({ err: emailErr, recordId: record._id, ecEmail: ec.email }, '[Escalation] Failed to send email to emergency contact');
      }
    }

    // Update the escalation record
    await EscalationRecord.findByIdAndUpdate(record._id, {
      status: 'escalated',
      stage: 'emergency_contact_notified',
      escalatedAt: new Date(),
      emergencyContactNotifiedAt: new Date(),
      emergencyContactEscalatedAt: new Date(),
      emergencyContactNotificationType: ecUser ? 'in_app' : 'email',
    });

    logger.info({ petName, ownerName }, '[Escalation] Stage 2: Emergency contact notified');
  } catch (err) {
    logger.error({ err, recordId: record._id }, '[Escalation] Error processing Stage 2 escalation');
  }
}

/**
 * Process a single escalation record - Stage 3 (Emergency Contact → PawTag Team).
 * Only for Black members. Triggers 30 minutes after Stage 2.
 */
async function processStage3Escalation(record: any): Promise<void> {
  try {
    const owner = record.ownerId as any;
    const pet = record.petId as any;
    const tag = record.tagId as any;

    // Check owner's membership tier - only Black members get Stage 3
    try {
      // Check owner's pet_recovery entitlement from registry
      const { membershipEntitlementService } = await import('./membership-entitlement.service');
      const hasPetRecovery = await membershipEntitlementService.hasAccess(owner._id, 'pet_recovery');

      if (!hasPetRecovery) {
        logger.info({ ownerId: owner._id }, '[Escalation] Stage 3: Owner lacks pet_recovery entitlement, skipping PawTag team notification');
        await EscalationRecord.findByIdAndUpdate(record._id, {
          stage: 'pawtag_team_notified',
          pawtagTeamNotifiedAt: new Date(),
          notes: 'Stage 3 skipped: Owner lacks pet_recovery entitlement',
        });
        return;
      }
    } catch (tierErr) {
      logger.error({ err: tierErr }, '[Escalation] Stage 3: Failed to check owner entitlement');
      return;
    }

    const petName = pet?.name || 'Unknown pet';
    const ownerName = owner.fullName || 'Unknown owner';
    const ownerEmail = owner.email || 'Unknown';
    const ownerPhone = owner.phoneNumber || owner.phone || 'Unknown';
    const ecName = owner.emergencyContact?.name || 'Unknown';
    const ecPhone = owner.emergencyContact?.phone || 'Unknown';
    const ecEmail = owner.emergencyContact?.email || 'Unknown';

    // Format finder location
    let finderLocation = 'Unknown';
    if (record.scanLocation?.latitude && record.scanLocation?.longitude) {
      finderLocation = `${record.scanLocation.latitude.toFixed(6)}, ${record.scanLocation.longitude.toFixed(6)}`;
      if (record.scanLocation.accuracy) {
        finderLocation += ` (±${record.scanLocation.accuracy}m)`;
      }
    }

    // Send admin escalation email (using existing template!)
    try {
      const { renderEmergencyAdminEscalationEmail } = await import('./email/templates/emergency-admin-escalation');
      const emailHtml = renderEmergencyAdminEscalationEmail({
        petName,
        ownerName,
        ownerEmail,
        contactName: ecName,
        contactPhone: ecPhone,
        finderLocation,
      });

      const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.ADMIN_EMAIL || 'admin@pawtag.co.nz';
      await sendMail(adminEmail, `URGENT: Pet Recovery Required - ${petName}`, emailHtml).catch(() => {});
    } catch (emailErr) {
      logger.error({ err: emailErr, recordId: record._id }, '[Escalation] Stage 3: Failed to send admin email');
    }

    // Create admin in-app notification
    try {
      // Find all admin users
      const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, deletedAt: null }).select('_id');
      for (const admin of admins) {
        await Notification.create({
          userId: admin._id,
          audience: 'admin',
          type: 'pet_recovery_escalation',
          title: `URGENT: ${petName} needs recovery`,
          message: `Owner (${ownerName}) and emergency contact (${ecName}) unreachable. Finder: ${record.finderName || 'Unknown'}. Location: ${finderLocation}`,
          priority: 'critical',
          channel: 'alert',
          data: {
            escalationRecordId: record._id,
            petId: pet?._id,
            ownerId: owner._id,
            petName,
            ownerName,
            ownerPhone,
            ownerEmail,
            emergencyContactName: ecName,
            emergencyContactPhone: ecPhone,
            emergencyContactEmail: ecEmail,
            finderName: record.finderName,
            finderPhone: record.finderPhone,
            finderEmail: record.finderEmail,
            finderLocation,
            scanLocation: record.scanLocation,
            tagId: tag?.tagId,
          },
          actionUrl: `/admin/escalations/${record._id}`,
        });
      }
    } catch (notifErr) {
      logger.error({ err: notifErr, recordId: record._id }, '[Escalation] Stage 3: Failed to create admin notification');
    }

    // Update the escalation record
    await EscalationRecord.findByIdAndUpdate(record._id, {
      stage: 'pawtag_team_notified',
      pawtagTeamNotifiedAt: new Date(),
      pawtagTeamNotificationType: 'email',
    });

    logger.info({ petName, ownerName, recordId: record._id }, '[Escalation] Stage 3: PawTag team notified');
  } catch (err) {
    logger.error({ err, recordId: record._id }, '[Escalation] Error processing Stage 3 escalation');
  }
}

/**
 * Mark an escalation as resolved by the owner.
 */
export async function resolveEscalation(recordId: string, resolvedBy: 'owner' | 'emergency_contact' | 'admin'): Promise<void> {
  await EscalationRecord.findByIdAndUpdate(recordId, {
    status: 'resolved',
    resolvedAt: new Date(),
    resolvedBy,
  });
}

/**
 * Forward an escalation to the emergency contact immediately.
 */
export async function forwardToEmergencyContact(recordId: string): Promise<{ success: boolean; message: string }> {
  const record = await EscalationRecord.findById(recordId)
    .populate('ownerId', 'fullName email emergencyContact')
    .populate('petId', 'name petId')
    .populate('tagId', 'tagId');

  if (!record) {
    return { success: false, message: 'Escalation record not found' };
  }

  if (record.status !== 'pending') {
    return { success: false, message: 'This escalation has already been processed' };
  }

  // Process the escalation immediately
  await processStage2Escalation(record);

  return { success: true, message: 'Emergency contact has been notified' };
}
