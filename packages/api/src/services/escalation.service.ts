import { EscalationRecord, User, Notification, Setting } from '@pawtag/db';
import { sendMail } from './email.service';
import { sendPushToUser } from './push-notification.service';
import logger from '../lib/logger';
import { logJob } from '../lib/timing';

const POLL_INTERVAL_MS = 60_000; // Check every minute
let pollingTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the escalation polling service.
 * Checks for overdue escalations every minute and notifies emergency contacts.
 */
export function startEscalationService(): void {
  if (pollingTimer) return;

  logger.info('[Escalation] Starting escalation polling service');
  pollingTimer = setInterval(processOverdueEscalations, POLL_INTERVAL_MS);
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
 * Process all overdue escalation records.
 */
async function processOverdueEscalations(): Promise<void> {
  try {
    const now = new Date();

    // Check if escalation is enabled
    const enabledSetting = await Setting.findOne({ key: 'escalation.notifyEmergencyContact' });
    if (enabledSetting?.value === 'false') return;

    // Find overdue records that haven't been escalated yet
    const overdueRecords = await EscalationRecord.find({
      status: 'pending',
      escalationDeadline: { $lte: now },
      escalatedAt: { $exists: false },
    }).populate('ownerId', 'fullName email emergencyContact')
      .populate('petId', 'name petId')
      .populate('tagId', 'tagId');

    if (overdueRecords.length === 0) return;

    await logJob('escalation-check', async () => {
      logger.info({ count: overdueRecords.length }, 'Processing overdue escalations');

      for (const record of overdueRecords) {
        await processEscalation(record);
      }
    }, { overdueCount: overdueRecords.length });
  } catch (err) {
    logger.error({ err }, '[Escalation] Error processing overdue escalations');
  }
}

/**
 * Process a single escalation record.
 */
async function processEscalation(record: any): Promise<void> {
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

    const ec = owner.emergencyContact;
    const petName = pet?.name || 'your pet';
    const ownerName = owner.fullName || 'the owner';

    // Try to find if emergency contact is a registered user
    const ecUser = await User.findOne({
      $or: [
        { email: ec.email },
        { phoneNumber: ec.phone },
      ],
      deletedAt: { $ne: null },
    }).select('_id fullName email');

    // Send in-app notification if EC is a registered user
    if (ecUser) {
      const notifTitle = `Emergency Contact: ${ownerName}'s pet ${petName} needs attention`;
      const notifMessage = `${ownerName} has not responded to a pet found notification for ${petName} (${tag?.tagId || ''}). As their emergency contact, please help reach them.`;

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
    }

    // Send email to emergency contact
    if (ec.email) {
      const emailSubject = `Urgent: ${ownerName}'s pet ${petName} was found - action needed`;
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; font-size: 24px; margin: 0;">PawTag Emergency Contact</h1>
          </div>
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #111827; margin: 0 0 16px;">${ownerName}'s pet ${petName} was found</h2>
            <p style="color: #374151; line-height: 1.6;">
              ${ownerName} registered you as their emergency contact. Someone found their pet <strong>${petName}</strong> (${tag?.tagId || 'N/A'}), 
              but ${ownerName} hasn't responded to the notification yet.
            </p>
            <p style="color: #374151; line-height: 1.6;">
              Please try to reach ${ownerName} directly to let them know their pet has been found.
            </p>
            ${record.finderName || record.finderPhone ? `
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="color: #1e40af; font-weight: 600; margin: 0 0 8px;">Finder Contact Details:</p>
                ${record.finderName ? `<p style="color: #374151; margin: 4px 0;">Name: ${record.finderName}</p>` : ''}
                ${record.finderPhone ? `<p style="color: #374151; margin: 4px 0;">Phone: ${record.finderPhone}</p>` : ''}
                ${record.finderEmail ? `<p style="color: #374151; margin: 4px 0;">Email: ${record.finderEmail}</p>` : ''}
              </div>
            ` : ''}
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/account" 
               style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
              View Details
            </a>
          </div>
        </div>
      `;

      await sendMail(ec.email, emailSubject, emailHtml).catch(() => {});
    }

    // Update the escalation record
    await EscalationRecord.findByIdAndUpdate(record._id, {
      status: 'escalated',
      escalatedAt: new Date(),
      emergencyContactNotifiedAt: new Date(),
      emergencyContactNotificationType: ecUser ? 'in_app' : 'email',
    });

    logger.info({ petName, ownerName }, '[Escalation] Escalated pet for owner');
  } catch (err) {
    logger.error({ err, recordId: record._id }, '[Escalation] Error processing escalation');
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
  await processEscalation(record);

  return { success: true, message: 'Emergency contact has been notified' };
}
