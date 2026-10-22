/**
 * Default "Free 3-Month Activation" entitlement values
 * (docs/ACTIVATION-ENTITLEMENTS.md — founder decisions, Oct 2026):
 *
 * - Every tag purchase earns the activation context while the tag's Active
 *   Period runs. Features: all EXCEPT money perks.
 * - Money perks (free shipping threshold, points multiplier, accessory
 *   discount) stay at base behaviour during activation.
 * - Black exclusives (black_friday_deal) stay paid-only; tag_limit only
 *   matters once a paid membership exists.
 *
 * These are SEED DEFAULTS: after seeding they are ordinary admin-editable
 * values on the Membership → Entitlements page (the registry is the source
 * of truth). Scripts that create these rows import this map so seed and
 * migration can never drift.
 */
export interface ActivationEntitlementValue {
  enabled: boolean;
  value: boolean | number | string | null;
}

export const ACTIVATION_ENTITLEMENT_DEFAULTS: Record<string, ActivationEntitlementValue> = {
  // Features (founder: "as if Black", minus money)
  medical_alerts: { enabled: true, value: true },
  pet_health_records: { enabled: true, value: true },
  in_app_notifications: { enabled: true, value: true },
  email_notifications: { enabled: true, value: true },
  emergency_contact: { enabled: true, value: true },
  emergency_person_email: { enabled: true, value: true },
  emergency_person_in_app: { enabled: true, value: true },
  pet_recovery: { enabled: true, value: true },

  // Money perks — base behaviour during activation
  free_shipping_threshold: { enabled: false, value: null },
  points_multiplier: { enabled: false, value: null },
  accessory_discount: { enabled: false, value: null },

  // Paid-tier exclusives / membership-only values
  black_friday_deal: { enabled: false, value: false },
  tag_limit: { enabled: false, value: null },
};
