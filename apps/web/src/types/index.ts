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
  dimensions?: { length: number; width: number; height: number; unit: 'cm' | 'in' };
  shippingCost?: number;
  warrantyMonths?: number;
  isSubscription?: boolean;
  subscriptionConfig?: {
    type: 'annual' | 'monthly';
    freePeriodMonths: number;
    gracePeriodWeeks: number;
    monthlyPrice?: number;
    features: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  petName?: string;
  variant?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  userId: string;
  items: Array<{
    productId: string;
    productName: string;
    variantName?: string;
    petName?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  status: 'pending' | 'pending_payment' | 'paid' | 'packing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  payment: {
    method: 'card' | 'paypal' | 'bank_transfer';
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    transactionId?: string;
    amount: number;
    currency: string;
    paidAt?: string;
  };
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  trackingNumber?: string;
  carrier?: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phoneNumber?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  emergencyContact?: {
    name: string;
    phone: string;
    email: string;
    relationship: string;
  };
  status?: string;
  mfaEnabled?: boolean;
  rbacRoles?: Array<{ name: string; displayName: string }>;
  profilePicture?: string;
  lastLogin?: string;
}

export interface Pet {
  _id: string;
  name: string;
  petId: string;
  petType: string;
  breed: string;
  secondaryBreed?: string;
  color: string;
  pattern?: string;
  gender?: string;
  birthday?: string;
  age?: string;
  favouriteFood?: string;
  medicalAlerts?: string;
  status: 'safe' | 'lost' | 'found' | 'deceased' | 'stolen' | 'transferred' | 'donated' | 'sold';
  photos: Array<{ url: string; caption?: string; isMain?: boolean }>;
  mainPhoto?: string;
  tagId?: { _id: string; tagId: string; status: string; tagType: string };
  subscription?: { status: string; planName: string; currentPeriodEnd: string };
  lostSince?: string;
  foundAt?: string;
  createdAt: string;
}

export interface Tag {
  _id: string;
  tagId: string;
  tagType: 'qr' | 'nfc';
  status: 'active' | 'inactive' | 'lost' | 'unredeemed';
  petId?: { _id: string; name: string; petType: string };
  subscription?: { status: string; planName: string; currentPeriodEnd: string };
  lastScannedAt?: string;
  createdAt: string;
}

export interface Subscription {
  _id: string;
  tagId: { tagId: string; status: string; tagType: string };
  planName: string;
  planType: string;
  status: string;
  price: number;
  startDate: string;
  freePeriodEndsAt?: string;
  currentPeriodEnd: string;
  gracePeriodEndsAt?: string;
  cancelledAt?: string;
  autoRenew: boolean;
  renewalMethod: string;
  totalScans: number;
  lastScannedAt?: string;
  nextPaymentDate?: string;
  petName?: string;
  petType?: string;
  productName?: string;
  createdAt: string;
}

export interface Notification {
  _id: string;
  type: 'pet_lost' | 'pet_found' | 'finder_reminder' | 'finder_scan' | 'order_update' | 'subscription_reminder' | 'referral' | 'system';
  title: string;
  message: string;
  read: boolean;
  priority?: 'high' | 'normal';
  data?: {
    petId?: string;
    petName?: string;
    finderPhone?: string;
    finderEmail?: string;
    finderName?: string;
    foundAt?: string;
    location?: { lat: number; lng: number; address?: string };
  };
  createdAt: string;
}

export interface DashboardData {
  pets: Pet[];
  tags: Tag[];
  subscriptions: Subscription[];
  recentOrders: Order[];
  unreadNotifications: number;
  responsibilityScore?: number;
}