import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { Order, Tag, FinderScan, Pet, Product, Setting } from '@pawtag/db';

const router = Router();

router.get('/overview', requirePermission('dashboard.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      // Revenue & orders by period
      todayOrders,
      weekOrders,
      monthOrders,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      // Tags
      activeTags,
      gracePeriodTags,
      expiredTags,
      totalTags,
      // Scans
      totalScansWeek,
      // Reunions
      reunionsWeek,
      // Low stock
      lowStockThreshold,
    ] = await Promise.all([
      // Today's orders (paid)
      Order.countDocuments({ status: 'paid', createdAt: { $gte: startOfDay } }),
      // This week's orders
      Order.countDocuments({ status: 'paid', createdAt: { $gte: startOfWeek } }),
      // This month's orders
      Order.countDocuments({ status: 'paid', createdAt: { $gte: startOfMonth } }),
      // Today's revenue
      Order.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$payment.amount' } } },
      ]),
      // This week's revenue
      Order.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: startOfWeek } } },
        { $group: { _id: null, total: { $sum: '$payment.amount' } } },
      ]),
      // This month's revenue
      Order.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$payment.amount' } } },
      ]),
      // Active tags
      Tag.countDocuments({ status: 'active', deletedAt: null }),
      // Grace period tags
      Tag.countDocuments({ subscriptionStatus: 'grace_period', deletedAt: null }),
      // Expired tags
      Tag.countDocuments({ subscriptionStatus: 'expired', deletedAt: null }),
      // Total tags
      Tag.countDocuments({ deletedAt: null }),
      // Scans this week
      FinderScan.countDocuments({ createdAt: { $gte: startOfWeek } }),
      // Reunions this week (pets found)
      Pet.countDocuments({ status: 'found', updatedAt: { $gte: startOfWeek }, deletedAt: null }),
      // Low stock threshold setting
      Setting.findOne({ key: 'lowStockThreshold' }).lean(),
    ]);

    const threshold = parseInt(lowStockThreshold?.value || '10', 10);

    // Low stock products
    const lowStockProducts = await Product.find({
      deletedAt: null,
      $expr: { $lte: ['$stock', threshold] },
    })
      .select('name stock price')
      .limit(20)
      .lean();

    // Daily order counts for last 30 days (for chart)
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const dailyOrders = await Order.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: '$payment.amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        revenue: {
          today: todayRevenue[0]?.total || 0,
          thisWeek: weekRevenue[0]?.total || 0,
          thisMonth: monthRevenue[0]?.total || 0,
        },
        orders: {
          today: todayOrders,
          thisWeek: weekOrders,
          thisMonth: monthOrders,
        },
        tags: {
          active: activeTags,
          gracePeriod: gracePeriodTags,
          expired: expiredTags,
          total: totalTags,
        },
        scansThisWeek: totalScansWeek,
        reunionsThisWeek: reunionsWeek,
        lowStockProducts,
        dailyOrders,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

export default router;
