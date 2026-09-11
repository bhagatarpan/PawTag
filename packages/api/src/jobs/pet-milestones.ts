import { Pet, User } from '@pawtag/db';
import { awardPetMilestonePoints } from '../services/loyalty/points-earning.service';
import logger from '../lib/logger';

/**
 * Pet Milestones Job
 * Checks for pet birthdays and adoption anniversaries daily
 * Awards Guardian Points for these milestones
 */

interface PetMilestone {
  petId: string;
  ownerId: string;
  type: 'birthday' | 'adoption_anniversary';
  date: Date;
  petName: string;
}

/**
 * Get today's date parts (month and day)
 */
function getTodayMonthDay(): { month: number; day: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, day: now.getDate() };
}

/**
 * Check if a date matches today's month and day
 */
function isTodayAnniversary(date: Date): boolean {
  const today = getTodayMonthDay();
  const dateMonth = date.getMonth() + 1;
  const dateDay = date.getDate();
  return today.month === dateMonth && today.day === dateDay;
}

/**
 * Find pets with milestones today
 */
async function findPetsWithMilestonesToday(): Promise<PetMilestone[]> {
  const milestones: PetMilestone[] = [];

  // Find pets with birthdays today
  const petsWithBirthdays = await Pet.find({
    deletedAt: null,
    dateOfBirth: { $exists: true, $ne: null },
  }).lean();

  for (const pet of petsWithBirthdays) {
    if (pet.dateOfBirth && isTodayAnniversary(new Date(pet.dateOfBirth))) {
      milestones.push({
        petId: pet._id.toString(),
        ownerId: pet.ownerId.toString(),
        type: 'birthday',
        date: new Date(pet.dateOfBirth),
        petName: pet.name,
      });
    }
  }

  // Check for adoption anniversaries
  const petsWithAdoptionDates = await Pet.find({
    deletedAt: null,
    adoptionDate: { $exists: true, $ne: null },
  }).lean();

  for (const pet of petsWithAdoptionDates) {
    if (pet.adoptionDate && isTodayAnniversary(new Date(pet.adoptionDate))) {
      milestones.push({
        petId: pet._id.toString(),
        ownerId: pet.ownerId.toString(),
        type: 'adoption_anniversary',
        date: new Date(pet.adoptionDate),
        petName: pet.name,
      });
    }
  }

  return milestones;
}

/**
 * Award points for pet milestones
 */
async function awardMilestonePoints(milestones: PetMilestone[]): Promise<void> {
  for (const milestone of milestones) {
    try {
      await awardPetMilestonePoints(milestone.ownerId, milestone.type, milestone.petId);
      logger.info({
        petId: milestone.petId,
        ownerId: milestone.ownerId,
        type: milestone.type,
        petName: milestone.petName,
      }, 'Awarded pet milestone points');
    } catch (error) {
      logger.error({
        err: error,
        petId: milestone.petId,
        ownerId: milestone.ownerId,
        type: milestone.type,
      }, 'Failed to award pet milestone points');
    }
  }
}

/**
 * Send birthday/anniversary emails to pet owners
 */
async function sendMilestoneEmails(milestones: PetMilestone[]): Promise<void> {
  const { sendMail } = await import('../services/email.service');
  const { renderPetBirthdayEmail, renderPetAnniversaryEmail } = await import('../services/email/templates');
  
  for (const milestone of milestones) {
    try {
      const user = await User.findById(milestone.ownerId).lean();
      if (!user?.email) continue;

      const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/account/guardian`;
      const subject = milestone.type === 'birthday' 
        ? `Happy Birthday ${milestone.petName}!`
        : `${milestone.petName}'s Adoption Anniversary!`;

      const body = milestone.type === 'birthday'
        ? renderPetBirthdayEmail({ customerName: user.fullName || 'there', petName: milestone.petName, pointsEarned: 10, dashboardUrl })
        : renderPetAnniversaryEmail({ customerName: user.fullName || 'there', petName: milestone.petName, yearsOwned: 1, pointsEarned: 10, dashboardUrl });

      await sendMail(user.email, subject, body);
      logger.info({
        petId: milestone.petId,
        ownerId: milestone.ownerId,
        type: milestone.type,
        petName: milestone.petName,
        email: user.email,
      }, 'Sent milestone email');
    } catch (error) {
      logger.error({
        err: error,
        petId: milestone.petId,
        ownerId: milestone.ownerId,
        type: milestone.type,
      }, 'Failed to send milestone email');
    }
  }
}

/**
 * Run pet milestones job
 * Should be called daily (e.g., via cron job)
 */
export async function runPetMilestonesJob(): Promise<void> {
  logger.info('Starting pet milestones job');

  try {
    const milestones = await findPetsWithMilestonesToday();
    
    if (milestones.length === 0) {
      logger.info('No pet milestones found today');
      return;
    }

    logger.info({ count: milestones.length }, 'Found pet milestones today');

    // Award points for all milestones
    await awardMilestonePoints(milestones);

    // Send emails for all milestones
    await sendMilestoneEmails(milestones);

    logger.info({ count: milestones.length }, 'Pet milestones job completed');
  } catch (error) {
    logger.error({ err: error }, 'Pet milestones job failed');
  }
}

/**
 * Start pet milestones job (runs daily at midnight)
 */
export function startPetMilestonesJob(): void {
  // Run immediately on startup
  runPetMilestonesJob().catch((error) => {
    logger.error({ err: error }, 'Pet milestones initial run failed');
  });

  // Then run every 24 hours
  setInterval(async () => {
    try {
      await runPetMilestonesJob();
    } catch (error) {
      logger.error({ err: error }, '[PetMilestonesJob] Error');
    }
  }, 24 * 60 * 60 * 1000);
  
  logger.info('Pet milestones job started (runs daily)');
}
