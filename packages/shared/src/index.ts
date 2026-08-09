// ============================================================
// PawTag Shared Types
// ============================================================

export * from './constants';

// --- Enums & Constants ---

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  SUPPORT = 'support',
  CUSTOMER = 'customer',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum PetStatus {
  SAFE = 'safe',
  LOST = 'lost',
  FOUND = 'found',
  DECEASED = 'deceased',
  STOLEN = 'stolen',
  TRANSFERRED = 'transferred',
  DONATED = 'donated',
  SOLD = 'sold',
}

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum TagStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LOST = 'lost',
}

export enum NotificationType {
  PET_LOST = 'pet_lost',
  PET_FOUND = 'pet_found',
  FINDER_SCAN = 'finder_scan',
  ORDER_UPDATE = 'order_update',
  SYSTEM = 'system',
  FINDER_REMINDER = 'finder_reminder',
  SUBSCRIPTION_EXPIRING = 'subscription_expiring',
  REFERRAL_REWARD = 'referral_reward',
  TAG_EXPIRY_WARNING = 'tag_expiry_warning',
}

export enum FinderAction {
  VIEWED = 'viewed',
  NOTIFIED_OWNER = 'notified_owner',
  SHARED_LOCATION = 'shared_location',
}

export enum ContentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  GRACE_PERIOD = 'grace_period',
  CANCELLED = 'cancelled',
  PENDING_PAYMENT = 'pending_payment',
}

export enum SubscriptionPlanType {
  ANNUAL = 'annual',
  MONTHLY = 'monthly',
  FREE = 'free',
}

export enum InvoiceStatus {
  PAID = 'paid',
  PENDING = 'pending',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// --- Core Models ---

export interface User {
  _id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phoneNumber?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  profilePicture?: string;
  address?: Address;
  emergencyContact?: EmergencyContact;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  email?: string;
  relationship: string;
}

export interface PetPhoto {
  url: string;
  caption?: string;
  isMain: boolean;
  addedAt: string;
}

// --- Health Record Types ---

export interface Vaccination {
  vaccine: string;
  vaccineType: 'core' | 'non-core' | 'other';
  dateGiven: string;
  nextDueDate?: string;
  vetClinic?: string;
  batchLotNumber?: string;
  veterinarian?: string;
  notes?: string;
}

export interface PetMicrochip {
  chipNumber: string;
  brand?: string;
  implantDate?: string;
  implantLocation?: string;
  implantedBy?: string;
  notes?: string;
}

export interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
  prescribedBy?: string;
  reason?: string;
  notes?: string;
}

export interface Allergy {
  allergen: string;
  severity: 'mild' | 'moderate' | 'severe';
  reaction?: string;
  diagnosedBy?: string;
  notes?: string;
}

export interface VetDetail {
  clinicName: string;
  address?: string;
  phone?: string;
  email?: string;
  veterinarian?: string;
  isPrimary: boolean;
  notes?: string;
}

export interface Surgery {
  procedure: string;
  date: string;
  performedBy?: string;
  clinic?: string;
  reason?: string;
  recoveryNotes?: string;
  notes?: string;
}

export interface WeightRecord {
  weight: number;
  date: string;
  notes?: string;
}

export interface HealthCondition {
  condition: string;
  severity: 'mild' | 'moderate' | 'severe' | 'chronic';
  diagnosedDate?: string;
  diagnosedBy?: string;
  treatment?: string;
  notes?: string;
}

export interface Desexing {
  isDesexed: boolean;
  date?: string;
  performedBy?: string;
  clinic?: string;
  notes?: string;
}

