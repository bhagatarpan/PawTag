import { Pet, Notification } from '@pawtag/db';
import { sendPushToUser } from './push-notification.service';
import { auditService, type AuditContext } from './audit';

const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REMINDER_CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

async function auditJobEvent(
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  // Fire and forget
  const logAudit = async () => {
    try {
      await auditService.log({
        actorType: 'SCHEDULED_JOB',
        actorId: 'reminderService',
        actorUsername: 'reminder-service-job',
        sourceIp: 'system',
        userAgent: 'scheduled-job',
        applicationName: 'pawtag-api',
        applicationVersion: '1.0.0',
        apiVersion: 'v1',
        environment: process.env.NODE_ENV || 'development',
        ...overrides,
      }, input);
    } catch (err) {
      console.error('[Audit] Failed to log job event:', err);
    }
  };
  logAudit();
}

export function startReminderService() {
  setInterval(async () => {
    try {
      await sendFinderReminders();
    } catch (error) {
      console.error('[ReminderService] Error:', error);
    }
  }, REMINDER_CHECK_INTERVAL_MS);

  console.log('[ReminderService] Started — checks every hour for pets in "found" status > 24h');
}

async function sendFinderReminders() {
  const cutoff = new Date(Date.now() - REMINDER_INTERVAL_MS);

  // Find pets that are in 'found' status and were found more than 24h ago
  const pets = await Pet.find({
    status: 'found',
    foundByFinderAt: { $lte: cutoff, $ne: null },
    deletedAt: null,
  }).populate('ownerId', 'fullName email');

  for (const pet of pets) {
    const owner = pet.ownerId as any;
    if (!owner) continue;

    // Check if we already sent a reminder in the last 23 hours (avoid duplicates)
    const recentReminder = await Notification.findOne({
      userId: owner._id,
      type: 'finder_reminder',
      'data.petId': pet._id,
      createdAt: { $gte: new Date(Date.now() - 23 * 60 * 60 * 1000) },
    });

    if (recentReminder) continue;

    // Get the latest finder contact details
    const scan = await (await import('@pawtag/db')).FinderScan.findOne({
      petId: pet._id,
      action: 'notified_owner',
    }).sort({ notifiedAt: -1 });

    const finderPhone = scan?.finderPhone || 'Not provided';
    const finderEmail = scan?.finderEmail || 'Not provided';
    const finderName = scan?.finderName || 'A kind person';
    const hoursSinceFound = Math.floor(
      (Date.now() - new Date(pet.foundByFinderAt!).getTime()) / (1000 * 60 * 60)
    );

    const reminderTitle = `REMINDER: Your pet ${pet.name} is still waiting to be reunited!`;
    const reminderMessage = `${finderName} found your pet ${pet.name} (${pet.petId}) ${hoursSinceFound} hours ago and left their contact details. Please reach out to them to bring your pet home!\n\nFinder contact — Phone: ${finderPhone} | Email: ${finderEmail}`;

    await Notification.create({
      userId: owner._id,
      type: 'finder_reminder',
      title: reminderTitle,
      message: reminderMessage,
      priority: 'high',
      data: {
        petId: pet._id.toString(),
        petName: pet.name,
        petPetId: pet.petId,
        finderPhone,
        finderEmail,
        finderName,
        foundAt: pet.foundByFinderAt?.toISOString(),
        hoursSinceFound,
        reminderNumber: Math.floor(hoursSinceFound / 24),
      },
    });

    await sendPushToUser(owner._id.toString(), reminderTitle, reminderMessage, {
      type: 'finder_reminder',
      petId: pet._id.toString(),
    }).catch(() => {});

    console.log(`[ReminderService] Sent reminder for pet ${pet.name} (${pet.petId}) to ${owner.email}`);

    await auditJobEvent({
      action: 'finder_reminder_sent',
      eventType: 'scheduled_finder_reminder',
      eventCategory: 'SYSTEM',
      operationType: 'CREATE',
      resourceType: 'Notification',
      resourceId: owner._id.toString(),
      outcome: 'SUCCESS',
      severity: 'MEDIUM',
      metadata: {
        petId: pet._id.toString(),
        petName: pet.name,
        petPetId: pet.petId,
        ownerId: owner._id.toString(),
        ownerEmail: owner.email,
        hoursSinceFound,
        finderName: scan?.finderName,
        finderPhone: scan?.finderPhone,
        finderEmail: scan?.finderEmail,
        reminderNumber: Math.floor(hoursSinceFound / 24),
      },
    });
  }
}
