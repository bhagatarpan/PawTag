import { ReferralCode, Referral, User, Subscription } from '@pawtag/db';
import { sendMail } from './email.service';
import { auditService, type AuditContext } from './audit';

async function auditReferralEvent(
  input: Parameters<typeof auditService.log>[1],
  overrides: Partial<AuditContext> = {},
): Promise<void> {
  try {
    await auditService.log({
      actorType: 'SYSTEM',
      actorId: 'referralService',
      actorUsername: 'referral-service',
      sourceIp: 'system',
      userAgent: 'referral-service',
      applicationName: 'pawtag-api',
      applicationVersion: '1.0.0',
      apiVersion: 'v1',
      environment: process.env.NODE_ENV || 'development',
      ...overrides,
    }, input);
  } catch (err) {
    console.error('[Audit] Failed to log referral event:', err);
  }
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await ReferralCode.findOne({ userId, isActive: true });
  if (existing) return existing.code;

  let code = generateCode();
  let attempts = 0;
  while (attempts < 10) {
    const exists = await ReferralCode.findOne({ code });
    if (!exists) break;
    code = generateCode();
    attempts++;
  }

  const referralCode = await ReferralCode.findOneAndUpdate(
    { userId },
    { userId, code, isActive: true },
    { upsert: true, new: true },
  );

  await auditReferralEvent({
    action: 'referral_code_created',
    eventType: 'referral.code_created',
    eventCategory: 'CREATE',
    operationType: 'CREATE',
    resourceType: 'ReferralCode',
    resourceId: referralCode?._id?.toString(),
    outcome: 'SUCCESS',
    severity: 'MEDIUM',
    metadata: {
      userId,
      code,
      isActive: true,
    },
  }, { actorType: 'USER', actorId: userId });

  return referralCode.code;
}

export async function validateReferralCode(code: string): Promise<{ valid: boolean; referrerName?: string; referrerId?: string }> {
  const referralCode = await ReferralCode.findOne({ code: code.toUpperCase(), isActive: true }).populate('userId', 'fullName');
  if (!referralCode) return { valid: false };
  const user = referralCode.userId as any;
  return { valid: true, referrerName: user?.fullName || 'A friend', referrerId: user?._id?.toString() };
}

export async function createReferralOnOrder(
  referrerId: string,
  refereeId: string,
  referralCode: string,
  orderId: string,
): Promise<void> {
  const existing = await Referral.findOne({ refereeId });
  if (existing) return;

  await Referral.create({
    referrerId,
    refereeId,
    referralCode: referralCode.toUpperCase(),
    status: 'pending',
    orderId,
  });

  await auditReferralEvent({
    action: 'referral_created',
    eventType: 'referral.created',
    eventCategory: 'FINANCIAL',
    operationType: 'CREATE',
    resourceType: 'Referral',
    resourceId: orderId,
    outcome: 'SUCCESS',
    severity: 'MEDIUM',
    metadata: {
      referrerId,
      refereeId,
      referralCode: referralCode.toUpperCase(),
      orderId,
      status: 'pending',
    },
  }, { actorType: 'SYSTEM', actorId: referrerId });
}

export async function completeReferralRewards(orderId: string): Promise<void> {
  const referral = await Referral.findOne({ orderId, status: 'pending' });
  if (!referral) return;

  const rewardMonths = referral.referrerRewardMonths;

  // Extend referrer's active subscription by reward months
  const referrerSub = await Subscription.findOne({ userId: referral.referrerId, status: 'active' }).sort({ currentPeriodEnd: -1 });
  if (referrerSub) {
    const newEnd = new Date(referrerSub.currentPeriodEnd);
    newEnd.setMonth(newEnd.getMonth() + rewardMonths);
    referrerSub.currentPeriodEnd = newEnd;
    if (referrerSub.freePeriodEndsAt && new Date(referrerSub.freePeriodEndsAt) > new Date()) {
      // Still in free period — extend free period instead
    }
    await referrerSub.save();
  }

  // Extend referee's active subscription by reward months
  const refereeSub = await Subscription.findOne({ userId: referral.refereeId, status: 'active' }).sort({ currentPeriodEnd: -1 });
  if (refereeSub) {
    const newEnd = new Date(refereeSub.currentPeriodEnd);
    newEnd.setMonth(newEnd.getMonth() + rewardMonths);
    refereeSub.currentPeriodEnd = newEnd;
    await refereeSub.save();
  }

  referral.status = 'rewarded';
  referral.completedAt = new Date();
  await referral.save();

  await auditReferralEvent({
    action: 'referral_reward_completed',
    eventType: 'referral.reward_completed',
    eventCategory: 'FINANCIAL',
    operationType: 'UPDATE',
    resourceType: 'Referral',
    resourceId: orderId,
    outcome: 'SUCCESS',
    severity: 'HIGH',
    afterState: {
      status: 'rewarded',
      completedAt: referral.completedAt,
    },
    metadata: {
      referrerId: referral.referrerId.toString(),
      refereeId: referral.refereeId.toString(),
      referralCode: referral.referralCode,
      orderId,
      rewardMonths,
      referrerSubExtended: !!referrerSub,
      referrerSubNewEnd: referrerSub?.currentPeriodEnd,
      refereeSubExtended: !!refereeSub,
      refereeSubNewEnd: refereeSub?.currentPeriodEnd,
    },
  });

  // Notify referrer
  const referrer = await User.findById(referral.referrerId).select('fullName email');
  if (referrer) {
    await sendMail((referrer as any).email, 'You earned a referral reward!', `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0d9488;">Referral Reward!</h2>
        <p>Hi ${(referrer as any).fullName},</p>
        <p>Great news! Your friend signed up using your referral code. You've earned <strong>${rewardMonths} month${rewardMonths > 1 ? 's' : ''} free</strong> on your PawTag subscription!</p>
        <p>Keep sharing your code to earn more rewards.</p>
        <p>Thanks for spreading the word about PawTag!</p>
      </div>`);
  }
}

export async function getReferralStats(userId: string) {
  const totalReferrals = await Referral.countDocuments({ referrerId: userId });
  const completedReferrals = await Referral.countDocuments({ referrerId: userId, status: { $in: ['completed', 'rewarded'] } });
  const pendingReferrals = await Referral.countDocuments({ referrerId: userId, status: 'pending' });
  const rewarded = await Referral.find({ referrerId: userId, status: 'rewarded' });
  const totalRewardMonths = rewarded.reduce((sum, r) => sum + r.referrerRewardMonths, 0);

  return { totalReferrals, completedReferrals, pendingReferrals, totalRewardMonths };
}

export async function getReferralHistory(userId: string) {
  return Referral.find({ referrerId: userId })
    .populate('refereeId', 'fullName email createdAt')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
}
