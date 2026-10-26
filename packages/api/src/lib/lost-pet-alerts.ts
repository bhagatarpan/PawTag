import { Notification, Setting } from '@pawtag/db';
import { recordPetHistory } from './pet-history';
import { membershipEntitlementService } from '../services/membership-entitlement.service';
import logger from './logger';

/** Default: one scan alert per tag per 6 hours (Setting: scanAlert.dedupeMinutes). */
const DEFAULT_SCAN_ALERT_DEDUPE_MINUTES = 360;

interface IpGeoLike {
  city?: string;
  region?: string;
  country?: string;
}

/**
 * Human-readable coarse area from IP geolocation — city + region, never
 * coordinates. This is deliberately a *locality*, not an address: the scan
 * alert tells the owner roughly where the tag was seen, nothing finer.
 */
export function describeIpArea(ipGeo: IpGeoLike | null | undefined): string | null {
  if (!ipGeo) return null;
  const parts = [ipGeo.city, ipGeo.region && ipGeo.region !== ipGeo.city ? ipGeo.region : null].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return ipGeo.country || null;
}

/** Pet statuses where a "is your pet safe?" prompt must NOT be sent. */
const SKIP_SCAN_ALERT_STATUSES = new Set(['lost', 'deceased', 'transferred', 'donated', 'sold']);

/**
 * Level-1 scan alert (business rule): a bare scan NEVER marks a pet lost —
 * it only asks the owner to confirm whether the pet is safe.
 *
 * - Deduped per tag (scanAlert.dedupeMinutes) so casual scans can't storm the owner.
 * - Gated by the in_app_notifications entitlement (registry-driven, like pet_found).
 * - Skips pets already in Lost Mode (owner already knows) or no longer in the
 *   owner's care (deceased/transferred/donated/sold).
 * - Safe pets ARE alerted — that is the point: an unaware owner gets the prompt.
 * - Returns true when an alert notification was created.
 */
export async function createScanAlertIfEligible(params: {
  petId: string;
  petName: string;
  petStatus: string;
  ownerId: string;
  tagId: string;
  area: string | null;
}): Promise<boolean> {
  try {
    const { petId, petName, petStatus, ownerId, tagId, area } = params;
    if (SKIP_SCAN_ALERT_STATUSES.has(petStatus)) return false;

    const entitled = await membershipEntitlementService.hasAccess(ownerId, 'in_app_notifications');
    if (!entitled) return false;

    const settingDoc = await Setting.findOne({ key: 'scanAlert.dedupeMinutes' }).lean();
    const minutes = Number.parseInt(settingDoc?.value || '', 10) || DEFAULT_SCAN_ALERT_DEDUPE_MINUTES;
    const windowStart = new Date(Date.now() - minutes * 60_000);
    const recent = await Notification.findOne({
      userId: ownerId,
      type: 'finder_scan',
      'data.tagId': tagId,
      createdAt: { $gte: windowStart },
    });
    if (recent) return false;

    const where = area ? `around ${area}` : 'recently';
    const alert = await Notification.create({
      userId: ownerId,
      type: 'finder_scan',
      priority: 'normal',
      channel: 'alert',
      title: `Someone may have found your pet ${petName}!`,
      message: `Your PawTag was scanned ${where}. This could mean someone has found your pet, or your pet may have wandered away from you. Is ${petName} safe with you, or should you mark them as Lost so the community can help bring them home?`,
      actionUrl: `/account/pets/${petId}`,
      data: { petId, petName, tagId, area },
    });

    await recordPetHistory({
      petId,
      ownerId,
      type: 'owner_prompted',
      actor: 'system',
      precision: area ? 'approximate' : 'none',
      metadata: { alertId: alert._id.toString(), tagId, area },
    });
    return true;
  } catch (err) {
    // A failed alert must never break the finder's scan response.
    logger.error({ err, tagId: params.tagId }, '[scan-alert] Failed to create scan alert');
    return false;
  }
}
