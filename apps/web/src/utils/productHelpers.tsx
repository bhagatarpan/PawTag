import { Smartphone, Wifi, Zap } from 'lucide-react';
import React from 'react';

export interface ProductBadge {
  label: string;
  color: string;
}

const PRODUCT_BADGES: Record<string, ProductBadge> = {
  'PT-SCAN-001': { label: 'Essential', color: 'bg-blue-100 text-blue-700' },
  'PT-CLASSIC-001': { label: 'Most Ordered', color: 'bg-amber-100 text-amber-700' },
  'PT-PLUS-001': { label: 'Premium', color: 'bg-purple-100 text-purple-700' },
};

export function getProductBadge(sku: string): ProductBadge | null {
  return PRODUCT_BADGES[sku.toUpperCase()] || null;
}

export function getProductIcon(sku: string, size: 'sm' | 'md' | 'lg' = 'md'): React.ReactNode {
  const className = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-12 w-12' : 'h-8 w-8';
  const upper = sku.toUpperCase();
  if (upper === 'PT-SCAN-001') return <Smartphone className={className} />;
  if (upper === 'PT-PLUS-001') return <Zap className={className} />;
  return <Wifi className={className} />;
}