export interface Pet {
  _id: string;
  petId: string;            // auto-generated: XX-6digits+gender+breed+color
  ownerId: string;
  name: string;
  petType: string;          // Dog, Cat, Rabbit, Hamster, Guinea Pig, Bird
  species: string;          // kept for backward compat
  breed: string;
  secondaryBreed?: string;  // when breed is "Mixed Breed"
  gender: 'male' | 'female' | 'unknown';
  dateOfBirth?: string;
  age?: number;             // computed or manually entered (in years)
  weight?: number;
  color: string;
  pattern?: string;
  favouriteFood?: string;
  photos: PetPhoto[];       // up to 5 photos
  photoUrl?: string;        // kept for backward compat (legacy single photo)
  medicalAlerts?: string;
  microchipId?: string;
  status: PetStatus;
  isNeutered: boolean;
  notes?: string;
  lostCount?: number;
  foundByFinderAt?: string;
  deletedAt?: string;
  // Health records
  vaccinations: Vaccination[];
  microchips: PetMicrochip[];
  medications: Medication[];
  allergies: Allergy[];
  vetDetails: VetDetail[];
  surgeries: Surgery[];
  weightHistory: WeightRecord[];
  healthConditions: HealthCondition[];
  desexing: Desexing;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  _id: string;
  tagId: string;          // Human-readable ID like PT-123456
  petId?: string;
  ownerId?: string;
  orderId?: string;
  nfcEnabled?: boolean;
  replacesTagId?: string;
  replacedByTagId?: string;
  status: TagStatus;
  qrCodeUrl?: string;
  tagType?: 'qr' | 'nfc';
  lastScannedAt?: string;
  lastScanLocation?: GeoLocation;
  subscriptionStatus?: 'active' | 'inactive' | 'grace_period' | 'expired' | 'none';
  subscriptionId?: string;
  activatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  _id: string;
  userId: string;
  tagId: string;
  orderId?: string;
  planId?: string;
  planName: string;
  planType: SubscriptionPlanType;
  status: SubscriptionStatus;
  price: number;
  currency: string;
  startDate: string;
  freePeriodEndsAt?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodEndsAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  autoRenew: boolean;
  renewalMethod: 'annual' | 'monthly';
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  nextPaymentDate?: string;
  lastScannedAt?: string;
  totalScans: number;
  reminderStates?: SubscriptionReminderStates;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SubscriptionReminderStates {
  reminder30dSent?: boolean;
  reminder7dSent?: boolean;
  reminder1dSent?: boolean;
  graceWeeklySentCount: number;
  lastGraceReminderAt?: string;
}

export interface Invoice {
  _id: string;
  subscriptionId?: string;
  orderId?: string;
  userId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  stripeInvoiceId?: string;
  stripePaymentIntentId?: string;
  paymentMethod?: string;
  billingPeriod?: {
    start: string;
    end: string;
  };
  paidAt?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source: 'gps' | 'qr_scan' | 'manual';
}

export interface LocationEvent {
  _id: string;
  tagId: string;
  petId: string;
  ownerId: string;
  timestamp: string;
  location: GeoLocation;
  finderId?: string;
  notes?: string;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  shortDescription?: string;
  price: number;
  currency: string;
  images: string[];
  category: string;
  tags: string[];
  isActive: boolean;
  stock: number;
  sku: string;
  weight?: number;
  dimensions?: ProductDimensions;
  variants?: ProductVariant[];
  customizable?: boolean;
  customizationPrice?: number;
  shippingCost?: number;
  warrantyMonths?: number;
  isSubscription?: boolean;
  isTagProduct?: boolean;
  subscriptionConfig?: SubscriptionConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  name: string;
  sku: string;
  price: number;
  stock: number;
  image?: string;
  attributes: Record<string, string>;
}

export interface SubscriptionConfig {
  type: 'annual' | 'monthly';
  freePeriodMonths: number;
  gracePeriodWeeks: number;
  monthlyPrice?: number;
  stripePriceId?: string;
  features: string[];
}

export interface ProductDimensions {
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'in';
}

export interface Order {
  _id: string;
  orderNumber: string;    // Human-readable order number
  userId: string;
  items: OrderItem[];
  status: OrderStatus;
  payment: PaymentInfo;
  shippingAddress: Address;
  billingAddress?: Address;
  trackingNumber?: string;
  notes?: string;
  discount?: {
    percent: number;
    amount: number;
    reason: string;
  };
  referredByCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantName?: string;
  petName?: string;
  customizationTotal?: number;
}

export interface PaymentInfo {
  method: 'card' | 'paypal' | 'bank_transfer';
  status: PaymentStatus;
  transactionId?: string;
  amount: number;
  currency: string;
  paidAt?: string;
}

export interface FinderScan {
  _id: string;
  tagId: string;
  petId: string;
  scannedBy?: string;     // IP or user agent if anonymous
  deviceInfo: string;
  location?: GeoLocation;
  action: FinderAction;
  notifiedAt?: string;
  contactAttempted: boolean;
  createdAt: string;
}

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  priority?: 'low' | 'normal' | 'high';
  actionUrl?: string;
  channel?: 'info' | 'alert' | 'reminder' | 'marketing';
  createdAt: string;
}

