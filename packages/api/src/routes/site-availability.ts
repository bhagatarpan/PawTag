import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { Setting } from '@pawtag/db';
import { auditService, AuditContext } from '../services/audit/audit.service';
import logger from '../lib/logger';
import {
  getSiteAvailabilityStatus,
  clearSiteAvailabilityCache,
} from '../lib/site-availability';

const router = Router();
router.use(authenticate);

// ── Get current site availability status ─────────────────────────────

router.get('/status', requirePermission('site_availability.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const [maintenanceSetting, offlineSetting] = await Promise.all([
      Setting.findOne({ key: 'site.maintenanceMode' }).lean(),
      Setting.findOne({ key: 'site.offlineMode' }).lean(),
    ]);

    const status = await getSiteAvailabilityStatus();

    res.json({
      success: true,
      data: {
        status,
        maintenanceMode: maintenanceSetting?.value === 'true',
        offlineMode: offlineSetting?.value === 'true',
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Site availability status query failed');
    res.status(500).json({ success: false, error: 'Failed to get site availability status' });
  }
});

// ── Update site availability settings ────────────────────────────────

const updateSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  offlineMode: z.boolean().optional(),
});

router.put('/status', requirePermission('site_availability.update'), validate(updateSchema), async (req: AuthRequest, res: Response) => {
  const { maintenanceMode, offlineMode } = req.body;

  try {
    const updates: Array<{ key: string; value: string; label: string }> = [];

    if (maintenanceMode !== undefined) {
      updates.push({ key: 'site.maintenanceMode', value: String(maintenanceMode), label: 'Maintenance Mode' });
    }
    if (offlineMode !== undefined) {
      updates.push({ key: 'site.offlineMode', value: String(offlineMode), label: 'Offline Mode' });
    }

    if (updates.length === 0) {
      res.status(400).json({ success: false, error: 'No valid fields to update' });
      return;
    }

    for (const u of updates) {
      const setting = await Setting.findOne({ key: u.key });
      if (setting) {
        setting.value = u.value;
        setting.updatedBy = req.user!.id as any;
        await setting.save();
      }
    }

    // Clear the availability cache so changes take effect immediately
    clearSiteAvailabilityCache();

    // Determine the new effective status
    const newStatus = await getSiteAvailabilityStatus();

    // Audit log each change
    const reqContext = req.auditContext as AuditContext;
    if (reqContext) {
      for (const u of updates) {
        const oldValue = u.key === 'site.maintenanceMode'
          ? String(!(maintenanceMode === true))
          : String(!(offlineMode === true));

        await auditService.log({
          ...reqContext,
          actorType: 'ADMIN',
          actorId: req.user?.id,
          actorEmail: req.user?.email,
        }, {
          action: u.value === 'true' ? 'enable' : 'disable',
          eventType: u.value === 'true'
            ? (u.key === 'site.maintenanceMode' ? 'SITE_MAINTENANCE_ENABLED' : 'SITE_OFFLINE_ENABLED')
            : (u.key === 'site.maintenanceMode' ? 'SITE_MAINTENANCE_DISABLED' : 'SITE_OFFLINE_DISABLED'),
          eventCategory: 'ADMIN',
          operationType: 'UPDATE',
          resourceType: 'Setting',
          resourceId: u.key,
          severity: u.value === 'true' ? 'HIGH' : 'MEDIUM',
          outcome: 'SUCCESS',
          metadata: {
            settingKey: u.key,
            oldValue,
            newValue: u.value,
            effectiveStatus: newStatus,
          },
        });
      }
    }

    res.json({
      success: true,
      data: {
        status: newStatus,
        maintenanceMode: (await Setting.findOne({ key: 'site.maintenanceMode' }).lean())?.value === 'true',
        offlineMode: (await Setting.findOne({ key: 'site.offlineMode' }).lean())?.value === 'true',
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Site availability update failed');
    res.status(500).json({ success: false, error: 'Failed to update site availability' });
  }
});

export default router;
