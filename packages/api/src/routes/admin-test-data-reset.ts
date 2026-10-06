import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import {
  User,
  Pet,
  Tag,
  Cart,
  Order,
  Notification,
  Subscription,
  Invoice,
  InvoiceAccessToken,
  PaymentTransaction,
  Fulfilment,
  Return,
  Shipment,
  PendingOrder,
  PendingRefundRetry,
  StockMovement,
  PromoCode,
  Referral,
  ReferralCode,
  EscalationRecord,
  TagExpiryNotification,
  SupportRequest,
  PushToken,
  RefreshToken,
  VerificationToken,
  EmailAudit,
  SystemLog,
  AuditEvent,
  WebhookEvent,
  GuardianPointsLedger,
  GuardianTierHistory,
  PawRewardsLedger,
  UserMembership,
  DigitalEntitlement,
  UserRole,
  Product,
  Category,
  Collection,
  Brand,
  ShippingMethod,
  BackgroundJob,
  MembershipTier,
  MembershipBenefit,
  Setting,
  FeatureFlag,
  Role,
  Permission,
  CmsPage,
} from '@pawtag/db';
import { auditService } from '../services/audit';
import mongoose from 'mongoose';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

// ─── Collections to DELETE (user-generated / test data) ──────────
const RESETTABLE_MODELS = [
  { model: Pet, name: 'Pets' },
  { model: Tag, name: 'Tags' },
  { model: Cart, name: 'Carts' },
  { model: Order, name: 'Orders' },
  { model: Notification, name: 'Notifications' },
  { model: Subscription, name: 'Subscriptions' },
  { model: Invoice, name: 'Invoices' },
  { model: InvoiceAccessToken, name: 'Invoice Access Tokens' },
  { model: PaymentTransaction, name: 'Payment Transactions' },
  { model: Fulfilment, name: 'Fulfilments' },
  { model: Return, name: 'Returns' },
  { model: Shipment, name: 'Shipments' },
  { model: PendingOrder, name: 'Pending Orders' },
  { model: PendingRefundRetry, name: 'Pending Refund Retries' },
  { model: StockMovement, name: 'Stock Movements' },
  { model: PromoCode, name: 'Promo Codes' },
  { model: Referral, name: 'Referrals' },
  { model: ReferralCode, name: 'Referral Codes' },
  { model: EscalationRecord, name: 'Escalation Records' },
  { model: TagExpiryNotification, name: 'Tag Expiry Notifications' },
  { model: SupportRequest, name: 'Support Requests' },
  { model: PushToken, name: 'Push Tokens' },
  { model: RefreshToken, name: 'Refresh Tokens' },
  { model: VerificationToken, name: 'Verification Tokens' },
  { model: EmailAudit, name: 'Email Audit' },
  { model: SystemLog, name: 'System Logs' },
  { model: AuditEvent, name: 'Audit Events' },
  { model: WebhookEvent, name: 'Webhook Events' },
  { model: GuardianPointsLedger, name: 'Guardian Points Ledger' },
  { model: GuardianTierHistory, name: 'Guardian Tier History' },
  { model: PawRewardsLedger, name: 'PawRewards Ledger' },
  { model: UserMembership, name: 'User Memberships' },
  { model: DigitalEntitlement, name: 'Digital Entitlements' },
];

