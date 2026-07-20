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
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  payment: {
    method: string;
    status: string;
    amount: number;
    currency: string;
  };
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
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
  rbacRoles?: Array<{ name: string; displayName: string }>;
}