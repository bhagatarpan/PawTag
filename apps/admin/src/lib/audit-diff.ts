/**
 * Pure helpers for rendering audit event changes in a human-readable way.
 * Kept free of React/DOM so they can be unit-tested in isolation.
 */

export interface AuditChangeInput {
  changedFields?: Array<{ field: string; before: unknown; after: unknown; sensitive?: boolean }>;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

export interface AuditChangeRow {
  field: string;
  before: string;
  after: string;
  sensitive: boolean;
  changed: boolean;
}

export interface ActualChange {
  field: string;
  label: string;
  before: string;
  after: string;
  type: 'changed' | 'added' | 'removed';
}

const SENSITIVE_PATTERN = /password|passwd|secret|token|otp|api[_-]?key|private[_-]?key|credential|cvv|pin/i;

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (value === '[REDACTED]') return '[REDACTED]';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function isSensitiveField(field: string): boolean {
  return SENSITIVE_PATTERN.test(field);
}

/**
 * Build display rows for the Before → After view.
 * Prefers the explicit changedFields list; falls back to a top-level
 * diff of beforeState/afterState when only snapshots exist.
 */
export function buildChangeRows(event: AuditChangeInput): AuditChangeRow[] {
  if (event.changedFields && event.changedFields.length > 0) {
    return event.changedFields.map((f) => {
      const before = formatAuditValue(f.before);
      const after = formatAuditValue(f.after);
      return {
        field: f.field,
        before,
        after,
        sensitive: Boolean(f.sensitive) || isSensitiveField(f.field),
        changed: before !== after,
      };
    });
  }

  const before = event.beforeState ?? {};
  const after = event.afterState ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((k) => !['_id', '__v', 'updatedAt'].includes(k));

  return keys
    .map((field) => {
      const b = formatAuditValue(before[field]);
      const a = formatAuditValue(after[field]);
      return { field, before: b, after: a, sensitive: isSensitiveField(field), changed: b !== a };
    })
    .filter((row) => row.before !== '—' || row.after !== '—')
    .sort((a, b) => Number(b.changed) - Number(a.changed) || a.field.localeCompare(b.field));
}

// --- Grid-specific helpers ---

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name',
  email: 'Email',
  phoneNumber: 'Phone number',
  profilePicture: 'Profile picture',
  address: 'Address',
  'address.line1': 'Street',
  'address.line2': 'Suburb',
  'address.city': 'City',
  'address.state': 'State',
  'address.zip': 'Postal code',
  'address.country': 'Country',
  emergencyContact: 'Emergency contact',
  'emergencyContact.name': 'Contact name',
  'emergencyContact.phone': 'Contact phone',
  'emergencyContact.email': 'Contact email',
  'emergencyContact.relationship': 'Relationship',
  responsibilityScore: 'Responsibility score',
  mfaEnabled: 'MFA enabled',
  showOwnerNameInFinder: 'Show name to finders',
  status: 'Status',
  role: 'Role',
  tagId: 'Tag ID',
  tagType: 'Tag type',
  petId: 'Pet ID',
  petName: 'Pet name',
  petType: 'Pet type',
  ownerId: 'Owner',
  userId: 'User',
  orderId: 'Order',
  planId: 'Plan',
  price: 'Price',
  pricePerPeriod: 'Price per period',
  totalScans: 'Total scans',
  autoRenew: 'Auto-renew',
  renewalMethod: 'Renewal method',
  startDate: 'Start date',
  currentPeriodEnd: 'Period end',
  gracePeriodEndsAt: 'Grace period ends',
  payment: 'Payment',
  'payment.method': 'Payment method',
  'payment.status': 'Payment status',
  'payment.amount': 'Amount',
  'payment.transactionId': 'Transaction ID',
  shippingAddress: 'Shipping address',
  trackingNumber: 'Tracking number',
  carrier: 'Carrier',
  items: 'Items',
  notificationPreferences: 'Notification preferences',
  'notificationPreferences.email': 'Email notifications',
  'notificationPreferences.push': 'Push notifications',
  'notificationPreferences.inApp': 'In-app notifications',
  referredByCode: 'Referral code',
  deletedAt: 'Deleted',
  isActive: 'Active',
  code: 'Code',
  relationship: 'Relationship',
  allergen: 'Allergen',
  reaction: 'Reaction',
  severity: 'Severity',
  name: 'Name',
  type: 'Type',
  breed: 'Breed',
  species: 'Species',
  color: 'Color',
  gender: 'Gender',
  weight: 'Weight',
  date: 'Date',
  notes: 'Notes',
  diagnosis: 'Diagnosis',
  treatment: 'Treatment',
  endDate: 'End date',
  manufacturer: 'Manufacturer',
  dosage: 'Dosage',
  frequency: 'Frequency',
  route: 'Route',
  chipNumber: 'Chip number',
  implantDate: 'Implant date',
  veterinarian: 'Veterinarian',
  clinic: 'Clinic',
  surgeryDate: 'Surgery date',
  outcome: 'Outcome',
  condition: 'Condition',
  diagnosedDate: 'Diagnosed date',
  isDesexed: 'Desexed',
  desexedDate: 'Desexed date',
};

