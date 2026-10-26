import { Notification, Setting } from '@pawtag/db';
import { recordPetHistory } from './pet-history';
import { membershipEntitlementService } from '../services/membership-entitlement.service';
import logger from './logger';

/**
 * Option B (founder decision, 2026-10-27): scan prompts are one-at-a-time.
 *
 * - While an UNREAD prompt for this tag is still open, scans never duplicate
 *   it — the unanswered prompt IS the persistent state (no storms possible).
 * - Once the owner responds (ack "pet is safe", or Lost Mode auto-resolves
 *   it), the next scan may prompt again — never sooner than the floor
 *   (`scanAlert.remindFloorMinutes`, default 5) so repeated safe-taps and
 *   rapid rescans cannot loop prompts. (Founder: 2026-10-27, 15 → 5 minutes.)
 */
const DEFAULT_REMIND_FLOOR_MINUTES = 5;

/** Floor setting with a valid-0 (0 = same-scan re-arm allowed) fallback. */
export async function getRemindFloorMinutes(): Promise<number> {
  try {
    const doc = await Setting.findOne({ key: 'scanAlert.remindFloorMinutes' }).lean();
    const parsed = Number.parseInt(doc?.value ?? '', 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_REMIND_FLOOR_MINUTES;
  } catch {
    return DEFAULT_REMIND_FLOOR_MINUTES;
  }
}

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
 * - One prompt at a time per tag (unread blocks; response re-arms; short
 *   floor prevents loops — see getRemindFloorMinutes).
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

    // One prompt at a time: an unanswered prompt for this tag stays the single
    // open ask no matter how many scans arrive; a responded-to prompt re-arms,
    // subject to the anti-loop floor.
    const lastPrompt = await Notification.findOne({
      userId: ownerId,
      type: 'finder_scan',
      'data.tagId': tagId,
    }).sort({ createdAt: -1 });
    if (lastPrompt) {
      if (!lastPrompt.read) return false;
      const ageMs = Date.now() - new Date(lastPrompt.createdAt).getTime();
      const floorMinutes = await getRemindFloorMinutes();
      if (ageMs < floorMinutes * 60_000) return false;
    }

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