export interface SiteContent {
  _id: string;
  slug: string;
  title: string;
  body: string;
  status: ContentStatus;
  metaTitle?: string;
  metaDescription?: string;
  createdBy: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Setting {
  _id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
  updatedBy: string;
  updatedAt: string;
}

export interface FeatureFlag {
  _id: string;
  key: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  allowedRoles?: UserRole[];
  percentage?: number;     // Rollout percentage
  createdAt: string;
  updatedAt: string;
}

// --- RBAC Types ---

export interface RoleType {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  roleType: 'system' | 'custom';
  isSystemRole: boolean;
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionGroupType {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionType {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  resource: string;
  action: string;
  permissionGroupId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionScopeType {
  _id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleAssignment {
  _id: string;
  userId: string;
  roleId: string;
  assignedAt: string;
  assignedBy: string;
  expiresAt?: string;
  isActive: boolean;
  role?: RoleType;
}

export interface RolePermissionAssignment {
  _id: string;
  roleId: string;
  permissionId: string;
  scopeId?: string;
  createdAt: string;
  permission?: PermissionType;
  scope?: PermissionScopeType;
}

export interface EffectivePermission {
  permission: PermissionType;
  scope?: PermissionScopeType;
  permissionGroup: PermissionGroupType;
  role: RoleType;
}

// --- API Types ---

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<User, 'passwordHash'>;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

// --- Finder Portal Types ---

export interface FinderPortalData {
  pet: Pet;
  tag: Tag;
  ownerName: string;
  ownerPhone?: string;
  ownerEmail?: string;
  emergencyContacts?: EmergencyContact[];
}

// --- Admin Dashboard Types ---

export interface AdminDashboardStats {
  totalUsers: number;
  totalPets: number;
  totalTags: number;
  totalOrders: number;
  totalRevenue: number;
  lostPets: number;
  recentScans: number;
  recentOrders: Order[];
}

// --- Order Status Utilities ---

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-700',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const ORDER_STATUS_STEPS = ['pending', 'paid', 'shipped', 'delivered'];

export function getOrderStatusColor(status: string): string {
  return ORDER_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
}

export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] || status;
}

// --- Subscription Status Utilities ---

export const SUBSCRIPTION_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  grace_period: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-700',
  pending_payment: 'bg-orange-100 text-orange-700',
  none: 'bg-gray-100 text-gray-500',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  expired: 'Expired',
  grace_period: 'Grace Period',
  cancelled: 'Cancelled',
  pending_payment: 'Pending Payment',
  none: 'No Subscription',
};

export function getSubscriptionStatusColor(status: string): string {
  return SUBSCRIPTION_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
}

export function getSubscriptionStatusLabel(status: string): string {
  return SUBSCRIPTION_STATUS_LABELS[status] || status;
}

export function isTagActiveForFinder(subscriptionStatus?: string): boolean {
  return subscriptionStatus === 'active' || subscriptionStatus === 'grace_period';
}

// --- Subscription Plan Constants ---

export const SUBSCRIPTION_PLANS = {
  annual: {
    name: 'PawTag Annual',
    price: 0.99,
    billingCycle: 'yearly',
    totalPrice: 11.88,
    freePeriodMonths: 12,
    gracePeriodWeeks: 4,
  },
  monthly: {
    name: 'PawTag Monthly',
    price: 1.99,
    billingCycle: 'monthly',
    totalPrice: 1.99,
    freePeriodMonths: 12,
    gracePeriodWeeks: 4,
  },
} as const;

// --- Referral Types ---

export interface ReferralCode {
  _id: string;
  userId: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export interface Referral {
  _id: string;
  referrerId: string;
  refereeId: string;
  referralCode: string;
  status: 'pending' | 'completed' | 'rewarded';
  referrerRewardMonths: number;
  refereeRewardMonths: number;
  orderId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalRewardMonths: number;
}

// --- Push Token Types ---

export interface PushToken {
  _id: string;
  userId: string;
  token: string;
  platform: 'web' | 'ios' | 'android';
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string;
}

// --- Tag Expiry Notification Types ---

export interface TagExpiryNotification {
  _id: string;
  subscriptionId: string;
  tagId: string;
  ownerId: string;
  daysUntilExpiry: number;
  notifiedAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

// --- Bundle Pricing ---

export const BUNDLE_DISCOUNTS = {
  2: 10,
  3: 15,
} as const;

export function getBundleDiscount(itemCount: number): number {
  if (itemCount >= 3) return BUNDLE_DISCOUNTS[3];
  if (itemCount >= 2) return BUNDLE_DISCOUNTS[2];
  return 0;
}