const ENTITY_LABELS: Record<string, string> = {
  User: 'Customer Profile',
  Pet: 'Pet',
  Tag: 'Tag',
  Order: 'Order',
  Subscription: 'Subscription',
  Product: 'Product',
  Setting: 'Setting',
  FeatureFlag: 'Feature Flag',
  Notification: 'Notification',
  Role: 'Role',
  Permission: 'Permission',
  UserRole: 'User Role',
  Referral: 'Referral',
  ReferralCode: 'Referral Code',
  Invoice: 'Invoice',
  EscalationRecord: 'Escalation',
  SiteContent: 'Content',
  FinderScan: 'Finder Scan',
  LocationEvent: 'Location',
  AuditEvent: 'Audit Event',
  Navigation: 'Page View',
  HTTP_ENDPOINT: 'API Endpoint',
  Cart: 'Cart',
  CartItem: 'Cart Item',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  register: 'Registered',
  add: 'Added',
  new: 'Created',
  update: 'Updated',
  edit: 'Edited',
  modify: 'Modified',
  change: 'Changed',
  set: 'Set',
  patch: 'Patched',
  delete: 'Deleted',
  remove: 'Removed',
  destroy: 'Destroyed',
  trash: 'Trashed',
  purge: 'Purged',
  read: 'Viewed',
  view: 'Viewed',
  list: 'Viewed list',
  query: 'Queried',
  search: 'Searched',
  get: 'Retrieved',
  fetch: 'Fetched',
  login: 'Logged in',
  logout: 'Logged out',
  signin: 'Signed in',
  signup: 'Signed up',
  authenticate: 'Authenticated',
  refresh: 'Refreshed',
  forgot: 'Requested reset',
  reset: 'Reset',
  verify: 'Verified',
  export: 'Exported',
  download: 'Downloaded',
  backup: 'Backed up',
  archive: 'Archived',
  approve: 'Approved',
  reject: 'Rejected',
  complete: 'Completed',
  cancel: 'Cancelled',
  suspend: 'Suspended',
  reactivate: 'Reactivated',
  payment: 'Payment',
  charge: 'Charged',
  refund: 'Refunded',
  invoice: 'Invoice',
  subscription: 'Subscription',
  billing: 'Billing',
  permission: 'Permission',
  rbac: 'RBAC',
  role: 'Role',
  grant: 'Granted',
  revoke: 'Revoked',
  assign: 'Assigned',
  config: 'Config',
  setting: 'Setting',
  preference: 'Preference',
  flag: 'Flag',
  toggle: 'Toggled',
  policy: 'Policy',
  profile_updated: 'Updated profile',
  profile_update_failed: 'Failed to update profile',
  password_changed: 'Changed password',
  token_refreshed: 'Refreshed token',
  email_verified: 'Verified email',
  phone_verified: 'Verified phone',
  mfa_otp_sent: 'Sent verification code',
  mfa_verified: 'Verified MFA code',
  pet_create: 'Created pet',
  pet_update: 'Updated pet',
  pet_delete: 'Deleted pet',
  pet_mark_lost: 'Marked pet as lost',
  pet_mark_found: 'Marked pet as found',
  tag_redeem: 'Activated tag',
  order_create: 'Placed order',
  order_payment_confirmed: 'Confirmed payment',
  cart_item_create: 'Added to cart',
  cart_item_update: 'Updated cart',
  cart_item_delete: 'Removed from cart',
  notification_clear_read: 'Cleared notifications',
  notification_mark_all_read: 'Marked all as read',
  notification_preferences_update: 'Updated notification settings',
  vaccination_create: 'Added vaccination',
  vaccination_update: 'Updated vaccination',
  vaccination_delete: 'Deleted vaccination',
  allergy_create: 'Added allergy',
  allergy_update: 'Updated allergy',
  allergy_delete: 'Deleted allergy',
  medication_create: 'Added medication',
  medication_update: 'Updated medication',
  medication_delete: 'Deleted medication',
  microchip_create: 'Added microchip',
  microchip_update: 'Updated microchip',
  microchip_delete: 'Deleted microchip',
  surgery_create: 'Added surgery',
  surgery_update: 'Updated surgery',
  surgery_delete: 'Deleted surgery',
  weight_create: 'Recorded weight',
  weight_delete: 'Deleted weight record',
  health_condition_create: 'Added health condition',
  health_condition_update: 'Updated health condition',
  health_condition_delete: 'Deleted health condition',
  vet_detail_update: 'Updated vet details',
  desexing_update: 'Updated desexing status',
  mfa_setting_changed: 'Changed MFA setting',
  finder_privacy_changed: 'Changed finder privacy',
  onboarding_completed: 'Completed onboarding',
  onboarding_skipped: 'Skipped onboarding',
  escalation_resolved: 'Resolved escalation',
  escalation_forwarded: 'Forwarded escalation',
  referral_data_viewed: 'Viewed referral data',
  referral_data_access: 'Accessed referral data',
  account_locked: 'Account locked',
  login_mfa_otp_sent: 'Sent login code',
  login_mfa_verified: 'Verified login code',
  phone_otp_sent: 'Sent phone code',
  phone_otp_resent: 'Resent phone code',
  phone_otp_skipped_system: 'Phone verified (system)',
  email_verification_resent: 'Resent verification email',
  password_reset_requested: 'Requested password reset',
  password_reset_completed: 'Reset password',
  http_get: 'GET',
  http_post: 'POST',
  http_put: 'PUT',
  http_delete: 'DELETE',
  http_patch: 'PATCH',
  redeem: 'Redeemed',
  renewal: 'Renewed',
  mark_lost: 'Marked as lost',
  mark_found: 'Marked as found',
  mark_terminal: 'Marked as terminal',
  forward: 'Forwarded',
  resolve: 'Resolved',
  toggle_mfa: 'Toggled MFA',
  toggle_skip_otp: 'Toggled skip OTP',
  soft_delete: 'Soft-deleted',
  hard_delete: 'Deleted',
  lock: 'Locked',
  unlock: 'Unlocked',
  reset_password: 'Reset password',
  assign_role: 'Assigned role',
  update_user: 'Updated user',
  create_shipment: 'Created shipment',
  mark_delivered: 'Marked as delivered',
  confirmed: 'Confirmed',
};

