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
  petId: string;
  ownerId: string;
  status: TagStatus;
  qrCodeUrl?: string;
  lastScannedAt?: string;
  lastScanLocation?: GeoLocation;
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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
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

export interface AuditLog {
  _id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
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
