import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validate } from '../middleware/validation';
import { z } from 'zod';
import { Setting } from '@pawtag/db';
import { auditService, type AuditContext } from '../services/audit';
import { getSiteAvailability, clearSiteAvailabilityCache } from '../lib/site-availability.service';
import logger from '../lib/logger';

const router = Router();
router.use(authenticate);

async function auditAdminEvent(
  req: AuthRequest,
  input: Parameters<typeof auditService.log>[1],
): Promise<void> {
  const context = req.auditContext as AuditContext | undefined;
  if (!context) return;
  try {
    await auditService.log(
      {
        ...context,
        actorType: context.actorType || 'ADMIN',
        actorId: req.user?.id,
        actorEmail: req.user?.email,
      },
      input,
    );
  } catch (err) {
    logger.error({ err }, 'Failed to persist site-availability audit event');
  }
}

// ── GET /api/admin/site-availability/status ──────────────────────────

router.get('/status', requirePermission('setting.read'), async (_req: AuthRequest, res: Response) => {
  try {
    const availability = await getSiteAvailability();
    res.json({
      success: true,
      data: {
        status: availability.status,
        maintenanceMode: availability.maintenanceMode,
        offlineMode: availability.offlineMode,
        messages: availability.messages,
        pollingInterval: availability.pollingInterval,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get site availability status');
    res.status(500).json({ success: false, error: 'Failed to get site availability status' });
  }
});

// ── PUT /api/admin/site-availability/status ──────────────────────────

const updateSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  offlineMode: z.boolean().optional(),
  maintenanceTitle: z.string().min(1).max(200).optional(),
  maintenanceMessage: z.string().min(1).max(500).optional(),
  offlineTitle: z.string().min(1).max(200).optional(),
  offlineMessage: z.string().min(1).max(500).optional(),
  pollingInterval: z.number().int().min(5).max(300).optional(),
});

const SETTING_KEYS_MAP: Record<string, string> = {
  maintenanceMode: 'site.maintenanceMode',
  offlineMode: 'site.offlineMode',
  maintenanceTitle: 'site.maintenanceTitle',
  maintenanceMessage: 'site.maintenanceMessage',
  offlineTitle: 'site.offlineTitle',
  offlineMessage: 'site.offlineMessage',
  pollingInterval: 'site.availabilityPollingInterval',
};

router.put('/status', requirePermission('setting.update'), validate(updateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const updates: Array<{ field: string; key: string; oldValue: string; newValue: string }> = [];

    for (const [field, value] of Object.entries(req.body)) {
      if (value === undefined) continue;
      const dbKey = SETTING_KEYS_MAP[field];
      if (!dbKey) continue;

      const existing = await Setting.findOne({ key: dbKey });
      const oldValue = existing?.value ?? '';
      const newValue = String(value);

      if (oldValue === newValue) continue;

      await Setting.findOneAndUpdate(
        { key: dbKey },
        { key: dbKey, value: newValue, category: 'site', updatedBy: req.user!.id },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      updates.push({ field, key: dbKey, oldValue, newValue });
    }

    clearSiteAvailabilityCache();
    const availability = await getSiteAvailability();

    // Audit each change
    for (const u of updates) {
      const isBooleanToggle = u.newValue === 'true' || u.newValue === 'false';
      await auditAdminEvent(req, {
        action: isBooleanToggle ? (u.newValue === 'true' ? 'enable' : 'disable') : 'update',
        eventType: `site_availability.${u.field}_changed`,
        eventCategory: 'CONFIG',
        operationType: 'UPDATE',
        resourceType: 'Setting',
        resourceId: u.key,
        beforeState: { value: u.oldValue },
        afterState: { value: u.newValue },
        changedFields: [{ field: u.key, before: u.oldValue, after: u.newValue }],
        outcome: 'SUCCESS',
        severity: (u.field === 'offlineMode' && u.newValue === 'true') ? 'CRITICAL'
          : (u.field === 'maintenanceMode' && u.newValue === 'true') ? 'HIGH' : 'MEDIUM',
      });
    }

    res.json({
      success: true,
      data: {
        status: availability.status,
        maintenanceMode: availability.maintenanceMode,
        offlineMode: availability.offlineMode,
        messages: availability.messages,
        pollingInterval: availability.pollingInterval,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to update site availability');
    res.status(500).json({ success: false, error: 'Failed to update site availability' });
  }
});

export default router;