export function getFieldDisplayName(field: string): string {
  return FIELD_LABELS[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

export function getEntityDisplayName(resourceType?: string): string {
  if (!resourceType) return '—';
  return ENTITY_LABELS[resourceType] || formatLabel(resourceType);
}

export function getActionDisplayName(action: string): string {
  return ACTION_LABELS[action] || formatLabel(action);
}

function formatLabel(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Get actual changed fields, handling nested objects.
 * Returns only fields where values actually differ.
 */
export function getActualChanges(
  beforeState?: Record<string, unknown>,
  afterState?: Record<string, unknown>,
  changedFields?: Array<{ field: string; before: unknown; after: unknown; sensitive?: boolean }>
): ActualChange[] {
  // If explicit changedFields exist, use them (filtering out unchanged)
  if (changedFields && changedFields.length > 0) {
    return changedFields
      .filter((f) => {
        const b = formatAuditValue(f.before);
        const a = formatAuditValue(f.after);
        return b !== a;
      })
      .map((f) => {
        const b = formatAuditValue(f.before);
        const a = formatAuditValue(f.after);
        return {
          field: f.field,
          label: getFieldDisplayName(f.field),
          before: b,
          after: a,
          type: (b === '—' ? 'added' : a === '—' ? 'removed' : 'changed') as ActualChange['type'],
        };
      });
  }

  // Fall back to comparing beforeState/afterState
  if (!beforeState || !afterState) return [];

  const changes: ActualChange[] = [];
  const allKeys = new Set([...Object.keys(beforeState), ...Object.keys(afterState)]);

  for (const key of allKeys) {
    if (['_id', '__v', 'updatedAt', 'createdAt'].includes(key)) continue;

    const beforeVal = beforeState[key];
    const afterVal = afterState[key];

    // Handle nested objects (address, emergencyContact)
    if (typeof beforeVal === 'object' && beforeVal !== null && typeof afterVal === 'object' && afterVal !== null) {
      const nestedKeys = new Set([...Object.keys(beforeVal as Record<string, unknown>), ...Object.keys(afterVal as Record<string, unknown>)]);
      for (const nk of nestedKeys) {
        const b = formatAuditValue((beforeVal as Record<string, unknown>)[nk]);
        const a = formatAuditValue((afterVal as Record<string, unknown>)[nk]);
        if (b !== a) {
          const fullField = `${key}.${nk}`;
          changes.push({
            field: fullField,
            label: getFieldDisplayName(fullField),
            before: b,
            after: a,
            type: (b === '—' ? 'added' : a === '—' ? 'removed' : 'changed'),
          });
        }
      }
    } else {
      const b = formatAuditValue(beforeVal);
      const a = formatAuditValue(afterVal);
      if (b !== a) {
        changes.push({
          field: key,
          label: getFieldDisplayName(key),
          before: b,
          after: a,
          type: (b === '—' ? 'added' : a === '—' ? 'removed' : 'changed'),
        });
      }
    }
  }

  return changes;
}