// ─── POST /api/admin/test-data/reset ─────────────────────────────
router.post('/reset', requirePermission('system.reset_test_data'), async (req: AuthRequest, res: Response) => {
  try {
    const { confirmText } = req.body;

    // ── Step 1: Require explicit confirmation ──
    if (confirmText !== 'RESET') {
      res.status(400).json({
        success: false,
        error: 'Type RESET to confirm. This action is irreversible.',
      });
      return;
    }

    // ── Step 2: Require SUPER_ADMIN role ──
    const adminUser = await User.findById(req.user!.id).lean();
    if (!adminUser) {
      res.status(401).json({ success: false, error: 'Admin user not found' });
      return;
    }

    const isSuperAdmin = adminUser.role === 'super_admin' ||
      (await UserRole.findOne({ userId: adminUser._id, isActive: true })
        .populate({ path: 'roleId', match: { isSuperAdmin: true } })
        .lean()) !== null;

    if (!isSuperAdmin) {
      res.status(403).json({
        success: false,
        error: 'Only Super Admins can reset test data.',
      });
      return;
    }

    logger.warn({ adminId: req.user!.id, email: req.user!.email }, '[TestDataReset] Reset initiated');

    // ── Step 3: Delete all non-admin users ──
    // Find admin user IDs to preserve
    const adminUserRole = await UserRole.find({ isActive: true })
      .populate({ path: 'roleId', match: { isSuperAdmin: true } })
      .lean();
    const adminUserIds = adminUserRole
      .filter(ur => ur.roleId != null)
      .map(ur => ur.userId);

    // Also preserve users with legacy super_admin role
    const legacyAdmins = await User.find({ role: 'super_admin' }).select('_id').lean();
    const preserveUserIds = new Set([
      ...adminUserIds.map(id => id.toString()),
      ...legacyAdmins.map(u => u._id.toString()),
    ]);

    const userDeleteResult = await User.deleteMany({
      _id: { $nin: Array.from(preserveUserIds).map(id => new mongoose.Types.ObjectId(id)) },
    });

    // ── Step 4: Delete resettable collections ──
    const deleted: Record<string, number> = {};
    deleted['Users (non-admin)'] = userDeleteResult.deletedCount;

    for (const { model, name } of RESETTABLE_MODELS) {
      try {
        const result = await (model as mongoose.Model<Document>).deleteMany({});
        deleted[name] = result.deletedCount;
      } catch (err) {
        logger.error({ err, collection: name }, '[TestDataReset] Failed to delete collection');
        deleted[name] = -1; // indicate error
      }
    }

    // ── Step 5: Preserve counts ──
    const preserved: Record<string, number> = {};
    preserved['Admin Users'] = await User.countDocuments({ _id: { $in: Array.from(preserveUserIds).map(id => new mongoose.Types.ObjectId(id)) } });
    preserved['Roles'] = await Role.countDocuments({});
    preserved['Permissions'] = await Permission.countDocuments({});
    preserved['Products'] = await Product.countDocuments({});
    preserved['Categories'] = await Category.countDocuments({});
    preserved['Collections'] = await Collection.countDocuments({});
    preserved['Brands'] = await Brand.countDocuments({});
    preserved['Shipping Methods'] = await ShippingMethod.countDocuments({});
    preserved['Background Jobs'] = await BackgroundJob.countDocuments({});
    preserved['Membership Tiers'] = await MembershipTier.countDocuments({});
    preserved['Membership Benefits'] = await MembershipBenefit.countDocuments({});
    preserved['Settings'] = await Setting.countDocuments({});
    preserved['Feature Flags'] = await FeatureFlag.countDocuments({});
    preserved['CMS Pages'] = await CmsPage.countDocuments({});

    // ── Step 6: Re-seed demo data for John Smith ──
    const testEmail = process.env.BOOTSTRAP_TEST_EMAIL || 'arpanbhagat@yahoo.com';
    let demoDataRecreated = false;

    const testCustomer = await User.findOne({ email: testEmail });
    if (testCustomer) {
      try {
        // Create pets
        const now = Date.now();
        const bella = await Pet.create({
          petId: `PET-${now.toString(36).toUpperCase()}-BELLA`,
          ownerId: testCustomer._id,
          name: 'Bella',
          petType: 'Dog',
          species: 'Canine',
          breed: 'Golden Retriever',
          gender: 'female',
          dateOfBirth: new Date('2021-06-15'),
          color: 'Golden',
          pattern: 'Solid',
          weight: 30,
          isNeutered: true,
          status: 'safe',
          photos: [],
        });

        const whiskers = await Pet.create({
          petId: `PET-${(now + 1).toString(36).toUpperCase()}-WHISKERS`,
          ownerId: testCustomer._id,
          name: 'Whiskers',
          petType: 'Cat',
          species: 'Feline',
          breed: 'Siamese',
          gender: 'male',
          dateOfBirth: new Date('2022-03-20'),
          color: 'Cream',
          pattern: 'Pointed',
          weight: 5,
          isNeutered: true,
          status: 'safe',
          photos: [],
        });

        // Create tags
        const tagBella = await Tag.create({
          tagId: `PT-${(now + 2).toString(36).toUpperCase()}`,
          ownerId: testCustomer._id,
          petId: bella._id,
          status: 'active',
          activatedAt: new Date(),
          activePeriodEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          warrantyEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });

        await Tag.create({
          tagId: `PT-${(now + 3).toString(36).toUpperCase()}`,
          ownerId: testCustomer._id,
          petId: whiskers._id,
          status: 'inactive',
        });

        // Link Bella's tag
        await Pet.findByIdAndUpdate(bella._id, { tagId: tagBella._id });

        // Create promo codes
        await PromoCode.insertMany([
          { code: 'SAFEPT10', discountType: 'percentage', discountValue: 10, isActive: true, maxUses: 100, currentUses: 0 },
          { code: 'FREESHIP', discountType: 'free_shipping', discountValue: 0, isActive: true, maxUses: 100, currentUses: 0 },
          { code: 'WELCOME15', discountType: 'percentage', discountValue: 15, isActive: true, maxUses: 50, currentUses: 0 },
        ]);

        demoDataRecreated = true;
        logger.info({ adminId: req.user!.id }, '[TestDataReset] Demo data re-seeded for John Smith');
      } catch (err) {
        logger.error({ err, adminId: req.user!.id }, '[TestDataReset] Failed to re-seed demo data');
      }
    }

    // ── Step 7: Audit log ──
    try {
      await auditService.log(
        {
          requestId: req.user!.id,
          correlationId: 'test-data-reset',
          traceId: 'test-data-reset',
          transactionId: 'test-data-reset',
          sourceIp: req.ip || 'unknown',
          userAgent: req.get('user-agent') || 'unknown',
          applicationName: 'pawtag-api',
          applicationVersion: '1.0.0',
          apiVersion: 'v1',
          environment: process.env.NODE_ENV || 'development',
          actorType: 'USER',
          actorId: req.user!.id,
          actorEmail: req.user!.email,
        },
        {
          action: 'test_data_reset',
          eventType: 'system.test_data_reset',
          eventCategory: 'SYSTEM',
          operationType: 'DELETE',
          resourceType: 'System',
          resourceId: 'all-test-data',
          outcome: 'SUCCESS',
          severity: 'CRITICAL',
          metadata: { deleted, preserved, demoDataRecreated, totalDeleted: Object.values(deleted).reduce((a, b) => a + Math.max(0, b), 0) },
        },
      );
    } catch (err) {
      logger.error({ err }, '[TestDataReset] Failed to create audit event');
    }

    // ── Step 8: Response ──
    const totalDeleted = Object.values(deleted).reduce((sum, count) => sum + Math.max(0, count), 0);

    res.json({
      success: true,
      data: {
        deleted,
        preserved,
        demoDataRecreated,
        totalDeleted,
        message: `Test data reset complete. ${totalDeleted} documents deleted. Demo data ${demoDataRecreated ? 're-seeded' : 'skipped (test customer not found)'}.`,
      },
    });
  } catch (error: any) {
    logger.error({ err: error, adminId: req.user?.id }, '[TestDataReset] Reset failed');
    res.status(500).json({ success: false, error: error.message || 'Failed to reset test data' });
  }
});

export default router;
